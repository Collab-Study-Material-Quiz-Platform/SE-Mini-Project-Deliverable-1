const zlib = require('zlib');

// Minimal, structurally valid sample files for upload tests.

function makePdf(sizeBytes = 1024) {
  const header = Buffer.from('%PDF-1.4\n%test document\n');
  const trailer = Buffer.from('\n%%EOF\n');
  const padding = Math.max(0, sizeBytes - header.length - trailer.length);
  return Buffer.concat([header, Buffer.alloc(padding, 0x20), trailer]);
}

// Builds an uncompressed ZIP archive containing the given { name: content } entries.
function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = zlib.crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeDocx() {
  return makeZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' });
}

function makePptx() {
  return makeZip({ '[Content_Types].xml': '<Types/>', 'ppt/presentation.xml': '<p:presentation/>' });
}

// Starts with the Windows executable "MZ" signature.
function makeExecutable(sizeBytes = 1024) {
  const data = Buffer.alloc(sizeBytes, 0);
  data.write('MZ', 0);
  return data;
}

module.exports = { makePdf, makeZip, makeDocx, makePptx, makeExecutable };
