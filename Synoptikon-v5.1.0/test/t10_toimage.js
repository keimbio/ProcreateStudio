// Fast toImage paths vs the v5.0.0 reference implementation (kept in test/ref_composite_v5.js),
// for every orientation and flip combination, on real files.
const api = require('./load'); const fs = require('fs'), vm = require('vm');
const ref = vm.runInNewContext(fs.readFileSync(__dirname + '/ref_composite_v5.js', 'utf8') + ';Composite', { Map, Uint8Array, Uint8ClampedArray, Float32Array, Uint16Array, Math });
(async () => {
  for (const f of process.argv.slice(2)) {
    const doc = await api.openFile(`../samples/${f}.procreate`);
    const items = []; for (const L of [...doc.layers].reverse()) items.push({ tiles: await api.Procreate.loadTiles(doc, L.uuid, false), opacity: L.opacity, blend: L.blend, clipped: L.clipped });
    let t = Date.now(); const comp = api.Composite.compose(items, 'hide'); const tc = Date.now() - t;
    const compRef = ref.compose(items, 'hide');
    let cd = 0; for (const [i, a] of compRef) { const b = comp.get(i); for (let j = 0; j < a.length; j++) cd = Math.max(cd, Math.abs(a[j] - b[j])); }
    const out = [`${f}: compose ${tc} ms (max diff vs ref ${cd})`];
    for (const orientation of [0, 90, 180, 270]) for (const flipH of [false, true]) {
      const info = { ...doc.info, orientation, flipH, flipV: orientation === 90 && flipH };
      for (const [k, bg] of [[1, null], [1, [1, 1, 1]], [3, null]]) {
        let t0 = Date.now(); const a = api.Composite.toImage(comp, info, { k, bg }); const dt = Date.now() - t0;
        const b = ref.toImage(comp, info, { k, bg });
        if (a.w !== b.w || a.h !== b.h) throw new Error('size mismatch');
        let mx = 0, sum = 0; for (let i = 0; i < a.data.length; i++) { const d = Math.abs(a.data[i] - b.data[i]); sum += d; if (d > mx) mx = d; }
        const mean = sum / a.data.length;
        if (k === 1 && mx > 1) throw new Error(`k=1 mismatch ${f} rot${orientation} fh${flipH}: max ${mx}`);
        if (k > 1 && mean > 1.5) throw new Error(`k=${k} drift ${f} rot${orientation}: mean ${mean}`);
        if (orientation === 0 && !flipH) out.push(`k=${k}${bg ? '+bg' : ''} ${dt} ms (max ${mx}, mean ${mean.toFixed(3)})`);
      }
      const s = api.Composite.toImage(comp, info, { k: 8, sample: true }), b8 = ref.toImage(comp, info, { k: 8 });
      let sm = 0; for (let i = 0; i < s.data.length; i++) sm += Math.abs(s.data[i] - b8.data[i]);
      if (sm / s.data.length > 12) throw new Error(`sampled thumbnail too far off ${f} rot${orientation}`);
    }
    console.log('✓ ' + out.join(' · '));
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
