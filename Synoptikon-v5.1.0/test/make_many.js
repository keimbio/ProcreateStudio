// Test fixture: a real sample with its layers repeated (and grouped) until there are N rows,
// for testing long layer lists (scrolling, selection). SYNTHETIC — for UI tests only.
const api = require('./load'); const fs = require('fs');
(async () => {
  const [src, out, N = 60] = process.argv.slice(2);
  const doc = await api.openFile(src);
  const P = api.PlistEdit.parse(await doc.zip.read('Document.archive'));
  const O = P.get('$objects'), root = O[P.get('$top').get('root').$uid];
  const uw = O[root.get('unwrappedLayers').$uid], arrCls = uw.get('$class'), L = uw.get('NS.objects').map(u => u.$uid);
  const add = v => { O.push(v); return { $uid: O.length - 1 }; };
  const gCls = add(new Map([['$classname', 'SilicaGroup'], ['$classes', ['SilicaGroup', 'NSObject']]]));
  const kids = []; for (let i = 0; i < +N; i++) kids.push({ $uid: L[i % L.length] });
  const groups = []; for (let g = 0; g < kids.length; g += 10) groups.push(add(new Map([['$class', gCls], ['children', add(new Map([['NS.objects', kids.slice(g, g + 10)], ['$class', arrCls]]))], ['isHidden', false], ['name', add('Group ' + (g / 10 + 1))]])));
  uw.set('NS.objects', groups);
  const items = doc.zip.names().map(n => n === 'Document.archive' ? { name: n, data: api.PlistEdit.write(P) } : { copy: doc.zip.entries.get(n), from: doc.zip });
  fs.writeFileSync(out, Buffer.from(await (await api.Zip.rewrite(items)).arrayBuffer()));
  console.log('many-layer fixture:', (await api.openFile(out)).layers.length, 'layers');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
