const Resource = require('../models/resource');
const path = require('path');

// Función auxiliar para buscar o crear la jerarquía de carpetas en MongoDB
async function getOrCreateFolderStructure(relativePath, rootParentId, userId) {
  // Dividimos la ruta "mi-carpeta/css/estilo.css" -> ["mi-carpeta", "css"]
  const parts = relativePath.split('/').slice(0, -1);
  
  let currentParentId = rootParentId;

  // Recorremos cada carpeta en la ruta
  for (let i = 0; i < parts.length; i++) {
    const folderName = parts[i];

    // Buscamos si la carpeta ya fue creada en MongoDB dentro del nivel actual
    let folder = await Resource.findOne({
      name: folderName,
      type: 'folder',
      owner: userId,
      parent: currentParentId
    });

    // Si no existe el documento en la DB, lo creamos
    if (!folder) {

      const folderRelativePath = parts.slice(0, i + 1).join('/');
      const folderPathOnDisk = path.join(__dirname, '../uploads', folderRelativePath);

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

    // Avanzamos el puntero para que el siguiente nivel apunte a esta carpeta
    currentParentId = folder._id;
  }

  // Retorna el _id de la carpeta contenedora final donde irá el archivo
  return currentParentId;
}

module.exports = getOrCreateFolderStructure;