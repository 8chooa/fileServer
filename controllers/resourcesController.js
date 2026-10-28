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
const mongoose = require('mongoose');
const uniqueName = require('../utils/uniqueName');

const { notifyClients } = require('../utils/notifyChanges');

let sseClients = [];

// endpoint que se conecta con el frontend mediante EventSource (la conexion se mantendrá abierta indefinidamente)
resourcesRouter.get('/events', (request, response) => {
  // configuramos cabeceras para SSE (Server Sent Event)
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache'); // ?
  response.setHeader('Connection', 'keep-alive') // ?

  response.flushHeaders(); // evitar timeouts agresivos de proxies o redes locales

  sseClients.push(response);
  console.log('Cliente conectado a SSE. Total:', sseClients.length);

  // se dispara automáticamente con el evento 'close'
  request.on('close', () => {
    sseClients = sseClients.filter(client => client !== response); // ?
    console.log('Cliente desconectado de SSE. Total:', sseClients.length); // ?
  });
});

resourcesRouter.post('/upload', upload.array('files'), async (request, response) => {
  const writtenFilesOnDisk = [];
  const createdResourceIds = [];

  try {
    const files = request.files;
    const userId = request.user.id;
    const parentId = request.body.parentId;

    if (!files || files.length === 0) {
      return response.status(400).json({ message: 'no se subió ningun archivo' });
    }

    // Normalizamos paths para asegurarnos de que siempre sea un array del mismo tamaño que files
    let relativePaths = request.body.paths;
    if (!relativePaths) {
      relativePaths = files.map(file => file.originalname);
    } else if (typeof relativePaths === 'string') {
      relativePaths = [relativePaths];
    }

    const savedResources = [];
    const folderCache = new Map();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = relativePaths[i] || file.originalname;

      // Si la ruta incluye barras '/', asumimos que es una estructura de carpetas
      let fileParentId = parentId;
      if (relativePath.includes('/')) {
        // Nota: Asegúrate de quitar la sesión también de getOrCreateFolderStructure si la recibía
        fileParentId = await getOrCreateFolderStructure(relativePath, parentId, userId, folderCache);
      }

      const newName = await uniqueName(file.originalname, fileParentId);
      let fileRelativePath = newName;
      let fullPathOnDisk;

      if (fileParentId) {
        // Quitamos .session(session) porque ya no usamos transacciones nativas
        const parentFolder = await Resource.findById(fileParentId);
        if (!parentFolder) {
          throw new Error('La carpeta contenedora no existe');
        }
        fullPathOnDisk = path.join(parentFolder.pathOnDisk, newName);
        fileRelativePath = path.join(parentFolder.relativePath, newName);
      } else {
        fullPathOnDisk = path.join(STORAGE_BASE, newName);
      }

      if (!fs.existsSync(path.dirname(fullPathOnDisk))) {
        fs.mkdirSync(path.dirname(fullPathOnDisk), { recursive: true });
      }

      // Escribimos en disco y guardamos rastro físico
      fs.writeFileSync(fullPathOnDisk, file.buffer);
      writtenFilesOnDisk.push(fullPathOnDisk);

      let newResource = new Resource({
        name: newName,
        type: 'file',
        mimeType: file.mimetype,
        size: file.size,
        pathOnDisk: fullPathOnDisk,
        relativePath: fileRelativePath,
        parent: fileParentId,
        owner: userId
      });

      // Guardamos sin { session } y guardamos el ID para un posible rollback
      const resourceSaved = await newResource.save();
      createdResourceIds.push(resourceSaved._id);

      await resourceSaved.populate('owner', 'name');
      savedResources.push(resourceSaved);
    }

    notifyClients(sseClients, { type: 'RESOURCE_CREATED', parentId: parentId });

    return response.status(201).json({
      message: 'Recursos subidos y guardados con exito',
      resources: savedResources,
    });

  } catch (error) {
    console.log('error al subir recursos, iniciando rollback...', error);

    // 1. Rollback en la Base de Datos: Borramos todos los recursos creados en esta tanda
    if (createdResourceIds.length > 0) {
      try {
        await Resource.deleteMany({ _id: { $in: createdResourceIds } });
      } catch (dbRollbackErr) {
        console.error('Error al hacer rollback en la Base de Datos:', dbRollbackErr);
      }
    }

    // 2. Rollback en el Disco: Limpiamos los archivos físicos que se alcanzaron a escribir
    for (const filePath of writtenFilesOnDisk) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('Error al limpiar archivo huerfano en disco:', unlinkErr);
        }
      }
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      console.log('el archivo supera el limite de peso!');
      return response.status(413).json({ error: 'El archivo excede el limite de peso permitido' });
    }

    return response.status(500).json({ error: error.message || 'error interno al procesar la subida' });
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
    notifyClients(sseClients, { type: 'RESOURCE_DELETED' });
    response.status(200).json({ message: 'Recurso y su contenido eliminado correctamente' });
  } catch (error) {
    console.log('error al eliminar el recurso:', error);
    response.status(500).json({ message: 'Ha ocurrido un error interno al eliminar el recurso' });
  }

});

//controlador de ruta solo para carpetas
resourcesRouter.get('/:id', async (request, response) => {
  try {
    const id = request.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({ message: 'ID no valido' });
    }
    
    const currentFolder = await Resource.findOne({ _id: id });

    if (!currentFolder || currentFolder.type !== 'folder') {
      return response.status(404).json({ message: 'Carpeta no encontrada' });
    }

    const ancestors = [];
    let parentId = currentFolder.parent;

    while (parentId) {
      const parentFolder = await Resource.findById(parentId);

      if (!parentFolder) break;

      ancestors.push({ id: parentFolder._id, name: parentFolder.name });
      parentId = parentFolder.parent;
    }

    ancestors.reverse(); //invertimos el orden: [Raiz, ..., PadreDirecto]

    return response.json({ ...currentFolder.toJSON(), ancestors });

  } catch (error) {
    return response.status(500).json({ error: 'Error interno del servidor al obtener el recuro especifico' });
  }
});

module.exports = resourcesRouter;