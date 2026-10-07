const fs = require('fs');
const Resource = require('../models/resource');

const deleteResourceRecursive = async (resource) => {
  if (resource.type === 'file') {

    if (fs.existsSync(resource.pathOnDisk)) {
      fs.unlinkSync(resource.pathOnDisk);
    }

    await Resource.findByIdAndDelete(resource._id);

  } else if (resource.type === 'folder') {
    const items = await Resource.find({ parent: resource._id });

    for (let item of items) {
      await deleteResourceRecursive(item)
    }

    const folderDiskPath = resource.pathOnDisk ||
      (resource.relativePath ? path.join(__dirname, '../uploads', resource.relativePath) : null);

    if (folderDiskPath && fs.existsSync(folderDiskPath)) {
      fs.rmSync(folderDiskPath, { recursive: true, force: true });
    }

    await Resource.findByIdAndDelete(resource._id);
  }
};

module.exports = deleteResourceRecursive;