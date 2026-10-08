const express = require('express');
const mongoose = require('mongoose');
const app = express();
const config = require('./utils/config');
const middlewares = require('./utils/middlewares/generals');

const authRouter = require('./controllers/authController');
const usersRouter = require('./controllers/usersController');
const resourcesRouter = require('./controllers/resourcesController');
const cors = require('cors');

console.log('conectando a', config.MONGODB_URI);


const connectionToDb = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('conexion con éxito a MongoDB');
  } catch (err) {
    console.log('No se pudo conectar:', err.message);
  }
}

connectionToDb();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', middlewares.tokenExtractor, middlewares.userExtractor, usersRouter);
app.use('/api/resources', middlewares.tokenExtractor, middlewares.userExtractor, resourcesRouter);

app.use(middlewares.unknowEndpoint);
app.use(middlewares.errorHandler);

module.exports = app;
