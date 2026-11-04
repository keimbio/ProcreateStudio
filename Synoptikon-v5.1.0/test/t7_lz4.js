// LZ4/bv41 encoder: round-trip real tiles (decode → encode → decode) and random/edge buffers.
const api = require('./load');
(async () => {
  const doc = await api.openFile('../samples/rgb.procreate'); let n = 0, rawIn = 0, rawOut = 0;
  for (const [uuid, list] of doc.tilesByUUID) for (const t of list) {
    const raw = await doc.zip.read(t.name); const buf = new Uint8Array(256 * 256 * 4);
    const k = api.Codecs.bv4(raw, buf); const enc = api.Codecs.bv4Encode(buf.subarray(0, k));
    const back = new Uint8Array(k); const k2 = api.Codecs.bv4(enc, back);
    if (k2 !== k || back.some((v, i) => v !== buf[i])) throw new Error('mismatch ' + t.name);
    n++; rawIn += raw.length; rawOut += enc.length;
  }
  for (const len of [0, 1, 5, 12, 13, 100, 65535, 65536, 65537, 262144]) {
    const a = new Uint8Array(len); for (let i = 0; i < len; i++) a[i] = (i * 7 + (i >> 9)) % 251 & (i % 3 ? 255 : 15);
    const b = new Uint8Array(len); if (api.Codecs.bv4(api.Codecs.bv4Encode(a), b) !== len || b.some((v, i) => v !== a[i])) throw new Error('synthetic mismatch ' + len);
  }
  console.log(`✓ ${n} real tiles round-trip; Procreate ${rawIn} B vs ours ${rawOut} B; synthetic edge sizes OK`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
