// ═══════════════ Export panel: images + .procreate ═══════════════
const EXP = { kind: 'image', what: 'view', fmt: 'png', bg: 'transparent', scale: 1, quality: 92 };
let webpOK = true;
{ const t = document.createElement('canvas'); t.width = t.height = 1; webpOK = t.toDataURL('image/webp').startsWith('data:image/webp'); }

// Jobs for the chosen “what”. Every option says exactly which layers it uses, so what is
// exported never depends on a hidden selection state.
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
const describeIds = ids => ids.length ? `${plural(ids.length, 'layer')}: ${ids.slice(0, 3).map(i => S.names.get(i)).join(', ')}${ids.length > 3 ? '…' : ''}` : 'no layers';
function updateExport() {
  if (!S.info) return;
  const all = leaves(), vis = all.filter(effVisible), sel = selectedLeaves();
  const viewTxt = S.show === 'original' ? 'Procreate’s saved render' + (hasEdits() ? ' (before your edits)' : '') : S.show === 'selected' ? (sel.length ? `Selected only — ${describeIds(sel)}` : 'Selected only — nothing selected') : `Visible layers — ${plural(vis.length, 'layer')}`;
  $('#whatViewSub').textContent = viewTxt;
  $('#whatVisibleSub').textContent = plural(vis.length, 'layer') + ' with the eye on';
  $('#whatSelSub').textContent = sel.length ? describeIds(sel) : 'Select layers in the Layers panel first';
  $('#whatSepSub').textContent = sel.length ? plural(sel.length, 'file') + (sel.length > 1 ? ' in a ZIP' : '') : 'Select layers in the Layers panel first';
  $('#whatEverySub').textContent = plural(all.length, 'file') + ' in a ZIP';
  $$('#exportWhat input').forEach(r => { r.disabled = (r.value === 'selected' || r.value === 'separate') && !sel.length; });
  const jobs = exportJobs(), f = EXP.fmt, { W, H } = orientedSize(S.info, set.orient), k = EXP.scale;
  $('#btnExport').disabled = !jobs.length || !S.ready;
  $('#btnExport').textContent = !jobs.length ? 'Nothing to export' : jobs.length > 1 ? `Export ${jobs.length} ${f.toUpperCase()} files as ZIP` : `Export ${f.toUpperCase()} · ${Math.ceil(W / k)}×${Math.ceil(H / k)}`;
  $('#qualityRow').hidden = !(f === 'jpg' || f === 'webp');
  const notes = [];
  if (f === 'jpg' && EXP.bg === 'transparent') notes.push('JPG has no transparency — white will be used.');
  if (f === 'tiff') notes.push('Uncompressed TIFF: large files, best for print and Photoshop.');
  if (f === 'webp' && !webpOK) notes.push('This browser can’t write WebP; PNG will be used instead.');
  $('#fmtNote').textContent = notes.join(' ');
  // live preview of the (first) file + which layers go in
  const ids = jobs.length === 1 ? jobs[0].ids : jobs.flatMap(j => j.ids);
  $('#expWhoTitle').textContent = !jobs.length ? 'Nothing selected' : jobs.length > 1 ? `${jobs.length} files — preview shows the first` : jobs[0].spec === 'original' ? 'Procreate’s saved render' : plural(ids.length, 'layer') + ', merged';
  const lst = ids.slice(0, 5).map(i => `<li>${esc(S.names.get(i))}</li>`).join('') + (ids.length > 5 ? `<li class="more">+ ${ids.length - 5} more</li>` : '');
  $('#expWho').innerHTML = lst;
  schedulePreview(jobs[0]);
  updateProcreateExport();
}
let prevT = 0, prevSeq = 0;
function schedulePreview(job) {
  clearTimeout(prevT); const c = $('#expThumb canvas');
  if (!job || !S.ready) { c.width = c.height = 1; return; }
  prevT = setTimeout(async () => {
    const my = ++prevSeq; const long = Math.max(S.info.width, S.info.height);
    try {
      const { img } = await viewClient.ask('render', { spec: specFor(job.spec, { k: Math.max(1, Math.floor(long / 152)), bg: expBg(), id: job.id }) });
      if (my === prevSeq) imgToCanvas(img, c);
    } catch (e) { }
  }, 120);
}
const expBg = () => { let bg = EXP.bg === 'doc' ? S.info.background.slice(0, 3) : EXP.bg === 'white' ? [1, 1, 1] : null; if (EXP.fmt === 'jpg' && !bg) bg = [1, 1, 1]; return bg; };

$$('#expKind button').forEach(b => b.addEventListener('click', () => {
  EXP.kind = b.dataset.kind; $$('#expKind button').forEach(x => x.setAttribute('aria-selected', x === b));
  $('#expImage').hidden = EXP.kind !== 'image'; $('#expProcreate').hidden = EXP.kind !== 'procreate'; updateExport();
}));
$$('#exportWhat input').forEach(r => r.addEventListener('change', () => { EXP.what = r.value; updateExport(); }));
$$('#fmtGroup button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.fmt === 'heic') { toast('Browsers can’t create HEIC files. Export PNG, then on a Mac open it in Preview → File → Export → HEIC.'); return; }
  EXP.fmt = b.dataset.fmt; $$('#fmtGroup button').forEach(x => x.setAttribute('aria-checked', x === b)); updateExport();
}));
$('#expBg').onchange = e => { EXP.bg = e.target.value; updateExport(); };
$('#expScale').onchange = e => { EXP.scale = +e.target.value; updateExport(); };
$('#quality').oninput = e => { EXP.quality = +e.target.value; $('#qualityOut').textContent = e.target.value; };

$('#btnExport').onclick = async () => {
  const jobs = exportJobs(); if (!jobs.length) return;
  const f = EXP.fmt, ext = f === 'webp' && !webpOK ? 'png' : f, bg = expBg();
  const btn = $('#btnExport'); btn.disabled = true;
  try {
    const files = [];
    for (let n = 0; n < jobs.length; n++) {
      const j = jobs[n]; busy(jobs.length > 1 ? `Exporting ${n + 1} of ${jobs.length}…` : 'Exporting…');
      const { img } = await viewClient.ask('render', { spec: specFor(j.spec, { k: EXP.scale, bg, id: j.id }) });
      files.push({ name: `${j.name}.${ext}`, blob: await encodeImage(img, ext, !bg) });
    }
    if (files.length === 1) download(files[0].blob, files[0].name);
    else {
      busy('Building ZIP…');
      const entries = await Promise.all(files.map(async x => ({ name: x.name, data: new Uint8Array(await x.blob.arrayBuffer()) })));
      download(Zip.build(entries), `${S.fileName}_${EXP.what === 'every' ? 'all' : 'selected'}_layers.zip`);
    }
    toast(files.length > 1 ? `Saved ${files.length} images in a ZIP` : `Saved ${files[0].name}`);
  } catch (e) { toast('Export failed — ' + e.message, true); }
  finally { busy(false); btn.disabled = false; updateExport(); }
};
async function encodeImage(img, fmt, alpha) {
  if (fmt === 'tiff') return Encoders.tiff(img, alpha);
  const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt], q = EXP.quality / 100;
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(img.w, img.h); oc.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    if (oc.convertToBlob) return oc.convertToBlob({ type, quality: q });
  }
  const c = imgToCanvas(img);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('image too large for this browser')), type, q));
}

// ── .procreate ──
function updateProcreateExport() {
  if (!S.orig) return;
  const d = diffFrom(S.orig), items = [];
  if (d.order) items.push('Layer order or grouping changed');
  const rl = d.removed.filter(i => !isGroup(i)).length, rg = d.removed.length - rl;
  if (rl) items.push(`${plural(rl, 'layer')} removed`); if (rg) items.push(`${plural(rg, 'group')} removed`);
  if (d.renamed.length) items.push(`${plural(d.renamed.length, 'name')} changed`);
  if (d.vis.length) items.push(`${plural(d.vis.length, 'visibility change')}${$('#pcKeepVis').checked ? '' : ' (not kept)'}`);
  $('#pcChanges').innerHTML = items.length ? items.map(t => `<li>${esc(t)}</li>`).join('') : '<li class="none">No layer edits yet — this would be a re-packed copy of the original. Reorder, rename, hide or delete layers in the Layers panel first.</li>';
  const fn = $('#pcFileName'); if (!fn.dataset.touched) fn.value = `${S.fileName} (edited)`;
  const ti = $('#pcTitle'); if (!ti.dataset.touched) ti.value = S.info.name || S.fileName;
  $('#btnSaveProcreate').disabled = !S.ready;
}
$('#pcFileName').oninput = e => { e.target.dataset.touched = 1; };
$('#pcTitle').oninput = e => { e.target.dataset.touched = 1; };
$('#pcKeepVis').onchange = updateProcreateExport;
$('#btnSaveProcreate').onclick = async () => {
  const btn = $('#btnSaveProcreate'); btn.disabled = true;
  try {
    const keepVis = $('#pcKeepVis').checked;
    const names = {}, hidden = {};
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
};
const safeFile = s => String(s).replace(/[\/\\:*?"<>|]+/g, '').trim().slice(0, 120);
