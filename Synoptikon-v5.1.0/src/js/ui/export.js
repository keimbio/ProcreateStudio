// ═══════════════ Export: Quick export tab + full Export window (Spectator-style) ═══════════════
const EXP = { what: 'view', fmt: 'png', bg: 'transparent', scale: 1, quality: 92 };
const QX = { fmt: 'png' };
let webpOK = true;
{ const t = document.createElement('canvas'); t.width = t.height = 1; webpOK = t.toDataURL('image/webp').startsWith('data:image/webp'); }

// Jobs for a “what”. Every option names exactly which layers it uses, so what is exported never
// depends on a hidden selection state.
function exportJobs(what = EXP.what) {
  const nums = layerNums(), all = leaves(), pad = String(all.length).length, f = S.fileName;
  const single = id => ({ spec: 'solo', id, name: `${String(nums.get(id)).padStart(pad, '0')}_${safe(S.names.get(id))}` });
  if (what === 'view') {
    if (S.show === 'original') return [{ spec: 'original', name: `${f}_procreate-render`, ids: [] }];
    if (S.show === 'selected') { const L = selectedLeaves(); if (!L.length) return []; return L.length === 1 ? [{ ...single(L[0]), ids: L }] : [{ spec: 'selected', name: `${f}_layers_${rangeLabel(L)}`, ids: L }]; }
    return [{ spec: 'visible', name: f, ids: all.filter(effVisible) }];
  }
  if (what === 'visible') return [{ spec: 'visible', name: f, ids: all.filter(effVisible) }];
  if (what === 'selected') { const L = selectedLeaves(); return L.length ? [{ spec: 'selected', name: `${f}_layers_${rangeLabel(L)}`, ids: L }] : []; }
  const ids = what === 'every' ? all : selectedLeaves();
  return ids.map(id => ({ ...single(id), ids: [id] }));
}
function rangeLabel(ids) {
  const nums = layerNums(), n = ids.map(i => nums.get(i)).sort((a, b) => a - b), out = [];
  for (let i = 0; i < n.length; i++) { let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push(i === j ? n[i] : `${n[i]}-${n[j]}`); i = j; }
  return out.join('_') || 'none';
}
const viewWhat = () => S.show === 'original' ? 'Procreate’s saved render' + (hasEdits() ? ' (before your edits)' : '')
  : S.show === 'selected' ? (selectedLeaves().length ? `the ${plural(selectedLeaves().length, 'selected layer')}` : 'nothing (no layers selected)')
  : `${plural(leaves().filter(effVisible).length, 'visible layer')}`;
const bgFor = (mode, fmt) => { let bg = mode === 'doc' ? S.info.background.slice(0, 3) : mode === 'white' ? [1, 1, 1] : null; if (fmt === 'jpg' && !bg) bg = [1, 1, 1]; return bg; };

// ── preview thumbnails (sampled render: fast) ──
const prevT = {}, prevSeq = {};
function schedulePreview(key, canvas, job, bg, px) {
  clearTimeout(prevT[key]);
  if (!job || !S.ready) { canvas.width = canvas.height = 1; return; }
  prevT[key] = setTimeout(async () => {
    const my = prevSeq[key] = (prevSeq[key] || 0) + 1, long = Math.max(S.info.width, S.info.height);
    try {
      const { img } = await viewClient.ask('render', { spec: specFor(job.spec, { k: Math.max(1, Math.floor(long / px)), bg, id: job.id, sample: true }) });
      if (my === prevSeq[key]) imgToCanvas(img, canvas);
    } catch (e) { }
  }, 140);
}

// ── Quick export (dock tab) ──
function updateQuick() {
  if (!S.info) return;
  $('#qxWhat').textContent = viewWhat();
  const jobs = exportJobs('view');
  $('#qxImage').disabled = !jobs.length || !S.ready;
  $('#qxImage').textContent = jobs.length ? `Export what you see · ${QX.fmt.toUpperCase()}` : 'Nothing to export';
  schedulePreview('q', $('#qxThumb canvas'), jobs[0], S.showBg ? S.info.background.slice(0, 3) : null, 300);
  const n = changeItems().length;
  $('#qxPcNote').textContent = n ? `${plural(n, 'kind')} of layer edits will be saved into a new file.` : 'No layer edits yet — reorder, rename, hide or delete layers first.';
  $('#qxProcreate').disabled = !S.ready;
}
$$('#qxFmt button').forEach(b => b.addEventListener('click', () => {
  QX.fmt = b.dataset.fmt; $$('#qxFmt button').forEach(x => x.setAttribute('aria-checked', x === b)); updateQuick();
}));
$('#qxImage').onclick = () => runImageExport(exportJobs('view'), { fmt: QX.fmt, bg: S.showBg ? 'doc' : 'transparent', scale: 1, quality: 92 }, $('#qxImage'));
$('#qxProcreate').onclick = () => saveProcreate($('#qxProcreate'));
$('#qxMore').onclick = () => openExport();

// ── Export window ──
function openExport(section) {
  if (!S.ready) return;
  EXP.bg = S.showBg ? 'doc' : 'transparent'; syncSegs();
  openModal('exportModal'); updateExport();
  if (!S.pal.colors.length) refreshPalette(true);
  if (section) requestAnimationFrame(() => $('#xsec' + section[0].toUpperCase() + section.slice(1)).scrollIntoView({ block: 'start' }));
}
function syncSegs() {
  $$('#xBg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === EXP.bg));
  $$('#xScale button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === EXP.scale));
}
const describeIds = ids => ids.length ? `${plural(ids.length, 'layer')}` : 'none';
function updateExport() {
  if (!S.info) return;
  const all = leaves(), vis = all.filter(effVisible), sel = selectedLeaves();
  const { W, H } = orientedSize(S.info, set.orient);
  $('#xSub').textContent = `${S.info.name || S.fileName}  ·  ${W.toLocaleString()} × ${H.toLocaleString()} px  ·  ${plural(all.length, 'layer')}`;
  $('#xsView').textContent = viewWhat();
  $('#xsVisible').textContent = plural(vis.length, 'layer') + ' → 1 image';
  $('#xsSel').textContent = sel.length ? plural(sel.length, 'layer') + ' → 1 image' : 'select layers first';
  $('#xsSep').textContent = sel.length ? plural(sel.length, 'image') + (sel.length > 1 ? ' (ZIP)' : '') : 'select layers first';
  $('#xsEvery').textContent = plural(all.length, 'image') + ' (ZIP)';
  $$('#xWhat input').forEach(r => { r.disabled = (r.value === 'selected' || r.value === 'separate') && !sel.length; });
  if ($(`#xWhat input[value="${EXP.what}"]`).disabled) { EXP.what = 'view'; $('#xWhat input[value="view"]').checked = true; }
  const jobs = exportJobs(), f = EXP.fmt, k = EXP.scale;
  const btn = $('#xDoImage'); btn.disabled = !jobs.length || !S.ready;
  btn.textContent = !jobs.length ? 'Nothing to export' : jobs.length > 1 ? `Export ${jobs.length} ${f.toUpperCase()} images (ZIP)` : `Export ${f.toUpperCase()} · ${Math.ceil(W / k).toLocaleString()} × ${Math.ceil(H / k).toLocaleString()}`;
  $('#xQualityRow').hidden = !(f === 'jpg' || f === 'webp');
  const notes = [];
  if (f === 'jpg' && EXP.bg === 'transparent') notes.push('JPEG has no transparency, so white is used behind the artwork.');
  if (f === 'tiff') notes.push('Uncompressed TIFF: large files, best for print and Photoshop.');
  if (f === 'webp' && !webpOK) notes.push('This browser can’t write WebP; PNG will be used instead.');
  $('#xNote').textContent = notes.join(' ');
  const ids = jobs.length === 1 ? jobs[0].ids : jobs.flatMap(j => j.ids);
  $('#xWhoTitle').textContent = !jobs.length ? 'Nothing selected' : jobs.length > 1 ? `${jobs.length} images · preview shows the first` : jobs[0].spec === 'original' ? 'Procreate’s saved render' : plural(ids.length, 'layer') + ' in this image';
  $('#xWho').innerHTML = ids.slice(0, 7).map(i => `<li>${esc(S.names.get(i))}</li>`).join('') + (ids.length > 7 ? `<li class="more">+ ${ids.length - 7} more</li>` : '');
  schedulePreview('x', $('#xThumb canvas'), jobs[0], bgFor(EXP.bg, f), 336);
  updateProcreateExport(); drawExportPalette();
}
$$('#xWhat input').forEach(r => r.addEventListener('change', () => { EXP.what = r.value; updateExport(); }));
$$('#xFmt input').forEach(r => r.addEventListener('change', () => { EXP.fmt = r.value; updateExport(); }));
$$('#xBg button').forEach(b => b.addEventListener('click', () => { EXP.bg = b.dataset.v; syncSegs(); updateExport(); }));
$$('#xScale button').forEach(b => b.addEventListener('click', () => { EXP.scale = +b.dataset.v; syncSegs(); updateExport(); }));
$('#xQuality').oninput = e => { EXP.quality = +e.target.value; $('#xQualityOut').textContent = e.target.value; };
$('#xDoImage').onclick = () => runImageExport(exportJobs(), EXP, $('#xDoImage'));
$('#btnExportTop').onclick = () => openExport();
$$('[data-open-export]').forEach(b => b.onclick = () => openExport(b.dataset.openExport));

async function runImageExport(jobs, o, btn) {
  if (!jobs.length) return;
  const ext = o.fmt === 'webp' && !webpOK ? 'png' : o.fmt, bg = bgFor(o.bg, o.fmt);
  btn.disabled = true;
  try {
    const files = [];
    for (let n = 0; n < jobs.length; n++) {
      const j = jobs[n]; busy(jobs.length > 1 ? `Exporting ${n + 1} of ${jobs.length}…` : 'Exporting…');
      const { img } = await viewClient.ask('render', { spec: specFor(j.spec, { k: o.scale, bg, id: j.id }) });
      files.push({ name: `${j.name}.${ext}`, blob: await encodeImage(img, ext, !bg, o.quality) });
    }
    if (files.length === 1) download(files[0].blob, files[0].name);
    else {
      busy('Building ZIP…');
      const entries = await Promise.all(files.map(async x => ({ name: x.name, data: new Uint8Array(await x.blob.arrayBuffer()) })));
      download(Zip.build(entries), `${S.fileName}_${o.what === 'every' ? 'all' : 'selected'}_layers.zip`);
    }
    toast(files.length > 1 ? `Saved ${files.length} images in a ZIP` : `Saved ${files[0].name}`);
  } catch (e) { toast('Export failed — ' + e.message, true); }
  finally { busy(false); btn.disabled = false; updateQuick(); if (modalOpen('exportModal')) updateExport(); }
}
async function encodeImage(img, fmt, alpha, quality = 92) {
  if (fmt === 'tiff') return Encoders.tiff(img, alpha);
  const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt], q = quality / 100;
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(img.w, img.h); oc.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    if (oc.convertToBlob) return oc.convertToBlob({ type, quality: q });
  }
  const c = imgToCanvas(img);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('image too large for this browser')), type, q));
}

// ── .procreate ──
function changeItems() {
  if (!S.orig) return [];
  const d = diffFrom(S.orig), items = [];
  if (d.order) items.push('Layer order or grouping changed');
  const rl = d.removed.filter(i => !isGroup(i)).length, rg = d.removed.length - rl;
  if (rl) items.push(`${plural(rl, 'layer')} removed`); if (rg) items.push(`${plural(rg, 'group')} removed`);
  if (d.renamed.length) items.push(`${plural(d.renamed.length, 'name')} changed`);
  if (d.vis.length) items.push(`${plural(d.vis.length, 'visibility change')}`);
  return items;
}
function updateProcreateExport() {
  if (!S.orig) return;
  const items = changeItems(); const keep = $('#pcKeepVis').checked;
  $('#pcChanges').innerHTML = items.length ? items.map(t => `<li>${esc(t)}${!keep && /visibility/.test(t) ? ' <span class="small">(not kept)</span>' : ''}</li>`).join('')
    : '<li class="none">No layer edits yet — this would be a re-packed copy of the original. Reorder, rename, hide or delete layers in the Layers panel first.</li>';
  const fn = $('#pcFileName'); if (!fn.dataset.touched) fn.value = `${S.fileName} (edited)`;
  const ti = $('#pcTitle'); if (!ti.dataset.touched) ti.value = S.info.name || S.fileName;
  $('#btnSaveProcreate').disabled = !S.ready;
}
$('#pcFileName').oninput = e => { e.target.dataset.touched = 1; };
$('#pcTitle').oninput = e => { e.target.dataset.touched = 1; };
$('#pcKeepVis').onchange = updateProcreateExport;
$('#btnSaveProcreate').onclick = () => saveProcreate($('#btnSaveProcreate'));
async function saveProcreate(btn) {
  if (!S.ready) return; btn.disabled = true;
  try {
    if (!$('#pcFileName').value) updateProcreateExport();
    const keepVis = $('#pcKeepVis').checked, names = {}, hidden = {};
    walk(S.tree, n => {
      if (S.names.get(n.id) !== S.orig.names.get(n.id)) names[n.id] = S.names.get(n.id);
      if (keepVis && S.vis.get(n.id) !== S.orig.vis.get(n.id)) hidden[n.id] = !S.vis.get(n.id);
    });
    const title = $('#pcTitle').value.trim();
    const edits = { tree: clone(S.tree), names, hidden: keepVis ? hidden : null, title: title && title !== (S.info.name || '') ? title : null };
    busy('Preparing .procreate…');
    const r = await viewClient.ask('save', { edits }, txt => busy(txt));
    const name = (safeFile($('#pcFileName').value) || S.fileName + ' (edited)') + '.procreate';
    download(r.blob, name);
    S.saved = snapshot(); updateEditUI();
    toast(`Saved ${name} — open it in Procreate to check it`);
  } catch (e) { toast('Couldn’t save the .procreate file — ' + e.message, true); }
  finally { busy(false); btn.disabled = false; }
}
const safeFile = s => String(s).replace(/[\/\\:*?"<>|]+/g, '').trim().slice(0, 120);
