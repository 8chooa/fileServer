const Resource = require('../models/resource');
const path = require('path');
const uniqueName = require('./uniqueName');
const fs = require('fs');

// Función auxiliar para buscar o crear la jerarquía de carpetas en MongoDB
async function getOrCreateFolderStructure(relativePath, rootParentId, userId, folderCache = new Map()) {
  // Dividimos la ruta "mi-carpeta/css/estilo.css" -> ["mi-carpeta", "css"]
  const parts = relativePath.split('/').slice(0, -1);
  
  let currentParentId = rootParentId;

  const resolvedParts = [];

  // Recorremos cada carpeta en la ruta
  for (let i = 0; i < parts.length; i++) {
    const originalFolderName = parts[i];

    const cacheKey = `${currentParentId}-${originalFolderName}`;

    if (folderCache.has(cacheKey)) {
      currentParentId = folderCache.get(cacheKey);
      continue;
    }


    const folderName = await uniqueName(originalFolderName, currentParentId);

    resolvedParts.push(folderName);

    // Buscamos si la carpeta ya fue creada en MongoDB dentro del nivel actual
    let folder = await Resource.findOne({
      name: folderName,
      type: 'folder',
      parent: currentParentId
    });

    // Si no existe el documento en la DB, lo creamos
    if (!folder) {

      const folderRelativePath = resolvedParts.join('/');
      const folderPathOnDisk = path.join(__dirname, '../uploads', folderRelativePath);


      if (!fs.existsSync(folderPathOnDisk)) {
        fs.mkdirSync(folderPathOnDisk, { recurisve: true });
      }

      folder = new Resource({
        name: folderName,
        type: 'folder',
        parent: currentParentId,
        owner: userId,
        relativePath: folderRelativePath,
        pathOnDisk: folderPathOnDisk,
      });
      await folder.save();
    }

    folderCache.set(cacheKey, folder._id);
    // Avanzamos el puntero para que el siguiente nivel apunte a esta carpeta
    currentParentId = folder._id;
  }

  // Retorna el _id de la carpeta contenedora final donde irá el archivo
  return currentParentId;
}

module.exports = getOrCreateFolderStructure;