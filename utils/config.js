require('dotenv').config();

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const SECRET = process.env.SECRET;
const HOST = process.env.HOST;

module.exports = { PORT, MONGODB_URI, SECRET, HOST };