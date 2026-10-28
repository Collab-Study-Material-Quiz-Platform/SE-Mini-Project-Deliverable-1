const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MAX_FILE_SIZE_BYTES, detectFileType, validateUploadedFile } = require('../utils/fileValidation');
const { makePdf, makeZip, makeDocx, makePptx, makeExecutable } = require('./helpers/documents');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'csq-file-validation-'));
test.after(() => fs.rmSync(directory, { recursive: true, force: true }));

function writeSample(name, data) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, data);
  return { path: filePath, originalname: name, size: data.length };
}

test('detects PDF, DOCX and PPTX files from their content', async () => {
  assert.equal(await detectFileType(writeSample('a.pdf', makePdf()).path), 'pdf');
  assert.equal(await detectFileType(writeSample('a.docx', makeDocx()).path), 'docx');
  assert.equal(await detectFileType(writeSample('a.pptx', makePptx()).path), 'pptx');
});

test('accepts valid documents and reports the verified MIME type', async () => {
  assert.equal((await validateUploadedFile(writeSample('notes.pdf', makePdf()))).mimeType, 'application/pdf');
  assert.equal((await validateUploadedFile(writeSample('notes.DOCX', makeDocx()))).type, 'docx');
  assert.equal((await validateUploadedFile(writeSample('slides.pptx', makePptx()))).type, 'pptx');
});

test('rejects an executable renamed with a document extension', async () => {
  assert.equal(await validateUploadedFile(writeSample('virus.pdf', makeExecutable())), null);
  assert.equal(await validateUploadedFile(writeSample('virus.docx', makeExecutable())), null);
});

test('rejects files whose extension does not match the real content', async () => {
  assert.equal(await validateUploadedFile(writeSample('notes.docx', makePdf())), null);
  assert.equal(await validateUploadedFile(writeSample('slides.pdf', makePptx())), null);
  assert.equal(await validateUploadedFile(writeSample('notes.txt', makePdf())), null);
});

test('rejects ZIP archives that are not Word or PowerPoint packages', async () => {
  const plainZip = makeZip({ 'readme.txt': 'hello' });
  assert.equal(await validateUploadedFile(writeSample('archive.docx', plainZip)), null);
  const noContentTypes = makeZip({ 'word/document.xml': '<w:document/>' });
  assert.equal(await validateUploadedFile(writeSample('broken.docx', noContentTypes)), null);
  const truncated = makeDocx().subarray(0, 40);
  assert.equal(await validateUploadedFile(writeSample('truncated.docx', truncated)), null);
});

test('rejects empty, missing and oversized files', async () => {
  assert.equal(await validateUploadedFile(undefined), null);
  assert.equal(await validateUploadedFile(writeSample('empty.pdf', Buffer.alloc(0))), null);
  const sample = writeSample('large.pdf', makePdf());
  assert.equal(await validateUploadedFile({ ...sample, size: MAX_FILE_SIZE_BYTES + 1 }), null);
  assert.ok(await validateUploadedFile({ ...sample, size: MAX_FILE_SIZE_BYTES }));
});
