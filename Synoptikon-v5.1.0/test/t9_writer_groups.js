// writer on grouped fixture: move Green into Inner group, rename Outer, hide Inner, delete Blue
const api = require('./load'); const fs = require('fs');
(async () => {
  const E = api.createEngine(); const msgs = []; await E.handle({ type: 'open', file: await fs.openAsBlob('/tmp/grouped.procreate') }, m => msgs.push(m));
  const o = msgs.find(m => m.type === 'opened'); const t = o.tree;
  const outer = t[0], blue = outer.children[0], inner = outer.children[1], red = inner.children[0], green = t[1];
  const tree = [{ id: outer.id, children: [{ id: inner.id, children: [{ id: green.id }, { id: red.id }] }] }];
  let res; await E.handle({ type: 'save', rid: 1, edits: { tree, names: { [outer.id]: 'Renamed outer' }, hidden: { [inner.id]: true }, title: null } }, m => { if (m.type === 'saved') res = m; if (m.type === 'error') throw new Error(m.message); });
  fs.writeFileSync('/tmp/grouped_edit.procreate', Buffer.from(await res.blob.arrayBuffer()));
  const d = await api.openFile('/tmp/grouped_edit.procreate');
  const show = ns => ns.map(n => n.kind === 'group' ? `${n.name}${n.hidden ? '(hidden)' : ''}[${show(n.children)}]` : n.name).join(', ');
  console.log('after edit:', show(d.tree), '| layersMode', res.layersMode, '| tiles of Blue removed:', !d.zip.names().some(n => n.startsWith(blue.uuid)));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
