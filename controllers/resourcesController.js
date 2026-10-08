const resourcesRouter = require('express').Router();
const upload = require('../utils/middlewares/upload');

const path = require('path');
const fs = require('fs');
const Resource = require('../models/resource');
const getOrCreateFolderStructure = require('../utils/folderStructure');

const STORAGE_BASE = path.join(__dirname, '../uploads');

const { ZipArchive  } = require('archiver'); //para comprimir como .zip las carpetas
const addFolderToZip = require('../utils/addFolderToZip');

const deleteResourceRecursive = require('../utils/deleteResourceRecursive');

resourcesRouter.post('/upload', upload.array('files', 50), async (request, response) => {
  try {
    const files = request.files;
    const userId = request.user.id;

    const parentId = request.body.parentId; //para id de la carpeta padre (en caso de haber lo gestiona el frontend)

    if (!files || files.length === 0) {
      return response.status(400).json({ message: 'no se subió ningun archivo' });
    }

    let relativePaths = request.body.paths; 
    //nota: las rutas enviadas desde el formulario del cliente (para casos de varios archivos) es un array de n rutas para n archivos, si es un solo archivo es un string con la ruta

    if (typeof relativePaths === 'string') {
      relativePaths = [relativePaths]; //eJ: de "hola" a ["hola"]
    }

    const savedResources = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const relativePath = (relativePaths && relativePaths[i])
      ? relativePaths[i]
      : file.originalname;

      const fileParentId = (relativePaths && relativePaths[i])
      ? await getOrCreateFolderStructure(relativePath, parentId, userId)
      : parentId;


      const fullPathOnDisk = path.join(STORAGE_BASE, relativePath); //unimos para generar la ruta completa

      const dirPath = path.dirname(fullPathOnDisk) //quitamos el archivo del final y quedamos con las rutas del directorio

      if (!fs.existsSync(dirPath)) { //si no existe la ruta
        fs.mkdirSync(dirPath, { recursive: true }); //crea todas las carpetas que no existan de la ruta
      }

      fs.writeFileSync(fullPathOnDisk, file.buffer); //escribimos el archivo

      let newResource = new Resource({
        name: file.originalname,
        type: 'file',
        mimeType: file.mimetype,
        size: file.size,
        pathOnDisk: fullPathOnDisk,
        relativePath: relativePath,
        parent: fileParentId, //id de la carpeta contenedora del archivo
        owner: userId
      });

      const resourceSaved = await newResource.save();
      await resourceSaved.populate('owner', 'name');

      savedResources.push(resourceSaved);
    }

    return response.status(201).json({
      message: 'Recursos subidos y guardados con exito',
      resources: savedResources,
    });

  } catch (error) {
    console.log('error al subir recursos', error);
    return response.status(500).json({ error: 'error interno al procesar la subida' });
  }
});

resourcesRouter.get('/', async (request, response) =>{
  try {

    //si viene ?parent=ID mostramos el contenido de esa carpeta, sino mostramos el de la carpeta raiz (parent: null)
    const parentId = request.query.parent || null;

    const resources = await Resource.find({ parent: parentId })
      .populate('owner', 'name') //traemos los datos del creador para saber de quien es cada archivo
      .sort({ type: -1, name: 1 }); //primero carpetas, luego archivos

    return response.status(200).json(resources);
  } catch (error) {
    return response.status(500).json({ error: 'error interno al obtener los recursos' });
  }
});

resourcesRouter.get('/download/:id', async (request, response) => {
  try {
    const id = request.params.id;

    const resource = await Resource.findById(id);

    if (!resource) {
      return response.status(404).json({ message: 'El recurso solicitado no existe' });
    }

    //Caso A: descarga de un archivo individual
    if (resource.type === 'file') {
      if (!fs.existsSync(resource.pathOnDisk)) {
        return response.status(404).json({ message: 'El archivo fisico no se encuentra en el servidor' });
      }

      return response.download(resource.pathOnDisk, resource.name);
    }

    //caso B: descarga de una carpeta (compresion ZIP al vuelo)
    if (resource.type === 'folder') {
      const zipFileName = `${resource.name}.zip`;

      response.attachment(zipFileName); //establece el valor de Content-Disposition con attachmente (indica al navegador que el contenido será descargado)
      response.setHeader('Content-Type', 'application/zip');


      const archive = new ZipArchive('zip', {
        zlib: { level: 9 } //nivel mas alto de comprension (gasta mas recursos pero los archivos ocupan menos)
      });

      archive.on('error', (err) => { //manejo de errores durante la compresión
        console.log('error durante la compresion ZIP:', err);
        if (!response.headersSent) {
          return response.status(500).json({ message: 'error al generar el archivo comprimido' });
        }
      });

      archive.pipe(response); //conectamos la salida del compresor directo con la respuesta http

      await addFolderToZip(resource._id, archive, resource.name);

      await archive.finalize(); //finaliza la transmision del ZIP
    }

  } catch (error) {
    console.log('error al descargar el recurso:', error);
    if (!response.headersSent) {
      return response.status(500).json({ error: 'error interno al procesar la descarga' });
    }
  }
});

resourcesRouter.delete('/:id', async (request, response) => {
  try {
    const id = request.params.id;
    const userId = request.user.id;

    const resource = await Resource.findById(id);

    if (!resource) {
      return response.status(404).json({ message: 'No se ha encontrado el recurso solicitado' });
    }

    if (resource.owner.toString() !== userId.toString()) {
      return response.status(403).json({ message: 'No tienes permisos para elimnar este recurso' });
    }

    await deleteResourceRecursive(resource);

    response.status(200).json({ message: 'Recurso y su contenido eliminado correctamente' });
  } catch (error) {
    console.log('error al eliminar el recurso:', error);
    response.status(500).json({ message: 'Ha ocurrido un error interno al eliminar el recurso' });
  }

});

resourcesRouter.get('/:id', async (request, response) => {
  const id = request.params.id;
  try {
    const resource = await Resource.findById(id);

    if (!resource) {
      return response.status(404).json({ message: 'Recurso no encontrado' });
    }

    return response.json(resource);
  } catch (error) {
    return response.status(500).json({ error: 'Error interno del servidor al obtener el recuro especifico' });
  }
});

module.exports = resourcesRouter;