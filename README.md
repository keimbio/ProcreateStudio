# Procreate Studio — Viewer & Converter

A browser-based tool for opening, viewing, and converting `.procreate` files. No server required — everything runs locally in your browser.

## Features

### Viewer
- **Layer Browser** — Browse all layers with thumbnails, opacity, and blend mode info
- **Composite View** — See all visible layers merged together
- **Selected Layers View** — Choose which layers to merge and preview
- **Single Layer View** — Inspect individual layers in isolation
- **Zoom Controls** — Zoom in/out with fit-to-screen option
- **Transparency Grid** — Toggle checkerboard background

### Export
- **PNG** — Lossless with transparency support
- **JPG** — Compressed with quality slider
- **TIFF** — Uncompressed for print workflows
- **WebP** — Modern, efficient format

### Export Modes
- **Composite** — All visible layers flattened
- **Selected Layers** — Only checked layers, merged
- **Individual Bulk Export** — Every layer as a separate file
- **Layer Range** — Specify ranges like `1-5, 7, 9-10`

### Color Palette
- **Auto-extraction** — K-means clustering extracts dominant colors
- **Click to copy** — Click any swatch to copy its hex code
- **Export Palettes:**
  - `.ASE` (Adobe Swatch Exchange) — for Photoshop, Illustrator
  - `.ACT` (Adobe Color Table) — for Photoshop
  - `.swatches` (Procreate format)

## How It Works

`.procreate` files are ZIP archives containing:
- `Document.archive` — Binary plist with canvas metadata
- Layer folders with LZO-compressed BGRA tile data
- `QuickLook/Thumbnail.png` — Preview image

The tool parses all of this client-side using JSZip, a custom binary plist parser, and an LZO decompressor.

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload `index.html` to the repository root
3. Go to **Settings → Pages**
4. Set source to **Deploy from a branch** → `main` / `/ (root)`
5. Your tool will be live at `https://YOUR-USERNAME.github.io/REPO-NAME`

## Privacy

All processing happens in your browser. No files are uploaded anywhere.

## Limitations

- Very large `.procreate` files (100+ MB) may be slow to process
- HEIC/HEIF export is not supported in most browsers
- Some advanced blend modes may render slightly differently than Procreate
- Files from very old Procreate versions may use different internal formats
