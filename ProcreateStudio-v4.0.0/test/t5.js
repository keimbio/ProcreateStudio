const api = require('./load'); const fs = require('fs'); const S = process.argv[2];
(async () => {
  const doc = await api.openFile('../samples/reference.procreate'); const P = api.Procreate, C = api.Composite;
  const ref = await P.loadTiles(doc, doc.compositeUUID, false);
  let t0 = Date.now(); const img = C.toImage(ref, doc.info, { k: 1 }); const t1 = Date.now() - t0;
  const small = C.toImage(ref, doc.info, { k: 4 });
  t0 = Date.now(); const pal = api.Palette.extract(small.data, 12); const t2 = Date.now() - t0;
  const pal2 = api.Palette.extract(small.data, 12);
  console.log('toImage', img.w + 'x' + img.h, t1 + 'ms; palette', t2 + 'ms deterministic:', JSON.stringify(pal) === JSON.stringify(pal2));
  console.log(api.Palette.sort(pal, 'share').map(c => c.hex + ' ' + (c.share * 100).toFixed(1) + '%').join(', '));
  const save = async (n, b) => fs.writeFileSync(S + '/' + n, Buffer.from(await b.arrayBuffer()));
  await save('t_rgba.tif', api.Encoders.tiff(img, true)); await save('t_rgb.tif', api.Encoders.tiff(C.toImage(ref, doc.info, { k: 2, bg: [1, 1, 1] }), false));
  await save('p.ase', api.Encoders.ase(pal, 'Test')); await save('p.swatches', api.Encoders.swatches(pal, 'Test')); await save('p.aco', api.Encoders.aco(pal)); await save('p.gpl', api.Encoders.gpl(pal, 'Test'));
  fs.writeFileSync(S + '/small.json', JSON.stringify({ w: small.w, h: small.h })); fs.writeFileSync(S + '/small.raw', Buffer.from(small.data.buffer));
})();
