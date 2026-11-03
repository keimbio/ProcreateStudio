# Design notes — v5 layers panel, dock and Compare

Why the v5 interface works the way it does. Visual styling (fonts, colours, final brand) is deliberately
out of scope for this round.

## 1. What was wrong in v4

| Symptom | Cause |
|---|---|
| Exported layers ≠ layers on screen | Three independent states — eye (visibility), checkbox (selection), clicked row (“active”, drove *Single layer*) — and nothing on screen tied the export to any of them. |
| Panels felt heavy | A fixed three-column grid: layers left, stage centre, three stacked cards right. No way to collapse, resize or move anything. |
| Tree hard to scan | Checkbox, number, thumbnail, name, tags and eye all in one row at one size; no compact mode. |

## 2. Principles applied

1. **Separate the three concepts and name them on screen.**
   - *Visibility* = the eye, as in Procreate/Photoshop. Changes what “Visible layers” shows and is saved into a `.procreate` export.
   - *Selection* = highlighted rows. It is the target of actions (move, rename, delete, export selected) and never changes the canvas by itself.
   - *What the canvas shows* = an explicit three-way switch (Visible / Selected only / Procreate render) with a label stating the result, and an accent outline when isolating.
   This follows the WAI-ARIA tree pattern's rule that in multi-select trees *selection is independent of focus*, and the long-standing convention in vector apps that panel selection and canvas state are distinct (VectorStyler's layer-panel discussion shows the confusion when that distinction isn't made visible).
2. **Export says what it will export.** First option is *What you see* (WYSIWYG). Every option lists its layers, and a live thumbnail previews the first output file. Options that would export nothing are disabled with the reason.
3. **Standard multi-select gestures** (click, ⇧-click range, ⌘-click toggle, ⌘A) plus keyboard per the ARIA tree pattern: ↑/↓ move, ←/→ fold groups, Enter/F2 rename, ⌥↑/↓ move layers, Home/End.
4. **One dock, many panels.** Tabs (Layers · Details · Palette · Export) instead of stacked cards — the Photoshop panel-group model. The dock can be resized, placed left or right, hidden to an icon rail (“collapse to icons”), and popped out over the canvas from the rail. Figma's UI3 experience is the caution here: floating panels by default were rolled back after users said the canvas felt smaller and the gaps distracting, so the dock is **docked by default** and floating is only a temporary pop-out, closed by clicking the canvas (Photoshop's *Auto-collapse iconic panels*).
5. **Two densities.** *Outline* (compact tree, ~28 px rows, type icon + tiny tag letters) for big files, *Preview* (thumbnail rows, S/M/L like Photoshop's Panel Options) for visual browsing.
6. **Edits are safe.** Non-destructive until export, unlimited undo/redo, “Edited” banner with Revert all, undo button in the delete toast, unsaved-edit dot on the file chip and a warning before leaving.
7. **Groups are easy to read.** Indentation by depth, fold chevrons, and optional colour-coding of top-level groups (the “Dream (colors)” reference), using tints from palette-01.

## 3. Compare mode

Uses the four established image-diff views (side by side with locked zoom, swipe, onion skin, difference). The panel puts the **layer list first** (that's what changes most often between versions of an artwork) and the artwork property table second, collapsible. Layers are matched by Procreate's per-layer UUID when B is an edited copy of A — so renames and moves are detected as such — and by name otherwise. Pixel changes are found exactly by fingerprinting every decoded tile (CRC32), so “Changed in 3 tiles” is precise rather than a visual estimate.

## 4. Open items for the visual-design round

- Name and brand mark (currently *Synoptikon*, plain text).
- Theme built from palette-01 / palette-02 and the mockups' gradient-framed dialogs.
- Header/footer treatment and the dashboard / suite landing page.

## Sources

- W3C WAI-ARIA Authoring Practices — Tree View pattern: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
- MDN — ARIA `tree` role (single vs multi-select): https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role
- VectorStyler forum — “Layers Panel – Highlight vs Select”: https://vectorstyler.com/forum/post/1043
- Figma — Navigating UI3 (resizable, collapsible panels): https://help.figma.com/hc/articles/23954856027159
- UX Collective — “Figma scrapes UI3's floating panels”: https://uxdesign.cc/figma-scrapes-ui3s-floating-panels-44303803c1ad
- Webucator — How to use panels in Photoshop (dock, collapse to icons): https://www.webucator.com/article/how-to-use-panels-in-adobe-photoshop/
- Andrew Haysom — Auto-collapse iconic panels: https://andrewhaysom.myportfolio.com/auto-collapse-iconic-panels
- Andrew Haysom — Layer panel options (thumbnail contents/size): https://andrewhaysom.myportfolio.com/two-layer-panel-options-you-may-not-know
