# Changelog

All notable changes to Procreate Studio are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

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
