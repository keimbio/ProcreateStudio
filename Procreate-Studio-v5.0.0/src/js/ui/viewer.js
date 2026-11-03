// ═══════════════ Viewer: document state, canvas, show modes, details ═══════════════
const S = {
  file: null, fileName: '', info: null, hasComposite: false, ready: false,
  meta: new Map(),          // id → original layer / group metadata from the file
  tree: [],                 // current structure [{id, children?}], top → bottom
  names: new Map(), vis: new Map(), orig: null, saved: null,
  selected: new Set(), anchor: null, focus: null, collapsed: new Set(),
  thumbs: new Map(), empty: new Set(),
  show: 'visible', showBg: false, applyMask: true,
  undo: [], redo: [],
  pal: { colors: [], label: '' }
};
let viewClient = null;
const viewVP = makeViewport($('#viewport'), $('#viewContent'), { onChange: () => updateStatus() });
const cv = $('#canvas');

function openFile(file) {
  if (!file) return;
  if (!/\.procreate$/i.test(file.name)) { toast('That isn’t a .procreate file. In Procreate, use Share → Procreate to export one.', true); return; }
  if (hasUnsaved() && !confirm('You have layer edits that haven’t been saved as a .procreate file. Open another file anyway?')) return;
  resetState(); S.file = file; S.fileName = file.name.replace(/\.procreate$/i, '');
  $('#fileName').textContent = file.name; $('#fileChip').hidden = false; $('#fileChip').title = file.name + ' · ' + fmtBytes(file.size);
  busy('Reading file…'); setMode('view');
  if (viewClient) viewClient.close();
  viewClient = makeClient(onViewEvent); viewClient.open(file);
}
function resetState() {
  Object.assign(S, { info: null, ready: false, tree: [], orig: null, saved: null, anchor: null, focus: null, show: 'visible', undo: [], redo: [] });
  S.meta = new Map(); S.names = new Map(); S.vis = new Map(); S.selected = new Set(); S.collapsed = new Set(); S.thumbs = new Map(); S.empty = new Set();
  S.pal = { colors: [], label: '' }; soloRestore = null;
  $('#rangeInput').value = ''; $('#rangeMsg').textContent = ''; $('#layerTree').innerHTML = ''; $('#swatches').innerHTML = ''; $('#palStrip').innerHTML = '';
  $('#editedDot').hidden = true; $('#editBanner').hidden = true; $('#btnExportTop').disabled = true;
  $('#pcFileName').dataset.touched = ''; $('#pcTitle').dataset.touched = ''; $('#btnPanels').disabled = true;
}
function closeFile() {
  if (hasUnsaved() && !confirm('Close this file? Your layer edits haven’t been saved as a .procreate file.')) return;
  if (viewClient) viewClient.close(); viewClient = null; resetState(); S.file = null;
  $('#workView').hidden = true; $('#emptyView').hidden = false; $('#fileChip').hidden = true; busy(false);
}
function openFailed(msg) { busy(false); S.orig = null; closeFile(); toast('Couldn’t open this file — ' + msg, true); }

function onViewEvent(m) {
  switch (m.type) {
    case 'opened': onOpened(m); break;
    case 'layer': onLayerDecoded(m); break;
    case 'ready': onReady(); break;
    case 'error': openFailed(m.message); break;
  }
}
function onOpened(m) {
  S.info = m.info; S.hasComposite = m.hasComposite;
  const conv = ns => ns.map(n => {
    S.names.set(n.id, n.name); S.vis.set(n.id, !n.hidden);
    if (n.kind === 'group') { S.meta.set(n.id, { kind: 'group', id: n.id, name: n.name, hidden: n.hidden }); return { id: n.id, children: conv(n.children) }; }
    S.meta.set(n.id, n); return { id: n.id };
  });
  S.tree = conv(m.tree);
  S.orig = snapshot(); S.saved = S.orig;
  S.showBg = !m.info.backgroundHidden;
  const first = m.layers[0]; if (first) { S.selected = new Set([first.id]); S.anchor = S.focus = first.id; }
  $('#emptyView').hidden = true; $('#workView').hidden = false;
  $('[data-show="original"]').disabled = !S.hasComposite;
  $('#btnPanels').disabled = false;
  setDock(dockState); showPanel(set.panel, { reveal: false });
  drawTree(); fillInfo(); syncShow(); updateEditUI();
  const { W, H } = orientedSize(S.info, set.orient); viewVP.st.fit = true; viewVP.setSize(W, H);
  $('#loadBar').classList.remove('done');
  busy('Decoding layers…');
  viewClient.ask('thumbnail').then(r => {   // Procreate's quick preview while layers decode
    if (S.ready || !r.png) return;
    createImageBitmap(new Blob([r.png], { type: 'image/png' })).then(bmp => {
      if (S.ready) return; cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0);
    }).catch(() => { });
  }).catch(() => { });
}
function onLayerDecoded(m) {
  if (m.empty) S.empty.add(m.id);
  else S.thumbs.set(m.id, imgToCanvas(m.thumb));
  const r = rowEl(m.id); if (r) fillThumb(r.querySelector('.thumb'), m.id);
  $('#loadBar span').style.width = (m.progress * 100).toFixed(1) + '%';
  busy(`Decoding layers… ${Math.round(m.progress * 100)}%`);
}
function onReady() {
  S.ready = true; $('#loadBar').classList.add('done'); $('#btnExportTop').disabled = false;
  render(); toast(`Opened ${S.fileName} — ${plural(leaves().length, 'layer')}`);
}

// ── what the canvas shows ──
function setShow(v) {
  if (v === 'original' && !S.hasComposite) return;
  S.show = v; syncShow(); render();
  if (v === 'selected') { const r = rowEl(S.focus); r && r.scrollIntoView({ block: 'nearest' }); }
}
function soloId() { const L = selectedLeaves(); return S.show === 'selected' && L.length === 1 ? L[0] : null; }
function syncShow() {
  $$('#showSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.show === S.show));
  $('#tgBg').setAttribute('aria-pressed', S.showBg); $('#tgMask').setAttribute('aria-pressed', S.applyMask);
  if (S.info) $('#bgSwatch').style.background = rgbCss(S.info.background);
  const solo = soloId(); const sel = selectedLeaves();
  $('#singleNav').hidden = !solo; $('#tgMask').hidden = !(solo && S.meta.get(solo).hasMask);
  $('#stage').classList.toggle('isolating', S.show === 'selected');
  $('#actIsolate').setAttribute('aria-pressed', S.show === 'selected');
  const lab = $('#viewLabel'); lab.classList.remove('warn');
  const all = leaves();
  if (S.show === 'visible') lab.innerHTML = `Showing <b>${all.filter(effVisible).length}</b> of ${all.length} layers — the ones with their eye on`;
  else if (S.show === 'original') { lab.innerHTML = 'Showing <b>Procreate’s saved render</b>' + (hasEdits() ? ' — made before your edits' : ''); }
  else if (solo) {
    const L = S.meta.get(solo), num = layerNums().get(solo);
    lab.innerHTML = `Showing only <b>${esc(S.names.get(solo))}</b> · layer ${num} of ${all.length}`;
    $('#singleName').textContent = S.names.get(solo);
    $('#singleSub').textContent = `Layer ${num} of ${all.length}${S.empty.has(solo) ? ' · empty' : ''}${L.blend ? ' · ' + L.blendName : ''}${S.vis.get(solo) ? '' : ' · hidden'}`;
    const i = all.indexOf(solo); $('#prevLayer').disabled = i <= 0; $('#nextLayer').disabled = i >= all.length - 1;
  } else if (sel.length) lab.innerHTML = `Showing only the <b>${sel.length} selected</b> layers`;
  else { lab.innerHTML = 'Nothing selected — click layers in the panel to show them here'; lab.classList.add('warn'); }
}
function specFor(what, opt = {}) {
  const base = { orient: set.orient, k: opt.k || dispK(S.info), bg: opt.bg !== undefined ? opt.bg : (S.showBg ? S.info.background.slice(0, 3) : null) };
  if (what === 'original') return { ...base, mode: 'original', bg: opt.bg !== undefined ? opt.bg : null };
  if (what === 'solo') return { ...base, mode: 'solo', soloId: opt.id, applyMask: S.applyMask };
  if (what === 'selected') { const L = selectedLeaves(); if (L.length === 1) return specFor('solo', { ...opt, id: L[0] }); return { ...base, mode: 'stack', ids: L, orphan: 'show' }; }
  return { ...base, mode: 'stack', ids: leaves().filter(effVisible), orphan: 'hide' };
}
let renderSeq = 0, renderRaf = 0;
function render() {
  if (!S.ready) return; syncShow(); updateStatus();
  cancelAnimationFrame(renderRaf);
  renderRaf = requestAnimationFrame(async () => {
    const my = ++renderSeq; const slow = setTimeout(() => my === renderSeq && busy('Rendering…'), 140);
    try {
      const { img } = await viewClient.ask('render', { spec: specFor(S.show) });
      if (my !== renderSeq) return;
      imgToCanvas(img, cv);
      const { W, H } = orientedSize(S.info, set.orient); viewVP.setSize(W, H);
      schedulePalette(250);
      if (set.panel === 'export') updateExport();
    } catch (e) { toast('Render failed — ' + e.message, true); }
    finally { clearTimeout(slow); if (my === renderSeq) busy(false); }
  });
}
function updateStatus() {
  if (!S.info) return;
  const all = leaves(), { W, H } = orientedSize(S.info, set.orient);
  const ed = hasEdits() ? `<span class="ed">● edited</span>` : '';
  $('#status').innerHTML = `<span><b>${all.filter(effVisible).length}</b> visible</span><span><b>${S.selected.size}</b> selected</span><span><b>${all.length}</b> layers</span>${ed}<span class="push">${W} × ${H}px</span><span>${Math.round(viewVP.st.zoom * 100)}%</span>`;
  $('#zoomVal').textContent = Math.round(viewVP.st.zoom * 100) + '%';
}
$('#zoomIn').onclick = () => viewVP.zoomAt(1.25); $('#zoomOut').onclick = () => viewVP.zoomAt(0.8); $('#zoomFit').onclick = () => viewVP.fit(); $('#zoomVal').onclick = () => viewVP.actual();
$$('#showSeg button').forEach(b => b.addEventListener('click', () => setShow(b.dataset.show)));
$('#tgBg').onclick = () => { S.showBg = !S.showBg; render(); };
$('#tgMask').onclick = () => { S.applyMask = !S.applyMask; render(); };
$('#prevLayer').onclick = () => stepSelection(-1); $('#nextLayer').onclick = () => stepSelection(1);

// ── Details panel ──
function fillInfo() {
  const i = S.info, { W, H } = orientedSize(i, set.orient);
  const all = leaves(); let groups = 0; walk(S.tree, n => { if (n.children) groups++; });
  $('#docTitle').textContent = i.name || S.fileName;
  $('#statLayers').textContent = all.length; $('#statSize').textContent = `${W} × ${H}`;
  const facts = [];
  if (i.dpi) facts.push(['Print size', `${(W / i.dpi).toFixed(2)} × ${(H / i.dpi).toFixed(2)} in @ ${Math.round(i.dpi)} dpi`]);
  facts.push(['Groups', groups || 'None']);
  const masks = all.filter(id => S.meta.get(id).hasMask).length, clips = all.filter(id => S.meta.get(id).clipped).length;
  if (masks || clips) facts.push(['Masks · clipping', `${masks} · ${clips}`]);
  facts.push(['Orientation', ORIENT_TXT(i)]);
  facts.push(['Background', `<span class="swatchdot" style="background:${rgbCss(i.background)}"></span>${hexOf(i.background)}${i.backgroundHidden ? ' (hidden)' : ''}`]);
  if (i.colorProfile) facts.push(['Colour profile', esc(i.colorProfile)]);
  if (i.strokeCount) facts.push(['Strokes', i.strokeCount.toLocaleString()]);
  if (i.trackedTime) facts.push(['Time in Procreate', fmtTime(i.trackedTime)]);
  if (i.author) facts.push(['Author', esc(i.author)]);
  if (S.file) facts.push(['File size', fmtBytes(S.file.size)]);
  const removed = S.orig ? countRemoved() : 0; if (removed) facts.push(['Removed (unsaved)', plural(removed, 'layer')]);
  $('#facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd title="${String(v).replace(/<[^>]+>/g, '')}">${v}</dd>`).join('');
}
