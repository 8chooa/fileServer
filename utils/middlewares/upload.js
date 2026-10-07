const multer = require('multer');
const path = require('path');
const fs = require('fs');

const FILEPATH = __dirname;

const uploadDir = path.join(FILEPATH, '../../uploads')

if (!fs.existsSync(uploadDir)) { //si no existe el directorio lo crea
  fs.mkdirSync(uploadDir, { recursive: true });
}

// const storage = multer.diskStorage({
//   destination: (request, file, callback) => {
//     callback(null, uploadDir);
//   },
//   filename: (request, file, callback) => {
//     const extension = path.extname(file.originalname);
//     const baseName = path.basename(file.originalname, extension);

//     //logica para agregar el numero de archivo (en caso de que esté repetido)
//     let finalName = file.originalname;
//     let fullPath = path.join(uploadDir, finalName);
//     let counter = 1;

//     while (fs.existsSync(fullPath)) { //si ya existe un archivo con ese nombre entra
//       finalName = `${baseName} (${counter})${extension}`;
//       fullPath = path.join(uploadDir, finalName);
//       counter++;
//     }
//     callback(null, finalName);
//   }
// });

const storage = multer.memoryStorage(); //guardamos temporalmente en la memoria

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10} //10 MB
});

module.exports = upload;