const api = require('./load'); const fs = require('fs');
(async () => {
  for (const f of ['reference', 'Reference_Blend_File', 'Mask_Test_File']) {
    const t0 = Date.now();
    const doc = await api.openFile(`../samples/${f}.procreate`);
    const { info } = doc;
    console.log(f, info.width + 'x' + info.height, 'ts', info.tileSize, 'orient', info.orientation, 'layers', doc.layers.length, 'composite', doc.compositeUUID, info.colorProfile, info.background.map(x=>x.toFixed(2)).join(','));
    // decode every layer + mask, count failures
    let ok = 0, tot = 0, fails = 0;
    for (const L of doc.layers) { const m = await api.Procreate.loadTiles(doc, L.uuid, false); ok += m.size; tot += L.tileCount; if (L.mask) await api.Procreate.loadTiles(doc, L.mask.uuid, true); }
    const comp = await api.Procreate.loadTiles(doc, doc.compositeUUID, false);
    console.log('  layer tiles nonempty', ok, '/', tot, ' composite tiles', comp.size, '/', doc.tilesByUUID.get(doc.compositeUUID).length, (Date.now() - t0) + 'ms');
    // raw stitch of composite (straight RGBA), row 0 = top, no orientation
    const { width: W, height: H, tileSize: ts, cols } = info; const img = new Uint8Array(W * H * 4);
    for (const [idx, tile] of comp) { const c = idx % cols, r = (idx / cols) | 0;
      for (let y = 0; y < ts; y++) { const Y = r * ts + y; if (Y >= H) break;
        for (let x = 0; x < ts; x++) { const X = c * ts + x; if (X >= W) break; const s = (y * ts + x) * 4, d = (Y * W + X) * 4; const a = tile[s + 3];
          img[d] = a ? Math.min(255, tile[s] * 255 / a) : 0; img[d + 1] = a ? Math.min(255, tile[s + 1] * 255 / a) : 0; img[d + 2] = a ? Math.min(255, tile[s + 2] * 255 / a) : 0; img[d + 3] = a; } } }
    fs.writeFileSync(`/tmp/claude-0/-home-claude/ec2a327c-b5d1-541c-b1bd-07581f1de2a1/scratchpad/${f}.raw`, img); fs.writeFileSync(`/tmp/claude-0/-home-claude/ec2a327c-b5d1-541c-b1bd-07581f1de2a1/scratchpad/${f}.json`, JSON.stringify({ W, H }));
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
