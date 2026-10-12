const Resource = require('../models/resource');
const path = require('node:path');

const uniqueName = async (name, parentId) => {
  const extension = path.extname(name); //ej: .pdf
  const baseName = path.basename(name, extension); // ej: libro

  let candidateName = name;
  let counter = 1;

  while (await Resource.findOne({ name: candidateName, parent: parentId })) {
    candidateName = `${baseName} (${counter})${extension}`;
    counter++;
  }

  return candidateName;
};

module.exports = uniqueName;