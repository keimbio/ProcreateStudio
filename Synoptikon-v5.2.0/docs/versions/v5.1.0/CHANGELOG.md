# Changelog

All notable changes to Synoptikon (formerly Procreate Studio) are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## [5.1.0] - 2026-11-03

Interface refresh in the Spectator family style, faster rendering, a full Export window and a
stronger Compare mode.

### Changed
- **New look, aligned with Spectator.** Same page structure (title bar → panel → view bar →
  credits footer), button, segment and modal styles, and the same tiled Export window. Its own
  identity: the *Synoptikon* wordmark from the mockups, a **Desert Summer** palette, and a serif
  display face (Cormorant Garamond) for titles over Hanken Grotesk for everything else.
- **Title and subtitle.** The wordmark is larger, with more space above the subtitle, which now
  reads *From the Greek syn ‘together’ + optikos ‘of seeing’ — seeing all together*.
- **One text system.** Every piece of text uses one of eight defined styles (display title, modal
  title, section heading, body, UI, small, label, link) with tabular numbers. The monospace font is
  gone; it was the mismatched font in the canvas’s dimensions read-out.
- **Nothing floats over the canvas any more.** The “Showing N of N layers” and background
  balloons moved into a *view bar* above the canvas (Show · Background · Zoom), a one-line footer
  under it, and a new **On the canvas** section in the Details tab.
- **The file name chip and its two dots are gone.** The artwork title, file name, size and
  layer counts now head the panel, and unsaved edits show as a labelled **Unsaved layer edits** badge.
- **Export.** The top-right **Export** button opens a centred Export window modelled on
  Spectator’s: what to export (tiles, with live preview and the layer list), file type, background,
  size, quality; the .procreate save; and the palette downloads. The dock’s tab became **Quick
  export** (export what you see in one click, or save the edited .procreate).
- **Themes** are now drawn from the reference palettes: Desert Summer (default), Retro Warmth,
  Meadow, Candlelight and Studio. Each works in dark and light mode.
- **Group colours** are eight well-separated hues instead of ten neighbouring ones, with a 4 px
  stripe, a tinted folder chip and a lighter row tint so a group is never mistaken for a selection.
- The page now scrolls: the workspace fills the window and the credits footer (version, GitHub,
  privacy note, credit, logo) sits below it, as in Spectator and ChromaScope. Opening a file scrolls
  the workspace into view.
- **Compare:** the files bar above the canvas moved into a **Files** tab (choose, use the Viewer’s
  file, **Remove**), with **Clear comparison** and **Swap** in the panel header. Empty Compare shows
  two drop targets, A and B. Panel tabs: Layers · Artwork · Files.

### Added
- **Compare: sort and group layers** by stack order, name, type of change, most changed, or
  **last modified**; optional *Group by type* section headers.
- **Last-modified times per layer**, read from the per-tile timestamps Procreate writes into the
  file. Shown in Details (selected layer and artwork), layer tooltips and Compare. Re-packed
  .procreate files now keep those timestamps.
- **Difference colours:** magenta, red, orange, yellow, lime, cyan, blue, violet, white, or *heat*
  (yellow → red by the size of the change).
- Details tab: *Selected layer* facts (number, blend, opacity, clipping, mask, painted tiles, last
  painted).

### Fixed
- **Rendering was slow, especially for large files.** Three causes:
  1. Every canvas update re-composited the stack up to three times: once for the canvas, again for
     the palette, and again for the export preview when that tab was open. The engine now keeps the
     last composites and re-uses them for previews, the palette and exports.
  2. Converting tiles to an image went through a per-pixel function call, a float accumulation
     buffer and a division, even at 100 %. There is now a direct one-pass path at 100 %, a
     point-sampled path for thumbnails, previews and the palette, and the box filter only for
     downscaled views. Output is pixel-identical (`test/t10_toimage.js`).
  3. Opening decoded Procreate’s stored render even when it was never viewed, and built every layer
     thumbnail by visiting every pixel at full size. The stored render is now decoded on demand and
     thumbnails are sampled.
  On the 27 MB test file: open + decode 3.5 s → 0.6 s; a full redraw 0.52 s → 0.17 s.
- **The layer list jumped to the top when a layer was clicked** (Viewer). Clicking a row let the
  browser focus the whole list, and Safari scrolls a focused element into view. The tree now
  prevents that default focus and focuses itself without scrolling.
- **The Compare list jumped to the top when a layer pair was clicked.** Each click rebuilt the
  list, which resets its scroll position. Selection now updates in place, and rebuilds (sorting,
  filtering) keep the scroll position.
- **The Compare “Changed” filter seemed to do nothing.** It showed every non-identical pair, so
  added and removed layers stayed visible and the list often looked the same. Filters are now
  explicit chips with counts (All · Changed · Added · Removed · Same); each shows exactly that type.
- **The “unsaved edits” marker never cleared after saving a file with deleted layers.** The
  comparison against the saved state listed every id in its names map, which still includes
  deleted layers, so deletions always counted as unsaved. It now compares the saved layer tree.
- Clicking a Compare panel tab could blank the Viewer’s panels: both docks’ tabs shared one
  selector. The handlers are now scoped to each dock.

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
