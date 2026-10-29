// ─── Binary plist reader + lazy NSKeyedArchiver view ───
// Root cause of the v1/v2 "Maximum call stack size exceeded": the old decoder
// eagerly expanded every UID reference, and Procreate's archive is cyclic
// (each layer points back to its SilicaDocument). Here UIDs are only followed
// on demand, one hop at a time, so cycles are never walked.

const BPlist = (() => {
  const td8 = new TextDecoder('utf-8');
  const td16 = new TextDecoder('utf-16be');

  function parse(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const head = td8.decode(b.subarray(0, 6));
    if (head !== 'bplist') throw new Error('Document.archive is not a binary plist');
    const t = b.length - 32;
    const offSize = b[t + 6], refSize = b[t + 7];
    const num = Number(dv.getBigUint64(t + 8)), top = Number(dv.getBigUint64(t + 16));
    const tableOff = Number(dv.getBigUint64(t + 24));
    const uint = (o, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; return v; };
    const offsets = new Array(num);
    for (let i = 0; i < num; i++) offsets[i] = uint(tableOff + i * offSize, offSize);
    const cache = new Map();

    function lenAt(o, info) { // returns [length, dataStart]
      if (info !== 15) return [info, o + 1];
      const m = b[o + 1]; const n = 1 << (m & 15);
      return [uint(o + 2, n), o + 2 + n];
    }
    function obj(i) {
      if (cache.has(i)) return cache.get(i);
      const o = offsets[i], m = b[o], type = m >> 4, info = m & 15; let v;
      switch (type) {
        case 0x0: v = info === 8 ? false : info === 9 ? true : null; break;
        case 0x1: { const n = 1 << info; v = n === 8 ? Number(dv.getBigInt64(o + 1)) : uint(o + 1, n); break; }
        case 0x2: v = info === 2 ? dv.getFloat32(o + 1) : dv.getFloat64(o + 1); break;
        case 0x3: v = new Date(978307200000 + dv.getFloat64(o + 1) * 1000); break;
        case 0x4: { const [n, s] = lenAt(o, info); v = b.subarray(s, s + n); break; }
        case 0x5: { const [n, s] = lenAt(o, info); v = td8.decode(b.subarray(s, s + n)); break; }
        case 0x6: { const [n, s] = lenAt(o, info); v = td16.decode(b.subarray(s, s + n * 2)); break; }
        case 0x8: v = { $uid: uint(o + 1, info + 1) }; break;
        case 0xA: case 0xC: { const [n, s] = lenAt(o, info); v = []; cache.set(i, v);
          for (let k = 0; k < n; k++) v.push(obj(uint(s + k * refSize, refSize))); break; }
        case 0xD: { const [n, s] = lenAt(o, info); v = {}; cache.set(i, v);
          for (let k = 0; k < n; k++) v[obj(uint(s + k * refSize, refSize))] = obj(uint(s + (n + k) * refSize, refSize)); break; }
        default: v = null;
      }
      cache.set(i, v); return v;
    }
    return obj(top);
  }

  // NSKeyedArchiver accessor — resolves exactly one UID hop per call.
  function keyed(plist) {
    const objects = plist.$objects;
    if (!objects) throw new Error('Document.archive is not an NSKeyedArchiver archive');
    const R = v => (v && typeof v === 'object' && '$uid' in v) ? objects[v.$uid] : v;
    const val = v => { v = R(v); return v === '$null' ? null : v; };
    const cls = o => { o = R(o); if (!o || !o.$class) return null; const c = R(o.$class); return c && c.$classname; };
    const get = (o, k) => { o = R(o); return o && typeof o === 'object' ? val(o[k]) : null; };
    const str = (o, k) => { const v = get(o, k); return typeof v === 'string' ? v : (v && v['NS.string']) || null; };
    const arr = (o, k) => { const v = get(o, k); return v && v['NS.objects'] ? v['NS.objects'].map(R) : []; };
    const root = R(plist.$top.root);
    return { root, R, val, cls, get, str, arr };
  }

  return { parse, keyed };
})();
