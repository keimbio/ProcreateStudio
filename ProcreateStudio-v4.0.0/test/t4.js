const api = require('./load');
(async () => {
  const doc = await api.openFile('../samples/Mask_Test_File.procreate'); const P = api.Procreate, C = api.Composite;
  const L = doc.layers[0]; L.tiles = await P.loadTiles(doc, L.uuid, false); const mt = await P.loadTiles(doc, L.mask.uuid, true);
  const ref = await P.loadTiles(doc, doc.compositeUUID, false);
  for (const missing of ['white', 'black']) {
    const m = new Map(mt); if (missing === 'black') for (const k of L.tiles.keys()) if (!m.has(k)) m.set(k, new Uint8Array(65536));
    L.maskTiles = m;
    // background tile layer
    const bgT = new Map(); const bgc = doc.info.background; for (let i = 0; i < doc.info.cols * doc.info.rows; i++) { const t = new Uint8Array(65536 * 4); for (let p = 0; p < 65536; p++) { t[p*4] = bgc[0]*255; t[p*4+1] = bgc[1]*255; t[p*4+2] = bgc[2]*255; t[p*4+3] = 255; } bgT.set(i, t); }
    const out = C.compose([{ tiles: bgT, opacity: 1, blend: 0 }, L], 'hide');
    let e = 0, n = 0; for (const [idx, r] of ref) { const a = out.get(idx); for (let i = 0; i < r.length; i++) { e += Math.abs(a[i] - r[i]); n++; } }
    console.log('missing mask tile =', missing, ' mean err', (e / n).toFixed(3));
  }
})();
