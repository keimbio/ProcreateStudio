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
const viewVP = makeViewport($('#viewport'), $('#viewContent'), { onChange: () => updateStatus(), pad: { top: 28, bottom: 28, x: 28 } });
const cv = $('#canvas');

function openFile(file) {
  if (!file) return;
  if (!/\.procreate$/i.test(file.name)) { toast('That isn’t a .procreate file. In Procreate, use Share → Procreate to export one.', true); return; }
  if (hasUnsaved() && !confirm('You have layer edits that haven’t been saved as a .procreate file. Open another file anyway?')) return;
  resetState(); S.file = file; S.fileName = file.name.replace(/\.procreate$/i, '');
  $('#docTitleH').textContent = S.fileName; $('#docMeta').textContent = `${file.name} · ${fmtBytes(file.size)} · reading…`;
  $('#emptyView').hidden = true; $('#workView').hidden = false;
  busy('Reading file…'); setMode('view');
  if (viewClient) viewClient.close();
  viewClient = makeClient(onViewEvent); viewClient.open(file);
}
function resetState() {
  Object.assign(S, { info: null, ready: false, tree: [], orig: null, saved: null, anchor: null, focus: null, show: 'visible', undo: [], redo: [] });
  S.meta = new Map(); S.names = new Map(); S.vis = new Map(); S.selected = new Set(); S.collapsed = new Set(); S.thumbs = new Map(); S.empty = new Set();
  S.pal = { colors: [], label: '' }; soloRestore = null;
  $('#rangeInput').value = ''; $('#rangeMsg').textContent = ''; $('#layerTree').innerHTML = ''; $('#swatches').innerHTML = ''; $('#palStrip').innerHTML = '';
  $('#editBadge').hidden = true; $('#editBanner').hidden = true; $('#btnExportTop').disabled = true;
  $('#pcFileName').dataset.touched = ''; $('#pcTitle').dataset.touched = '';
  cv.width = cv.height = 1;
}
function closeFile() {
  if (hasUnsaved() && !confirm('Close this file? Your layer edits haven’t been saved as a .procreate file.')) return;
  if (viewClient) viewClient.close(); viewClient = null; resetState(); S.file = null;
  $('#workView').hidden = true; $('#emptyView').hidden = false; busy(false); closeModal('exportModal');
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
  $('[data-show="original"]').disabled = !S.hasComposite;
  setDock(dockState); showPanel(set.panel, { reveal: false });
  drawTree(); fillInfo(); syncShow(); updateEditUI();
  // bring the whole workspace into view (the title area scrolls away; it's one scroll up)
  requestAnimationFrame(() => { const r = $('#viewMode').getBoundingClientRect(); if (r.top > 40) scrollTo({ top: scrollY + r.top - 14, behavior: 'smooth' }); });
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
function viewSentence() {
  const all = leaves(), solo = soloId(), sel = selectedLeaves();
  if (S.show === 'visible') return `<b>${all.filter(effVisible).length}</b> of ${all.length} layers — every layer with its eye on`;
  if (S.show === 'original') return `<b>Procreate’s saved render</b>${hasEdits() ? ' — made before your edits' : ''}`;
  if (solo) return `Only <b>${esc(S.names.get(solo))}</b> (layer ${layerNums().get(solo)} of ${all.length})`;
  if (sel.length) return `Only the <b>${sel.length} selected</b> layers`;
  return 'Nothing selected — click layers in the panel to show them here';
}
function syncShow() {
  $$('#showSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.show === S.show));
  $('#tgBg').setAttribute('aria-checked', S.showBg); $('#tgMask').setAttribute('aria-checked', S.applyMask);
  if (S.info) $('#bgSwatch').style.background = rgbCss(S.info.background);
  const solo = soloId(), all = leaves();
  $('#singleNav').hidden = !solo; $('#maskGrp').hidden = !(solo && S.meta.get(solo).hasMask);
  $('#stage').classList.toggle('isolating', S.show === 'selected');
  $('#actIsolate').setAttribute('aria-pressed', S.show === 'selected');
  const sentence = viewSentence();
  $('#sfLeft').innerHTML = (S.show === 'selected' && !selectedLeaves().length ? '' : 'Showing ') + sentence;
  $('#viewDesc').innerHTML = sentence;
  if (solo) {
    const L = S.meta.get(solo), num = layerNums().get(solo);
    $('#singleName').textContent = S.names.get(solo);
    $('#singleSub').textContent = `· ${num} of ${all.length}${S.empty.has(solo) ? ' · empty' : ''}${L.blend ? ' · ' + L.blendName : ''}`;
    const i = all.indexOf(solo); $('#prevLayer').disabled = i <= 0; $('#nextLayer').disabled = i >= all.length - 1;
  }
  fillViewFacts(); fillLayerFacts();
}
function specFor(what, opt = {}) {
  const base = { orient: set.orient, k: opt.k || dispK(S.info), bg: opt.bg !== undefined ? opt.bg : (S.showBg ? S.info.background.slice(0, 3) : null), sample: !!opt.sample };
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
    const my = ++renderSeq; const slow = setTimeout(() => my === renderSeq && busy('Rendering…'), 160);
    try {
      const { img } = await viewClient.ask('render', { spec: specFor(S.show) });
      if (my !== renderSeq) return;
      imgToCanvas(img, cv);
      const { W, H } = orientedSize(S.info, set.orient); viewVP.setSize(W, H);
      schedulePalette(300);
      if (set.panel === 'export') updateQuick();
      if (modalOpen('exportModal')) updateExport();
    } catch (e) { toast('Render failed — ' + e.message, true); }
    finally { clearTimeout(slow); if (my === renderSeq) busy(false); }
  });
}
function updateStatus() {
  if (!S.info) return;
  const all = leaves(), { W, H } = orientedSize(S.info, set.orient), z = Math.round(viewVP.st.zoom * 100);
  const sep = '<span class="sep">·</span>';
  $('#docCounts').innerHTML = `<b>${all.filter(effVisible).length}</b> visible${sep}<b>${selectedLeaves().length}</b> selected${sep}<b>${all.length}</b> layer${all.length === 1 ? '' : 's'}`;
  $('#sfRight').textContent = `${W.toLocaleString()} × ${H.toLocaleString()} px · ${z}%`;
  $('#zoomVal').textContent = z + '%';
}
$('#zoomIn').onclick = () => viewVP.zoomAt(1.25); $('#zoomOut').onclick = () => viewVP.zoomAt(0.8); $('#zoomFit').onclick = () => viewVP.fit(); $('#zoomVal').onclick = () => viewVP.actual();
$$('#showSeg button').forEach(b => b.addEventListener('click', () => setShow(b.dataset.show)));
$('#tgBg').onclick = () => { S.showBg = !S.showBg; render(); };
$('#tgMask').onclick = () => { S.applyMask = !S.applyMask; render(); };
$('#prevLayer').onclick = () => stepSelection(-1); $('#nextLayer').onclick = () => stepSelection(1);
$('#btnClose').onclick = closeFile;

// ── Details panel ──
const fmtDate = ms => ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const factHTML = facts => facts.map(([k, v]) => `<dt>${k}</dt><dd title="${String(v).replace(/<[^>]+>/g, '')}">${v}</dd>`).join('');
function fillViewFacts() {
  if (!S.info) return;
  const i = S.info, modeName = { visible: 'Visible layers', selected: 'Selected only', original: 'Procreate render' }[S.show];
  $('#viewFacts').innerHTML = factHTML([
    ['Showing', modeName],
    ['Canvas colour', `<span class="swatchdot" style="background:${rgbCss(i.background)}"></span>${hexOf(i.background)} · ${S.showBg ? 'shown' : 'hidden'}`],
    ['Orientation', set.orient ? ORIENT_TXT(i) : 'As stored (rotation off)']
  ]);
}
function fillLayerFacts() {
  const sel = [...S.selected], one = sel.length === 1 ? sel[0] : null;
  const has = one != null && !!S.meta.get(one);
  $('#layerInfo').hidden = !has; $('#layerNone').hidden = has;
  $('#layerNone').textContent = sel.length > 1 ? `${sel.length} layers are selected — select just one to see its details.` : 'Select a single layer in the Layers panel to see its details.';
  if (!has) return;
  const M = S.meta.get(one);
  $('#layerName').textContent = S.names.get(one);
  const tc = $('#layerThumb canvas'), src = S.thumbs.get(one);
  if (src) { tc.width = src.width; tc.height = src.height; tc.getContext('2d').drawImage(src, 0, 0); } else { tc.width = tc.height = 1; tc.getContext('2d').clearRect(0, 0, 1, 1); }
  $('#layerSub').textContent = M.kind === 'group' ? 'Group' : `Layer ${layerNums().get(one)} of ${leaves().length}${S.empty.has(one) ? ' · empty' : ''}`;
  if (M.kind === 'group') { $('#layerFacts').innerHTML = factHTML([['Group', esc(S.names.get(one))], ['Layers inside', leaves(locate(one).node.children).length], ['Visible', S.vis.get(one) ? 'Yes' : 'No']]); return; }
  $('#layerFacts').innerHTML = factHTML([
    ['Blend · opacity', `${M.blendName} · ${Math.round(M.opacity * 100)}%`],
    ['Clipping · mask', `${M.clipped ? 'Clipped' : '—'} · ${M.hasMask ? (M.maskHidden ? 'Mask (hidden)' : 'Mask') : '—'}`],
    ['Painted tiles', S.empty.has(one) ? 'Empty' : M.tileCount],
    ['Last painted', fmtDate(M.modified)]
  ]);
}
function fillInfo() {
  const i = S.info, { W, H } = orientedSize(i, set.orient);
  const all = leaves(); let groups = 0; walk(S.tree, n => { if (n.children) groups++; });
  $('#docTitleH').textContent = i.name || S.fileName;
  const title = i.name || S.fileName, fname = S.file && S.file.name;
  $('#docMeta').textContent = [fname && fname.replace(/\.procreate$/i, '') !== title ? fname : null, `${W.toLocaleString()} × ${H.toLocaleString()} px`, i.dpi ? `${Math.round(i.dpi)} dpi` : null, S.file && fmtBytes(S.file.size)].filter(Boolean).join('  ·  ');
  $('#statLayers').textContent = all.length; $('#statSize').textContent = `${W.toLocaleString()} × ${H.toLocaleString()}`;
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
  const last = Math.max(0, ...all.map(id => S.meta.get(id).modified || 0)); if (last) facts.push(['Last painted', fmtDate(last)]);
  if (i.author) facts.push(['Author', esc(i.author)]);
  if (S.file) facts.push(['File size', fmtBytes(S.file.size)]);
  const removed = S.orig ? countRemoved() : 0; if (removed) facts.push(['Removed (unsaved)', plural(removed, 'layer')]);
  $('#facts').innerHTML = factHTML(facts);
}
