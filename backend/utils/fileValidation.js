const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const FILE_TYPES = Object.freeze({
  pdf: Object.freeze({ extension: '.pdf', mimeType: 'application/pdf' }),
  docx: Object.freeze({ extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  pptx: Object.freeze({ extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
});

const PDF_SIGNATURE = Buffer.from('%PDF-');
const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_EOCD_MIN_SIZE = 22;
const ZIP_MAX_COMMENT_SIZE = 0xffff;

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

// DOCX and PPTX files are ZIP packages, so read the entry names from the ZIP central directory.
async function readZipEntryNames(handle, size) {
  const tailLength = Math.min(size, ZIP_EOCD_MIN_SIZE + ZIP_MAX_COMMENT_SIZE);
  const tail = await readAt(handle, size - tailLength, tailLength);

  let eocd = -1;
  for (let i = tail.length - ZIP_EOCD_MIN_SIZE; i >= 0; i -= 1) {
    if (tail.readUInt32LE(i) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const entryCount = tail.readUInt16LE(eocd + 10);
  const directorySize = tail.readUInt32LE(eocd + 12);
  const directoryOffset = tail.readUInt32LE(eocd + 16);
  if (directoryOffset + directorySize > size) return null;

  const directory = await readAt(handle, directoryOffset, directorySize);
  const names = [];
  let offset = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== ZIP_CENTRAL_HEADER) return null;
    const nameLength = directory.readUInt16LE(offset + 28);
    const extraLength = directory.readUInt16LE(offset + 30);
    const commentLength = directory.readUInt16LE(offset + 32);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > directory.length) return null;
    names.push(directory.toString('utf8', offset + 46, nameEnd));
    offset = nameEnd + extraLength + commentLength;
  }
  return names;
}

// Identify a file from its content rather than its name. Returns 'pdf', 'docx', 'pptx' or null.
async function detectFileType(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const head = await readAt(handle, 0, Math.min(size, 8));

    if (head.length >= PDF_SIGNATURE.length && head.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      return 'pdf';
    }

    if (head.length >= 4 && head.readUInt32LE(0) === ZIP_LOCAL_HEADER) {
      const names = await readZipEntryNames(handle, size);
      if (!names || !names.includes('[Content_Types].xml')) return null;
      if (names.some(name => name.startsWith('word/'))) return 'docx';
      if (names.some(name => name.startsWith('ppt/'))) return 'pptx';
    }

    return null;
  } finally {
    await handle.close();
  }
}

// The extension must agree with the real content, so a renamed file of another type is rejected.
async function validateUploadedFile(file) {
  if (!file || !file.path || file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) return null;
  const type = await detectFileType(file.path);
  if (!type) return null;
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension !== FILE_TYPES[type].extension) return null;
  return { type, ...FILE_TYPES[type] };
}

module.exports = { MAX_FILE_SIZE_BYTES, FILE_TYPES, detectFileType, validateUploadedFile };
