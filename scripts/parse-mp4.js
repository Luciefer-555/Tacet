const fs = require('fs');

const fileBuffer = fs.readFileSync('public/hero-touch.mp4');
console.log('File total bytes:', fileBuffer.length);

let offset = 0;
while (offset < fileBuffer.length - 8) {
  const size = fileBuffer.readUInt32BE(offset);
  const name = fileBuffer.toString('ascii', offset + 4, offset + 8);
  console.log(`Box: ${name}, size: ${size}, offset: ${offset}`);

  if (name === 'moov') {
    parseContainer(offset + 8, offset + size, '  moov');
    break;
  }
  if (size === 0) break;
  if (size === 1) {
    const largeSize = Number(fileBuffer.readBigUInt64BE(offset + 8));
    offset += largeSize;
  } else {
    offset += size;
  }
}

function parseContainer(start, end, indent) {
  let pos = start;
  while (pos < end - 8) {
    const size = fileBuffer.readUInt32BE(pos);
    const name = fileBuffer.toString('ascii', pos + 4, pos + 8);
    console.log(`${indent} -> Box: ${name}, size: ${size}, offset: ${pos}`);

    if (name === 'tkhd') {
      const version = fileBuffer[pos + 8];
      const widthOffset = version === 1 ? pos + 8 + 88 : pos + 8 + 76;
      const widthFixed = fileBuffer.readUInt32BE(widthOffset);
      const heightFixed = fileBuffer.readUInt32BE(widthOffset + 4);
      const width = widthFixed >> 16;
      const height = heightFixed >> 16;
      console.log(`${indent}    *** Track Dimensions (tkhd): ${width}x${height} ***`);
    }

    if (name === 'avcC') {
      console.log(`${indent}    *** Found avcC (H.264 video stream configuration) ***`);
    }

    if (['trak', 'mdia', 'minf', 'stbl'].includes(name)) {
      parseContainer(pos + 8, pos + size, indent + '  ');
    }

    if (size === 0) break;
    pos += size;
  }
}
