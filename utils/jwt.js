const jwt = require('jsonwebtoken');
const config = require('./config');


const tokenGeneration = (userData) => {
  const payload = {
    username: userData.username,
    id: userData.id,
  };

  const token = jwt.sign(payload, config.SECRET);

  return token;
}

module.exports = { tokenGeneration };