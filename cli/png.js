// The smallest PNG reader and writer that will do: 8-bit RGB, no interlace. Enough to save what ink-studio draws and read it back.
const zlib = require('zlib'),
  fs = require('fs');
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
const crc = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4),
    td = Buffer.concat([Buffer.from(type, 'ascii'), data]),
    cr = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
function write(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const hd = Buffer.alloc(13);
  hd.writeUInt32BE(w, 0);
  hd.writeUInt32BE(h, 4);
  hd[8] = 8;
  hd[9] = 2;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', hd),
      chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
      chunk('IEND', Buffer.alloc(0))
    ])
  );
}
function read(file) {
  const b = fs.readFileSync(file);
  let p = 8,
    w = 0,
    h = 0,
    ch = 3;
  const parts = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p),
      type = b.toString('ascii', p + 4, p + 8),
      d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ch = d[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') parts.push(d);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts)),
    st = w * ch + 1,
    out = new Uint8Array(w * h * 3),
    row = new Uint8Array(w * ch),
    prev = new Uint8Array(w * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * st];
    for (let i = 0; i < w * ch; i++) {
      const x = raw[y * st + 1 + i],
        a = i >= ch ? row[i - ch] : 0,
        u = prev[i],
        c = i >= ch ? prev[i - ch] : 0;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + u;
      else if (f === 3) v = x + ((a + u) >> 1);
      else if (f === 4) {
        const q = a + u - c,
          pa = Math.abs(q - a),
          pb = Math.abs(q - u),
          pc = Math.abs(q - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c);
      }
      row[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 3] = row[x * ch];
      out[(y * w + x) * 3 + 1] = row[x * ch + 1];
      out[(y * w + x) * 3 + 2] = row[x * ch + 2];
    }
    prev.set(row);
  }
  return { w, h, rgb: out };
}
// an animated PNG: the first frame is an ordinary picture, the rest ride along as extra chunks. Browsers play it; a plain viewer shows frame one
function animate(file, frames, fps) {
  const w = frames[0].w,
    h = frames[0].h,
    pack = f => {
      const raw = Buffer.alloc((w * 3 + 1) * h);
      for (let y = 0; y < h; y++) {
        raw[y * (w * 3 + 1)] = 0;
        Buffer.from(f.rgb.buffer, f.rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
      }
      return zlib.deflateSync(raw, { level: 6 });
    };
  const hd = Buffer.alloc(13);
  hd.writeUInt32BE(w, 0);
  hd.writeUInt32BE(h, 4);
  hd[8] = 8;
  hd[9] = 2;
  const ac = Buffer.alloc(8);
  ac.writeUInt32BE(frames.length, 0);
  ac.writeUInt32BE(0, 4);
  const out = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('acTL', ac)];
  let seq = 0;
  frames.forEach((f, i) => {
    const fc = Buffer.alloc(26);
    fc.writeUInt32BE(seq++, 0);
    fc.writeUInt32BE(w, 4);
    fc.writeUInt32BE(h, 8);
    fc.writeUInt16BE(1, 20);
    fc.writeUInt16BE(fps, 22);
    out.push(chunk('fcTL', fc));
    const z = pack(f);
    if (i === 0) out.push(chunk('IDAT', z));
    else {
      const sq = Buffer.alloc(4);
      sq.writeUInt32BE(seq++, 0);
      out.push(chunk('fdAT', Buffer.concat([sq, z])));
    }
  });
  out.push(chunk('IEND', Buffer.alloc(0)));
  fs.writeFileSync(file, Buffer.concat(out));
}
module.exports = { write, read, animate };
