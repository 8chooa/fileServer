const config = require('./utils/config');
const app = require('./app');

app.listen(config.PORT, config.HOST, () => {
  console.log(`servidor de archivos corriendo en el puerto ${config.PORT} y en el host ${config.HOST}`);
});