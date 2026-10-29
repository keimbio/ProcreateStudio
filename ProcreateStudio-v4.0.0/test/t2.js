// Validate compositor against Procreate's own stored flattened render, per blend mode.
const api = require('./load');
(async () => {
  for (const f of process.argv.slice(2)) {
    const doc = await api.openFile(`../samples/${f}.procreate`);
    const P = api.Procreate, C = api.Composite;
    const visible = L => { if (L.hidden) return false; for (let g = L.parent; g; g = g.parent) if (g.hidden) return false; return true; };
    const items = [];
    for (const L of [...doc.layers].reverse()) {
      if (!visible(L)) continue;
      L.tiles = await P.loadTiles(doc, L.uuid, false);
      L.maskTiles = L.mask && !L.mask.hidden ? await P.loadTiles(doc, L.mask.uuid, true) : null;
      items.push(L);
    }
    const t0 = Date.now(); const out = C.compose(items, 'hide'); const ms = Date.now() - t0;
    const ref = await P.loadTiles(doc, doc.compositeUUID, false);
    // per-group error, measured over the tiles the group's top layer touches
    const report = [];
    const groups = new Map(); for (const L of doc.layers) { const k = L.parent ? L.parent.name : '(root) ' + L.name; if (!groups.has(k)) groups.set(k, L); }
    let tot = 0, tn = 0;
    for (const [name, L] of groups) {
      let e = 0, n = 0;
      for (const idx of (L.tiles || new Map()).keys()) {
        const a = out.get(idx) || new Uint8Array(65536 * 4), b = ref.get(idx) || new Uint8Array(65536 * 4);
        for (let i = 0; i < a.length; i++) { e += Math.abs(a[i] - b[i]); n++; }
      }
      tot += e; tn += n; report.push([name, n ? (e / n).toFixed(2) : '-']);
    }
    console.log(f, 'compose', ms + 'ms', 'overall mean abs err', (tot / tn).toFixed(2));
    console.log(report.map(r => r.join(':')).join('  '));
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
