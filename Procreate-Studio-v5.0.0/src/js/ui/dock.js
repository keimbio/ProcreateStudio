// ═══════════════ dock: tabbed panels, hide / pop-out, resize, side ═══════════════
// States (set.dock):  docked — beside the canvas, takes its own column
//                     hidden — only the slim rail is shown
//                     float  — opened from the rail, floating over the canvas (temporary)
const PANELS = { layers: '#pLayers', info: '#pInfo', palette: '#pPalette', export: '#pExport' };
let dockState = set.dock === 'hidden' ? 'hidden' : 'docked';
function showPanel(name, { reveal = true } = {}) {
  set.panel = name; saveSet();
  for (const [k, sel] of Object.entries(PANELS)) $(sel).hidden = k !== name;
  $$('.dock-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.panel === name));
  $$('#rail [data-rail]').forEach(b => b.setAttribute('aria-pressed', dockState === 'float' && b.dataset.rail === name));
  if (reveal && dockState === 'hidden') setDock('float');
  if (name === 'export') updateExport();
  if (name === 'palette' && S.ready && (S.pal.stale || !S.pal.colors.length)) { S.pal.stale = false; palTimer = setTimeout(refreshPalette, 0); }
}
function setDock(state) {
  dockState = state; appEl.dataset.dock = state;
  if (state !== 'float') { set.dock = state; saveSet(); }
  $('#rail').hidden = state === 'docked';
  $('#dockPin').hidden = state !== 'float';
  $('#btnPanels').setAttribute('aria-pressed', state === 'docked');
  $('#dockHide').title = state === 'float' ? 'Close (Esc)' : 'Hide panels (\\)';
  $$('#rail [data-rail]').forEach(b => b.setAttribute('aria-pressed', state === 'float' && b.dataset.rail === set.panel));
  requestAnimationFrame(() => viewVP.st.fit && viewVP.fit());
}
function togglePanels() { setDock(dockState === 'docked' ? 'hidden' : 'docked'); }
$$('.dock-tabs button').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
$('.dock-tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const tabs = $$('.dock-tabs button'), i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); showPanel(n.dataset.panel);
});
$('#dockHide').onclick = () => setDock('hidden');
$('#dockPin').onclick = () => setDock('docked');
$('#btnPanels').onclick = togglePanels;
$$('#rail [data-rail]').forEach(b => b.addEventListener('click', () => {
  const r = b.dataset.rail;
  if (r === 'dock') return setDock('docked');
  if (dockState === 'float' && set.panel === r) return setDock('hidden');
  showPanel(r); setDock('float'); showPanel(r, { reveal: false });
}));
// close the pop-out when the canvas is clicked (optional)
$('#viewport').addEventListener('pointerdown', () => { if (dockState === 'float' && set.autoClose) setDock('hidden'); });
// resize
(() => {
  const h = $('#dockResize'); let d = null;
  const clampW = w => Math.max(260, Math.min(620, w, window.innerWidth * 0.6));
  h.addEventListener('pointerdown', e => { d = { x: e.clientX, w: set.dockW }; h.setPointerCapture(e.pointerId); h.classList.add('on'); });
  h.addEventListener('pointermove', e => {
    if (!d) return; const dx = e.clientX - d.x; set.dockW = clampW(d.w + (set.side === 'right' ? -dx : dx));
    appEl.style.setProperty('--dock-w', Math.round(set.dockW) + 'px');
  });
  const end = () => { if (!d) return; d = null; h.classList.remove('on'); saveSet(); viewVP.st.fit && viewVP.fit(); };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('dblclick', () => { set.dockW = DEF.dockW; applySettings(); saveSet(); });
  h.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
    const s = (e.key === 'ArrowLeft') === (set.side === 'right') ? 20 : -20; set.dockW = clampW(set.dockW + s); applySettings(); saveSet();
  });
})();
