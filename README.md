# Procreate Studio

A viewer and converter for Procreate `.procreate` artwork. It runs entirely in the browser: it shows every layer, merges any combination of layers, exports images and builds a colour palette from the artwork. Nothing is uploaded, and the whole app is one self-contained `index.html` with no CDN, no backend and no tracking.

**Live:** https://keimbio.github.io/ProcreateStudio/ · **Version:** 4.0.0 · See [CHANGELOG.md](CHANGELOG.md)

## Features

| Area | What it does |
|---|---|
| Viewer | Composite, Single layer, Selected and Procreate render views. Zoom with the wheel or a pinch, drag to pan, fit and 1:1 buttons, optional document background, sharp pixels at high zoom |
| Layers | Group tree with thumbnails, show/hide for layers and groups, checkboxes, All/None/Visible/Invert, and selection by number (`1-5, 7`, counted from the bottom up) |
| Rendering | All 26 Procreate blend modes, layer opacity, layer masks, clipping masks, pass-through groups, canvas rotation and flips |
| Export | Composite, selected layers merged, selected layers as separate files, or every layer. PNG, JPG, WebP or TIFF (RGBA). Transparent, document-colour or white background. 100%, 50% or 25% size. Multiple files download as one ZIP |
| Palette | 3–30 colours from the current view (deterministic CIELAB k-means), sorted by amount, hue or lightness. Saves as `.swatches` (Procreate), `.ase`, `.aco`, `.act`, `.gpl`, `.css`, `.json` or `.png` |
| Info | Canvas size, print size at the file's DPI, groups, masks, rotation, background, colour profile, strokes, time spent in Procreate, author |
| Appearance | Dark, light or system mode. Wattle, Ember, Waratah and Carnival themes. S–XL text sizes. Settings are saved in `localStorage` |

HEIC isn't offered because no browser can encode it. Export a PNG, then use **Preview → File → Export → HEIC** on a Mac.

## The `.procreate` format (as implemented)

All of this was verified against real files.

```
artwork.procreate  (ZIP, may be ZIP64)
├── Document.archive            NSKeyedArchiver binary plist → SilicaDocument
├── <layer-UUID>/<col>~<row>.chunk   LZO1X tile (older Procreate)
├── <layer-UUID>/<col>~<row>.lz4     Apple LZ4 "bv41" block chain (newer); one layer can mix both
├── QuickLook/Thumbnail.png
└── video/segments/*.mp4        time-lapse (ignored)
```

- `size` is the string `"{w, h}"`; `tileSize` is usually 256. Edge tiles are stored cropped to the canvas.
- Tile pixels are **premultiplied RGBA**. Mask tiles hold 1 byte per pixel, and a missing mask tile means fully visible.
- **Rows are stored bottom-up.** Display order is: flip vertically → rotate clockwise by `orientation` (1 = 0°, 2 = 180°, 3 = 270°, 4 = 90°) → apply `flippedHorizontally/Vertically`.
- `unwrappedLayers[0]` is the **top** layer. `SilicaGroup` nodes hold `children` and `isHidden`. Groups are pass-through.
- The blend mode is `extendedBlend`, falling back to `blend`. Procreate numbers them its own way (see `Procreate.BLEND` in `src/js/core/procreate.js`).
- `composite` points to a layer UUID that holds Procreate's own flattened render. The app shows it as **Procreate render** and the tests use it as ground truth.
- The archive is cyclic (every layer has `document` → root), so references are resolved lazily, one step at a time.

## Architecture

```
src/
├── template.html          markup with placeholders
├── styles.css             design tokens, themes, layout
├── fonts/                 Hanken Grotesk + JetBrains Mono (woff2, OFL)
└── js/
    ├── core/              engine (runs in a Web Worker)
    │   ├── zip.js         lazy Blob-backed ZIP/ZIP64 reader + STORE writer + CRC32
    │   ├── bplist.js      binary plist parser + lazy NSKeyedArchiver accessor
    │   ├── codecs.js      LZO1X and LZ4/bv41 decoders
    │   ├── procreate.js   document model, layer tree, tile loading
    │   ├── composite.js   tile-sparse compositor, 26 blend modes, masks, clipping, orientation
    │   ├── palette.js     deterministic CIELAB k-means palette
    │   ├── encoders.js    TIFF, ASE, ACO, ACT, GPL, .swatches, CSS, JSON
    │   └── engine.js      worker message handler (falls back to the main thread)
    └── app.js             UI: state, layer tree, viewer, export, palette, settings
build.py                   → dist/index.html  (node --check, embeds fonts, asserts no placeholders remain)
test/                      Node + Playwright tests run against real sample files
```

Compositing is tile-sparse, so only the 256 × 256 tiles that contain paint are processed, and decoded tiles stay inside the worker. The UI thread only receives finished RGBA images, sent as transferable buffers.

### Build

```bash
python3 build.py          # requires Node.js for `node --check`
```

### Test

Put sample files in `../samples/` (the Silicate repo's `demo_files` work well), then run:

```bash
node test/t1.js           # decode every tile of every layer
node test/t2.js reference Mask_Test_File   # compositor vs Procreate's stored render, per blend mode
npm i playwright && node test/e2e.js /tmp  # end-to-end in Chromium
```

Results for v4.0.0: every tile decodes. The composite matches Procreate's stored render with a mean error of 0.79/255 across all blend modes, and the mask file matches to 0.21/255.

## Browser support

Current Chrome, Edge, Safari 16.4+ and Firefox 113+. The app needs `DecompressionStream` and `OffscreenCanvas` (with a `<canvas>` fallback). It works from `file://` or GitHub Pages.

## Credits

See [CREDITS.md](CREDITS.md). © Klara Keim, PhD.
