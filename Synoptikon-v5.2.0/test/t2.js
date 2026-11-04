// Compositor vs Procreate’s own stored render (background included), per file. Usage: node test/t2.js rgb parse-reference …
const api = require('./load');
(async () => {
  for (const f of process.argv.slice(2)) {
    const doc = await api.openFile(`../samples/${f}.procreate`);
    const P = api.Procreate, C = api.Composite; const ts = doc.info.tileSize;
    const items = [];
    // background layer as opaque tiles
    const bg = new Map(); const n = doc.info.cols * doc.info.rows;
    for (let i = 0; i < n; i++) { const t = new Uint8Array(ts*ts*4); for (let p=0;p<t.length;p+=4){t[p]=doc.info.background[0]*255;t[p+1]=doc.info.background[1]*255;t[p+2]=doc.info.background[2]*255;t[p+3]=255;} bg.set(i,t); }
    if (!doc.info.backgroundHidden) items.push({ tiles: bg, opacity: 1, blend: 0 });
    for (const L of [...doc.layers].reverse()) { if (L.hidden) continue; items.push({ tiles: await P.loadTiles(doc, L.uuid, false), maskTiles: L.mask && !L.mask.hidden ? await P.loadTiles(doc, L.mask.uuid, true) : null, opacity: L.opacity, blend: L.blend, clipped: L.clipped }); }
    const out = C.compose(items, 'hide'); const ref = await P.loadTiles(doc, doc.compositeUUID, false);
    let e = 0, k = 0, mx = 0;
    for (const [idx, b] of ref) { const a = out.get(idx); if (!a) { console.log('missing', idx); continue; }
      const { width: W, height: H, cols } = doc.info; const c = idx % cols, r = (idx / cols) | 0;
      for (let y = 0; y < Math.min(ts, H - r*ts); y++) for (let x = 0; x < Math.min(ts, W - c*ts); x++) for (let ch=0; ch<4; ch++) { const i=(y*ts+x)*4+ch; const d=Math.abs(a[i]-b[i]); e+=d; k++; if(d>mx)mx=d; } }
    console.log(f, 'bgHidden', doc.info.backgroundHidden, 'mean err', (e/k).toFixed(3), 'max', mx, doc.layers.map(l=>l.name+':'+l.blendName+':'+l.opacity.toFixed(2)).join(' | '));
  }
})();
