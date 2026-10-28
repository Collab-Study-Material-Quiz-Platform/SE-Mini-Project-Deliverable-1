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
const { validateMaterialInput, parseMaterialSearch } = require('../utils/materialValidation');
const { getUploadDir, removeStoredFile } = require('../utils/fileStorage');

const router = express.Router();
const INVALID_FILE = 'Invalid file';
const PAGE_SIZE = 10;
const LIST_FIELDS = 'title subject topic originalName mimeType sizeBytes downloadCount ownerId createdAt';

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

router.get('/', requireAuth, requireRoles('student', 'contributor', 'admin'), requireDatabase, async (req, res) => {
  const search = parseMaterialSearch(req.query);
  if (search.error) return res.status(400).json({ message: search.error });

  const { filter, page } = search.value;
  try {
    // Lean queries with a list-only projection keep the newest-first page fast (CSQ-NF-001).
    const [materials, total] = await Promise.all([
      Material.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select(LIST_FIELDS)
        .lean(),
      Material.countDocuments(filter),
    ]);

    return res.json({
      materials: materials.map(toMaterialResponse),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
      ...(total === 0 ? { message: 'No materials found' } : {}),
    });
  } catch (error) {
    console.error('Material search failed:', error.message);
    return res.status(500).json({ message: 'Unable to search materials' });
  }
});

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
