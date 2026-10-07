const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['file', 'folder']
  },
  mimeType: String,
  size: String, //posiblemente cambie el valor
  pathOnDisk: String,
  relativePath: String,
  parent: String, //id de la carpeta que lo contiene
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: Date
});

resourceSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id;
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Resource', resourceSchema);