const uploadRouter = require('express').Router();
const uploadFiles = require('../utils/middlewares/upload');

uploadRouter.post('/', uploadFiles, (request, response) => {
  if (!request.files || request.files.length === 0) {
    return response.status(400).json({ error: 'no se recibieron archivos!' });
  }
  console.log('hola desde uploadRouter');
  if (request.files.length === 1) {
    console.log('se recibio un archivo!');
    console.log(request.files[0]);
    return response.send(`se recibio un archivo ${request.files[0].originalname}`)
  } else {
    console.log('se recibieron ', request.files.length, ' archivos');
    console.log(request.files);
    const names = request.files.map(file => file.originalname);
    return response.send(`se recibieron los archivos ${names.join(' ')}`);
  }
});

module.exports = uploadRouter;