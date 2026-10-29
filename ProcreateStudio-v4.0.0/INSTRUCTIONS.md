# Procreate Studio: Step-by-step Guide

You don't need any coding experience to follow this guide.

---

## 1. Use it straight away (no setup)

1. Download **`index.html`**.
2. Double-click it. It opens in your web browser.
3. Drag a `.procreate` file onto the page, or click **Choose file**.

That's all. Your artwork never leaves your computer.

> **Getting a `.procreate` file off your iPad:** in Procreate's Gallery, tap **Select**, choose the artwork,
> tap **Share**, then **Procreate**. Save it to Files or AirDrop it to your Mac.

---

## 2. Put it on GitHub Pages (your own web link)

1. Go to your repository on github.com (for example `keimbio/ProcreateStudio`).
2. Click **Add file → Upload files**.
3. Drag in **`index.html`**, `README.md`, `INSTRUCTIONS.md`, `CHANGELOG.md`, `CREDITS.md`
   and the **`src`** folder. Replace the old `index.html` when GitHub asks.
4. Type a message such as `v4.0.0 rewrite`, then click **Commit changes**.
5. If Pages isn't switched on yet: **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**.
6. After a minute or two the tool is live at `https://keimbio.github.io/ProcreateStudio/`.
   If you still see the old version, press **Cmd + Shift + R** to reload without the cache.

Only `index.html` is needed for the site to work. The `src` folder holds the editable source code.

---

## 3. Using the tool

**The four views** (the buttons at the top, or keys **1–4**):

| View | Shows |
|---|---|
| Composite | Every visible layer, blended the way Procreate blends them |
| Single layer | One layer on its own. Click any layer, or use **↑ / ↓** to step through them |
| Selected | Only the layers whose boxes are ticked, merged together |
| Procreate render | The flattened image Procreate saved inside the file, useful for comparing |

**Layers panel**
- 👁 hides or shows a layer or a whole group. Click a group's name to fold it open or closed.
- The checkbox picks layers for the *Selected* view and for export.
- **Select by number:** type `1-5, 7` and press Enter. Layer **1 is the bottom layer**, matching Procreate's naming. Each row shows its number.

**Viewer:** scroll or pinch to zoom, drag to move around, double-click (or press **0**) to fit.
**Background** shows or hides the canvas background colour.

**Export:** choose *What*, *Format*, *Background* and *Size*, then click **Export**.
When the export produces more than one image, they all download together as one ZIP file.

**Palette:** shows the main colours in whatever view you're looking at. Use **− / +** to change how many colours.
Click a colour to copy its hex code. Use **.swatches** to load the palette into Procreate, or **.ase** for Illustrator, Photoshop and InDesign.

**Settings** (the sliders icon at the top right): dark, light or system mode, colour theme, text size, transparency grid, and whether to apply the canvas rotation.

---

## 4. Editing the code (optional)

You only need this if you want to change how the tool works.

1. Install **Node.js** from https://nodejs.org (the LTS version).
2. Open **Terminal**. Type `cd ` (with a space after it), drag the project folder into the
   Terminal window, then press **Return**.
3. Edit the files inside `src/`.
4. Run:
   ```bash
   python3 build.py
   ```
   This checks the code for mistakes and creates a fresh **`dist/index.html`**. Copy that file over the `index.html` you upload to GitHub.

> To see hidden files in Finder, press **Cmd + Shift + .**

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| "That isn't a .procreate file" | Export from Procreate as **Procreate**, not PSD or PNG. Make sure the file name ends in `.procreate`. |
| "Couldn't open this file" | The file may be damaged or only partly downloaded. Share it from Procreate again. |
| A huge file is slow | Very large canvases with many layers take a few seconds to decode. The progress bar under the layers shows how far along it is. |
| HEIC is crossed out | Browsers can't make HEIC files. Export a PNG, open it in **Preview**, then choose **File → Export → Format: HEIC**. |
| Colours look slightly different from the iPad | Procreate files are often in **Display P3**. Browsers show them as sRGB, so very saturated colours can look a little duller. The colour profile is listed in the Artwork card. |
| GitHub still shows the old version | Wait two minutes, then press **Cmd + Shift + R**. |
| The page looks unstyled or blank | Use a current version of Safari, Chrome, Edge or Firefox. |
