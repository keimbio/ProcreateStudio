// ─── Engine: message handler shared by the Web Worker and the main-thread fallback ───
// One engine = one open document. The viewer and each side of Compare get their own,
// so decoded tiles stay inside their worker and the UI thread only receives finished images.

function createEngine() {
  let doc = null, tiles = new Map(), masks = new Map(), ownComposite = null;

  const serialTree = nodes => nodes.map(n => n.kind === 'group'
    ? { kind: 'group', id: n.id, name: n.name, hidden: n.hidden, children: serialTree(n.children) }
    : layerMeta(n));
  const layerMeta = L => ({ kind: 'layer', id: L.id, num: L.num, uuid: L.uuid, name: L.name, opacity: L.opacity, blend: L.blend, blendName: L.blendName,
    hidden: L.hidden, clipped: L.clipped, locked: L.locked, isText: L.isText, hasMask: !!L.mask, maskHidden: L.mask ? L.mask.hidden : false,
    parentId: L.parent ? L.parent.id : null, tileCount: L.tileCount });

  async function open(file, post) {
    doc = await Procreate.open(file); tiles = new Map(); masks = new Map(); ownComposite = null;
    const { info } = doc;
    post({ type: 'opened', info, tree: serialTree(doc.tree), layers: doc.layers.map(layerMeta), hasComposite: !!(doc.compositeUUID && doc.tilesByUUID.has(doc.compositeUUID)) });
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

  const byId = id => doc.layers.find(l => l.id === id);
  // items for a stack. ids are listed TOP → BOTTOM (panel order, which may differ from the file's)
  function stackItems(ids) {
    const items = [];
    for (let i = ids.length - 1; i >= 0; i--) {
      const L = byId(ids[i]); if (!L) continue;
      items.push({ tiles: tiles.get(L.id) || new Map(), maskTiles: L.mask && !L.mask.hidden ? masks.get(L.id) : null,
        opacity: L.opacity, blend: L.blend, clipped: L.clipped });
    }
    return items;
  }
  function bgItem(rgb) {
    const { tileSize: ts, cols, rows } = doc.info; const t = new Uint8Array(ts * ts * 4);
    for (let p = 0; p < t.length; p += 4) { t[p] = rgb[0] * 255; t[p + 1] = rgb[1] * 255; t[p + 2] = rgb[2] * 255; t[p + 3] = 255; }
    const m = new Map(); for (let i = 0; i < cols * rows; i++) m.set(i, t);
    return { tiles: m, maskTiles: null, opacity: 1, blend: 0, clipped: false };
  }

  // spec: { mode:'stack'|'solo'|'original', ids:[top→bottom], soloId, orphan, bg, orient, k, applyMask }
  function compose(spec) {
    if (spec.mode === 'original') return ownComposite || new Map();
    if (spec.mode === 'solo') {
      const L = byId(spec.soloId); if (!L) return new Map();
      const m = spec.applyMask && L.mask && !L.mask.hidden ? masks.get(L.id) : null;
      return Composite.compose([{ tiles: tiles.get(L.id) || new Map(), maskTiles: m, opacity: 1, blend: 0, clipped: false }], 'show');
    }
    return Composite.compose(stackItems(spec.ids || []), spec.orphan || 'hide');
  }
  function render(spec) {
    return Composite.toImage(compose(spec), doc.info, { k: spec.k || 1, bg: spec.bg, orient: spec.orient !== false });
  }

  // Per-layer tile fingerprints (CRC32 of each decoded tile) for Compare mode.
  function signature() {
    return doc.layers.map(L => {
      const t = tiles.get(L.id) || new Map(); const sig = {};
      for (const [idx, tile] of t) sig[idx] = Zip.crc32(tile);
      return { id: L.id, sig, n: t.size };
    });
  }

  async function encodePng(img, w, h) { // w, h: exact output size (resampled), defaults to the image's own
    if (typeof OffscreenCanvas === 'undefined') return null;
    let oc = new OffscreenCanvas(img.w, img.h); oc.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    if (w && h && (w !== img.w || h !== img.h)) {
      const o2 = new OffscreenCanvas(w, h), g = o2.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(oc, 0, 0, w, h); oc = o2;
    }
    if (!oc.convertToBlob) return null;
    return new Uint8Array(await (await oc.convertToBlob({ type: 'image/png' })).arrayBuffer());
  }
  async function pngSize() {
    const png = await doc.zip.read('QuickLook/Thumbnail.png');
    if (!png || png.length < 24) return null;
    const dv = new DataView(png.buffer, png.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  // edits: { tree, names, hidden|null, title }. Re-renders Procreate's stored composite and
  // QuickLook thumbnail from the edited stack so the gallery preview matches.
  async function save(edits, post) {
    const nodes = new Map(); (function ix(ns) { for (const n of ns) { nodes.set(n.id, n); if (n.children) ix(n.children); } })(doc.tree);
    const hiddenOf = n => edits.hidden && n.id in edits.hidden ? edits.hidden[n.id] : n.hidden;
    const visIds = [];
    (function walk(list, parentHidden) {
      for (const e of list) {
        const n = nodes.get(e.id); if (!n) continue; const h = parentHidden || hiddenOf(n);
        if (n.kind === 'group') walk(e.children || [], h); else if (!h) visIds.push(n.id);
      }
    })(edits.tree, false);
    post({ type: 'progress', rid: edits.rid, text: 'Rendering new preview…' });
    const items = stackItems(visIds);
    if (!doc.info.backgroundHidden) items.unshift(bgItem(doc.info.background));
    const compTiles = Composite.compose(items, 'hide');
    let thumbnail = null;
    try {
      const sz = await pngSize();
      if (sz) {
        const g = Composite.geometry(doc.info, true);
        const k = Math.max(1, Math.floor(Math.min(g.W / sz.w, g.H / sz.h)));
        thumbnail = await encodePng(Composite.toImage(compTiles, doc.info, { k, bg: null, orient: true }), sz.w, sz.h);
      }
    } catch (e) { thumbnail = null; }
    post({ type: 'progress', rid: edits.rid, text: 'Packing .procreate…' });
    return Writer.save(doc, edits, { compositeTiles: compTiles, thumbnail });
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
        case 'thumbnail': { const png = await doc.zip.read('QuickLook/Thumbnail.png'); post({ type: 'thumbnail', rid: msg.rid, png }); break; }
        case 'signature': post({ type: 'signature', rid: msg.rid, layers: signature() }); break;
        case 'save': { const r = await save({ ...msg.edits, rid: msg.rid }, post); post({ type: 'saved', rid: msg.rid, ...r }); break; }
      }
    } catch (e) {
      post({ type: 'error', rid: msg.rid, message: (e && e.message) || String(e) });
    }
  }
  return { handle };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const E = createEngine();
  self.onmessage = e => E.handle(e.data, (m, tr) => self.postMessage(m, tr || []));
}
