const usersRouter = require('express').Router();
const middlewares = require('../utils/middlewares/generals');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const Resource = require('../models/resource');

usersRouter.get('/profile', async (request, response) => {
  const userByToken = request.user;
  
  if (!userByToken) {
    return response.status(401).json({ error: 'falta token' });
  }

  if (!userByToken.id) {
    return response.status(401).json({ error: 'token invalido' });
  }

  const users = await User.find({});
  response.json(users);
});

usersRouter.get('/profile/:id', async (request, response) => {
  const id = request.params.id;
  const userByToken = request.user;

  if (!userByToken) {
    return response.status(401).json({ error: 'falta token' });
  }

  if (!userByToken.id) {
    return response.status(401).json({ error: 'token invalido' });
  }

  const user = await User.findById(id);

  if (user.id.toString() === userByToken.id.toString()) {
    const totalFiles = await Resource.countDocuments({ owner: request.user.id, type:'file' });
    return response.json({ ...user.toObject(), totalFiles });
  } else {
    return response.status(403).json({ error: 'no puedes ver los datos de otro usuario' });
  }
});

usersRouter.put('/profile/:id', async (request, response) => {

  const body = request.body;

  const newUser = ('password' in body)
  ? { username: body.username, name: body.name, passwordHash: await bcrypt.hash(body.password, 10) }
  : {...body};
  const id = request.params.id;
  const userByToken = request.user;

  if (!userByToken) {
    return response.status(201).json({ error: 'falta token' });
  }

  if (!userByToken.id) {
    return response.status(401).json({ error: 'token invalido' });
  }

  if (id === userByToken.id.toString()) {
    const updatedUser = await User.findByIdAndUpdate(id, newUser, { returnDocument: 'after' });

    return response.json(updatedUser);
  } else {
    return response.status(403).json({ error: 'no puedes actualizar los datos de otro usuario' });
  }
});

module.exports = usersRouter;