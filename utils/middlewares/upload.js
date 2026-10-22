const multer = require('multer');
const path = require('path');
const fs = require('fs');

const FILEPATH = __dirname;

const uploadDir = path.join(FILEPATH, '../../uploads')

if (!fs.existsSync(uploadDir)) { //si no existe el directorio lo crea
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage(); //guardamos temporalmente en la memoria

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 20} //20 MB
});

module.exports = upload;