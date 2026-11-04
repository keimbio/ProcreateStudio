const api = require('./load');
(async () => {
  const doc = await api.openFile('../samples/Mask_Test_File.procreate'); const P = api.Procreate;
  const L = doc.layers[0]; console.log('mask', L.mask, 'layer tiles', L.tileCount, doc.tilesByUUID.get(L.mask.uuid).length);
  const lt = await P.loadTiles(doc, L.uuid, false), ref = await P.loadTiles(doc, doc.compositeUUID, false);
  // raw decoded sizes of mask tiles
  const list = doc.tilesByUUID.get(L.mask.uuid);
  for (const t of list.slice(0, 3)) { const raw = await doc.zip.read(t.name); const buf = new Uint8Array(256*256*4); const n = api.Codecs[t.kind==='lz4'?'bv4':'lzo'](raw, buf); console.log(t.name.split('/')[1], 'decoded bytes', n); }
  const mt = await P.loadTiles(doc, L.mask.uuid, true);
  console.log('layer tile idx', [...lt.keys()].join(','), '\nmask idx', [...mt.keys()].join(','), '\nref idx', [...ref.keys()].join(','));
  // where layer has paint: compare ref alpha to layer alpha and mask value
  let s = []; for (const [idx, t] of lt) { const m = mt.get(idx), r = ref.get(idx); for (let p = 0; p < 65536; p += 4099) if (t[p*4+3]) s.push([idx, t[p*4+3], m ? m[p] : 'none', r ? r[p*4+3] : 'none', r? r[p*4]:'']); }
  console.log(s.slice(0, 25).map(x=>x.join('/')).join('  '));
})();
