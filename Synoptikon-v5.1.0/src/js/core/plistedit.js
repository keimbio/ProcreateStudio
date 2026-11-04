// ─── Binary plist: type-preserving reader + writer (for editing Document.archive) ───
// BPlist.parse() above is built for fast, lazy *reading*. Editing needs a lossless
// round trip, so this reader keeps every type distinction that JavaScript would
// otherwise blur: integers stay plain numbers (BigInt beyond 2^53), reals are
// wrapped as {$real, $size} so 1.0 is not written back as integer 1, dictionaries
// are Maps (key order preserved), and UIDs are {$uid}. The writer emits bplist00.

const PlistEdit = (() => {
  const td8 = new TextDecoder('utf-8'), td16 = new TextDecoder('utf-16be');

  function parse(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (td8.decode(b.subarray(0, 8)) !== 'bplist00') throw new Error('Not a bplist00 file');
    const t = b.length - 32;
    const offSize = b[t + 6], refSize = b[t + 7];
    const num = Number(dv.getBigUint64(t + 8)), top = Number(dv.getBigUint64(t + 16)), tableOff = Number(dv.getBigUint64(t + 24));
    const uint = (o, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; return v; };
    const offsets = new Array(num);
    for (let i = 0; i < num; i++) offsets[i] = uint(tableOff + i * offSize, offSize);
    const cache = new Map();
    const lenAt = (o, info) => { if (info !== 15) return [info, o + 1]; const n = 1 << (b[o + 1] & 15); return [uint(o + 2, n), o + 2 + n]; };
    function obj(i) {
      if (cache.has(i)) return cache.get(i);
      const o = offsets[i], m = b[o], type = m >> 4, info = m & 15; let v;
      switch (type) {
        case 0x0: v = info === 8 ? false : info === 9 ? true : null; break;
        case 0x1: {
          const n = 1 << info;
          if (n === 8) { const x = dv.getBigInt64(o + 1); v = (x >= -9007199254740991n && x <= 9007199254740991n) ? Number(x) : x; }
          else if (n === 16) v = { $int128: b.slice(o + 1, o + 17) };
          else v = uint(o + 1, n);
          break;
        }
        case 0x2: v = info === 2 ? { $real: dv.getFloat32(o + 1), $size: 4 } : { $real: dv.getFloat64(o + 1), $size: 8 }; break;
        case 0x3: v = { $date: dv.getFloat64(o + 1) }; break;
        case 0x4: { const [n, s] = lenAt(o, info); v = b.slice(s, s + n); break; }
        case 0x5: { const [n, s] = lenAt(o, info); v = td8.decode(b.subarray(s, s + n)); break; }
        case 0x6: { const [n, s] = lenAt(o, info); v = td16.decode(b.subarray(s, s + n * 2)); break; }
        case 0x8: v = { $uid: uint(o + 1, info + 1) }; break;
        case 0xA: case 0xC: {
          const [n, s] = lenAt(o, info); const arr = []; v = type === 0xC ? { $set: arr } : arr; cache.set(i, v);
          for (let k = 0; k < n; k++) arr.push(obj(uint(s + k * refSize, refSize)));
          break;
        }
        case 0xD: {
          const [n, s] = lenAt(o, info); v = new Map(); cache.set(i, v);
          for (let k = 0; k < n; k++) v.set(obj(uint(s + k * refSize, refSize)), obj(uint(s + (n + k) * refSize, refSize)));
          break;
        }
        default: throw new Error('Unsupported plist object type 0x' + type.toString(16));
      }
      cache.set(i, v); return v;
    }
    return obj(top);
  }

  // ── writer ──
  function write(root) {
    const objs = [];                 // flattened objects in table order
    const idByRef = new Map();       // containers / byte arrays, by identity
    const idByKey = new Map();       // scalars, by value (uniqued like Apple's writer)
    const kind = v => {
      if (v === null || v === undefined) return 'null';
      if (typeof v === 'boolean') return 'bool';
      if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'realn';
      if (typeof v === 'bigint') return 'int';
      if (typeof v === 'string') return 'str';
      if (v instanceof Uint8Array) return 'data';
      if (Array.isArray(v)) return 'array';
      if (v instanceof Map) return 'dict';
      if ('$uid' in v) return 'uid';
      if ('$real' in v) return 'real';
      if ('$date' in v) return 'date';
      if ('$set' in v) return 'set';
      if ('$int128' in v) return 'int128';
      return 'dict';                 // plain object → dict
    };
    function scalarKey(v, k) {
      switch (k) {
        case 'null': return 'n'; case 'bool': return 'b' + v; case 'int': return 'i' + v.toString();
        case 'realn': return 'r8:' + v; case 'real': return 'r' + v.$size + ':' + v.$real;
        case 'str': return 's' + v; case 'uid': return 'u' + v.$uid; case 'date': return 'd' + v.$date;
      }
      return null;
    }
    // first pass: assign ids depth-first (parents before children, like plistlib)
    const refs = new Map(); // id -> child ids
    function flatten(v) {
      const k = kind(v), sk = scalarKey(v, k);
      if (sk !== null) { if (idByKey.has(sk)) return idByKey.get(sk); const id = objs.length; objs.push([k, v]); idByKey.set(sk, id); return id; }
      if (idByRef.has(v)) return idByRef.get(v);
      const id = objs.length; objs.push([k, v]); idByRef.set(v, id);
      if (k === 'array' || k === 'set') { const a = k === 'set' ? v.$set : v; refs.set(id, a.map(flatten)); }
      else if (k === 'dict') {
        const ents = v instanceof Map ? [...v.entries()] : Object.entries(v);
        const ks = ents.map(e => flatten(e[0])), vs = ents.map(e => flatten(e[1]));
        refs.set(id, ks.concat(vs));
      }
      return id;
    }
    flatten(root);
    const n = objs.length;
    const refSize = n < 256 ? 1 : n < 65536 ? 2 : 4;
    const chunks = []; let size = 8; const offsets = new Array(n);
    const push = u8 => { chunks.push(u8); size += u8.length; };
    push(new TextEncoder().encode('bplist00')); size = 8; // (size already counts the header)
    const be = (v, nbytes) => { const a = new Uint8Array(nbytes); for (let i = nbytes - 1; i >= 0; i--) { a[i] = v & 255; v = Math.floor(v / 256); } return a; };
    const marker = (type, len) => {
      if (len < 15) return new Uint8Array([type << 4 | len]);
      const nb = len < 256 ? 0 : len < 65536 ? 1 : 2;
      return concat([new Uint8Array([type << 4 | 15, 0x10 | nb]), be(len, 1 << nb)]);
    };
    function intBytes(v) {
      if (typeof v === 'bigint' || v < 0 || v > 0xffffffff) {
        const d = new DataView(new ArrayBuffer(9)); d.setUint8(0, 0x13); d.setBigInt64(1, BigInt(v)); return new Uint8Array(d.buffer);
      }
      const nb = v < 256 ? 0 : v < 65536 ? 1 : 2;
      return concat([new Uint8Array([0x10 | nb]), be(v, 1 << nb)]);
    }
    for (let id = 0; id < n; id++) {
      offsets[id] = size;
      const [k, v] = objs[id];
      switch (k) {
        case 'null': push(new Uint8Array([0x00])); break;
        case 'bool': push(new Uint8Array([v ? 0x09 : 0x08])); break;
        case 'int': push(intBytes(v)); break;
        case 'int128': push(concat([new Uint8Array([0x14]), v.$int128])); break;
        case 'realn': case 'real': {
          const x = k === 'real' ? v.$real : v, s4 = k === 'real' && v.$size === 4;
          const d = new DataView(new ArrayBuffer(s4 ? 5 : 9)); d.setUint8(0, s4 ? 0x22 : 0x23);
          s4 ? d.setFloat32(1, x) : d.setFloat64(1, x); push(new Uint8Array(d.buffer)); break;
        }
        case 'date': { const d = new DataView(new ArrayBuffer(9)); d.setUint8(0, 0x33); d.setFloat64(1, v.$date); push(new Uint8Array(d.buffer)); break; }
        case 'data': push(concat([marker(0x4, v.length), v])); break;
        case 'str': {
          if (/^[\x00-\x7f]*$/.test(v)) { const a = new Uint8Array(v.length); for (let i = 0; i < v.length; i++) a[i] = v.charCodeAt(i); push(concat([marker(0x5, a.length), a])); }
          else { const a = new Uint8Array(v.length * 2); for (let i = 0; i < v.length; i++) { const c = v.charCodeAt(i); a[i * 2] = c >> 8; a[i * 2 + 1] = c & 255; } push(concat([marker(0x6, v.length), a])); }
          break;
        }
        case 'uid': { const u = v.$uid; const nb = u < 256 ? 1 : u < 65536 ? 2 : 4; push(concat([new Uint8Array([0x80 | (nb - 1)]), be(u, nb)])); break; }
        case 'array': case 'set': case 'dict': {
          const r = refs.get(id), cnt = k === 'dict' ? r.length / 2 : r.length;
          const body = new Uint8Array(r.length * refSize); r.forEach((x, i) => body.set(be(x, refSize), i * refSize));
          push(concat([marker(k === 'array' ? 0xA : k === 'set' ? 0xC : 0xD, cnt), body])); break;
        }
      }
    }
    const tableOff = size;
    const offSize = tableOff < 256 ? 1 : tableOff < 65536 ? 2 : tableOff < 16777216 ? 3 : 4;
    const table = new Uint8Array(n * offSize); offsets.forEach((o, i) => table.set(be(o, offSize), i * offSize)); push(table);
    const tr = new DataView(new ArrayBuffer(32));
    tr.setUint8(6, offSize); tr.setUint8(7, refSize); tr.setBigUint64(8, BigInt(n)); tr.setBigUint64(16, 0n); tr.setBigUint64(24, BigInt(tableOff));
    push(new Uint8Array(tr.buffer));
    return concat(chunks);
  }
  function concat(list) { let n = 0; for (const a of list) n += a.length; const o = new Uint8Array(n); let p = 0; for (const a of list) { o.set(a, p); p += a.length; } return o; }

  return { parse, write };
})();
