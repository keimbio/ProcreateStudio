# Synoptikon: Step-by-step Guide

*(formerly Procreate Studio — from the Greek* syn *‘together’ +* optikos *‘of seeing’: seeing all together)*

You don't need any coding experience to follow this guide.

---

## 1. Use it straight away (no setup)

1. Download **`index.html`**.
2. Double-click it. It opens in your web browser.
3. Drag a `.procreate` file onto the page, or click **Choose file**.

Your artwork never leaves your computer.

> **Getting a `.procreate` file off your iPad:** in Procreate's Gallery, tap **Select**, choose the artwork,
> tap **Share**, then **Procreate**. Save it to Files or AirDrop it to your Mac.

---

## 2. Put it on GitHub Pages (your own web link)

1. Go to your repository on github.com (for example `keimbio/ProcreateStudio`).
2. Click **Add file → Upload files**.
3. Drag in **`index.html`**, `README.md`, `INSTRUCTIONS.md`, `CHANGELOG.md`, `CREDITS.md`, `build.py`
   and the **`src`**, **`test`** and **`docs`** folders. Replace the old files when GitHub asks.
4. Type a message such as `v5.0.0`, then click **Commit changes**.
5. If Pages isn't switched on yet: **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**.
6. After a minute or two the tool is live at `https://keimbio.github.io/ProcreateStudio/`.
   If you still see the old version, press **Cmd + Shift + R**.

Only `index.html` is needed for the site to work. The other folders hold the editable source.

> **Renaming the repository later** (for example to `synoptikon`): on GitHub go to **Settings → General →
> Repository name**. The web address changes to `https://keimbio.github.io/synoptikon/`. GitHub forwards the
> old *repository* link, but **not** the old Pages link, so update any bookmarks you've shared.

---

## 3. The page

From top to bottom:

1. **Title bar** — the Synoptikon title, **Viewer | Compare**, **Open**, and ⚙ **Settings** (text size, theme, light/dark live there).
2. **The panel** — the open artwork, or Compare.
3. **Footer** — one line below the panel: credit, privacy note, version and GitHub link.

When you open a file, the page scrolls so the whole workspace fits the window. Scroll up to see the title again.

**The panel, in the Viewer**

```
 Artwork title                                       [Unsaved edits]  [Close file]  [Export]
 file name · size · dpi · file size     3 visible · 1 selected · 3 layers
 ─────────────────────────────────────────────────────────────────────────────────────────────
 Show [Visible layers | Selected only | Procreate render]   Background (switch)     Zoom − 100% + Fit
 ┌ canvas ───────────────────────────────────┐ ┌ Layers  Canvas  Layer  File  Palette  Export ┐
 └───────────────────────────────────────────┘ └───────────────────────────────────────────────┘
 Showing 3 of 3 layers — every layer with its eye on                       2,048 × 2,048 px · 32%
```

**Show** (or keys **1 2 3**):

| Button | The canvas shows |
|---|---|
| Visible layers | every layer whose 👁 eye is on — like Procreate |
| Selected only | only the layers highlighted in the Layers panel. The canvas gets a coloured outline, and ↑ / ↓ flip through layers one at a time |
| Procreate render | the flattened picture Procreate saved inside the file (before any edits you make here) |

**Background** shows or hides the canvas colour behind the artwork (key **B**).
The line under the canvas always says exactly what you're looking at; the **Canvas** tab says it in full.

**Zooming:** pinch on a trackpad, hold **Cmd** (Mac) or **Ctrl** (Windows) while scrolling, use **− / +**, or press **0** to fit. Plain scrolling over the canvas scrolls the page, so you can always scroll down to the footer. Drag the artwork to move it; double-click to fit.

**Unsaved edits** appears when you have changed layers but not yet saved a new .procreate file.

**The panels** (right of the canvas)
- Tabs: **Layers**, **Canvas** (what the canvas shows), **Layer** (the selected layer), **File** (facts about the artwork file), **Palette**, **Export** (quick export).
  When the panel is narrow (or the text size is large), only the open tab shows its name; hover an icon to see the others.
- **Wider or narrower:** drag the thin edge next to the canvas. Double-click the edge to reset.
- **Hide them** for a bigger canvas: click **›** at the top of the panel, or press **\**. A slim strip of
  icons stays at the edge. Click an icon to pop that panel out over the canvas; click 📌 to put it back.
- **Left or right:** ⚙ Settings → **Panel side**.

---

## 4. Layers panel

**Two list styles** (the two small icons next to “Layers”): **Outline** — a compact list; **Preview** —
thumbnails (Settings → **Thumbnail size**). Each top-level group gets its own colour stripe
(Settings → **Colour-code groups** turns it off).

**Selecting** (highlighted rows — selecting does *not* hide or show anything):
- Click a layer to select it. **Shift**-click selects a run. **Cmd**-click adds or removes one.
- Click a **group** to select everything inside it.
- **All · None · Visible · Invert** at the top; **By #** lets you type `1-5, 7` (layer **1 is the bottom layer**).
- **↑ / ↓** move the selection.

**Showing and hiding:** click the 👁 eye. If several layers are selected, clicking one of their eyes switches
them all. **Option**-click an eye to show *only* that layer; Option-click it again to bring the others back.

**Editing** (nothing changes in your original file):

| To… | Do this |
|---|---|
| Move layers | Drag them up or down. Drop **on** a group (it lights up) to put them inside it. Or **Option + ↑ / ↓** |
| Rename | Double-click the name, or press **Enter**. **Enter** keeps it, **Esc** cancels |
| Delete | **Delete** key or the 🗑 button. An **Undo** button appears for a few seconds |
| Undo / redo | **Cmd + Z** / **Shift + Cmd + Z**, or ↶ ↷ at the bottom of the panel |
| Start over | **Revert all** in the “Edited” bar |

**Canvas tab:** what's shown, canvas colour, orientation. **Layer tab:** the selected layer's thumbnail,
number, blend, opacity, clipping, mask and **last painted** — the time Procreate last saved paint on that
layer. **File tab:** size, print size, groups, colour profile, strokes, time spent, author.

---

## 5. Exporting

**Export** (panel tab — quick export): one click exports exactly what the canvas shows. Pick PNG, JPG, WebP or TIFF
first. **Save edited .procreate** saves your layer edits as a new file.

**Export window** — click **Export** at the top right of the panel (or press **E**):

1. **Images**
   - Choose a tile: **What you see** (the safest choice), **Visible, merged**, **Selected, merged**,
     **Selected, one each**, or **Every layer**. Each tile says how many layers / images it makes.
   - Check the **preview** and the list of included layers next to it.
   - Pick the file type tile, then **Background**, **Size** (and **Quality** for JPEG / WebP).
   - Click **Export**. Several images download together as one ZIP.
2. **Procreate file** — the list shows what will change. Check the **File name** and **Artwork title**,
   leave **Keep visibility changes** ticked if hidden layers should stay hidden, then **Save .procreate**.
   A **new** file downloads. *Beta:* open it in Procreate and check it before deleting your original.
3. **Colour palette** — the main colours of the canvas. **− / +** changes how many; click a tile to download
   (.swatches for Procreate, .ase for Adobe, and others).

Press **Esc** or click **Close** to close the window.

---

## 6. Compare mode

1. Click **Compare** in the title bar. If a file is open in the Viewer, it loads as **A**.
2. Load **B**: drop a file on the **B** box (or the right half of the canvas), or click **Choose…**.
   Drop two files at once to load both.
3. **View** (keys **1–4**):

| View | How to use it |
|---|---|
| Side by side | Zooming or moving one side moves both |
| Swipe | Drag the handle left and right to wipe between A and B |
| Onion skin | B on top of A; **B opacity** sets how see-through it is |
| Difference | Changed pixels light up in the chosen **Colour** (or **heat**: yellow = small change, red = big). **Sensitivity** sets how small a change counts |

4. The panel on the right:
   - **Layers** — the score, then every layer pair. Filter with **All · Changed · Added · Removed · Same**,
     **Sort** by stack order, name, type of change, most changed or **last modified**, and tick
     **Group by type** for section headings. Click a pair to compare just that layer; **Show the whole
     artwork** (under the canvas) goes back.
   - **Artwork** — size, DPI, profile, strokes, time spent, last painted… with differences highlighted.
   - **Files** — choose, **Use Viewer file**, or **Remove** each file. **Clear comparison** (top right)
     removes both. Removing frees memory; the Viewer is not affected.
5. Hide the panel with **›** or **\** for a bigger canvas.

Layers are matched by Procreate's hidden layer ID when B is an edited copy of A, otherwise by name.

---

## 7. Palette

The **Palette** tab shows the main colours of whatever the canvas shows. **− / +** changes how many; click a colour
to copy its hex code. Download it from **Export → Colour palette** (.swatches for Procreate, .ase for Illustrator,
Photoshop and InDesign, and more).

---

## 8. Editing the code (optional)

1. Install **Node.js** from https://nodejs.org (the LTS version).
2. Open **Terminal**. Type `cd ` (with a space after it), drag the project folder into the Terminal window, press **Return**.
3. Edit the files inside `src/`. The app's name is the line `APP_NAME = "Synoptikon"` near the top of **`build.py`**.
4. Run:
   ```bash
   python3 build.py
   ```
   This checks the code and creates **`dist/index.html`**. Copy it over the `index.html` you upload to GitHub.
5. (Optional) To run the tests, put sample files in a folder called `samples` **next to** the project folder, then:
   ```bash
   npm i playwright
   sh test/run-all.sh
   ```

> To see hidden files in Finder, press **Cmd + Shift + .**

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| “That isn't a .procreate file” | Export from Procreate as **Procreate**, not PSD or PNG. The file name must end in `.procreate`. |
| “Couldn't open this file” | The file may be damaged or only partly downloaded. Share it from Procreate again. |
| The export didn't include the layers I expected | Look at the preview and layer list in the Export panel before clicking Export. **What you see** always matches the canvas. |
| The canvas footer says “Nothing selected” | You're in **Selected only**. Click layers in the panel, or press **1** to go back to Visible layers. |
| Something looks slow on a very large file | The first view of a huge canvas takes a moment; after that, previews, the palette and exports re-use it. Hiding the Palette tab avoids extra work while you edit. |
| The panels disappeared | Press **\\**, or click the arrow at the bottom of the icon strip. |
| The new .procreate won't open in Procreate | Please send the original file and a note of what you edited — the export is still in beta. Your original file is unaffected. |
| The time-lapse still shows deleted layers | Expected: the recording is copied as it was. |
| HEIC is crossed out | Browsers can't make HEIC files. Export a PNG, open it in **Preview → File → Export → HEIC**. |
| Scrolling over the artwork doesn't zoom any more | That's on purpose (since 5.2): plain scrolling scrolls the page. Hold **Cmd** / **Ctrl** while scrolling, pinch on the trackpad, or use **− / +**. |
| Settings or panels look odd after updating | Your saved settings carry over. To start fresh, open ⚙ Settings and pick the theme and text size again. |
| Colours look slightly different from the iPad | Procreate files are often in **Display P3**; browsers show sRGB. The profile is listed in the **File** tab. |
| GitHub still shows the old version | Wait two minutes, then press **Cmd + Shift + R**. |
