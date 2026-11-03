# Synoptikon: Step-by-step Guide

*(formerly Procreate Studio)* — you don't need any coding experience to follow this guide.

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

## 3. The workspace

```
┌ Top bar ─ Viewer | Compare ─────────────── file name · Open · Export · ◧ panels · ⚙ settings ┐
│ ┌ Canvas ─────────────────────────────────────┐ ┌ Panels: Layers · Details · Palette · Export ┐ │
│ │ [Visible layers | Selected only | Procreate │ │                                              │ │
│ │  render]   ← what the canvas is showing      │ │                                              │ │
│ └──────────────────────────────────────────────┘ └──────────────────────────────────────────────┘ │
```

**The panels**
- Click the tabs at the top of the panel to switch between **Layers**, **Details**, **Palette** and **Export**.
- **Make it wider or narrower:** drag the thin edge of the panel next to the canvas. Double-click the edge to reset.
- **Hide the panels** for a bigger canvas: click **›** at the top of the panel, the ◧ button in the top bar, or press **\\**.
  A slim strip of icons stays at the edge. Click an icon to pop that panel out over the canvas; click the
  📌 pin to put it back beside the canvas.
- **Left or right:** Settings (⚙) → **Panel side**.

**What the canvas shows** (the three buttons at its top left, or keys **1 2 3**):

| Button | Shows |
|---|---|
| Visible layers | every layer whose 👁 eye is on — like Procreate |
| Selected only | only the layers highlighted in the Layers panel. The canvas gets a coloured outline so you know |
| Procreate render | the flattened picture Procreate saved inside the file (before any edits you make here) |

The small label under the buttons always says exactly what you're looking at.

---

## 4. Layers panel

**Two list styles** (the two small icons next to “Layers”):
- **Outline** — a compact list, good for files with many layers and groups.
- **Preview** — thumbnails. Change their size in Settings → **Thumbnail size**.

**Selecting** (selection is the highlighted rows — it does *not* hide or show anything):
- Click a layer to select it. **Shift**-click to select a run of layers. **Cmd**-click to add or remove one.
- Click a **group** to select everything inside it.
- **All · None · Visible · Invert** at the top; **By #** lets you type `1-5, 7` (layer **1 is the bottom layer**,
  like Procreate; each row shows its number on the right).
- **↑ / ↓** move the selection. With **Selected only** on, this flips through layers one at a time.

**Showing and hiding:** click the 👁 eye. If several layers are selected, clicking one of their eyes switches
them all. **Option**-click an eye to show *only* that layer; Option-click it again to bring the others back.

**Editing** (nothing changes in your original file):

| To… | Do this |
|---|---|
| Move layers | Drag them up or down. Drop **on** a group (it lights up) to put them inside it. Or press **Option + ↑ / ↓** |
| Rename | Double-click the name, or press **Enter**. Type, then **Enter** to keep or **Esc** to cancel |
| Delete | Press **Delete**, or the 🗑 button. An **Undo** button appears for a few seconds |
| Undo / redo | **Cmd + Z** / **Shift + Cmd + Z**, or the ↶ ↷ buttons at the bottom of the panel |
| Start over | **Revert all** in the orange “Edited” bar |

An orange dot next to the file name means you have edits that haven't been saved as a `.procreate` file yet.

---

## 5. Exporting

Click **Export** in the top bar (or press **E**). Choose **Images** or **Procreate file**.

**Images**
1. **What to export** — every option says which layers it uses:
   - **What you see** — exactly what's on the canvas right now (the safest choice).
   - **Visible layers, merged** · **Selected layers, merged** · **Selected layers, one file each** · **Every layer, one file each**.
2. Check the small **preview** and the list of layer names under it.
3. Pick **Format**, **Background** and **Size**, then click the big **Export** button.
   Several images download together as one ZIP file.

**Procreate file**
1. Make your edits in the Layers panel first. The list at the top shows what will change.
2. Check the **File name** and the **Artwork title** (the name shown in Procreate's gallery).
3. Leave **Keep visibility changes** ticked if layers you hid here should stay hidden in Procreate.
4. Click **Save .procreate**. A **new** file downloads; your original is never changed.
5. **Beta:** AirDrop the new file to your iPad and open it in Procreate to check it before deleting the original.

---

## 6. Compare mode

1. Click **Compare** in the top bar.
2. Load file **A** and file **B** with **Choose…** (or **Use Viewer file** to reuse what's open in the Viewer).
   You can also drop a file on the left half (A) or right half (B) of the canvas, or drop two files at once.
3. Switch views at the top left of the canvas (or keys **1–4**):

| View | How to use it |
|---|---|
| Side by side | Zooming or moving one side moves both |
| Swipe | Drag the handle left and right to wipe between A and B |
| Onion skin | B on top of A; the slider sets how see-through B is |
| Difference | Pink shows pixels that differ. **Sensitivity** sets how small a difference counts |

4. The **Differences** panel shows the score at the top, every layer pair (**Same / Changed / Added / Removed**,
   with what changed) and an **Artwork** table. Tick **Changed** to hide identical layers.
   Click a layer pair to compare just that layer; **Show whole artwork** goes back.

Layers are matched by Procreate's hidden layer ID when B is an edited copy of A, otherwise by name.

---

## 7. Palette

Shows the main colours of whatever the canvas is showing. **− / +** changes how many. Click a colour to copy its hex code.
**.swatches** loads into Procreate; **.ase** into Illustrator, Photoshop and InDesign.

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
| The canvas says “Nothing selected” | You're in **Selected only**. Click layers in the panel, or press **1** to go back to Visible layers. |
| The panels disappeared | Press **\\**, or click the ◧ button in the top bar. |
| The new .procreate won't open in Procreate | Please send the original file and a note of what you edited — the export is still in beta. Your original file is unaffected. |
| The time-lapse still shows deleted layers | Expected: the recording is copied as it was. |
| HEIC is crossed out | Browsers can't make HEIC files. Export a PNG, open it in **Preview → File → Export → HEIC**. |
| Colours look slightly different from the iPad | Procreate files are often in **Display P3**; browsers show sRGB. The profile is listed under **Details**. |
| GitHub still shows the old version | Wait two minutes, then press **Cmd + Shift + R**. |
