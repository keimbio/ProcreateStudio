# Design notes — v5 layers panel, dock and Compare (v5.1: visual system)

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

## 4. v5.1 visual system (superseded in part by §5)

- **Family resemblance with Spectator:** same page skeleton (title bar → rounded panel with heading, hint and
  gold-number counts → view bar of *LABEL + segment* groups → content → credits footer), the same button,
  segment, pill and modal components, and the same tiled Export window with gradient icon chips.
- **Distinct identity:** the Synoptikon wordmark; Desert Summer palette (clay → sunrise → pollen gradient,
  sage-olive secondary); Cormorant Garamond for display titles and the etymology line, where Spectator uses a
  bold sans gradient title.
- **Type scale:** display 2.05 rem (serif) · modal title 1.5 rem (serif) · section 1.28 rem (serif) · body
  .94 rem · UI .86 rem · small .78 rem · label .68 rem uppercase +.14 em tracking. Numbers are tabular (lining in
  the serif). Links use the theme's link colour with an underline offset.
- **No overlays on the canvas.** Mode, background and zoom live in the view bar; the status sentence sits under
  the canvas; the full description is in Details → *On the canvas*. Only transient feedback (rendering spinner,
  toasts) appears over content.
- **Group colours:** eight hues spaced around the colour wheel and alternating warm/cool, so adjacent groups
  differ in hue and temperature; shown as a stripe and folder chip rather than a strong row fill, so they can't
  be confused with the selection highlight.

## 5. v5.2 visual system (replaces the type and colour rules of §4)

Feedback on 5.1: text too small, file name too big, serif and sans mixed, header/footer padding too
generous, canvas smaller than in 5.0, all-yellow buttons too close to Spectator, wheel captured by the canvas.

- **Type:** Hanken Grotesk only (400/500/600/700, italic 400). Five sizes in rem: title 1.3125 · heading
  1.0625 · body .9375 · small .8125 · micro .75. Labels are sentence case, 600 weight, muted colour; no
  uppercase tracking. The wordmark image is the only display lettering.
- **Colour roles** (each theme sets all of them for dark and light):
  `--act` action buttons — greens, olive, sage, blue-grey, brown (never the highlight colour) ·
  `--sel` the chosen segment / tab / selected row — clay, terracotta, wine, indigo ·
  `--hi` numbers, counts and links in text · `--warn` unsaved-edit badge ·
  `--sw1…3` deep and `--sw4…6` light colour blocks for export tiles, the empty state and A/B tags
  (alternating so neighbouring tiles contrast, with white text on deep and dark text on light blocks).
  Surfaces (`--bg…--bg4`, `--line`) are tinted per theme — Daemonium is green-black, Meadow deep-sea teal,
  Mulled wine-black — so themes differ in mood, not just accent. No decorative gradients.
- **Sizes:** controls 2.5 rem (40 px), in-panel controls 2.125 rem, rail 2.75 rem (44 px, Fitts / touch
  target), dock tabs 3.35 rem with icon over label. All in rem, so the Text size setting scales them.
- **Layout:** one-row title bar · compact doc bar (name + one meta line incl. counts) · view bar · stage + dock ·
  one-line stage footer · one-row page footer. Work area height `100vh − 13.5rem` (≈50 px more than 5.1).
- **Six dock tabs:** Layers · Canvas · Layer · File · Palette · Export. On a narrow dock (container query) only the
  active tab keeps its label.
- **Scrolling:** wheel over the canvas scrolls the page; zoom is pinch or ⌘/Ctrl + wheel (the convention for
  canvases embedded in scrolling pages, e.g. embedded maps), with a one-second hint on first plain scroll.

## 6. Open items

- A small square brand mark (favicon / dashboard tile) derived from the wordmark's swash S.
- The suite dashboard / landing page.

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
