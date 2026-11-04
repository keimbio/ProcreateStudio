// ═══════════════ Compare mode: two files, four views, layer-by-layer differences ═══════════════
const C = { a: null, b: null, view: 'side', pair: null, pairs: [], filter: 'all', swipeX: null, onion: 0.5, thresh: 8, imgA: null, imgB: null, diffPct: null, lastStats: null };
const DIFF_COLORS = { magenta: [255, 40, 150], red: [235, 50, 50], orange: [255, 140, 30], yellow: [255, 220, 40], lime: [130, 230, 50], cyan: [40, 210, 230], blue: [60, 120, 255], violet: [160, 90, 255], white: [255, 255, 255], heat: null };
const cmpVPs = [];
const vpA = makeViewport($('#cmpVpA'), $('#cmpVpA .content'), { onChange: st => syncVPs(0, st), ignore: e => e.target.closest('.swipe-handle'), pad: { top: 28, bottom: 28, x: 28 } });
const vpB = makeViewport($('#cmpVpB'), $('#cmpVpB .content'), { onChange: st => syncVPs(1, st), pad: { top: 28, bottom: 28, x: 28 } });
cmpVPs.push(vpA, vpB);
function syncVPs(from, st) {
  if (from === 0 && C.view === 'side') vpB.copyFrom(st); if (from === 1) vpA.copyFrom(st);
  $('#cmpZoomVal').textContent = Math.round(st.zoom * 100) + '%'; placeSwipe(); cmpFoot();
}
const cmpBusy = msg => busyOn($('#cmpBusy'), $('#cmpBusyText'), msg);

// ── files ──
function newSlot(file, key) {
  const s = { key, file, name: file.name.replace(/\.procreate$/i, ''), info: null, tree: [], layers: [], thumbs: new Map(), ready: false, sig: null, client: null };
  s.client = makeClient(m => {
    if (C[s.key] !== s) return;
    if (m.type === 'opened') { s.info = m.info; s.tree = m.tree; s.layers = m.layers; cmpHeader(); }
    if (m.type === 'layer') { if (!m.empty) s.thumbs.set(m.id, imgToCanvas(m.thumb)); cmpBusy(`Decoding ${s.key.toUpperCase()}… ${Math.round(m.progress * 100)}%`); }
    if (m.type === 'ready') { s.ready = true; s.client.ask('signature').then(r => { s.sig = new Map(r.layers.map(l => [l.id, l])); cmpUpdate(); }); }
    if (m.type === 'error') { toast(`Couldn’t open ${s.name} — ${m.message}`, true); removeSlot(s.key); }
  });
  s.client.open(file); return s;
}
function cmpOpen(key, file) {
  if (!file) return;
  if (!/\.procreate$/i.test(file.name)) { toast('That isn’t a .procreate file.', true); return; }
  if (C[key]) C[key].client.close();
  C[key] = newSlot(file, key); resetView(); cmpBusy(`Reading ${key.toUpperCase()}…`); cmpUpdate();
}
function removeSlot(key) {
  if (C[key]) C[key].client.close(); C[key] = null; resetView(); cmpBusy(false); cmpUpdate();
}
function resetView() { C.pair = null; C.imgA = C.imgB = null; C.diffPct = null; C.lastStats = null; C.pairs = []; }
function cmpHeader() {
  for (const k of ['a', 'b']) {
    const s = C[k], K = k.toUpperCase();
    $('#cmpName' + K).textContent = s ? s.name : 'No file';
    $('#cmpSub' + K).textContent = s && s.info ? `${s.info.width} × ${s.info.height} · ${plural(s.layers.length, 'layer')} · ${fmtBytes(s.file.size)}` : s ? 'Reading…' : `Choose the ${k === 'a' ? 'first' : 'second'} artwork`;
    $$(`[data-cmp-remove="${k}"]`).forEach(b => b.disabled = !s);
  }
  const nm = s => s ? `<b>${esc(s.name)}</b>` : '<span class="small">not chosen</span>';
  $('#cmpHint').innerHTML = C.a || C.b ? `A ${nm(C.a)} &nbsp;⇄&nbsp; B ${nm(C.b)}` : 'Load two .procreate files to compare the artwork and every layer.';
  $('#cmpSwap').disabled = !(C.a || C.b); $('#cmpClear').disabled = !(C.a || C.b);
}
let cmpPick = 'a';
$$('[data-cmp-open]').forEach(b => b.onclick = () => { cmpPick = b.dataset.cmpOpen; $('#cmpFileInput').click(); });
$('#cmpFileInput').onchange = e => { cmpOpen(cmpPick, e.target.files[0]); e.target.value = ''; };
$$('[data-cmp-current]').forEach(b => b.onclick = () => { if (!S.file) return toast('Open a file in the Viewer first.', true); cmpOpen(b.dataset.cmpCurrent, S.file); });
$$('[data-cmp-remove]').forEach(b => b.onclick = () => removeSlot(b.dataset.cmpRemove));
$('#cmpSwap').onclick = () => { [C.a, C.b] = [C.b, C.a]; if (C.a) C.a.key = 'a'; if (C.b) C.b.key = 'b'; resetView(); cmpUpdate(); };
$('#cmpClear').onclick = () => { removeSlot('a'); removeSlot('b'); toast('Comparison cleared — both files closed.'); };
$('#cmpFilesBtn').onclick = () => { if (set.cdock === 'hidden') setCmpDock('docked'); showCPanel('files'); };

// ── panel tabs ──
function showCPanel(name) {
  set.cpanel = name; saveSet();
  $$('[data-cpanel]').forEach(b => b.setAttribute('aria-selected', b.dataset.cpanel === name));
  $('#cpLayers').hidden = name !== 'layers'; $('#cpArtwork').hidden = name !== 'artwork'; $('#cpFiles').hidden = name !== 'files';
}
$$('[data-cpanel]').forEach(b => b.onclick = () => showCPanel(b.dataset.cpanel));

// ── matching layers between A and B ──
// 1) same layer UUID (an edited copy of the same artwork), 2) same name, 3) leftovers are added/removed.
function matchLayers() {
  const A = C.a.layers, B = C.b.layers, used = new Set(), pairs = [], am = new Map();
  const byUuid = new Map(B.map(l => [l.uuid, l]));
  for (const a of A) { const b = byUuid.get(a.uuid); if (b && !used.has(b.id)) { am.set(a.id, b); used.add(b.id); } }
  const bn = new Map(); B.forEach(b => { if (!used.has(b.id)) { if (!bn.has(b.name)) bn.set(b.name, []); bn.get(b.name).push(b); } });
  for (const a of A) { if (am.has(a.id)) continue; const list = bn.get(a.name); if (list && list.length) { const b = list.shift(); am.set(a.id, b); used.add(b.id); } }
  const sameGrid = C.a.info.width === C.b.info.width && C.a.info.height === C.b.info.height && C.a.info.tileSize === C.b.info.tileSize;
  const matchedA = A.filter(a => am.has(a.id)), rankA = new Map(matchedA.map((a, i) => [a.id, i]));
  const matchedB = B.filter(b => used.has(b.id)), rankB = new Map(matchedB.map((b, i) => [b.id, i]));
  const posA = new Map(A.map((a, i) => [a.id, i])), posB = new Map(B.map((b, i) => [b.id, i]));
  for (const a of A) {
    const b = am.get(a.id);
    if (!b) { pairs.push({ a, b: null, status: 'removed', notes: ['Only in A'], score: 1e6, order: posA.get(a.id) - 0.5 }); continue; }
    const notes = [];
    if (a.name !== b.name) notes.push(`Renamed “${a.name}” → “${b.name}”`);
    if (rankA.get(a.id) !== rankB.get(b.id)) notes.push('Moved in the stack');
    if (a.blend !== b.blend) notes.push(`Blend ${a.blendName} → ${b.blendName}`);
    if (Math.abs(a.opacity - b.opacity) > 0.004) notes.push(`Opacity ${Math.round(a.opacity * 100)}% → ${Math.round(b.opacity * 100)}%`);
    if (a.hidden !== b.hidden) notes.push(b.hidden ? 'Hidden in B' : 'Shown in B');
    if (a.clipped !== b.clipped) notes.push(b.clipped ? 'Clipped in B' : 'Unclipped in B');
    if (a.hasMask !== b.hasMask) notes.push(b.hasMask ? 'Mask added' : 'Mask removed');
    let tiles = 0;
    if (sameGrid && C.a.sig && C.b.sig) {
      const sa = C.a.sig.get(a.id).sig, sb = C.b.sig.get(b.id).sig;
      for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) if (sa[k] !== sb[k]) tiles++;
      if (tiles) notes.push(`Pixels changed in ${plural(tiles, 'tile')}`);
    } else if (!sameGrid) notes.push('Different canvas sizes — open the pair to compare pixels');
    const changed = notes.filter(n => !n.startsWith('Different canvas')).length;
    pairs.push({ a, b, status: changed ? 'changed' : 'same', notes, tiles, score: changed * 1000 + tiles, order: posB.get(b.id) });
  }
  for (const b of B) if (!used.has(b.id)) pairs.push({ a: null, b, status: 'added', notes: ['Only in B'], score: 1e6, order: posB.get(b.id) });
  // stack order: follow B, slotting A-only layers right after their nearest matched neighbour in A
  for (const p of pairs) if (p.status === 'removed') {
    const i = posA.get(p.a.id); let o = -0.5;
    for (let j = i - 1; j >= 0; j--) { const q = am.get(A[j].id); if (q) { o = posB.get(q.id) + 0.5; break; } }
    p.order = o;
  }
  pairs.sort((x, y) => x.order - y.order);
  pairs.forEach((p, i) => p.idx = i);
  return { pairs, sameGrid };
}

// ── panel ──
function cmpUpdate() {
  cmpHeader();
  const ready = C.a && C.b && C.a.ready && C.b.ready;
  $('#cmpEmpty').hidden = !!(C.a && C.b);
  fillDocTable();
  if (!ready) {
    $('#cmpPairs').innerHTML = ''; $('#cmpScore').innerHTML = ''; $('#cmpFilter').innerHTML = ''; $('#cmpCounts').innerHTML = '';
    $('#cmpMatchNote').textContent = C.a && C.b ? 'Decoding…' : 'Load both files to compare their layers.';
    if (!(C.a || C.b)) cmpBusy(false);
    const one = (C.a && !C.b) ? C.a : (C.b && !C.a) ? C.b : null;
    if (one && one.ready) cmpRender(); else drawCompare();
    return;
  }
  cmpBusy(false);
  C.pairs = matchLayers().pairs;
  const uuidMatches = C.a.layers.filter(a => C.b.layers.some(b => b.uuid === a.uuid)).length;
  $('#cmpMatchNote').textContent = uuidMatches ? `Layers are matched by Procreate’s internal layer ID (${uuidMatches} matched), then by name.` : 'No shared layer IDs, so layers are matched by name. Unmatched layers count as added or removed.';
  drawPairs(); cmpRender();
}
function fillDocTable() {
  const a = C.a && C.a.info, b = C.b && C.b.info;
  const g = s => { let n = 0; const w = l => l.forEach(x => { if (x.kind === 'group') { n++; w(x.children); } }); if (s) w(s.tree); return n; };
  const last = s => { const m = Math.max(0, ...s.layers.map(l => l.modified || 0)); return m ? fmtDate(m) : '—'; };
  const rows = [
    ['Title', i => i.name || '—'], ['Canvas', i => `${i.width} × ${i.height}`], ['DPI', i => i.dpi ? Math.round(i.dpi) : '—'],
    ['Orientation', i => ORIENT_TXT(i)], ['Layers', (i, s) => s.layers.length], ['Groups', (i, s) => g(s)],
    ['Colour profile', i => i.colorProfile || '—'], ['Background', i => hexOf(i.background) + (i.backgroundHidden ? ' (hidden)' : '')],
    ['Strokes', i => (i.strokeCount || 0).toLocaleString()], ['Time spent', i => i.trackedTime ? fmtTime(i.trackedTime) : '—'],
    ['Last painted', (i, s) => last(s)], ['Author', i => i.author || '—'], ['File size', (i, s) => fmtBytes(s.file.size)]
  ];
  let nchg = 0;
  $('#cmpDocTable tbody').innerHTML = rows.map(([k, f]) => {
    const va = a ? String(f(a, C.a)) : '—', vb = b ? String(f(b, C.b)) : '—', d = a && b && va !== vb; if (d) nchg++;
    return `<tr class="${d ? 'chg' : ''}"><th>${k}</th><td title="${esc(va)}">${esc(va)}</td><td title="${esc(vb)}">${esc(vb)}</td></tr>`;
  }).join('');
  $('#cmpDocChg').textContent = a && b ? (nchg ? `· ${nchg} different` : '· identical') : '';
}
const STATUS = { changed: 'Changed', added: 'Added', removed: 'Removed', same: 'Same' };
function sortedPairs() {
  const list = C.pairs.filter(p => C.filter === 'all' || p.status === C.filter);
  const nm = p => (p.b || p.a).name.toLocaleLowerCase(), mod = p => Math.max((p.a && p.a.modified) || 0, (p.b && p.b.modified) || 0);
  const by = {
    stack: (x, y) => x.order - y.order,
    name: (x, y) => nm(x).localeCompare(nm(y)),
    status: (x, y) => Object.keys(STATUS).indexOf(x.status) - Object.keys(STATUS).indexOf(y.status) || x.order - y.order,
    amount: (x, y) => y.score - x.score || x.order - y.order,
    modified: (x, y) => mod(y) - mod(x) || x.order - y.order
  }[set.cmpSort] || ((x, y) => x.order - y.order);
  return list.sort(by);
}
function pairRow(p) {
  const nm = (p.b || p.a).name, mod = Math.max((p.a && p.a.modified) || 0, (p.b && p.b.modified) || 0);
  const sub = (p.notes.join(' · ') || 'Identical') + (set.cmpSort === 'modified' && mod ? ` · ${fmtDate(mod)}` : '');
  return `<li><button data-pair="${p.idx}" aria-pressed="${C.pair === p.idx}"><span class="pt ${p.a ? '' : 'none'}" data-t="a${p.a ? p.a.id : ''}">${p.a ? '' : '—'}</span><span class="pt ${p.b ? '' : 'none'}" data-t="b${p.b ? p.b.id : ''}">${p.b ? '' : '—'}</span>
    <span class="pn"><b>${esc(nm)}</b><span title="${esc(sub)}">${esc(sub)}</span></span><span class="st ${p.status}">${STATUS[p.status]}</span></button></li>`;
}
function drawPairs() {
  const box = $('#cpLayers'), keep = box.scrollTop;   // rebuilding the list must not lose the scroll position
  const cnt = s => C.pairs.filter(p => p.status === s).length;
  $('#cmpScore').innerHTML = `<div><b>${cnt('changed')}</b><span class="label">changed</span></div><div><b>${cnt('added')} / ${cnt('removed')}</b><span class="label">added / removed</span></div><div><b id="pxPct">${C.diffPct == null ? '…' : fmtPct(C.diffPct)}</b><span class="label">pixels differ</span></div>`;
  $('#cmpCounts').innerHTML = `<b>${cnt('changed')}</b> changed<span class="sep">·</span><b>${cnt('added')}</b> added<span class="sep">·</span><b>${cnt('removed')}</b> removed<span class="sep">·</span><b>${cnt('same')}</b> same`;
  $('#cmpFilter').innerHTML = [['all', 'All', C.pairs.length], ...Object.entries(STATUS).map(([k, v]) => [k, v, cnt(k)])]
    .map(([k, v, n]) => `<button role="radio" data-f="${k}" aria-checked="${C.filter === k}" ${n || k === 'all' ? '' : 'disabled'}>${v} <b>${n}</b></button>`).join('');
  const list = sortedPairs();
  let html = '';
  if (!list.length) html = `<li class="small">No layers in “${C.filter === 'all' ? 'All' : STATUS[C.filter]}”.</li>`;
  else if (set.cmpGroup) {
    for (const st of Object.keys(STATUS)) { const g = list.filter(p => p.status === st); if (g.length) html += `<li class="grp-h"><span class="label">${STATUS[st]}</span><span class="label">${g.length}</span></li>` + g.map(pairRow).join(''); }
  } else html = list.map(pairRow).join('');
  $('#cmpPairs').innerHTML = html;
  $$('#cmpPairs .pt[data-t]').forEach(el => {
    const t = el.dataset.t; if (t.length < 2) return; const s = t[0] === 'a' ? C.a : C.b, th = s && s.thumbs.get(+t.slice(1));
    if (th) { const c = document.createElement('canvas'); c.width = th.width; c.height = th.height; c.getContext('2d').drawImage(th, 0, 0); el.appendChild(c); }
  });
  $('#cmpSort').value = set.cmpSort; $('#cmpGroup').checked = set.cmpGroup;
  box.scrollTop = keep;
}
const fmtPct = p => p === 0 ? '0%' : p < 0.1 ? '<0.1%' : p.toFixed(p < 10 ? 1 : 0) + '%';
$('#cmpPairs').addEventListener('click', e => {
  const b = e.target.closest('[data-pair]'); if (!b) return; const i = +b.dataset.pair;
  C.pair = C.pair === i ? null : i;
  $$('#cmpPairs [data-pair]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.pair === C.pair)); // update in place: no rebuild, no jump
  cmpRender();
});
$('#cmpFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b || b.disabled) return; C.filter = b.dataset.f; drawPairs(); });
$('#cmpSort').onchange = e => { set.cmpSort = e.target.value; saveSet(); drawPairs(); };
$('#cmpGroup').onchange = e => { set.cmpGroup = e.target.checked; saveSet(); drawPairs(); };
$('#cmpWhole').onclick = () => { C.pair = null; $$('#cmpPairs [data-pair]').forEach(x => x.setAttribute('aria-pressed', false)); cmpRender(); };

// ── rendering ──
function wholeSpec(s) {
  const ids = []; const w = (l, h) => l.forEach(n => { const hh = h || n.hidden; if (n.kind === 'group') w(n.children, hh); else if (!hh) ids.push(n.id); }); w(s.tree, false);
  return { mode: 'stack', ids, orphan: 'hide', orient: set.orient, k: dispK(s.info), bg: s.info.backgroundHidden ? null : s.info.background.slice(0, 3) };
}
const soloSpec = (s, id) => ({ mode: 'solo', soloId: id, applyMask: true, orient: set.orient, k: dispK(s.info), bg: null });
let cmpSeq = 0;
async function cmpRender() {
  const one = !(C.a && C.b) && (C.a || C.b);
  if (one && one.ready) { // a single file loaded: show it while waiting for the other
    const { img } = await one.client.ask('render', { spec: wholeSpec(one) }); C.imgA = imgToCanvas(img); C.imgB = null; drawCompare(); return;
  }
  if (!(C.a && C.b && C.a.ready && C.b.ready)) return;
  const my = ++cmpSeq; const slow = setTimeout(() => my === cmpSeq && cmpBusy('Rendering…'), 160);
  const p = C.pair != null ? C.pairs[C.pair] : null;
  try {
    const [ra, rb] = await Promise.all([
      p ? (p.a ? C.a.client.ask('render', { spec: soloSpec(C.a, p.a.id) }) : null) : C.a.client.ask('render', { spec: wholeSpec(C.a) }),
      p ? (p.b ? C.b.client.ask('render', { spec: soloSpec(C.b, p.b.id) }) : null) : C.b.client.ask('render', { spec: wholeSpec(C.b) })
    ]);
    if (my !== cmpSeq) return;
    const A = ra ? imgToCanvas(ra.img) : null, B = rb ? imgToCanvas(rb.img) : null;
    const base = A || B; const W = base.width, H = base.height;
    const fit = src => { const c = document.createElement('canvas'); c.width = W; c.height = H; if (src) c.getContext('2d').drawImage(src, 0, 0, W, H); return c; };
    C.imgA = A && A.width === W ? A : fit(A); C.imgB = fit(B);
    C.scaled = !!(A && B && (A.width !== B.width || A.height !== B.height));
    $('#cmpWhole').hidden = !p;
    C.lastStats = diffStats(C.imgA, C.imgB, C.thresh);
    if (!p) { C.diffPct = C.lastStats.pct; const el = $('#pxPct'); if (el) el.textContent = fmtPct(C.diffPct); }
    drawCompare();
  } catch (e) { toast('Compare render failed — ' + e.message, true); }
  finally { clearTimeout(slow); if (my === cmpSeq) cmpBusy(false); }
}
function cmpFoot() {
  const p = C.pair != null ? C.pairs[C.pair] : null;
  $('#cmpLabel').innerHTML = !(C.a && C.b) ? (C.a || C.b ? 'Waiting for the second file' : 'No files loaded') : (p ? `Comparing layer <b>${esc((p.b || p.a).name)}</b>` : 'Comparing the <b>whole artwork</b>') + (C.scaled ? ' · B scaled to A’s size' : '');
  const st = C.lastStats, z = Math.round(vpA.st.zoom * 100);
  $('#cmpStatus').textContent = C.a && C.b && C.a.info && C.b.info ? `A ${C.a.info.width} × ${C.a.info.height} · B ${C.b.info.width} × ${C.b.info.height}${st ? ` · ${fmtPct(st.pct)} of pixels differ` : ''} · ${z}%` : `${z}%`;
}
function diffStats(a, b, th) {
  const W = a.width, H = a.height, da = a.getContext('2d').getImageData(0, 0, W, H).data, db = b.getContext('2d').getImageData(0, 0, W, H).data;
  let n = 0; for (let i = 0; i < da.length; i += 4) { if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3])) > th) n++; }
  return { pct: n / (W * H) * 100, da, db, th };
}
// Unchanged pixels: A in dim greyscale. Changed pixels: the chosen colour (or a heat ramp by size of change).
function diffImage(a, b, th) {
  const W = a.width, H = a.height, st = C.lastStats && C.lastStats.th === th ? C.lastStats : (C.lastStats = diffStats(a, b, th)), da = st.da, db = st.db;
  const out = new ImageData(W, H), o = out.data, col = DIFF_COLORS[set.diffColor];
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
    const g = (0.3 * da[i] + 0.59 * da[i + 1] + 0.11 * da[i + 2]) * 0.35 + 30, ga = Math.max(da[i + 3], db[i + 3]);
    if (d > th) {
      let r, gg, bb;
      if (col) { r = col[0]; gg = col[1]; bb = col[2]; }
      else { const t = Math.min(1, d / 160); r = 255; gg = 226 - 190 * t; bb = 122 - 28 * t; } // heat: yellow → red
      const t = col ? Math.min(1, 0.55 + d / 255) : 1; o[i] = r * t + g * (1 - t); o[i + 1] = gg * t + g * (1 - t); o[i + 2] = bb * t + g * (1 - t); o[i + 3] = 255;
    } else { o[i] = o[i + 1] = o[i + 2] = g; o[i + 3] = ga ? 255 : 0; }
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0); return c;
}
function paint(canvas, src) { if (!src) { canvas.width = canvas.height = 1; return; } canvas.width = src.width; canvas.height = src.height; canvas.getContext('2d').drawImage(src, 0, 0); }
function drawCompare() {
  const views = $('#cmpViews'); views.className = 'cmp-views ' + C.view;
  $$('#cmpViewSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.cv === C.view));
  $('#onionCtl').hidden = C.view !== 'onion'; $('#diffCtl').hidden = C.view !== 'diff';
  cmpFoot();
  const A = C.imgA, over = $('#cmpCanB2');
  if (!A) { paint($('#cmpCanA'), null); paint($('#cmpCanB'), null); paint(over, null); $('#swipeHandle').hidden = true; return; }
  const ref = (C.a && C.a.info) || (C.b && C.b.info), sz = ref ? orientedSize(ref, set.orient) : { W: A.width, H: A.height };
  over.style.clipPath = ''; over.style.opacity = '';
  if (C.view === 'side') { paint($('#cmpCanA'), A); paint($('#cmpCanB'), C.imgB); }
  else if (C.view === 'diff') { paint($('#cmpCanA'), C.imgB ? diffImage(A, C.imgB, C.thresh) : A); paint(over, null); }
  else { paint($('#cmpCanA'), A); paint(over, C.imgB); if (C.view === 'onion') over.style.opacity = C.onion; }
  vpA.setSize(sz.W, sz.H); vpB.setSize(sz.W, sz.H); if (C.view === 'side') vpB.copyFrom(vpA.st);
  $('#swipeHandle').hidden = C.view !== 'swipe' || !C.imgB; placeSwipe();
}
function placeSwipe() {
  if (C.view !== 'swipe') return;
  const st = vpA.st, vw = $('#cmpVpA').clientWidth, h = $('#swipeHandle');
  const x = Math.max(0, Math.min(vw, C.swipeX != null ? C.swipeX : vw / 2)); C.swipeX = x; h.style.left = x + 'px';
  const frac = st.W ? (x - st.px) / (st.W * st.zoom) : 0.5;
  $('#cmpCanB2').style.clipPath = `inset(0 0 0 ${Math.max(0, Math.min(100, frac * 100))}%)`;
  h.setAttribute('aria-valuenow', Math.round(Math.max(0, Math.min(1, frac)) * 100));
}
(() => {
  const h = $('#swipeHandle'); let on = false;
  h.addEventListener('pointerdown', e => { on = true; h.setPointerCapture(e.pointerId); e.stopPropagation(); });
  h.addEventListener('pointermove', e => { if (!on) return; const r = $('#cmpVpA').getBoundingClientRect(); C.swipeX = e.clientX - r.left; placeSwipe(); });
  const end = () => { on = false; }; h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); C.swipeX += e.key === 'ArrowLeft' ? -20 : 20; placeSwipe(); } });
})();
function setCmpView(v) { C.view = v; drawCompare(); requestAnimationFrame(() => vpA.fit()); }
$$('#cmpViewSeg button').forEach(b => b.onclick = () => setCmpView(b.dataset.cv));
$('#onionOpacity').oninput = e => { C.onion = e.target.value / 100; $('#cmpCanB2').style.opacity = C.onion; };
$('#diffThresh').oninput = e => { C.thresh = 65 - +e.target.value; if (C.imgA && C.imgB) { C.lastStats = diffStats(C.imgA, C.imgB, C.thresh); drawCompare(); } };
$('#diffColors').innerHTML = Object.entries(DIFF_COLORS).map(([k, c]) => `<button role="radio" data-c="${k}" class="${c ? '' : 'heat'}" style="${c ? `--c:rgb(${c})` : ''}" title="${k === 'heat' ? 'Heat — colour shows how big the change is' : k[0].toUpperCase() + k.slice(1)}" aria-label="${k}"></button>`).join('');
const syncDiffColors = () => $$('#diffColors button').forEach(b => b.setAttribute('aria-checked', b.dataset.c === set.diffColor));
$('#diffColors').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; set.diffColor = b.dataset.c; saveSet(); syncDiffColors(); if (C.view === 'diff') drawCompare(); });
syncDiffColors();
$('#cmpZoomIn').onclick = () => vpA.zoomAt(1.25); $('#cmpZoomOut').onclick = () => vpA.zoomAt(0.8); $('#cmpZoomFit').onclick = () => vpA.fit(); $('#cmpZoomVal').onclick = () => vpA.actual();
function setCmpDock(state) { set.cdock = state; saveSet(); appEl.dataset.cdock = state; $('#cmpRail').hidden = state !== 'hidden'; requestAnimationFrame(() => vpA.st.fit && vpA.fit()); }
$('#cmpDockHide').onclick = () => setCmpDock('hidden');
$('#cmpRail [data-rail]').onclick = () => setCmpDock('docked');
// drop targets in the empty state light up
$$('.drop-slot').forEach(d => { d.addEventListener('dragover', () => d.classList.add('over')); d.addEventListener('dragleave', () => d.classList.remove('over')); d.addEventListener('drop', () => d.classList.remove('over')); });
