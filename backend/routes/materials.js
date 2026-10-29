const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Material = require('../models/Material');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');
const { MAX_FILE_SIZE_BYTES, validateUploadedFile } = require('../utils/fileValidation');
const { validateMaterialInput } = require('../utils/materialValidation');
const { getUploadDir, removeStoredFile } = require('../utils/fileStorage');

const router = express.Router();
const INVALID_FILE = 'Invalid file';

// Files are streamed straight to disk under a random name; multer stops reading once 20 MB is exceeded.
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const directory = getUploadDir();
      fs.mkdir(directory, { recursive: true }, error => callback(error, directory));
    },
    filename(req, file, callback) {
      callback(null, crypto.randomUUID());
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 10 },
  // Browsers send file names as UTF-8, so names such as "résumé.pdf" are kept intact.
  defParamCharset: 'utf8',
}).single('file');

function receiveFile(req, res, next) {
  upload(req, res, async (error) => {
    if (!error) return next();
    await removeStoredFile(req.file?.path);
    if (error instanceof multer.MulterError) return res.status(400).json({ message: INVALID_FILE });
    console.error('Upload failed:', error.message);
    return res.status(500).json({ message: 'Unable to upload material' });
  });
}

function toMaterialResponse(material) {
  return {
    id: material._id,
    title: material.title,
    subject: material.subject,
    topic: material.topic,
    originalName: material.originalName,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes,
    downloadCount: material.downloadCount,
    ownerId: material.ownerId,
    createdAt: material.createdAt,
  };
}

router.post('/', requireAuth, requireRoles('contributor'), requireDatabase, receiveFile, async (req, res) => {
  const file = req.file;
  try {
    const fileType = await validateUploadedFile(file);
    if (!fileType) {
      await removeStoredFile(file?.path);
      return res.status(400).json({ message: INVALID_FILE });
    }

    const validation = validateMaterialInput(req.body);
    if (validation.error) {
      await removeStoredFile(file.path);
      return res.status(400).json({ message: validation.error });
    }

    const material = await Material.create({
      ...validation.value,
      originalName: path.basename(file.originalname),
      storagePath: file.filename,
      mimeType: fileType.mimeType,
      sizeBytes: file.size,
      ownerId: req.auth.sub,
    });

    return res.status(201).json({ message: 'Upload successful', material: toMaterialResponse(material) });
  } catch (error) {
    await removeStoredFile(file?.path);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid material details' });
    }
    console.error('Upload failed:', error.message);
    return res.status(500).json({ message: 'Unable to upload material' });
  }
});

module.exports = router;
