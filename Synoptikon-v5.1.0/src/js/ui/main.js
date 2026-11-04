// ═══════════════ app mode tabs, settings, keyboard, files — init ═══════════════
let appMode = 'view';
function setMode(m) {
  appMode = m; $$('[data-mode-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.modeTab === m));
  $('#viewMode').hidden = m !== 'view'; $('#compareMode').hidden = m !== 'compare';
  if (m === 'compare') { requestAnimationFrame(() => vpA.fit()); if (!C.a && !C.b && S.file) cmpOpen('a', S.file); }
  else requestAnimationFrame(() => viewVP.st.fit && viewVP.fit());
}
$$('[data-mode-tab]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.modeTab)));

// settings window
$('#btnSettings').onclick = () => openModal('settings');
const bindSet = (sel, key, after) => $$(sel + ' button').forEach(b => b.addEventListener('click', () => { set[key] = b.dataset.v; saveSet(); applySettings(); after && after(); }));
const refit = () => setTimeout(() => { viewVP.st.fit && viewVP.fit(); vpA.st.fit && vpA.fit(); }, 60);
bindSet('#setMode', 'mode'); bindSet('#setTheme', 'theme'); bindSet('#setChecker', 'checker'); bindSet('#setLpMode', 'lpMode'); bindSet('#setThumb', 'thumb');
bindSet('#setSize', 'size', refit); bindSet('#sizeSeg', 'size', refit); bindSet('#setSide', 'side', refit);
$('#setOrient').onchange = e => { set.orient = e.target.checked; saveSet(); if (S.ready) { fillInfo(); viewVP.st.fit = true; render(); } if (C.a || C.b) { resetView(); cmpUpdate(); } };
$('#setPixel').onchange = e => { set.pixel = e.target.checked; saveSet(); applySettings(); };
$('#setTint').onchange = e => { set.tint = e.target.checked; saveSet(); applySettings(); };
$('#setAutoClose').onchange = e => { set.autoClose = e.target.checked; saveSet(); };

// keyboard
document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || $('.modal.show')) return;
  const k = e.key;
  if (modKey(e) && (k === 'z' || k === 'Z')) { if (appMode === 'view' && S.ready) { e.preventDefault(); e.shiftKey ? redo() : undo(); } return; }
  if (modKey(e) && k === 'y') { if (appMode === 'view') { e.preventDefault(); redo(); } return; }
  if (e.metaKey || e.ctrlKey) return;
  if (k === 'o' || k === 'O') { if (appMode === 'view') $('#fileInput').click(); else { cmpPick = C.a ? 'b' : 'a'; $('#cmpFileInput').click(); } return; }
  if (k === ',') { openModal('settings'); return; }
  if (appMode === 'compare') {
    if ('1234'.includes(k) && k.length === 1) setCmpView(['side', 'swipe', 'onion', 'diff'][+k - 1]);
    else if (k === '0') vpA.fit(); else if (k === '+' || k === '=') vpA.zoomAt(1.25); else if (k === '-') vpA.zoomAt(0.8);
    else if (k === '\\') setCmpDock(set.cdock === 'hidden' ? 'docked' : 'hidden');
    return;
  }
  if (!S.ready) return;
  if (e.defaultPrevented) return; // already handled by the layer tree
  if (k === 'Escape' && dockState === 'float') { setDock('hidden'); return; }
  if ('123'.includes(k) && k.length === 1) setShow(['visible', 'selected', 'original'][+k - 1]);
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); if (e.altKey) nudge(k === 'ArrowUp' ? -1 : 1); else stepSelection(k === 'ArrowUp' ? -1 : 1, e.shiftKey); }
  else if (k === '0') viewVP.fit();
  else if (k === '+' || k === '=') viewVP.zoomAt(1.25);
  else if (k === '-') viewVP.zoomAt(0.8);
  else if (k === 'b' || k === 'B') $('#tgBg').click();
  else if (k === 'e' || k === 'E') openExport();
  else if (k === '\\') togglePanels();
  else if ((k === 'Delete' || k === 'Backspace') && S.selected.size) { e.preventDefault(); deleteSelected(); }
});

// files & drag-and-drop
const fi = $('#fileInput');
fi.onchange = () => { openFile(fi.files[0]); fi.value = ''; };
$('#btnOpen').onclick = e => { e.stopPropagation(); if (appMode === 'compare') { cmpPick = C.a ? 'b' : 'a'; $('#cmpFileInput').click(); } else fi.click(); };
$('#dropZone').addEventListener('click', () => fi.click());
$('#dropZone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
$('#brandHome').onclick = e => { e.preventDefault(); setMode('view'); scrollTo({ top: 0, behavior: 'smooth' }); };
let dragDepth = 0; const veil = $('#dragVeil');
const dropSlot = e => { const r = $('#cmpWork').getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'a' : 'b'; };
addEventListener('dragenter', e => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); dragDepth++; veil.hidden = false; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; } });
addEventListener('dragover', e => { e.preventDefault(); $('#dragVeilText').textContent = appMode === 'compare' ? `Drop to load as ${dropSlot(e).toUpperCase()}` : 'Drop to open'; });
addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; veil.hidden = true; const files = [...e.dataTransfer.files]; if (!files.length) return;
  if (appMode === 'compare') { if (files.length >= 2) { cmpOpen('a', files[0]); cmpOpen('b', files[1]); } else cmpOpen(dropSlot(e), files[0]); }
  else openFile(files[0]);
});
addEventListener('beforeunload', e => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });

// init
applySettings();
appEl.dataset.dock = dockState; appEl.dataset.cdock = set.cdock || 'docked'; $('#cmpRail').hidden = set.cdock !== 'hidden';
showPanel(set.panel in PANELS ? set.panel : 'layers', { reveal: false });
showCPanel(['layers', 'artwork', 'files'].includes(set.cpanel) ? set.cpanel : 'layers');
cmpHeader();
window.__app = { S, C, openFile, setShow, setMode, cmpOpen, undo, redo, openExport }; // handy for debugging in the console
