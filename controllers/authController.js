const authRouter = require('express').Router()
const User = require('../models/user');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { tokenGeneration } = require('../utils/jwt');


authRouter.post('/register', async (request, response) => {
  const { username, name, password } = request.body;

  if (password === undefined || password.length < 3) {
    return response.status(400).json({ error: 'falta contraseña o es demasiado corta' });
  }

  const salt = 10; // bcrypt se encarga de hacerlo seguro, unico y criptográficamente aleatorio

  const passwordHash = await bcrypt.hash(password, salt);

  const user = new User({
    username,
    name,
    passwordHash
  });

  const savedUser = await user.save();

  response.status(201).json(savedUser);
});


authRouter.post('/login', async (request, response) => {
  const { username, password } = request.body;

  const user = await User.findOne({ username });

  const correctPassword = user === null ? false : bcrypt.compare(password, user.passwordHash);

  if (!(correctPassword && user)) {
    return response.status(401).json({ error: 'username o contraseña incorrectos' });
  }

  const token = tokenGeneration(user);

  response.status(200).json({ token, username: user.username, name: user.name });
})

module.exports = authRouter;