// ─── .procreate writer: re-package an edited artwork ───
// Edits are applied to the original Document.archive (NSKeyedArchiver), never rebuilt
// from scratch, so every property this tool does not understand is carried over as-is.
//   • order / grouping → rewrites the NSArrays `unwrappedLayers`, `layers` and each group's `children`
//   • delete           → drops the layer from those arrays and its <UUID>/ tile folder (and mask) from the ZIP
//   • rename           → appends a new string to $objects and points `name` at it
//   • visibility       → `hidden` (layers) / `isHidden` (groups)
// Procreate's stored flattened render (`composite`) and QuickLook/Thumbnail.png would show
// the old artwork after edits, so the engine passes freshly rendered replacements.
// Unchanged entries are copied byte-for-byte (still compressed) from the source file.

const Writer = (() => {
  const uid = n => ({ $uid: n });
  const isUid = v => v && typeof v === 'object' && '$uid' in v;

  // edits: { tree:[{id, children?}], names:{id:str}, hidden:{id:bool}|null, title:str|null }
  // extra: { compositeTiles: Map(idx → premultiplied RGBA tile ts²) | null, thumbnail: Uint8Array | null }
  async function save(doc, edits, extra = {}) {
    const plist = PlistEdit.parse(doc.archive);
    const objects = plist.get('$objects');
    const rootUid = plist.get('$top').get('root').$uid;
    const root = objects[rootUid];
    const D = u => objects[u];
    const nodeById = new Map(); const allOld = [];
    (function index(ns) { for (const n of ns) { nodeById.set(n.id, n); allOld.push(n); if (n.children) index(n.children); } })(doc.tree);

    // ── new structure ──
    const keep = new Set(); const newFlatLeaves = []; const newDfs = [];
    const toUids = list => list.map(e => {
      const n = nodeById.get(e.id); if (!n) throw new Error('Unknown layer id ' + e.id);
      keep.add(n.id); newDfs.push(n.uid);
      if (n.kind === 'group') {
        const kids = toUids(e.children || []);
        setArray(D(n.uid), 'children', kids);
      } else newFlatLeaves.push(n.uid);
      return n.uid;
    });
    function setArray(dict, key, uids) {
      const ref = dict.get(key);
      if (!isUid(ref)) throw new Error(`Archive has no “${key}” array to update`);
      const arr = D(ref.$uid);
      arr.set('NS.objects', uids.map(uid));
    }
    const origTop = arrUids(root.get('unwrappedLayers'));
    const origLayers = arrUids(root.get('layers'));
    const origLeaves = doc.layers.map(l => l.uid);
    function arrUids(ref) { if (!isUid(ref)) return null; const a = D(ref.$uid); const o = a && a.get && a.get('NS.objects'); return o ? o.map(x => x.$uid) : null; }
    const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

    const newTop = toUids(edits.tree);
    if (!newFlatLeaves.length) throw new Error('A Procreate file needs at least one layer.');
    // `layers` mirrors whichever convention this file uses (top level, flat leaves, or other)
    let layersMode = 'other';
    if (same(origLayers, origTop)) layersMode = 'top'; else if (same(origLayers, origLeaves)) layersMode = 'leaves';
    const unwrappedRef = root.get('unwrappedLayers'), layersRef = root.get('layers');
    setArray(root, 'unwrappedLayers', newTop);
    if (origLayers && !(isUid(layersRef) && isUid(unwrappedRef) && layersRef.$uid === unwrappedRef.$uid)) {
      if (layersMode === 'top') setArray(root, 'layers', newTop);
      else if (layersMode === 'leaves') setArray(root, 'layers', newFlatLeaves);
      else { const pos = new Map(newDfs.map((u, i) => [u, i])); setArray(root, 'layers', origLayers.filter(u => pos.has(u) || !allOld.some(n => n.uid === u)).sort((a, b) => (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9))); }
    }

    // ── deleted ──
    const deleted = allOld.filter(n => !keep.has(n.id));
    const deletedUids = new Set(deleted.map(n => n.uid));
    const dropDirs = new Set();
    for (const n of deleted) if (n.kind === 'layer') { if (n.uuid) dropDirs.add(n.uuid); if (n.mask) dropDirs.add(n.mask.uuid); }
    for (const key of ['selectedLayer', 'primaryItem', 'selectedSamplerLayer', 'solo']) {
      const r = root.get(key);
      if (isUid(r) && deletedUids.has(r.$uid)) root.set(key, key === 'selectedLayer' || key === 'primaryItem' ? uid(newFlatLeaves[0]) : uid(0));
    }

    // ── names, visibility, title ──
    const addString = s => { objects.push(String(s)); return uid(objects.length - 1); };
    for (const [id, name] of Object.entries(edits.names || {})) {
      const n = nodeById.get(+id); if (!n || !keep.has(n.id)) continue;
      D(n.uid).set('name', addString(name));
    }
    if (edits.hidden) for (const [id, h] of Object.entries(edits.hidden)) {
      const n = nodeById.get(+id); if (!n || !keep.has(n.id)) continue;
      D(n.uid).set(n.kind === 'group' ? 'isHidden' : 'hidden', !!h);
    }
    if (edits.title != null && edits.title !== '') root.set('name', addString(edits.title));

    const archive = PlistEdit.write(plist);

    // ── ZIP ──
    const zip = doc.zip; const items = [];
    const { tileSize: ts, width, height, cols, rows } = doc.info;
    const newComposite = extra.compositeTiles && doc.compositeUUID;
    for (const name of zip.names()) {
      const dir = name.includes('/') ? name.slice(0, name.indexOf('/')) : '';
      if (dropDirs.has(dir)) continue;
      if (newComposite && dir === doc.compositeUUID) continue;
      if (name === 'Document.archive') { items.push({ name, data: archive }); continue; }
      if (name === 'QuickLook/Thumbnail.png' && extra.thumbnail) { items.push({ name, data: extra.thumbnail }); continue; }
      items.push({ copy: zip.entries.get(name), from: zip });
    }
    if (newComposite) {
      for (const [idx, tile] of extra.compositeTiles) {
        const c = idx % cols, r = (idx / cols) | 0; if (c >= cols || r >= rows) continue;
        const tw = c === cols - 1 ? width - c * ts : ts, th = r === rows - 1 ? height - r * ts : ts;
        let raw = tile instanceof Uint8Array ? tile : new Uint8Array(tile.buffer, tile.byteOffset, tile.length);
        if (tw !== ts || th !== ts) { const cr = new Uint8Array(tw * th * 4); for (let y = 0; y < th; y++) cr.set(raw.subarray(y * ts * 4, y * ts * 4 + tw * 4), y * tw * 4); raw = cr; }
        items.push({ name: `${doc.compositeUUID}/${c}~${r}.lz4`, data: Codecs.bv4Encode(raw) });
      }
    }
    if (items.length > 65535) throw new Error('This artwork has too many tiles for this tool to re-package.');
    const blob = await Zip.rewrite(items);
    return { blob, removedLayers: deleted.filter(n => n.kind === 'layer').length, removedGroups: deleted.filter(n => n.kind === 'group').length, layersMode };
  }

  return { save };
})();
