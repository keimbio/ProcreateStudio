// ─── Engine: message handler shared by the Web Worker and the main-thread fallback ───
// Keeps decoded tiles here so the UI thread never holds full-size layer buffers.

const Engine = (() => {
  let doc = null, tiles = new Map(), masks = new Map(), ownComposite = null;

  const serialTree = nodes => nodes.map(n => n.kind === 'group'
    ? { kind: 'group', id: n.id, name: n.name, hidden: n.hidden, children: serialTree(n.children) }
    : layerMeta(n));
  const layerMeta = L => ({ kind: 'layer', id: L.id, num: L.num, name: L.name, opacity: L.opacity, blend: L.blend, blendName: L.blendName,
    hidden: L.hidden, clipped: L.clipped, locked: L.locked, isText: L.isText, hasMask: !!L.mask, maskHidden: L.mask ? L.mask.hidden : false,
    parentId: L.parent ? L.parent.id : null });

  async function open(file, post) {
    doc = await Procreate.open(file); tiles = new Map(); masks = new Map(); ownComposite = null;
    const { info } = doc;
    post({ type: 'opened', info, tree: serialTree(doc.tree), layers: doc.layers.map(layerMeta), hasComposite: !!(doc.compositeUUID && doc.tilesByUUID.has(doc.compositeUUID)) });
    // decode every layer, emitting a thumbnail as each one lands
    const long = Math.max(info.width, info.height), tk = Math.max(1, Math.floor(long / 160));
    let done = 0;
    for (const L of doc.layers) {
      const t = await Procreate.loadTiles(doc, L.uuid, false); tiles.set(L.id, t);
      if (L.mask) masks.set(L.id, await Procreate.loadTiles(doc, L.mask.uuid, true));
      const th = Composite.toImage(t, info, { k: tk });
      post({ type: 'layer', id: L.id, empty: t.size === 0, thumb: th, progress: ++done / doc.layers.length }, [th.data.buffer]);
    }
    if (doc.compositeUUID) ownComposite = await Procreate.loadTiles(doc, doc.compositeUUID, false);
    post({ type: 'ready' });
  }

  // spec: { mode:'stack'|'solo'|'original', ids:[...], soloId, orphan, bg:[r,g,b]|null, orient, k, applyMask }
  function compose(spec) {
    if (spec.mode === 'original') return ownComposite || new Map();
    if (spec.mode === 'solo') {
      const L = doc.layers.find(l => l.id === spec.soloId); if (!L) return new Map();
      const m = spec.applyMask && L.mask && !L.mask.hidden ? masks.get(L.id) : null;
      return Composite.compose([{ tiles: tiles.get(L.id) || new Map(), maskTiles: m, opacity: 1, blend: 0, clipped: false }], 'show');
    }
    const want = new Set(spec.ids);
    const items = [];
    for (let i = doc.layers.length - 1; i >= 0; i--) { // bottom → top
      const L = doc.layers[i]; if (!want.has(L.id)) continue;
      items.push({ tiles: tiles.get(L.id) || new Map(), maskTiles: L.mask && !L.mask.hidden ? masks.get(L.id) : null,
        opacity: L.opacity, blend: L.blend, clipped: L.clipped });
    }
    return Composite.compose(items, spec.orphan || 'hide');
  }

  function render(spec) {
    const t = compose(spec);
    return Composite.toImage(t, doc.info, { k: spec.k || 1, bg: spec.bg, orient: spec.orient !== false });
  }

  async function handle(msg, post) {
    try {
      switch (msg.type) {
        case 'open': await open(msg.file, post); break;
        case 'render': { const img = render(msg.spec); post({ type: 'rendered', rid: msg.rid, img }, [img.data.buffer]); break; }
        case 'palette': {
          const { info } = doc; const k = Math.max(1, Math.round(Math.sqrt(info.width * info.height / 250000)));
          const img = render({ ...msg.spec, k, bg: null });
          post({ type: 'palette', rid: msg.rid, colors: Palette.extract(img.data, msg.count) }); break;
        }
        case 'thumbnail': { // Procreate's QuickLook preview
          const png = await doc.zip.read('QuickLook/Thumbnail.png'); post({ type: 'thumbnail', rid: msg.rid, png }); break;
        }
      }
    } catch (e) {
      post({ type: 'error', rid: msg.rid, message: (e && e.message) || String(e) });
    }
  }
  return { handle };
})();

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => Engine.handle(e.data, (m, tr) => self.postMessage(m, tr || []));
}
