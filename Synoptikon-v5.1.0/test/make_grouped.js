// Test fixture: wraps layers of a real sample into nested groups (SilicaGroup), since none
// of the public sample files contain groups. SYNTHETIC — real Procreate group files must
// still be checked; see CHANGELOG "Known limitations".
const api = require('./load'); const fs = require('fs');
(async () => {
  const [src, out] = process.argv.slice(2);
  const doc = await api.openFile(src);
  const P = api.PlistEdit.parse(await doc.zip.read('Document.archive'));
  const O = P.get('$objects'), root = O[P.get('$top').get('root').$uid];
  const uw = O[root.get('unwrappedLayers').$uid], arrCls = uw.get('$class');
  const L = uw.get('NS.objects').map(u => u.$uid); // top → bottom
  const add = v => { O.push(v); return { $uid: O.length - 1 }; };
  const gCls = add(new Map([['$classname', 'SilicaGroup'], ['$classes', ['SilicaGroup', 'NSObject']]]));
  const group = (name, kids, hidden) => add(new Map([['$class', gCls], ['children', add(new Map([['NS.objects', kids], ['$class', arrCls]]))], ['isHidden', !!hidden], ['name', add(name)]]));
  const inner = group('Inner group', [{ $uid: L[1] }]);
  const outer = group('Outer group', [{ $uid: L[0] }, inner]);
  uw.set('NS.objects', [outer, ...L.slice(2).map(u => ({ $uid: u }))]);
  const items = doc.zip.names().map(n => n === 'Document.archive' ? { name: n, data: api.PlistEdit.write(P) } : { copy: doc.zip.entries.get(n), from: doc.zip });
  fs.writeFileSync(out, Buffer.from(await (await api.Zip.rewrite(items)).arrayBuffer()));
  const d2 = await api.openFile(out);
  console.log('grouped fixture:', JSON.stringify(d2.tree.map(n => n.kind === 'group' ? { g: n.name, c: n.children.map(c => c.kind === 'group' ? { g: c.name, c: c.children.map(x => x.name) } : c.name) } : n.name)));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
