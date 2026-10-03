const config = require('./utils/config');
const app = require('./app');


app.listen(config.PORT, () => {
  console.log(`servidor de archivos corriendo en el puerto ${config.PORT}`);
});