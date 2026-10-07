const jwt = require('jsonwebtoken');
const config = require('../config');


const errorHandler = (error, request, response, next) => {
  console.log(error.message);

  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message });
  } else if (error.name === 'CastError') {
    return response.status(400).json({ error: 'id mal formateado' });
  } else if (error.name === 'MongoServerError') {
    return response.status(400).json({ error: error.message });
  }
  next(error); //dejamos paso al manejador de errores de node
}

const unknowEndpoint = (request, response) => {
  response.status(404).json({ error: 'endpoint desconocido' });
}

const tokenExtractor = (request, response, next) => {
  const authorization = request.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    request.token = authorization.replace('Bearer ', '');
  } else {
    request.token = null;
    return response.status(400).json({error: 'falta token o esquema de token incorrecto'});
  }
  next();
}

const userExtractor = (request, response, next) => {
  if (!request.token) {
    return request.user = null;
  } else {
    const decodedToken = jwt.verify(request.token, config.SECRET) //verifica el token y devuelve el payload si es valido
    if (decodedToken && decodedToken.id) {
      request.user = decodedToken;
    }
  }
  next();

}

module.exports = { errorHandler, unknowEndpoint, tokenExtractor, userExtractor };