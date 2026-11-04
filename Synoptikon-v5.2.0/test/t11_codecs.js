// Optimised LZO decoder + sync inflate vs the v4 reference decoder, on every tile of the real samples.
const api = require('./load'); const fs = require('fs'), vm = require('vm');
const ref = vm.runInNewContext(fs.readFileSync(__dirname + '/ref_codecs_v4.js', 'utf8') + ';Codecs', { Uint8Array, Error, Math });
(async () => {
  let n = 0, tNew = 0, tRef = 0;
  for (const f of process.argv.slice(2)) {
    const doc = await api.openFile(`../samples/${f}.procreate`);
    for (const list of doc.tilesByUUID.values()) for (const t of list) {
      const raw = await doc.zip.read(t.name);
      const a = new Uint8Array(256 * 256 * 4), b = new Uint8Array(256 * 256 * 4);
      let t0 = performance.now(); const na = t.kind === 'lz4' ? api.Codecs.bv4(raw, a) : api.Codecs.lzo(raw, a); tNew += performance.now() - t0;
      t0 = performance.now(); const nb = t.kind === 'lz4' ? ref.bv4(raw, b) : ref.lzo(raw, b); tRef += performance.now() - t0;
      if (na !== nb) throw new Error(`length differs ${t.name}`);
      for (let i = 0; i < na; i++) if (a[i] !== b[i]) throw new Error(`byte differs ${t.name} @${i}`);
      n++;
    }
  }
  console.log(`✓ ${n} tiles byte-identical; decode ${tNew.toFixed(0)} ms (v4 decoder ${tRef.toFixed(0)} ms)`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
