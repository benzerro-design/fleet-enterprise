const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const buf = fs.readFileSync('c:/Users/mariu/Downloads/CIV Logan B157EFI.pdf');
const outDir = 'c:/Users/mariu/OneDrive/Desktop/fleet-enterprise/api/scripts/_civ_preview';
fs.mkdirSync(outDir, { recursive: true });

// Parse indirect objects roughly for image XObjects
const text = buf.toString('binary');
const objRe = /(\d+)\s+(\d+)\s+obj\s*([\s\S]*?)\s*endobj/g;
let om;
let images = 0;
while ((om = objRe.exec(text)) && images < 10) {
  const body = om[3];
  if (!/\/Subtype\s*\/Image/.test(body)) continue;
  const w = /\/Width\s+(\d+)/.exec(body)?.[1];
  const h = /\/Height\s+(\d+)/.exec(body)?.[1];
  const bpc = /\/BitsPerComponent\s+(\d+)/.exec(body)?.[1];
  const cs = /\/ColorSpace\s*\/(\w+)/.exec(body)?.[1] || /\/ColorSpace\s*(\[[^\]]+\])/.exec(body)?.[1];
  const filter = /\/Filter\s*\/(\w+)/.exec(body)?.[1] || /\/Filter\s*(\[[^\]]+\])/.exec(body)?.[1];
  const sm = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body);
  if (!sm) {
    console.log('image obj without stream', om[1], { w, h, filter, cs });
    continue;
  }
  let raw = Buffer.from(sm[1], 'binary');
  // PDF may use \r\n after stream; some writers include an extra newline already stripped by regex
  let data = raw;
  if (String(filter).includes('FlateDecode') || filter === 'FlateDecode') {
    try {
      data = zlib.inflateSync(raw);
    } catch (e) {
      console.log('inflate fail', om[1], e.message, 'raw', raw.length);
      continue;
    }
  } else if (String(filter).includes('DCTDecode')) {
    // already jpeg
  }
  console.log('IMAGE', om[1], { w, h, bpc, cs, filter, raw: raw.length, data: data.length });
  const isJpeg = data[0] === 0xff && data[1] === 0xd8;
  if (isJpeg) {
    const fp = path.join(outDir, `img-${om[1]}.jpg`);
    fs.writeFileSync(fp, data);
    console.log('wrote', fp);
    images++;
    continue;
  }
  // raw RGB/Gray -> PPM then hope Read works; write binary + sidecar meta
  if (w && h) {
    const width = Number(w);
    const height = Number(h);
    const channels = String(cs).includes('RGB') || String(cs) === '/DeviceRGB' ? 3 : 1;
    const expected = width * height * channels;
    console.log('expected', expected, 'got', data.length, 'channels', channels);
    if (data.length >= expected * 0.9) {
      // write PPM
      const header = Buffer.from(`P6\n${width} ${height}\n255\n`);
      let pixels = data.subarray(0, expected);
      if (channels === 1) {
        // expand gray to RGB
        const rgb = Buffer.alloc(width * height * 3);
        for (let i = 0; i < width * height; i++) {
          rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = pixels[i];
        }
        pixels = rgb;
      }
      const fp = path.join(outDir, `img-${om[1]}.ppm`);
      fs.writeFileSync(fp, Buffer.concat([header, pixels]));
      console.log('wrote', fp);
      images++;
    }
  }
}
console.log('done images', images);
