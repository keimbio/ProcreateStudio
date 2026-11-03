# Changelog

All notable changes to Synoptikon (formerly Procreate Studio) are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## [5.0.0] - 2026-11-02

Layer editing, `.procreate` export, Compare mode and a redesigned workspace. **Renamed** from
Procreate Studio to **Synoptikon** (working name; one constant in `build.py`).

### Added
- **Layer editing.** Drag & drop to reorder, including into, out of and between groups; ⌥↑/⌥↓ to
  nudge; inline rename (double-click or Enter); delete (⌫); unlimited undo/redo (⌘Z / ⇧⌘Z);
  **Revert all**. Edits are non-destructive until exported. An “Edited” banner and an orange dot on
  the file name show unsaved edits, and the page warns before closing with unsaved edits.
- **Export as `.procreate`.** Writes a new file with the new order, grouping, names, deletions,
  optional visibility changes and title. Re-renders Procreate's stored composite and the
  gallery thumbnail so they match the edits. Unchanged entries are copied byte-for-byte.
- **Compare mode** (new top-level tab). Files A and B; Side by side (locked zoom/pan), Swipe, Onion
  skin and Difference views; artwork property table; layer pairs matched by internal UUID, then
  name, with Same / Changed / Added / Removed and what changed (rename, move, blend, opacity,
  visibility, clipping, mask, pixels by tile). Click a pair to compare just that layer.
- **Tabbed dock** for Layers · Details · Palette · Export, resizable, on the right by default or the
  left (Settings → Panel side). Hide with `\` → slim icon rail; rail icons pop a panel out over the
  canvas, with a pin to dock it and optional auto-close when the canvas is clicked.
- **Two layer-list styles:** Outline (compact tree) and Preview (thumbnails S/M/L). Optional
  colour-coding of top-level groups (tints from palette-01).
- Standard multi-select: click, ⇧-click range, ⌘-click toggle, ⌘A; ⌥-click an eye to solo a layer.
- Export preview: thumbnail of the first output file plus the names of the layers it contains.
- Engine: lossless binary-plist writer (`plistedit.js`), LZ4/bv41 encoder, ZIP `rewrite()` that
  copies entries without recompressing, per-layer tile fingerprints for Compare.

### Changed
- **Selection and viewing are now separate, explicit concepts** (see Fixed). The four v4 views
  became three canvas modes — *Visible layers*, *Selected only*, *Procreate render* — always named
  by a label on the canvas, with an accent outline while *Selected only* is on.
- Export's first option is **What you see**, so exporting what is on the canvas needs no extra step.
- App fills the window (no outer frame); one dock replaces the three fixed columns.
- The engine renders layers in the order the UI passes (`ids` top → bottom) instead of the file's
  order, so reordering affects the canvas and every export.
- `Engine` became `createEngine()` so the Viewer and both Compare slots each get their own worker.
- Settings key `procreate-studio` → `synoptikon` (old preferences are read once and carried over).

### Fixed
- **Exporting the wrong layers.** In v4, the *Single layer* view was driven by clicking a row while
  *Selected* export used the checkboxes, so the canvas could show one thing and the export include
  another. Root cause: three independent states (eye, checkbox, “active” row) with no on-screen
  link between them. v5 has one selection (highlighted rows), the canvas states what it shows, and
  every export option lists its layers and previews the result.
- **Panels used a fixed share of the window.** v4's three-column grid reserved space for Layers and
  the side column at all times. The dock can now be resized, moved, hidden or popped out.

### Known limitations
- `.procreate` export is **beta**: validated by re-reading the output with this app's own reader,
  Python's `plistlib`/`zipfile`, and pixel checks against the re-rendered composite — not yet by
  opening it in Procreate on an iPad. Grouped files were only tested with a synthetic fixture
  (no public sample contains groups).
- The time-lapse video is kept unchanged, so it still shows deleted layers.
- Compare's pixel-by-tile check needs both files to have the same canvas size; otherwise the
  Difference view compares rendered images (B scaled to A).

## [4.0.0] - 2026-10-29

Complete rewrite. The file parser, compositor and interface were rebuilt from scratch and
validated against real `.procreate` files, comparing every render with the flattened image
Procreate itself stores inside each file.

### Fixed
- **Layers now render separately instead of all landing in layer 1.** Earlier versions could not
  link layers to their pixel data, so they fell back to guessing — usually by drawing
  Procreate's QuickLook thumbnail into the first layer. v4 reads the layer list from
  `Document.archive` (`unwrappedLayers`) and matches each layer's `UUID` to its tile folder in the ZIP.
- **Colours were wrong (red and blue swapped).** Tiles were treated as BGRA. They are
  premultiplied **RGBA**. The swap is gone and alpha is un-premultiplied only at output.
- **Artwork appeared upside down or sideways.** Procreate stores tile rows bottom-up and keeps the
  canvas rotation separately (`orientation`, `flippedHorizontally/Vertically`). v4 flips the rows,
  then applies the rotation and flips. The result matches Procreate's thumbnail to within 1/255.
- **Files mixing `.chunk` and `.lz4` tiles lost pixels.** A single layer can hold both: LZO
  `.chunk` tiles from older Procreate versions and LZ4 `.lz4` tiles from newer ones. Both
  codecs now run per tile. The LZ4 decoder also handles Apple's chained `bv41` blocks, where each
  block may copy bytes from the one before it, as well as the uncompressed `bv4-` and end-of-stream
  `bv4$` blocks.
- **Edge tiles were corrupted.** Tiles on the right and bottom edges are stored at their cropped
  size, not the full 256 × 256. They are now padded correctly.
- **"Maximum call stack size exceeded" on open.** The archive is cyclic: every layer points back to
  its document. The old decoder expanded every reference up front. v4 follows references lazily,
  one step at a time.
- **`[object Event]` errors on open.** Image-load failures were rejected as DOM `Event` objects
  with no message. The preview thumbnail is now decoded with `createImageBitmap`, and every error
  passed to the UI is a real `Error`.
- **Blend modes were wrong.** The old code assumed Photoshop's numbering. Procreate uses its own
  (for example 3 = Add, 11 = Overlay, 19 = Darken, 26 = Divide), read from `extendedBlend` with
  `blend` as fallback. All 26 modes are now implemented and each one checks out against
  Procreate's own render.
- **Status bar didn't update.** Counts were only refreshed when the file loaded. Every visibility,
  selection and zoom change now refreshes the status bar.
- **Palette feature didn't work, and `.swatches` files wouldn't import into Procreate.** The
  palette was taken from an empty canvas, and the `.swatches` export was a bare JSON file with
  **HSL** values. A real `.swatches` file is a ZIP holding `Swatches.json` with **HSB** values and
  30 slots. Both are fixed.
- **The palette changed every time you clicked Regenerate.** It used random k-means seeding. It is
  now deterministic: the same view always gives the same palette, so the Regenerate button is gone.

### Added
- Layer masks (missing mask tiles count as fully visible), clipping masks and pass-through groups,
  plus hidden groups and hidden masks.
- Four views: Composite, Single layer (step with ↑/↓), Selected, and Procreate render (the
  flattened image stored in the file).
- Group tree with collapse/expand, per-layer thumbnails and badges for blend mode, opacity, clipping, mask and text.
- Selection by number (`1-5, 7`). Layers are numbered from the bottom up, matching Procreate's "Layer 1".
- Export options: composite, selected layers merged, selected layers as separate files, or every
  layer. Formats: PNG, JPG, WebP and TIFF (with alpha). Background: transparent, document colour or
  white. Size: 100%, 50% or 25%. Multiple files download as a single ZIP.
- Palette from the current view with 3–30 colours, sorted by amount, hue or lightness, with
  click-to-copy hex. Saves as `.swatches`, `.ase`, `.aco`, `.act`, `.gpl`, `.css`, `.json` or a `.png` palette card.
- Artwork details: print size at the file's DPI, groups, masks, rotation, background colour,
  colour profile, stroke count, time spent in Procreate, author.
- New interface: dark mode by default plus light and system modes; Wattle, Ember, Waratah and
  Carnival themes; S/M/L/XL text sizes; transparency grid options; sharp pixels when zoomed in;
  keyboard shortcuts; drag and drop anywhere on the page.
- Decoding and compositing run in a Web Worker, so the page stays responsive. If workers are
  unavailable, the same engine runs on the main thread.

### Changed
- Fully self-contained: no CDN. JSZip was replaced by a built-in ZIP reader and writer that uses
  the browser's own `DecompressionStream`. Hanken Grotesk and JetBrains Mono are embedded as woff2.
- The source is now modular (`src/`) and assembled by `build.py` into a single `index.html`.

### Removed
- HEIC export. Browsers cannot encode HEIC. The app explains how to convert a PNG with macOS Preview instead.
