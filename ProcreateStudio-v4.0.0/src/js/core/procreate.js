// ─── .procreate document model ───
// Format (verified against real files): ZIP containing
//   Document.archive         NSKeyedArchiver binary plist (SilicaDocument)
//   <layer UUID>/<col>~<row>.chunk   LZO1X tile  (older Procreate)
//   <layer UUID>/<col>~<row>.lz4     Apple bv41 LZ4 tile (newer Procreate)
//   QuickLook/Thumbnail.png
// A single layer can mix .chunk and .lz4 tiles. Tiles are premultiplied RGBA
// (masks: 1 byte/px grey). Edge tiles are cropped to the canvas size.
// Layer order: unwrappedLayers[0] is the TOP of the stack. Groups are pass-through.

const Procreate = (() => {
  // Procreate's own blend-mode numbering (extendedBlend, falling back to blend)
  const BLEND = {
    0: 'Normal', 1: 'Multiply', 2: 'Screen', 3: 'Add', 4: 'Lighten', 5: 'Exclusion', 6: 'Difference',
    7: 'Subtract', 8: 'Linear Burn', 9: 'Color Dodge', 10: 'Color Burn', 11: 'Overlay', 12: 'Hard Light',
    13: 'Color', 14: 'Luminosity', 15: 'Hue', 16: 'Saturation', 17: 'Soft Light', 19: 'Darken',
    20: 'Hard Mix', 21: 'Vivid Light', 22: 'Linear Light', 23: 'Pin Light', 24: 'Lighter Color',
    25: 'Darker Color', 26: 'Divide'
  };
  const ORIENT = { 1: 0, 2: 180, 3: 270, 4: 90 }; // clockwise degrees

  async function open(blob) {
    const zip = await Zip.open(blob);
    const arc = await zip.read('Document.archive');
    if (!arc) throw new Error('Document.archive is missing — the file may be damaged or not a Procreate artwork.');
    const K = BPlist.keyed(BPlist.parse(arc));
    const root = K.root;
    const sizeStr = K.str(root, 'size') || '';
    const m = sizeStr.match(/(\d+)\D+(\d+)/);
    if (!m) throw new Error('Could not read canvas size from Document.archive');
    const width = +m[1], height = +m[2];
    const tileSize = K.get(root, 'tileSize') || 256;

    // index the zip once: uuid -> [{col,row,name,kind}]
    const tilesByUUID = new Map();
    for (const name of zip.names()) {
      const mm = name.match(/^([^/]+)\/(\d+)~(\d+)\.(chunk|lz4)$/);
      if (!mm) continue;
      if (!tilesByUUID.has(mm[1])) tilesByUUID.set(mm[1], []);
      tilesByUUID.get(mm[1]).push({ col: +mm[2], row: +mm[3], name, kind: mm[4] });
    }

    let nextId = 0;
    const layers = [];      // flat, top → bottom (layers only)
    function readLayer(o, parent) {
      const uuid = K.str(o, 'UUID');
      const ext = K.get(o, 'extendedBlend'), bl = K.get(o, 'blend');
      const blend = (ext != null && BLEND[ext] !== undefined) ? ext : (BLEND[bl] !== undefined ? bl : 0);
      const maskObj = K.get(o, 'mask');
      let mask = null;
      if (maskObj && typeof maskObj === 'object') {
        const mu = K.str(maskObj, 'UUID');
        if (mu && tilesByUUID.has(mu)) mask = { uuid: mu, hidden: !!K.get(maskObj, 'hidden') };
      }
      const L = {
        kind: 'layer', id: nextId++, uuid, parent,
        name: K.str(o, 'name') || 'Untitled Layer',
        opacity: typeof K.get(o, 'opacity') === 'number' ? K.get(o, 'opacity') : 1,
        blend, blendName: BLEND[blend],
        hidden: !!K.get(o, 'hidden'), clipped: !!K.get(o, 'clipped'), locked: !!K.get(o, 'locked'),
        isText: !!K.get(o, 'text'), mask,
        tileCount: (tilesByUUID.get(uuid) || []).length
      };
      layers.push(L); return L;
    }
    function walk(list, parent) {
      return list.map(o => {
        if (K.cls(o) === 'SilicaGroup') {
          const g = { kind: 'group', id: nextId++, name: K.str(o, 'name') || 'Group', hidden: !!K.get(o, 'isHidden'), parent, children: [] };
          g.children = walk(K.arr(o, 'children'), g);
          return g;
        }
        return readLayer(o, parent);
      });
    }
    const tree = walk(K.arr(root, 'unwrappedLayers'), null);
    // bottom-up number, matching Procreate's "Layer 1 is at the bottom" convention
    layers.forEach((L, i) => { L.num = layers.length - i; });

    const compositeObj = K.get(root, 'composite');
    const compositeUUID = compositeObj ? K.str(compositeObj, 'UUID') : null;

    let bg = [1, 1, 1, 1];
    const bgBytes = K.get(root, 'backgroundColor');
    if (bgBytes instanceof Uint8Array && bgBytes.length >= 16) {
      const dv = new DataView(bgBytes.buffer, bgBytes.byteOffset, 16);
      bg = [0, 1, 2, 3].map(i => dv.getFloat32(i * 4, true));
    }
    const profile = K.get(root, 'colorProfile');
    const info = {
      name: K.str(root, 'name') || null,
      author: K.str(root, 'authorName') || null,
      width, height, tileSize,
      cols: Math.ceil(width / tileSize), rows: Math.ceil(height / tileSize),
      dpi: K.get(root, 'SilicaDocumentArchiveDPIKey') || null,
      orientation: ORIENT[K.get(root, 'orientation')] || 0,
      flipH: !!K.get(root, 'flippedHorizontally'), flipV: !!K.get(root, 'flippedVertically'),
      background: bg, backgroundHidden: !!K.get(root, 'backgroundHidden'),
      strokeCount: K.get(root, 'strokeCount') || 0,
      trackedTime: K.get(root, 'SilicaDocumentTrackedTimeKey') || 0,
      colorProfile: (profile && typeof profile === 'object' && (K.str(profile, 'SiColorProfileArchiveICCNameKey'))) || null,
      version: K.get(root, 'version'),
      animation: false
    };
    const anim = K.get(root, 'animation');
    if (anim && typeof anim === 'object') info.animation = !!K.get(root, 'featureSet') && K.get(root, 'featureSet') === 2;

    return { zip, info, tree, layers, compositeUUID, tilesByUUID };
  }

  // Decode every tile of one UUID into a sparse Map(tileIndex -> Uint8Array).
  // RGBA tiles are padded to tileSize² ×4; mask tiles to tileSize² ×1.
  async function loadTiles(doc, uuid, isMask) {
    const { tileSize: ts, width, height, cols, rows } = doc.info;
    const out = new Map();
    const list = doc.tilesByUUID.get(uuid) || [];
    const bpp = isMask ? 1 : 4;
    for (const t of list) {
      if (t.col >= cols || t.row >= rows) continue;
      const tw = t.col === cols - 1 ? width - t.col * ts : ts;
      const th = t.row === rows - 1 ? height - t.row * ts : ts;
      const need = tw * th * bpp;
      const raw = await doc.zip.read(t.name);
      const buf = new Uint8Array(need);
      let n;
      try { n = t.kind === 'lz4' ? Codecs.bv4(raw, buf) : Codecs.lzo(raw, buf); }
      catch (e) { continue; } // damaged tile: skip, keep the rest of the layer
      if (n < need) continue;
      let tile;
      if (tw === ts && th === ts) tile = buf;
      else { tile = new Uint8Array(ts * ts * bpp); for (let y = 0; y < th; y++) tile.set(buf.subarray(y * tw * bpp, (y + 1) * tw * bpp), y * ts * bpp); }
      // skip fully transparent tiles to keep compositing sparse
      if (!isMask) { let any = false; for (let i = 3; i < tile.length; i += 4) if (tile[i]) { any = true; break; } if (!any) continue; }
      out.set(t.row * cols + t.col, tile);
    }
    return out;
  }

  return { open, loadTiles, BLEND };
})();
