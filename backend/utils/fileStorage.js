const fs = require('fs');
const path = require('path');

// Uploaded files live outside any public directory and are only served through the download route.
function getUploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
}

async function removeStoredFile(filePath) {
  if (!filePath) return;
  await fs.promises.rm(filePath, { force: true }).catch(error => {
    console.error('Could not remove stored file:', error.message);
  });
}

module.exports = { getUploadDir, removeStoredFile };
