// ═══════════════ Procreate Studio — UI ═══════════════
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const root = document.documentElement;

  // ───────── settings (localStorage: light prefs only) ─────────
  const DEF = { mode: 'dark', theme: 'wattle', size: 'm', checker: 'dark', orient: true, pixel: true, palCount: 12, palSort: 'share' };
  let set = { ...DEF };
  try { Object.assign(set, JSON.parse(localStorage.getItem('procreate-studio') || '{}')); } catch (e) { }
  const saveSet = () => { try { localStorage.setItem('procreate-studio', JSON.stringify(set)); } catch (e) { } };
  const mq = matchMedia('(prefers-color-scheme: light)');
  function applySettings() {
    root.dataset.mode = set.mode === 'system' ? (mq.matches ? 'light' : 'dark') : set.mode;
    root.dataset.theme = set.theme; root.dataset.size = set.size; root.dataset.checker = set.checker;
    $$('#setMode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === set.mode));
    $$('#setTheme button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === set.theme));
    $$('#setSize button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === set.size));
    $$('#setChecker button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === set.checker));
    $('#setOrient').checked = set.orient; $('#setPixel').checked = set.pixel;
    updatePixelClass();
  }
  mq.addEventListener('change', () => set.mode === 'system' && applySettings());

  // ───────── state ─────────
  const S = {
    info: null, tree: [], layers: [], byId: new Map(), fileName: '', hasComposite: false, ready: false,
    view: 'composite', activeId: null, visible: new Map(), groupHidden: new Map(), selected: new Set(), empty: new Set(),
    showBg: false, applyMask: true, img: null,
    zoom: 1, px: 0, py: 0, fit: true,
    exp: { what: 'composite', fmt: 'png', bg: 'transparent', scale: 1, quality: 92 },
    pal: { colors: [], label: '' }
  };
  const rows = new Map(), groupsEl = new Map();

  // ───────── engine (Web Worker, with same-thread fallback) ─────────
  let worker = null, rid = 0; const waits = new Map(); let openedAck = false, currentFile = null;
  function startEngine() {
    if (worker) worker.terminate(); worker = null;
    try {
      const url = URL.createObjectURL(new Blob([$('#engineSrc').textContent], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = e => onEngine(e.data);
      worker.onerror = e => { e.preventDefault(); if (!openedAck && currentFile) { worker = null; send({ type: 'open', file: currentFile }); } };
    } catch (e) { worker = null; }
  }
  function send(msg, tr) { if (worker) worker.postMessage(msg, tr || []); else Engine.handle(msg, m => onEngine(m)); }
  function ask(type, extra) { const id = ++rid; return new Promise((res, rej) => { waits.set(id, { res, rej }); send({ type, rid: id, ...extra }); }); }
  function onEngine(m) {
    if (m.rid && waits.has(m.rid)) { const w = waits.get(m.rid); waits.delete(m.rid); m.type === 'error' ? w.rej(new Error(m.message)) : w.res(m); return; }
    switch (m.type) {
      case 'opened': openedAck = true; onOpened(m); break;
      case 'layer': onLayerDecoded(m); break;
      case 'ready': onReady(); break;
      case 'error': openFailed(m.message); break;
    }
  }

  // ───────── open / reset ─────────
  function openFile(file) {
    if (!file) return;
    if (!/\.procreate$/i.test(file.name)) { toast('That isn’t a .procreate file. Export your artwork from Procreate’s Share menu as “Procreate”.', true); return; }
    resetState(); currentFile = file; openedAck = false; S.fileName = file.name.replace(/\.procreate$/i, '');
    $('#fileName').textContent = file.name; $('#fileChip').hidden = false; $('#fileChip').title = file.name + ' · ' + fmtBytes(file.size);
    busy('Reading file…');
    startEngine(); send({ type: 'open', file });
  }
  function resetState() {
    Object.assign(S, { info: null, tree: [], layers: [], ready: false, activeId: null, img: null, view: 'composite', fit: true });
    S.byId = new Map(); S.visible = new Map(); S.groupHidden = new Map(); S.selected = new Set(); S.empty = new Set(); S.pal = { colors: [], label: '' };
    rows.clear(); groupsEl.clear(); parentMap.clear(); $('#rangeInput').value = ''; $('#rangeMsg').textContent = ''; $('#rangeMsg').classList.remove('err'); $('#layerTree').innerHTML = ''; $('#swatches').innerHTML = ''; $('#palStrip').innerHTML = '';
  }
  function closeFile() {
    if (worker) worker.terminate(); worker = null; currentFile = null; resetState();
    $('#workView').hidden = true; $('#emptyView').hidden = false; $('#viewSeg').hidden = true; $('#fileChip').hidden = true; busy(false);
  }
  function openFailed(msg) {
    busy(false); closeFile();
    toast('Couldn’t open this file — ' + msg, true);
  }

  function onOpened(m) {
    S.info = m.info; S.tree = m.tree; S.layers = m.layers; S.hasComposite = m.hasComposite;
    m.layers.forEach(L => { S.byId.set(L.id, L); S.visible.set(L.id, !L.hidden); });
    S.showBg = !m.info.backgroundHidden;
    S.activeId = m.layers.length ? m.layers[0].id : null;
    $('#emptyView').hidden = true; $('#workView').hidden = false; $('#viewSeg').hidden = false;
    $('[data-view="original"]').disabled = !S.hasComposite;
    buildTree(); fillInfo(); syncView(); setCanvasSize();
    $('#loadBar').classList.remove('done');
    busy('Decoding layers…');
    // show Procreate's quick preview while layers decode
    ask('thumbnail').then(r => {
      if (S.ready || !r.png) return;
      createImageBitmap(new Blob([r.png], { type: 'image/png' })).then(bmp => {
        if (S.ready) return; const c = $('#canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); fitView();
      }).catch(() => { });
    }).catch(() => { });
  }
  function onLayerDecoded(m) {
    if (m.empty) S.empty.add(m.id);
    const r = rows.get(m.id); if (r) {
      const th = r.querySelector('.thumb'); th.classList.remove('loading'); th.innerHTML = '';
      if (!m.empty) { const c = document.createElement('canvas'); c.width = m.thumb.w; c.height = m.thumb.h; c.getContext('2d').putImageData(new ImageData(m.thumb.data, m.thumb.w, m.thumb.h), 0, 0); th.appendChild(c); }
      else th.title = 'Empty layer';
    }
    $('#loadBar span').style.width = (m.progress * 100).toFixed(1) + '%';
    busy(`Decoding layers… ${Math.round(m.progress * 100)}%`);
  }
  function onReady() {
    S.ready = true; $('#loadBar').classList.add('done');
    if (S.activeId != null && S.empty.has(S.activeId)) { const f = S.layers.find(l => !S.empty.has(l.id)); if (f) S.activeId = f.id; }
    S.selected = new Set(S.layers.filter(l => !S.empty.has(l.id)).map(l => l.id));
    refreshRows(); render(); toast(`Opened ${S.fileName} — ${S.layers.length} layer${S.layers.length === 1 ? '' : 's'}`);
  }

  // ───────── layer tree ─────────
  const eyeSvg = on => on ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>';
  function buildTree() {
    const host = $('#layerTree'); host.innerHTML = '';
    const mk = (nodes, parent) => nodes.forEach(n => {
      const li = document.createElement('li');
      if (n.kind === 'group') {
        S.groupHidden.set(n.id, n.hidden);
        li.innerHTML = `<div class="grow" role="treeitem" aria-expanded="true"><svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg><span class="gname"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>${esc(n.name)} <small>${countLayers(n)}</small></span><button class="eye" aria-label="Toggle group visibility">${eyeSvg(!n.hidden)}</button></div><ol role="group"></ol>`;
        const g = li.firstChild; groupsEl.set(n.id, { li, g });
        g.addEventListener('click', e => { if (e.target.closest('.eye')) return; li.classList.toggle('closed'); g.classList.toggle('closed'); g.setAttribute('aria-expanded', !li.classList.contains('closed')); });
        g.querySelector('.eye').addEventListener('click', () => { S.groupHidden.set(n.id, !S.groupHidden.get(n.id)); refreshRows(); if (S.view === 'composite') render(); });
        mk(n.children, li.querySelector('ol'));
      } else {
        const tags = [];
        if (n.blend) tags.push(`<span class="tagx blend">${n.blendName}</span>`);
        if (n.opacity < 0.999) tags.push(`<span class="tagx">${Math.round(n.opacity * 100)}%</span>`);
        if (n.clipped) tags.push('<span class="tagx" title="Clipping mask">Clip</span>');
        if (n.hasMask) tags.push(`<span class="tagx" title="Layer mask${n.maskHidden ? ' (hidden)' : ''}">Mask</span>`);
        if (n.isText) tags.push('<span class="tagx">Text</span>');
        li.innerHTML = `<div class="row${n.clipped ? ' clipped' : ''}" role="treeitem" title="Click to view this layer on its own"><input type="checkbox" aria-label="Select ${esc(n.name)}"><span class="num">${n.num}</span><span class="thumb loading"></span><span class="lname"><b>${esc(n.name)}</b><span>${tags.join('') || '<span>Normal</span>'}</span></span><button class="eye" aria-label="Toggle visibility of ${esc(n.name)}"></button></div>`;
        const r = li.firstChild; rows.set(n.id, r);
        r.querySelector('input').addEventListener('change', e => { e.target.checked ? S.selected.add(n.id) : S.selected.delete(n.id); afterSelection(); });
        r.querySelector('input').addEventListener('click', e => e.stopPropagation());
        r.querySelector('.eye').addEventListener('click', e => { e.stopPropagation(); S.visible.set(n.id, !S.visible.get(n.id)); refreshRows(); if (S.view === 'composite') render(); });
        r.addEventListener('click', () => { S.activeId = n.id; setView('single'); });
      }
      parent.appendChild(li);
    });
    mk(S.tree, host);
    $('#layerCount').textContent = S.layers.length;
  }
  const countLayers = g => g.children.reduce((s, c) => s + (c.kind === 'group' ? countLayers(c) : 1), 0);
  const effVisible = id => { if (!S.visible.get(id)) return false; return groupsVisible(S.byId.get(id).parentId); };
  function groupsVisible(gid) { while (gid != null) { if (S.groupHidden.get(gid)) return false; gid = parentOfGroup(gid); } return true; }
  const parentMap = new Map();
  function parentOfGroup(gid) {
    if (!parentMap.size) { const walk = (ns, p) => ns.forEach(n => { if (n.kind === 'group') { parentMap.set(n.id, p); walk(n.children, n.id); } }); walk(S.tree, null); }
    return parentMap.has(gid) ? parentMap.get(gid) : null;
  }
  function refreshRows() {
    for (const [id, r] of rows) {
      const v = S.visible.get(id), ev = effVisible(id);
      r.classList.toggle('off', !ev); r.classList.toggle('active', S.view === 'single' && id === S.activeId);
      const eye = r.querySelector('.eye'); eye.innerHTML = eyeSvg(v); eye.classList.toggle('off', !v); eye.setAttribute('aria-pressed', v);
      r.querySelector('input').checked = S.selected.has(id);
    }
    for (const [gid, { g }] of groupsEl) { const h = S.groupHidden.get(gid); g.classList.toggle('off', h); g.querySelector('.eye').innerHTML = eyeSvg(!h); g.querySelector('.eye').classList.toggle('off', h); }
    updateStatus(); updateExportSummary();
  }
  function afterSelection() { refreshRows(); if (S.view === 'selected') render(); }

  // selection helpers
  $$('.layers .mini-seg button').forEach(b => b.addEventListener('click', () => {
    const ids = S.layers.map(l => l.id);
    if (b.dataset.sel === 'all') S.selected = new Set(ids);
    if (b.dataset.sel === 'none') S.selected = new Set();
    if (b.dataset.sel === 'visible') S.selected = new Set(ids.filter(effVisible));
    if (b.dataset.sel === 'invert') S.selected = new Set(ids.filter(i => !S.selected.has(i)));
    $('#rangeMsg').textContent = ''; afterSelection();
  }));
  $('#rangeForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = parseRange($('#rangeInput').value, S.layers.length), msg = $('#rangeMsg');
    if (r.error) { msg.textContent = r.error; msg.classList.add('err'); return; }
    S.selected = new Set(S.layers.filter(l => r.nums.has(l.num)).map(l => l.id));
    msg.classList.remove('err'); msg.textContent = `Selected ${S.selected.size} layer${S.selected.size === 1 ? '' : 's'} (# counts up from the bottom layer)`;
    afterSelection();
    if (S.view !== 'selected') setView('selected');
  });
  function parseRange(str, max) {
    const nums = new Set(); const parts = str.split(/[,;\s]+/).filter(Boolean);
    if (!parts.length) return { error: 'Type layer numbers, like 1-5, 7' };
    for (const p of parts) {
      const m = p.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
      if (!m) return { error: `“${p}” isn’t a number or range` };
      let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) return { error: `Layers are numbered 1–${max}` };
      for (let i = a; i <= b; i++) nums.add(i);
    }
    return { nums };
  }

  // ───────── views & rendering ─────────
  const VIEW_LABEL = { composite: 'Composite', single: 'Single layer', selected: 'Selected layers', original: 'Procreate render' };
  function setView(v) {
    if (v === 'original' && !S.hasComposite) return;
    S.view = v; syncView(); refreshRows(); render();
    if (v === 'single') { const r = rows.get(S.activeId); r && r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function syncView() {
    $$('#viewSeg button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === S.view));
    $('#singleNav').hidden = S.view !== 'single'; $('#tgMask').hidden = S.view !== 'single';
    $('#tgBg').setAttribute('aria-pressed', S.showBg); $('#tgMask').setAttribute('aria-pressed', S.applyMask);
    if (S.info) { const b = S.info.background; $('#bgSwatch').style.background = rgbCss(b); }
    let label = VIEW_LABEL[S.view];
    if (S.view === 'single' && S.activeId != null) {
      const L = S.byId.get(S.activeId); label = `#${L.num} · ${L.name}`;
      const idx = S.layers.indexOf(L);
      $('#singleName').textContent = L.name; $('#singleSub').textContent = `Layer ${L.num} of ${S.layers.length}${S.empty.has(L.id) ? ' · empty' : ''}${L.blend ? ' · ' + L.blendName : ''}`;
      $('#prevLayer').disabled = idx <= 0; $('#nextLayer').disabled = idx >= S.layers.length - 1;
    }
    if (S.view === 'selected') label = `${S.selected.size} selected layer${S.selected.size === 1 ? '' : 's'}`;
    $('#viewLabel').textContent = label;
  }
  function specFor(view, opt = {}) {
    const ordered = S.layers.map(l => l.id);
    const base = { orient: set.orient, k: opt.k || dispK(), bg: opt.bg !== undefined ? opt.bg : (S.showBg ? S.info.background.slice(0, 3) : null) };
    if (view === 'original') return { ...base, mode: 'original', bg: opt.bg !== undefined ? opt.bg : null };
    if (view === 'single') return { ...base, mode: 'solo', soloId: opt.id != null ? opt.id : S.activeId, applyMask: S.applyMask };
    if (view === 'selected') return { ...base, mode: 'stack', ids: ordered.filter(i => S.selected.has(i)), orphan: 'show' };
    return { ...base, mode: 'stack', ids: ordered.filter(effVisible), orphan: 'hide' };
  }
  const dispK = () => Math.max(1, Math.ceil(Math.sqrt(S.info.width * S.info.height / 16e6)));

  let renderSeq = 0, renderTimer = 0, palTimer = 0;
  function render() {
    if (!S.ready) return; syncView(); updateStatus();
    cancelAnimationFrame(renderTimer);
    renderTimer = requestAnimationFrame(async () => {
      const my = ++renderSeq; const slow = setTimeout(() => my === renderSeq && busy('Rendering…'), 140);
      try {
        const r = await ask('render', { spec: specFor(S.view) });
        if (my !== renderSeq) return;
        const { img } = r; const c = $('#canvas');
        if (c.width !== img.w || c.height !== img.h) { c.width = img.w; c.height = img.h; }
        c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
        setCanvasSize(); if (S.fit) fitView(); else applyTransform();
        clearTimeout(palTimer); palTimer = setTimeout(refreshPalette, 250);
      } catch (e) { toast('Render failed — ' + e.message, true); }
      finally { clearTimeout(slow); if (my === renderSeq) busy(false); }
    });
  }

  // ───────── viewer: zoom / pan ─────────
  const vp = $('#viewport'), cv = $('#canvas');
  const geom = () => { const i = S.info; if (!i) return { W: cv.width, H: cv.height }; const sw = set.orient && (i.orientation === 90 || i.orientation === 270); return { W: sw ? i.height : i.width, H: sw ? i.width : i.height }; };
  function setCanvasSize() { const { W, H } = S.ready ? geom() : { W: cv.width, H: cv.height }; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  function fitView() {
    setCanvasSize(); const { W, H } = S.ready ? geom() : { W: cv.width, H: cv.height };
    const vw = vp.clientWidth, vh = vp.clientHeight; if (!vw || !W) return;
    const padTop = 66, padBot = 92, padX = 34;
    S.zoom = Math.min((vw - padX * 2) / W, (vh - padTop - padBot) / H, 8);
    S.px = (vw - W * S.zoom) / 2; S.py = padTop + (vh - padTop - padBot - H * S.zoom) / 2; S.fit = true; applyTransform();
  }
  function zoomAt(f, cx, cy) {
    const z = Math.min(32, Math.max(0.02, S.zoom * f)); f = z / S.zoom;
    if (cx == null) { cx = vp.clientWidth / 2; cy = vp.clientHeight / 2; }
    S.px = cx - (cx - S.px) * f; S.py = cy - (cy - S.py) * f; S.zoom = z; S.fit = false; applyTransform();
  }
  function applyTransform() { cv.style.transform = `translate(${S.px}px, ${S.py}px) scale(${S.zoom})`; $('#zoomVal').textContent = Math.round(S.zoom * 100) + '%'; updatePixelClass(); updateStatus(); }
  function updatePixelClass() { cv.classList.toggle('pixel', set.pixel && S.zoom >= 2); }
  vp.addEventListener('wheel', e => { e.preventDefault(); const r = vp.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  vp.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, px: S.px, py: S.py }; vp.setPointerCapture(e.pointerId); vp.classList.add('panning'); });
  vp.addEventListener('pointermove', e => { if (!drag) return; S.px = drag.px + e.clientX - drag.x; S.py = drag.py + e.clientY - drag.y; S.fit = false; applyTransform(); });
  const endDrag = () => { drag = null; vp.classList.remove('panning'); };
  vp.addEventListener('pointerup', endDrag); vp.addEventListener('pointercancel', endDrag);
  vp.addEventListener('dblclick', fitView);
  new ResizeObserver(() => S.fit && fitView()).observe(vp);
  $('#zoomIn').onclick = () => zoomAt(1.25); $('#zoomOut').onclick = () => zoomAt(0.8); $('#zoomFit').onclick = fitView;
  $('#zoomVal').onclick = () => zoomAt(1 / S.zoom);

  // ───────── status / info ─────────
  function updateStatus() {
    if (!S.info) return;
    const vis = S.layers.filter(l => effVisible(l.id)).length, { W, H } = geom();
    $('#status').innerHTML = `<span><b>${vis}</b> visible</span><span><b>${S.selected.size}</b> selected</span><span><b>${S.layers.length}</b> layers</span><span class="push">${W} × ${H}px</span><span>${Math.round(S.zoom * 100)}%</span>`;
  }
  function fillInfo() {
    const i = S.info, { W, H } = geom(); const groups = parentMap.size || countGroups(S.tree);
    $('#docTitle').textContent = i.name || S.fileName;
    $('#statLayers').textContent = S.layers.length; $('#statSize').textContent = `${W} × ${H}`;
    const facts = [];
    if (i.dpi) facts.push(['Print size', `${(W / i.dpi).toFixed(2)} × ${(H / i.dpi).toFixed(2)} in @ ${Math.round(i.dpi)} dpi`]);
    facts.push(['Groups', groups || 'None']);
    const masks = S.layers.filter(l => l.hasMask).length, clips = S.layers.filter(l => l.clipped).length;
    if (masks || clips) facts.push(['Masks · clipping', `${masks} · ${clips}`]);
    facts.push(['Orientation', (i.orientation ? `Rotated ${i.orientation}°` : 'Upright') + (i.flipH ? ', flipped ↔' : '') + (i.flipV ? ', flipped ↕' : '')]);
    facts.push(['Background', `<span class="swatchdot" style="background:${rgbCss(i.background)}"></span>${hexOf(i.background)}${i.backgroundHidden ? ' (hidden)' : ''}`]);
    if (i.colorProfile) facts.push(['Colour profile', esc(i.colorProfile)]);
    if (i.strokeCount) facts.push(['Strokes', i.strokeCount.toLocaleString()]);
    if (i.trackedTime) { const m = Math.round(i.trackedTime / 60); facts.push(['Time in Procreate', m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`]); }
    if (i.author) facts.push(['Author', esc(i.author)]);
    if (currentFile) facts.push(['File size', fmtBytes(currentFile.size)]);
    $('#facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd title="${String(v).replace(/<[^>]+>/g, '')}">${v}</dd>`).join('');
  }
  const countGroups = ns => ns.reduce((s, n) => s + (n.kind === 'group' ? 1 + countGroups(n.children) : 0), 0);

  // ───────── export ─────────
  $$('#exportWhat input').forEach(r => r.addEventListener('change', () => { S.exp.what = r.value; updateExportSummary(); }));
  $$('#fmtGroup button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.fmt === 'heic') { toast('Browsers can’t create HEIC files. Export PNG, then on a Mac open it in Preview → File → Export → HEIC.'); return; }
    S.exp.fmt = b.dataset.fmt; $$('#fmtGroup button').forEach(x => x.setAttribute('aria-checked', x === b)); updateExportSummary();
  }));
  $('#expBg').onchange = e => { S.exp.bg = e.target.value; updateExportSummary(); };
  $('#expScale').onchange = e => { S.exp.scale = +e.target.value; updateExportSummary(); };
  $('#quality').oninput = e => { S.exp.quality = +e.target.value; $('#qualityOut').textContent = e.target.value; };
  function exportJobs() {
    const w = S.exp.what;
    if (w === 'composite') return [{ spec: 'composite', name: `${S.fileName}` }];
    if (w === 'selected') return S.selected.size ? [{ spec: 'selected', name: `${S.fileName}_layers_${rangeLabel()}` }] : [];
    const ids = w === 'every' ? S.layers.map(l => l.id) : S.layers.filter(l => S.selected.has(l.id)).map(l => l.id);
    return ids.map(id => { const L = S.byId.get(id); return { spec: 'single', id, name: `${String(L.num).padStart(String(S.layers.length).length, '0')}_${safe(L.name)}` }; });
  }
  function rangeLabel() {
    const nums = S.layers.filter(l => S.selected.has(l.id)).map(l => l.num).sort((a, b) => a - b); const out = [];
    for (let i = 0; i < nums.length; i++) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++; out.push(i === j ? nums[i] : `${nums[i]}-${nums[j]}`); i = j; }
    return out.join('_') || 'none';
  }
  function updateExportSummary() {
    if (!S.info) return;
    const jobs = exportJobs(), f = S.exp.fmt, { W, H } = geom(), k = S.exp.scale;
    $('#exportSummary').textContent = jobs.length ? `${jobs.length} file${jobs.length > 1 ? 's' : ''} · ${Math.ceil(W / k)}×${Math.ceil(H / k)}` : 'nothing selected';
    $('#btnExport').disabled = !jobs.length || !S.ready;
    $('#btnExport').textContent = jobs.length > 1 ? `Export ${jobs.length} files as ZIP` : `Export ${f.toUpperCase()}`;
    $('#qualityRow').hidden = !(f === 'jpg' || f === 'webp');
    const notes = [];
    if (f === 'jpg' && S.exp.bg === 'transparent') notes.push('JPG has no transparency — a white background will be used.');
    if (f === 'tiff') notes.push('Uncompressed TIFF: large files, best for print and Photoshop.');
    if (f === 'webp' && !webpOK) notes.push('This browser can’t write WebP; PNG will be used instead.');
    $('#fmtNote').textContent = notes.join(' ');
  }
  let webpOK = true;
  { const t = document.createElement('canvas'); t.width = t.height = 1; webpOK = t.toDataURL('image/webp').startsWith('data:image/webp'); }

  $('#btnExport').onclick = async () => {
    const jobs = exportJobs(); if (!jobs.length) return;
    const f = S.exp.fmt; const ext = f === 'webp' && !webpOK ? 'png' : f;
    let bg = S.exp.bg === 'doc' ? S.info.background.slice(0, 3) : S.exp.bg === 'white' ? [1, 1, 1] : null;
    if (f === 'jpg' && !bg) bg = [1, 1, 1];
    const btn = $('#btnExport'); btn.disabled = true;
    try {
      const files = [];
      for (let n = 0; n < jobs.length; n++) {
        const j = jobs[n]; busy(jobs.length > 1 ? `Exporting ${n + 1} of ${jobs.length}…` : 'Exporting…');
        const spec = specFor(j.spec, { k: S.exp.scale, bg, id: j.id });
        const { img } = await ask('render', { spec });
        files.push({ name: `${j.name}.${ext === 'jpg' ? 'jpg' : ext}`, blob: await encode(img, ext, !bg) });
      }
      if (files.length === 1) download(files[0].blob, files[0].name);
      else {
        busy('Building ZIP…');
        const entries = await Promise.all(files.map(async x => ({ name: x.name, data: new Uint8Array(await x.blob.arrayBuffer()) })));
        download(Zip.build(entries), `${S.fileName}_${S.exp.what === 'every' ? 'all' : 'selected'}_layers.zip`);
      }
      toast(files.length > 1 ? `Saved ${files.length} images in a ZIP` : `Saved ${files[0].name}`);
    } catch (e) { toast('Export failed — ' + e.message, true); }
    finally { busy(false); btn.disabled = false; updateExportSummary(); }
  };
  async function encode(img, fmt, alpha) {
    if (fmt === 'tiff') return Encoders.tiff(img, alpha);
    const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt];
    const q = S.exp.quality / 100;
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(img.w, img.h); oc.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
      if (oc.convertToBlob) return oc.convertToBlob({ type, quality: q });
    }
    const c = document.createElement('canvas'); c.width = img.w; c.height = img.h; c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('image too large for this browser')), type, q));
  }

  // ───────── palette ─────────
  let palSeq = 0;
  async function refreshPalette() {
    if (!S.ready) return; const my = ++palSeq;
    const L = S.byId.get(S.activeId);
    S.pal.label = S.view === 'single' ? `from “${L ? L.name : ''}”` : S.view === 'selected' ? `from ${S.selected.size} selected` : S.view === 'original' ? 'from Procreate render' : 'from composite';
    $('#paletteSource').textContent = S.pal.label;
    try {
      const r = await ask('palette', { spec: specFor(S.view, { bg: null }), count: set.palCount });
      if (my !== palSeq) return; S.pal.colors = r.colors; drawPalette();
    } catch (e) { $('#swatches').innerHTML = `<li class="pal-empty">Couldn’t read colours: ${esc(e.message)}</li>`; }
  }
  function drawPalette() {
    const cols = Palette.sort(S.pal.colors, set.palSort);
    $('#palCount').textContent = set.palCount;
    $$('.palette .mini-seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === set.palSort));
    if (!cols.length) { $('#swatches').innerHTML = '<li class="pal-empty">No opaque colour in this view.</li>'; $('#palStrip').innerHTML = ''; return; }
    $('#palStrip').innerHTML = cols.map(c => `<span style="flex:${Math.max(c.share, 0.01)};background:${c.hex}" title="${c.hex}"></span>`).join('');
    $('#swatches').innerHTML = cols.map(c => `<li><button data-hex="${c.hex}" title="Copy ${c.hex}"><span class="chip" style="background:${c.hex}"></span><span class="hex">${c.hex}</span><span class="pct">${(c.share * 100).toFixed(c.share < 0.1 ? 1 : 0)}%</span></button></li>`).join('');
  }
  $('#swatches').addEventListener('click', e => { const b = e.target.closest('button'); if (b) copy(b.dataset.hex); });
  $('#palMinus').onclick = () => { set.palCount = Math.max(3, set.palCount - 1); saveSet(); $('#palCount').textContent = set.palCount; clearTimeout(palTimer); palTimer = setTimeout(refreshPalette, 200); };
  $('#palPlus').onclick = () => { set.palCount = Math.min(30, set.palCount + 1); saveSet(); $('#palCount').textContent = set.palCount; clearTimeout(palTimer); palTimer = setTimeout(refreshPalette, 200); };
  $$('.palette .mini-seg button').forEach(b => b.onclick = () => { set.palSort = b.dataset.sort; saveSet(); drawPalette(); });
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

  // ───────── toggles, nav, settings, keys ─────────
  $$('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#tgBg').onclick = () => { S.showBg = !S.showBg; render(); };
  $('#tgMask').onclick = () => { S.applyMask = !S.applyMask; render(); };
  function stepLayer(d) {
    const i = S.layers.findIndex(l => l.id === S.activeId), n = i + d;
    if (n < 0 || n >= S.layers.length) return; S.activeId = S.layers[n].id; if (S.view !== 'single') S.view = 'single';
    syncView(); refreshRows(); render(); const r = rows.get(S.activeId); r && r.scrollIntoView({ block: 'nearest' });
  }
  $('#prevLayer').onclick = () => stepLayer(-1); $('#nextLayer').onclick = () => stepLayer(1);

  const dlg = $('#settings');
  $('#btnSettings').onclick = () => dlg.showModal();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  const bindSet = (sel, key, after) => $$(sel + ' button').forEach(b => b.addEventListener('click', () => { set[key] = b.dataset.v; saveSet(); applySettings(); after && after(); }));
  bindSet('#setMode', 'mode'); bindSet('#setTheme', 'theme'); bindSet('#setSize', 'size', () => S.fit && setTimeout(fitView, 50)); bindSet('#setChecker', 'checker');
  $('#setOrient').onchange = e => { set.orient = e.target.checked; saveSet(); if (S.ready) { fillInfo(); S.fit = true; render(); } };
  $('#setPixel').onchange = e => { set.pixel = e.target.checked; saveSet(); updatePixelClass(); };

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'o' || k === 'O') { $('#fileInput').click(); return; }
    if (!S.ready) return;
    if ('1234'.includes(k) && k.length === 1) setView(['composite', 'single', 'selected', 'original'][+k - 1]);
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); stepLayer(k === 'ArrowUp' ? -1 : 1); }
    else if (k === '0') fitView();
    else if (k === '+' || k === '=') zoomAt(1.25);
    else if (k === '-') zoomAt(0.8);
    else if (k === 'b' || k === 'B') $('#tgBg').click();
  });

  // ───────── file input / drag & drop ─────────
  const fi = $('#fileInput');
  fi.onchange = () => { openFile(fi.files[0]); fi.value = ''; };
  $('#btnOpen').onclick = $('#btnBrowse').onclick = e => { e.stopPropagation(); fi.click(); };
  $('#dropZone').addEventListener('click', () => fi.click());
  $('#dropZone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  $('#brandHome').onclick = e => { e.preventDefault(); if (S.info) closeFile(); };
  let dragDepth = 0; const veil = $('#dragVeil');
  addEventListener('dragenter', e => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); dragDepth++; veil.hidden = false; });
  addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; veil.hidden = true; const f = e.dataTransfer.files[0]; if (f) openFile(f); });

  // ───────── utilities ─────────
  function busy(msg) { const b = $('#busy'); if (!msg) { b.hidden = true; return; } $('#busyText').textContent = msg; b.hidden = false; }
  let toastT = 0;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 6000 : 3200); }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function copy(text) {
    const done = () => toast(`Copied ${text}`);
    if (navigator.clipboard && isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(text); } t.remove(); }
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safe = s => String(s).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'layer';
  const rgbCss = c => `rgb(${c.slice(0, 3).map(v => Math.round(v * 255)).join(',')})`;
  const hexOf = c => '#' + c.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fmtBytes = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';

  applySettings();
  window.__ps = { S, openFile, setView }; // handy for debugging in the console
})();
