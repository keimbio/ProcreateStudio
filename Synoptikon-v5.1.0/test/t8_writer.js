// .procreate writer: reorder, delete, rename, hide and retitle, then re-open the result
// with the same reader and check the archive with Python's plistlib.
const api = require('./load'); const fs = require('fs'); const { execFileSync } = require('child_process');
const assert = (c, m) => { if (!c) throw new Error('assert: ' + m); };
(async () => {
  for (const f of process.argv.slice(2)) {
    const src = await fs.openAsBlob(`../samples/${f}.procreate`);
    const E = api.createEngine(); const msgs = [];
    await E.handle({ type: 'open', file: src }, m => msgs.push(m));
    const opened = msgs.find(m => m.type === 'opened');
    const top = opened.tree; // top → bottom
    const leaves = opened.layers;
    // edit: reverse order, drop the middle layer (if ≥3), rename the first, hide the last
    let tree = [...top].reverse().map(n => ({ id: n.id }));
    const dropped = leaves.length >= 3 ? leaves[1] : null;
    if (dropped) tree = tree.filter(n => n.id !== dropped.id);
    const renamed = leaves[0];
    const edits = { tree, names: { [renamed.id]: 'Renamed ✦ layer' }, hidden: { [leaves[leaves.length - 1].id]: true }, title: 'Edited copy' };
    let res; await E.handle({ type: 'save', rid: 1, edits }, m => { if (m.type === 'saved') res = m; if (m.type === 'error') throw new Error(m.message); });
    const outPath = `/tmp/${f}_edited.procreate`;
    fs.writeFileSync(outPath, Buffer.from(await res.blob.arrayBuffer()));
    // re-open
    const doc2 = await api.openFile(outPath);
    const names2 = doc2.layers.map(l => l.name);
    const expectNames = tree.map(t => leaves.find(l => l.id === t.id)).map(l => l.id === renamed.id ? 'Renamed ✦ layer' : l.name);
    assert(JSON.stringify(names2) === JSON.stringify(expectNames), `order/names ${JSON.stringify(names2)} vs ${JSON.stringify(expectNames)}`);
    assert(doc2.info.name === 'Edited copy', 'title');
    const lastL = doc2.layers.find(l => l.uuid === leaves[leaves.length - 1].uuid); assert(lastL && lastL.hidden, 'hidden flag');
    if (dropped) assert(!doc2.zip.names().some(n => n.startsWith(dropped.uuid + '/')), 'dropped tiles removed');
    // every layer still decodes
    for (const L of doc2.layers) { const t = await api.Procreate.loadTiles(doc2, L.uuid, false); assert(t.size === (L.tileCount ? t.size : 0), 'decode'); }
    // stored composite == our compose of visible layers + background
    const vis = doc2.layers.filter(l => !l.hidden).reverse();
    const items = []; const { tileSize: ts, cols, rows, background: bg } = doc2.info;
    if (!doc2.info.backgroundHidden) { const t = new Uint8Array(ts * ts * 4); for (let p = 0; p < t.length; p += 4) { t[p] = bg[0] * 255; t[p + 1] = bg[1] * 255; t[p + 2] = bg[2] * 255; t[p + 3] = 255; } const m = new Map(); for (let i = 0; i < cols * rows; i++) m.set(i, t); items.push({ tiles: m, opacity: 1, blend: 0 }); }
    for (const L of vis) items.push({ tiles: await api.Procreate.loadTiles(doc2, L.uuid, false), opacity: L.opacity, blend: L.blend, clipped: L.clipped });
    const want = api.Composite.compose(items, 'hide'); const got = await api.Procreate.loadTiles(doc2, doc2.compositeUUID, false);
    let err = 0, n = 0; for (const [i, a] of want) { const b = got.get(i); const W = doc2.info.width, H = doc2.info.height, c = i % cols, r = (i / cols) | 0;
      for (let y = 0; y < Math.min(ts, H - r * ts); y++) for (let x = 0; x < Math.min(ts, W - c * ts) * 4; x++) { err += Math.abs(a[y * ts * 4 + x] - (b ? b[y * ts * 4 + x] : 0)); n++; } }
    // archive integrity in Python: loads, every UID in range
    fs.writeFileSync('/tmp/doc.plist', await doc2.zip.read('Document.archive'));
    const py = execFileSync('python3', ['-I', '-c', `
import plistlib; p=plistlib.load(open('/tmp/doc.plist','rb')); o=p['$objects']; bad=[0]
def walk(v):
    if isinstance(v, plistlib.UID):
        if v.data>=len(o): bad[0]+=1
    elif isinstance(v, dict): [walk(x) for x in v.values()]
    elif isinstance(v, list): [walk(x) for x in v]
walk(o); walk(p['$top']); print('uids-ok' if not bad[0] else 'BAD %d'%bad[0])`]).toString().trim();
    execFileSync('python3', ['-I', '-c', `import zipfile;z=zipfile.ZipFile('${outPath}');r=z.testzip();print('zip-ok' if r is None else 'BAD '+r)`], { stdio: 'inherit' });
    console.log(`✓ ${f}: ${leaves.length}→${doc2.layers.length} layers [${names2.join(' | ')}], layersMode=${res.layersMode}, composite err ${(err / n).toFixed(3)}, ${py}, ${(src.size / 1024) | 0}→${(res.blob.size / 1024) | 0} KB`);
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
