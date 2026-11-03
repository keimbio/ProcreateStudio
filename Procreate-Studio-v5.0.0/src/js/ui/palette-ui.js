// ═══════════════ Palette panel ═══════════════
let palSeq = 0, palTimer = 0;
function schedulePalette(ms) { clearTimeout(palTimer); if (set.panel !== 'palette' && S.pal.colors.length) { S.pal.stale = true; return; } palTimer = setTimeout(refreshPalette, ms); }
async function refreshPalette() {
  if (!S.ready) return; const my = ++palSeq; S.pal.stale = false;
  const solo = soloId();
  S.pal.label = S.show === 'selected' ? (solo ? `from “${S.names.get(solo)}”` : `from ${selectedLeaves().length} selected`) : S.show === 'original' ? 'from Procreate render' : 'from visible layers';
  $('#paletteSource').textContent = S.pal.label;
  try {
    const r = await viewClient.ask('palette', { spec: specFor(S.show, { bg: null }), count: set.palCount });
    if (my !== palSeq) return; S.pal.colors = r.colors; drawPalette();
  } catch (e) { $('#swatches').innerHTML = `<li class="pal-empty">Couldn’t read colours: ${esc(e.message)}</li>`; }
}
function drawPalette() {
  const cols = Palette.sort(S.pal.colors, set.palSort);
  $('#palCount').textContent = set.palCount;
  $$('#palSort button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === set.palSort));
  if (!cols.length) { $('#swatches').innerHTML = '<li class="pal-empty">No opaque colour in this view.</li>'; $('#palStrip').innerHTML = ''; return; }
  $('#palStrip').innerHTML = cols.map(c => `<span style="flex:${Math.max(c.share, 0.01)};background:${c.hex}" title="${c.hex}"></span>`).join('');
  $('#swatches').innerHTML = cols.map(c => `<li><button data-hex="${c.hex}" title="Copy ${c.hex}"><span class="chip" style="background:${c.hex}"></span><span class="hex">${c.hex}</span><span class="pct">${(c.share * 100).toFixed(c.share < 0.1 ? 1 : 0)}%</span></button></li>`).join('');
}
$('#swatches').addEventListener('click', e => { const b = e.target.closest('button'); if (b) copyText(b.dataset.hex); });
$('#palMinus').onclick = () => { set.palCount = Math.max(3, set.palCount - 1); saveSet(); $('#palCount').textContent = set.palCount; schedulePalette(200); };
$('#palPlus').onclick = () => { set.palCount = Math.min(30, set.palCount + 1); saveSet(); $('#palCount').textContent = set.palCount; schedulePalette(200); };
$$('#palSort button').forEach(b => b.onclick = () => { set.palSort = b.dataset.sort; saveSet(); drawPalette(); });
$$('[data-pal]').forEach(b => b.onclick = () => {
  const cols = Palette.sort(S.pal.colors, set.palSort); if (!cols.length) return toast('No colours to save yet.', true);
  const name = `${S.info.name || S.fileName}`, f = b.dataset.pal, base = safe(name) + '_palette';
  if (f === 'png') return paletteImage(cols, name).then(bl => download(bl, base + '.png'));
  if (f === 'swatches' && cols.length > 30) toast('Procreate palettes hold 30 colours — saving the first 30.');
  download(Encoders[f](cols, name), `${base}.${f}`);
});
function paletteImage(cols, name) {
  const W = 1200, pad = 48, sw = (W - pad * 2) / cols.length, H = 420, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#F6EFE6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#26332E'; g.font = '300 34px "Hanken Grotesk", sans-serif'; g.fillText(name, pad, 74);
  cols.forEach((col, i) => {
    const x = pad + i * sw; g.fillStyle = col.hex; g.fillRect(x, 110, sw + 0.5, 220);
    g.save(); g.translate(x + sw / 2 + 4, 370); g.rotate(cols.length > 12 ? -Math.PI / 2 : 0); g.fillStyle = '#26332E';
    g.font = `500 ${cols.length > 12 ? 13 : 15}px "JetBrains Mono", monospace`; g.textAlign = cols.length > 12 ? 'left' : 'center'; g.fillText(col.hex, cols.length > 12 ? -24 : -4, 0); g.restore();
  });
  return new Promise(r => c.toBlob(r, 'image/png'));
}
