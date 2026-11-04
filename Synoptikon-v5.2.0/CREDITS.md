# Credits

**Synoptikon** (formerly Procreate Studio) was designed and directed by Klara Keim, PhD ([keimbio](https://github.com/keimbio)).

## Format research (consulted for reference; no code copied)
- [Silicate](https://github.com/Avarel/silicate) by Avarel (MIT). Its source was the reference for the
  `.procreate` layout, the blend-mode numbering, the edge-tile cropping and the mask semantics. Its demo
  files were used as real-world test files.
- [Silica Viewer](https://git.sr.ht/~redstrate/silica-viewer) by redstrate and
  [Prospect](https://github.com/jaromvogel/prospect) by Jarom Vogel: earlier format work credited by Silicate.
- The LZO1X decoder is structured after the Linux kernel's `lzo1x_decompress_safe` (algorithm by Markus F.X.J. Oberhumer).
- Blend and composite formulas follow the W3C *Compositing and Blending Level 1* specification.

## Test files (public sample artwork, used only for automated tests; not distributed)
- `reference_files/*.procreate` from [procreate-rs](https://github.com/cuibonobo/procreate-rs) by cuibonobo.
- `18.04.10-10.29 Neon.procreate` from [Procreate-Exporter](https://github.com/alcor6502/Procreate-Exporter) by alcor6502.

## Interface research (v5)
- W3C WAI-ARIA Authoring Practices — Tree View pattern (multi-select keyboard model, focus vs selection).
- Layer and panel conventions from Adobe Photoshop / Illustrator (eye column, thumbnail sizes, collapse-to-icons
  panels, ⌥-click to solo), Figma UI3 (resizable, hideable panels; the reversal of floating panels), and Procreate itself.
- Layer-panel reference images and mockups supplied by Klara Keim.
- Group tint colours are taken from the palette-01 reference palette.

## Brand & visual design (v5.1)
- *Synoptikon* wordmark designed by Klara Keim (from her mockups; extracted losslessly from two renders on different backgrounds).
- Footer logo by Klara Keim, as used in Spectator and ChromaScope.
- Colour themes adapted from reference palettes supplied by Klara Keim: **Desert Summer** (designed by cindyroamingdesigns.com),
  **Retro Warmth** (printablepretty.co), **Daemonium** (The Flossy Finch: Vervain, Palm Frond, Fuschia, Paradise, Papaya),
  and three further mood-board palettes (Meadow, Mulled, Studio).
- Layout, components and Export window follow Klara Keim’s **Spectator**.

## Bundled fonts (SIL Open Font License 1.1; license texts in `src/fonts/`)
- **Hanken Grotesk** by Alfredo Marco Pradil and Hanken Design Co.

## Design references
- The interface draws on dashboard-style card layouts. The themes take colours from retro and Australian-native palettes supplied as moodboard references.
- v5.2's colour-blocking and earthy greens, browns and tans take their mood from website moodboards Klara supplied
  (Wildfeast, Rastro, Althea Floral Design, Taylor Anne Photography / Blush & Poppy Studio, Edges Wild). No layouts, artwork or code were copied.

Procreate® is a trademark of Savage Interactive Pty Ltd. This project is not affiliated with Savage Interactive.
