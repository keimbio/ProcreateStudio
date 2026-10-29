// ─── ZIP reader (lazy, Blob-backed, ZIP64-aware) + STORE-only ZIP writer ───
// Reading slices of the Blob on demand means a 500 MB .procreate never has to sit
// in memory as one ArrayBuffer. Deflate entries use the platform DecompressionStream.

const Zip = (() => {
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 4294967296;
  const td = new TextDecoder();

  async function bytes(blob, start, end) {
    return new Uint8Array(await blob.slice(start, end).arrayBuffer());
  }

  async function open(blob) {
    const size = blob.size;
    const tailLen = Math.min(size, 65557 + 20);
    const tail = await bytes(blob, size - tailLen, size);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a ZIP archive — this does not look like a .procreate file.');
    let count = u16(tail, eocd + 10);
    let cdSize = u32(tail, eocd + 12);
    let cdOff = u32(tail, eocd + 16);
    // ZIP64 end-of-central-directory locator sits 20 bytes before the EOCD
    if (eocd >= 20 && u32(tail, eocd - 20) === 0x07064b50) {
      const z64Off = u64(tail, eocd - 20 + 8);
      const z = await bytes(blob, z64Off, z64Off + 56);
      if (u32(z, 0) === 0x06064b50) { count = u64(z, 32); cdSize = u64(z, 40); cdOff = u64(z, 48); }
    }
    const cd = await bytes(blob, cdOff, cdOff + cdSize);
    const entries = new Map();
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cd.length; n++) {
      if (u32(cd, p) !== 0x02014b50) break;
      const method = u16(cd, p + 10);
      let csize = u32(cd, p + 20), usize = u32(cd, p + 24);
      const nlen = u16(cd, p + 28), xlen = u16(cd, p + 30), clen = u16(cd, p + 32);
      let off = u32(cd, p + 42);
      const name = td.decode(cd.subarray(p + 46, p + 46 + nlen));
      // ZIP64 extra field (0x0001) carries the real 64-bit values
      let x = p + 46 + nlen; const xend = x + xlen;
      while (x + 4 <= xend) {
        const id = u16(cd, x), len = u16(cd, x + 2); let q = x + 4;
        if (id === 0x0001) {
          if (usize === 0xffffffff) { usize = u64(cd, q); q += 8; }
          if (csize === 0xffffffff) { csize = u64(cd, q); q += 8; }
          if (off === 0xffffffff) { off = u64(cd, q); q += 8; }
        }
        x += 4 + len;
      }
      if (!name.endsWith('/')) entries.set(name, { name, method, csize, usize, off });
      p += 46 + nlen + xlen + clen;
    }

    async function read(name) {
      const e = typeof name === 'string' ? entries.get(name) : name;
      if (!e) return null;
      const lh = await bytes(blob, e.off, e.off + 30);
      const start = e.off + 30 + u16(lh, 26) + u16(lh, 28);
      const raw = await bytes(blob, start, start + e.csize);
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw);
      throw new Error('Unsupported ZIP compression method ' + e.method + ' in ' + e.name);
    }
    return { entries, read, names: () => [...entries.keys()] };
  }

  async function inflateRaw(data) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([data]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }

  // ── writer (STORE): images are already compressed, so deflate would only cost time ──
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(d) { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function build(files) { // files: [{name, data:Uint8Array}]
    const te = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const now = new Date();
    const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const nm = te.encode(f.name); const crc = crc32(f.data); const sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dtime, true); ch.setUint16(14, ddate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nm);
      offset += 30 + nm.length + sz;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  return { open, build, crc32 };
})();
