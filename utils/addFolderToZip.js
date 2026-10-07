const Resource = require('../models/resource');
const path = require('path');
const fs = require('fs');

//funcion recursiva para ñadir archivos y subcarpetas al archivo ZIP
const addFolderToZip = async (folderId, zipArchive, currentPathInZip = '') => {
  //obtener otods los elementos cuyo padre sea la carpeta actual
  const children = await Resource.find({ parent: folderId });

  for (const item of children) {
    const itemZipPath = path.join(currentPathInZip, item.name);

    if (item.type === 'file') {
      //si el archivo existe fisicamente en el servidor, se adjunta al ZIP
      if (fs.existsSync(item.pathOnDisk)) {
        zipArchive.file(item.pathOnDisk, { name: itemZipPath });
      }
    } else if (item.type === 'folder') {
      //si es una subcarpeta llamada recursiva para incluir su contenido
      await addFolderToZip(item._id, zipArchive, itemZipPath);
    }
  }
};

module.exports = addFolderToZip;