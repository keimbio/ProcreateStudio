# Synoptikon

*From the Greek* syn *‘together’ +* optikos *‘of seeing’ — seeing all together. Formerly Procreate Studio; the name is set in one place (`APP_NAME` in `build.py`).*

A viewer, layer editor and comparison tool for Procreate `.procreate` artwork. It runs entirely in the browser: browse every layer, reorder / rename / hide / delete layers, export images or a **new `.procreate` file**, compare two files layer by layer, and build a colour palette from the artwork. Nothing is uploaded, and the whole app is one self-contained `index.html` with no CDN, no backend and no tracking.

**Version:** 5.1.0 · See [CHANGELOG.md](CHANGELOG.md) · UX rationale in [docs/DESIGN.md](docs/DESIGN.md)

## Features

| Area | What it does |
|---|---|
| Look | Spectator-family layout (title bar → panel → view bar → credits footer) with its own identity: Synoptikon wordmark, Desert Summer palette, Cormorant Garamond titles over Hanken Grotesk. Five themes from the reference palettes (Desert Summer, Retro Warmth, Meadow, Candlelight, Studio), dark / light / system, S–XL text |
| Viewer | View bar: **Show** (Visible layers · Selected only · Procreate render), **Background** switch, **Zoom**. Nothing floats over the canvas; a footer line says what is shown, and the Details tab describes it in full |
| Panels | One tabbed dock — **Layers · Details · Palette · Quick export** — right or left, resizable, hideable to an icon rail with pop-out panels |
| Layers | Outline (compact) and Preview (thumbnails S/M/L) lists; eight distinct group colours; click / ⇧-click / ⌘-click selection, All · None · Visible · Invert · by number; ⌥-click an eye to solo |
| Editing | Drag & drop (into / out of groups), ⌥↑/⌥↓, rename, delete, show/hide, unlimited undo/redo, Revert all; an **Unsaved layer edits** badge until you save a .procreate |
| Export window | Spectator-style: what to export (What you see · Visible merged · Selected merged · Selected one each · Every layer) with live preview and layer list; PNG · JPEG · WebP · TIFF; background, size, quality; **Save .procreate**; palette downloads |
| Quick export | Export what you see in one click; save the edited .procreate |
| .procreate | New file with order, grouping, names, deletions, visibility and title; re-rendered composite and gallery thumbnail; tile timestamps preserved |
| Compare | Files A/B (Files tab: choose, use the Viewer’s file, remove; Swap; Clear). Side by side (locked zoom), Swipe, Onion skin, Difference with sensitivity and ten highlight colours (incl. heat). Layer pairs matched by internal ID then name; filter chips (All · Changed · Added · Removed · Same); sort by stack, name, type, most changed or **last modified**; group by type. Artwork table |
| Details | On the canvas · Selected layer (incl. **last painted** time from tile timestamps) · Artwork facts |
| Rendering | All 26 blend modes, opacity, masks, clipping, pass-through groups, rotation and flips. Composites are cached and re-used by previews, palette and exports |
| Palette | 3–30 colours (deterministic CIELAB k-means); `.swatches`, `.ase`, `.aco`, `.act`, `.gpl`, `.css`, `.json`, `.png` |

## Architecture

```
src/
├── template.html          markup with {{placeholders}}
├── styles.css             design tokens, themes, layout (dock, rail, tree, compare)
├── fonts/                 Hanken Grotesk + Cormorant Garamond (woff2, OFL)
├── img/                   wordmark.webp, logo.webp (embedded as data URIs by build.py)
└── js/
    ├── core/              engine — runs in a Web Worker (one per open document)
    │   ├── zip.js         lazy Blob-backed ZIP/ZIP64 reader · STORE writer · raw-copy rewrite()
    │   ├── bplist.js      fast lazy binary-plist reader + NSKeyedArchiver accessor
    │   ├── plistedit.js   lossless, type-preserving bplist parse + write (for editing)
    │   ├── codecs.js      LZO1X + LZ4/bv41 decoders, LZ4/bv41 encoder
    │   ├── procreate.js   document model, layer tree (with archive object indexes), tile loading
    │   ├── composite.js   tile-sparse compositor, 26 blend modes, masks, clipping; toImage: exact (k=1), box, sampled
    │   ├── palette.js     deterministic CIELAB k-means palette
    │   ├── encoders.js    TIFF, ASE, ACO, ACT, GPL, .swatches, CSS, JSON
    │   ├── writer.js      .procreate re-packager (edits Document.archive in place)
    │   └── engine.js      createEngine(): message handler, composite cache, lazy stored render
    └── ui/                concatenated into one IIFE in this order:
        util · client · settings · viewport · viewer · layers · dock · export · palette-ui · compare · main
build.py                   → dist/index.html (node --check, embeds fonts, asserts no placeholders remain)
test/                      Node + Playwright tests on real sample files
docs/                      DESIGN.md, versions/<ver>/ doc snapshots
```

**Layer model (UI).** `S.tree` holds only structure (`{id, children?}`, top → bottom); names and visibility live in maps. Undo snapshots are therefore cheap, and the writer receives exactly what changed. Selection (highlighted rows) and visibility (eyes) are independent state; what the canvas shows is a third, explicit choice.

**Rendering order.** The engine composites the ids it is given, in the order given (top → bottom), so reordering in the panel changes the canvas and all exports immediately.

## Writing `.procreate` (how it works)

Edits are applied to the original `Document.archive`; nothing is rebuilt from scratch, so every key this tool doesn't understand survives.

| Edit | Archive change | ZIP change |
|---|---|---|
| Order / grouping | Rewrites the `NS.objects` of `unwrappedLayers`, each `SilicaGroup.children`, and `layers` (mirroring whichever convention the file uses: same as the top level, or flat leaves) | — |
| Delete | Removed from those arrays; `selectedLayer` / `primaryItem` repointed if they referenced it | `<UUID>/` tile folder (and its mask folder) dropped |
| Rename | New string appended to `$objects`; `name` points at it | — |
| Visibility | `hidden` (layers) / `isHidden` (groups) | — |
| Title | Root `name` | — |
| — | — | `composite` tiles re-rendered and LZ4-encoded; `QuickLook/Thumbnail.png` re-rendered at its original size |

Unchanged entries are copied byte-for-byte (still deflated) via Blob slices, so even very large files re-pack in seconds without being loaded into memory. The time-lapse (`video/segments`) is kept as it was.

## The `.procreate` format (as implemented)

```
artwork.procreate  (ZIP, may be ZIP64)
├── Document.archive            NSKeyedArchiver binary plist → SilicaDocument
├── <layer-UUID>/<col>~<row>.chunk   LZO1X tile (older Procreate)
├── <layer-UUID>/<col>~<row>.lz4     Apple LZ4 "bv41" block chain (newer); one layer can mix both
├── QuickLook/Thumbnail.png     gallery preview, oriented as displayed
└── video/segments/*.mp4        time-lapse
```

- `size` is `"{w, h}"`; `tileSize` usually 256; edge tiles stored cropped. Tiles are **premultiplied RGBA**, rows **bottom-up**.
- Orientation: flip rows → rotate clockwise by `orientation` (1 = 0°, 2 = 180°, 3 = 270°, 4 = 90°) → `flippedHorizontally/Vertically`.
- `unwrappedLayers[0]` is the **top** item; `SilicaGroup` holds `children` and `isHidden`; groups are pass-through.
- `composite` → a layer UUID holding Procreate's flattened render **including the background colour**.
- Procreate writes LZ4 tiles as 64 KB `bv41` blocks ending with `bv4$`; the encoder does the same.

## Build & test

```bash
python3 build.py                  # needs Node.js for `node --check`
npm i playwright                  # once, for the browser test
sh test/run-all.sh                # every test below
```

Test files go in `../samples/` (next to the project folder). The suite uses public files: `reference_files/*.procreate` from [cuibonobo/procreate-rs](https://github.com/cuibonobo/procreate-rs) and `Examples/Exported/18.04.10-10.29 Neon.procreate` from [alcor6502/Procreate-Exporter](https://github.com/alcor6502/Procreate-Exporter) (saved as `neon.procreate`). The older Silicate demo files (`reference`, `Mask_Test_File`) still work with `t3`–`t5`.

| Test | Checks | v5.0.0 result |
|---|---|---|
| `t1` | every tile of every layer decodes | all tiles, 5 files |
| `t2` | compositor vs Procreate's stored render | mean error 0.00–0.19 / 255 |
| `t6` | `Document.archive` → parse → write → strict, type-aware comparison in Python | identical, 5 files |
| `t7` | LZ4 encoder round-trips 126 real tiles; cross-checked with the reference `lz4` library | pass |
| `t8` | writer: reorder + delete + rename + hide + retitle → re-open, decode, composite, Python `plistlib` + `zipfile` checks | pass, 3 files incl. a 27 MB LZO file |
| `t9` | writer with nested groups (synthetic fixture from `make_grouped.js`) | pass |
| `t10` | fast `toImage` paths vs the v5.0 reference (`ref_composite_v5.js`), all orientations/flips | identical at 100 %, box mean diff 0 |
| `e2e` | Chromium: no canvas balloons, counts, selection, Export window + Quick export, rename, drag & drop, delete, undo/redo, save + re-open `.procreate`, list keeps its scroll (Viewer and Compare, 60-layer fixture from `make_many.js`), dock states, Compare filters/sort/group/diff colours/remove, light theme, footer | pass, no page errors |

## Browser support

Current Chrome, Edge, Safari 16.4+ and Firefox 113+ (`DecompressionStream`, `OffscreenCanvas`, CSS container queries, `color-mix`).

## Performance (engine timings in Node; 27 MB, 2048 × 2732 test file)

| | v5.0 | v5.1 |
|---|---|---|
| Open + decode | 3.5 s | 0.6 s |
| Full redraw (100 %) | 0.52 s | 0.17 s |
| Composites per canvas update (palette + preview open) | up to 3 | 1 |

## Licence & credits

© Klara Keim, PhD. See [CREDITS.md](CREDITS.md). Procreate® is a trademark of Savage Interactive Pty Ltd; this project is not affiliated with Savage Interactive.
