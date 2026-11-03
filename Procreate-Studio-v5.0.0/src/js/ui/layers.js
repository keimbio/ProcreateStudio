// ═══════════════ Layers panel: tree model, editing, selection, drag & drop ═══════════════
// Model: S.tree holds only structure ({id, children?}); names and visibility live in maps,
// so a snapshot for undo is cheap and the .procreate writer gets exactly what changed.
// Selection (highlighted rows) is separate from visibility (eyes). The canvas shows either
// the visible layers or — explicitly, via “Selected only” — the selection.

// ── tree helpers ──
function walk(list, fn, depth = 0, parent = null) { for (const n of list) { fn(n, depth, parent); if (n.children) walk(n.children, fn, depth + 1, n); } }
function leaves(list = S.tree) { const out = []; walk(list, n => { if (!n.children) out.push(n.id); }); return out; }
function locate(id, list = S.tree, parent = null) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { arr: list, i, node: list[i], parent };
    if (list[i].children) { const r = locate(id, list[i].children, list[i]); if (r) return r; }
  }
  return null;
}
const isGroup = id => S.meta.get(id) && S.meta.get(id).kind === 'group';
function ancestors(id) { const out = []; let l = locate(id); while (l && l.parent) { out.push(l.parent.id); l = locate(l.parent.id); } return out; }
function effVisible(id) { if (!S.vis.get(id)) return false; return ancestors(id).every(g => S.vis.get(g)); }
function layerNums() { const L = leaves(), m = new Map(); L.forEach((id, i) => m.set(id, L.length - i)); return m; }
function selectedLeaves() {
  const out = []; walk(S.tree, (n, d, p) => { if (n.children) return; if (S.selected.has(n.id) || ancestors(n.id).some(a => S.selected.has(a))) out.push(n.id); });
  return out;
}
function topSelected() { // selected nodes whose ancestors are not selected, in panel order
  const out = []; walk(S.tree, n => { if (S.selected.has(n.id) && !ancestors(n.id).some(a => S.selected.has(a))) out.push(n.id); }); return out;
}
const rowEl = id => id == null ? null : $(`#layerTree li[data-id="${id}"] > .row`);

// ── history / edits ──
const clone = t => t.map(n => n.children ? { id: n.id, children: clone(n.children) } : { id: n.id });
function snapshot() { return { tree: clone(S.tree), names: new Map(S.names), vis: new Map(S.vis) }; }
function restore(s) { S.tree = clone(s.tree); S.names = new Map(s.names); S.vis = new Map(s.vis); const ids = new Set(); walk(S.tree, n => ids.add(n.id)); S.selected = new Set([...S.selected].filter(i => ids.has(i))); }
function commit(fn) { const before = snapshot(); if (fn() === false) return; S.undo.push(before); if (S.undo.length > 200) S.undo.shift(); S.redo = []; afterEdit(); }
function undo() { if (!S.undo.length) return; S.redo.push(snapshot()); restore(S.undo.pop()); afterEdit(); }
function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); afterEdit(); }
const sameTree = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
function diffFrom(base) {
  const nowIds = new Set(); walk(S.tree, n => nowIds.add(n.id));
  const removed = [...base.names.keys()].filter(id => !nowIds.has(id));
  const order = (() => { const filt = t => t.filter(n => nowIds.has(n.id)).map(n => n.children ? { id: n.id, children: filt(n.children) } : { id: n.id }); return !sameTree(filt(base.tree), S.tree); })();
  const renamed = [...nowIds].filter(id => base.names.get(id) !== S.names.get(id));
  const vis = [...nowIds].filter(id => base.vis.get(id) !== S.vis.get(id));
  return { removed, order, renamed, vis, any: removed.length || order || renamed.length || vis.length };
}
const hasEdits = () => !!(S.orig && diffFrom(S.orig).any);
const hasUnsaved = () => !!(S.saved && S.ready && diffFrom(S.saved).any);
const countRemoved = () => diffFrom(S.orig).removed.filter(id => !isGroup(id)).length;
function afterEdit() {
  drawTree(); render(); fillInfo(); updateEditUI();
}
function updateEditUI() {
  const d = S.orig ? diffFrom(S.orig) : { any: false };
  $('#actUndo').disabled = !S.undo.length; $('#actRedo').disabled = !S.redo.length;
  $('#editBanner').hidden = !d.any;
  if (d.any) {
    const parts = [];
    if (d.order) parts.push('order');
    if (d.removed.length) parts.push(`${d.removed.length} removed`);
    if (d.renamed.length) parts.push(`${d.renamed.length} renamed`);
    if (d.vis.length) parts.push(`${d.vis.length} visibility`);
    $('#editSummary').textContent = 'Edited: ' + parts.join(' · ');
  }
  $('#editedDot').hidden = !hasUnsaved();
  updateSelBar();
}
$('#btnRevert').onclick = () => commit(() => { restore(S.orig); });
$('#actUndo').onclick = undo; $('#actRedo').onclick = redo;

// ── drawing ──
const TINTS = ['#4C56A5', '#A63870', '#CFAA16', '#BD5826', '#6D52A3', '#D65871', '#005CA3', '#AB5BA8', '#CB5F39', '#8388DD']; // from palette-01
function drawTree() {
  const host = $('#layerTree'), wrap = $('#treeWrap'), top = wrap.scrollTop; host.innerHTML = '';
  const nums = layerNums(); let gi = 0;
  const mk = (list, parentOl, depth, tint) => {
    for (const n of list) {
      const id = n.id, M = S.meta.get(id), grp = !!n.children, li = document.createElement('li');
      li.className = grp ? 'group' : 'layer'; li.dataset.id = id; li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-level', depth + 1); li.setAttribute('aria-selected', S.selected.has(id));
      let t = tint; if (grp && depth === 0) t = TINTS[gi++ % TINTS.length];
      if (t) li.style.setProperty('--tint', t);
      if (grp) { li.setAttribute('aria-expanded', !S.collapsed.has(id)); if (S.collapsed.has(id)) li.classList.add('closed'); }
      const name = S.names.get(id), vis = S.vis.get(id), inh = vis && !effVisible(id);
      const renamed = S.orig && S.orig.names.get(id) !== name;
      let meta = '', mini = '';
      if (!grp) {
        const tags = [];
        if (M.blend) tags.push(`<span class="tagx blend">${M.blendName}</span>`);
        if (M.opacity < 0.999) tags.push(`<span class="tagx">${Math.round(M.opacity * 100)}%</span>`);
        if (M.clipped) tags.push('<span class="tagx" title="Clipping mask">Clip</span>');
        if (M.hasMask) tags.push(`<span class="tagx" title="Layer mask${M.maskHidden ? ' (hidden)' : ''}">Mask</span>`);
        if (M.isText) tags.push('<span class="tagx">Text</span>');
        if (S.empty.has(id)) tags.push('<span class="tagx">Empty</span>');
        if (renamed) tags.push('<span class="tagx ed" title="Renamed">Renamed</span>');
        meta = tags.join('') || '<span>Normal</span>';
        mini = [M.blend ? `<i title="${M.blendName}">${M.blendName.slice(0, 3)}</i>` : '', M.opacity < 0.999 ? `<i>${Math.round(M.opacity * 100)}</i>` : '', M.clipped ? '<i title="Clipping mask">C</i>' : '', M.hasMask ? '<i title="Mask">M</i>' : ''].join('');
      } else meta = `${plural(leaves(n.children).length, 'layer')}${renamed ? ' <span class="tagx ed">Renamed</span>' : ''}`;
      const ico = grp ? ICON.folder : M.isText ? ICON.text : ICON.layer;
      li.innerHTML = `<div class="row${S.selected.has(id) ? ' sel' : ''}${S.focus === id ? ' focus' : ''}${vis ? '' : ' hid'}${!grp && M.clipped ? ' clipped' : ''}" style="--depth:${depth}">
        <button class="eye${vis ? '' : ' off'}${inh ? ' inherited' : ''}" tabindex="-1" aria-label="${vis ? 'Hide' : 'Show'} ${esc(name)}" title="${vis ? 'Hide' : 'Show'} · ${isMac ? '⌥' : 'Alt'}-click to show only this">${vis ? ICON.eyeOn : ICON.eyeOff}</button>
        <span class="indent"></span>
        ${grp ? `<button class="twisty" tabindex="-1" aria-label="Expand or collapse">${ICON.chev}</button>` : '<span class="twisty blank"></span>'}
        <span class="ico">${ico}</span>
        ${grp ? `<span class="thumb gthumb">${ICON.folder}</span>` : '<span class="thumb loading"></span>'}
        <span class="lname"><span class="nm">${esc(name)}</span><span class="meta">${meta}</span></span>
        <span class="tagmini">${mini}</span>
        ${grp ? '' : `<span class="num" title="Layer number (1 = bottom)">${nums.get(id)}</span>`}
      </div>`;
      if (!grp) fillThumb(li.querySelector('.thumb'), id);
      parentOl.appendChild(li);
      if (grp) { const ol = document.createElement('ol'); ol.setAttribute('role', 'group'); li.appendChild(ol); mk(n.children, ol, depth + 1, t); }
    }
  };
  mk(S.tree, host, 0, null);
  host.classList.toggle('flat', !S.tree.some(n => n.children));
  wrap.scrollTop = top;
  $('#layerCount').textContent = leaves().length;
  updateSelBar(); updateStatus();
}
function fillThumb(el, id) {
  if (!el) return;
  if (S.thumbs.has(id)) { el.classList.remove('loading'); el.innerHTML = ''; el.appendChild(S.thumbs.get(id)); }
  else if (S.empty.has(id)) { el.classList.remove('loading'); el.innerHTML = ''; el.title = 'Empty layer'; }
}
function refreshRowsLight() { // selection / focus only — no rebuild
  $$('#layerTree li').forEach(li => {
    const id = +li.dataset.id, r = li.firstElementChild;
    r.classList.toggle('sel', S.selected.has(id)); r.classList.toggle('focus', S.focus === id); li.setAttribute('aria-selected', S.selected.has(id));
  });
  updateSelBar(); updateStatus();
}
function updateSelBar() {
  const n = selectedLeaves().length, g = [...S.selected].filter(isGroup).length;
  $('#selCount').innerHTML = S.selected.size ? `<b>${n}</b> ${n === 1 ? 'layer' : 'layers'} selected${g ? ` <span title="Groups count all the layers inside them">(in ${plural(g, 'group')})</span>` : ''}` : 'Nothing selected';
  const none = !S.selected.size;
  ['#actUp', '#actDown', '#actRename', '#actDelete', '#actIsolate'].forEach(s => $(s).disabled = none);
  $('#actRename').disabled = S.selected.size !== 1;
}
function afterSelect(scroll) {
  refreshRowsLight();
  if (S.show === 'selected') render(); else syncShow();
  if (set.panel === 'export') updateExport();
  if (scroll) { const r = rowEl(S.focus); r && r.scrollIntoView({ block: 'nearest' }); }
}

// ── selection ──
function visibleRowIds() { // panel order, skipping rows inside collapsed groups
  const out = []; walk(S.tree, n => { if (!ancestors(n.id).some(a => S.collapsed.has(a))) out.push(n.id); }); return out;
}
function selectOnly(id) { S.selected = new Set([id]); S.anchor = S.focus = id; }
function selectRange(id) {
  const rows = visibleRowIds(), a = rows.indexOf(S.anchor ?? id), b = rows.indexOf(id);
  if (a < 0) return selectOnly(id);
  S.selected = new Set(rows.slice(Math.min(a, b), Math.max(a, b) + 1)); S.focus = id;
}
function toggleSel(id) { S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); S.anchor = S.focus = id; }
function stepSelection(d, extend) {
  const rows = visibleRowIds(); if (!rows.length) return;
  let i = rows.indexOf(S.focus); i = i < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, i + d));
  // in “Selected only” browsing, skip group rows so ↑/↓ steps layer by layer
  if (S.show === 'selected' && !extend) { while (rows[i] != null && isGroup(rows[i]) && i + d >= 0 && i + d < rows.length) i += d; }
  const id = rows[i];
  if (extend) { S.focus = id; selectRange(id); } else selectOnly(id);
  afterSelect(true);
}
$$('.sel-actions [data-sel]').forEach(b => b.addEventListener('click', () => {
  const all = leaves();
  if (b.dataset.sel === 'all') S.selected = new Set(all);
  if (b.dataset.sel === 'none') S.selected = new Set();
  if (b.dataset.sel === 'visible') S.selected = new Set(all.filter(effVisible));
  if (b.dataset.sel === 'invert') { const cur = new Set(selectedLeaves()); S.selected = new Set(all.filter(i => !cur.has(i))); }
  $('#rangeMsg').textContent = ''; afterSelect();
}));
$('#byNumberBtn').onclick = () => { const f = $('#rangeForm'); f.hidden = !f.hidden; $('#byNumberBtn').setAttribute('aria-expanded', !f.hidden); if (!f.hidden) $('#rangeInput').focus(); else $('#rangeMsg').textContent = ''; };
$('#rangeForm').addEventListener('submit', e => {
  e.preventDefault();
  const all = leaves(), nums = layerNums(), r = parseRange($('#rangeInput').value, all.length), msg = $('#rangeMsg');
  if (r.error) { msg.textContent = r.error; msg.classList.add('err'); return; }
  S.selected = new Set(all.filter(id => r.nums.has(nums.get(id))));
  msg.classList.remove('err'); msg.textContent = `Selected ${plural(S.selected.size, 'layer')}. Numbers count up from the bottom layer.`;
  afterSelect();
});
function parseRange(str, max) {
  const nums = new Set(), parts = str.split(/[,;\s]+/).filter(Boolean);
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

// ── visibility ──
let soloRestore = null;
function toggleVis(id, alt) {
  commit(() => {
    if (alt && !isGroup(id)) {
      const all = leaves(), onlyThis = all.every(l => l === id ? effVisible(l) : !S.vis.get(l));
      if (onlyThis && soloRestore) { for (const [k, v] of soloRestore) S.vis.set(k, v); soloRestore = null; }
      else { soloRestore = new Map(S.vis); all.forEach(l => S.vis.set(l, l === id)); ancestors(id).forEach(g => S.vis.set(g, true)); }
    } else {
      const ids = S.selected.has(id) && S.selected.size > 1 ? [...S.selected] : [id]; // toggling a selected row toggles the whole selection
      const to = !S.vis.get(id); ids.forEach(i => S.vis.set(i, to)); soloRestore = null;
    }
  });
}

// ── rename ──
function startRename(id) {
  const r = rowEl(id); if (!r) return; const nm = r.querySelector('.nm'); if (!nm) return;
  const input = document.createElement('input'); input.value = S.names.get(id); input.setAttribute('aria-label', 'Layer name'); input.maxLength = 120;
  nm.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    const v = input.value.trim();
    if (ok && v && v !== S.names.get(id)) commit(() => { S.names.set(id, v); });
    else drawTree();
    $('#layerTree').focus({ preventScroll: true });
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', e => e.stopPropagation());
}
$('#actRename').onclick = () => { const id = [...S.selected][0]; if (id != null) startRename(id); };

// ── delete ──
function deleteSelected() {
  const ids = topSelected(); if (!ids.length) return;
  const goneLeaves = new Set(selectedLeaves());
  if (leaves().every(l => goneLeaves.has(l))) { toast('A Procreate file needs at least one layer — keep one layer.', true); return; }
  const rows = visibleRowIds(); const nextFocus = rows.find((r, i) => i > rows.indexOf(ids[ids.length - 1]) && !goneLeaves.has(r) && !ids.includes(r));
  commit(() => { for (const id of ids) { const l = locate(id); if (l) l.arr.splice(l.i, 1); } });
  S.selected = new Set(nextFocus != null ? [nextFocus] : []); S.focus = S.anchor = nextFocus ?? null; refreshRowsLight(); if (S.show === 'selected') render();
  toast(`Removed ${plural(goneLeaves.size, 'layer')}${ids.some(isGroup) ? ' (with their group)' : ''} from the list. Your original file isn’t changed.`, false, { label: 'Undo', fn: undo });
}
$('#actDelete').onclick = deleteSelected;

// ── move ──
function moveNodes(ids, target) { // target: { ref, where: 'before'|'after'|'into' } or { root:'end' }
  const set_ = new Set(ids);
  if (target.ref != null && (set_.has(target.ref) || ancestors(target.ref).some(a => set_.has(a)))) return false; // into itself
  const nodes = ids.map(id => locate(id)).filter(Boolean).map(l => l.node);
  for (const n of nodes) { const l = locate(n.id); l.arr.splice(l.i, 1); }
  if (target.root === 'end') { S.tree.push(...nodes); return true; }
  const t = locate(target.ref); if (!t) return false;
  if (target.where === 'into') { t.node.children.unshift(...nodes); S.collapsed.delete(t.node.id); }
  else t.arr.splice(target.where === 'before' ? t.i : t.i + 1, 0, ...nodes);
  return true;
}
function nudge(dir) { // dir −1 = up (toward the top of the stack)
  const ids = topSelected(); if (!ids.length) return;
  commit(() => {
    let moved = false;
    for (const id of dir < 0 ? ids : [...ids].reverse()) {
      const l = locate(id), j = l.i + dir;
      if (j >= 0 && j < l.arr.length) { if (ids.includes(l.arr[j].id)) continue; [l.arr[l.i], l.arr[j]] = [l.arr[j], l.arr[l.i]]; moved = true; }
      else if (l.parent) { // step out of the group
        const p = locate(l.parent.id); l.arr.splice(l.i, 1); p.arr.splice(dir < 0 ? p.i : p.i + 1, 0, l.node); moved = true;
      }
    }
    return moved;
  });
  const r = rowEl(S.focus); r && r.scrollIntoView({ block: 'nearest' });
}
$('#actUp').onclick = () => nudge(-1); $('#actDown').onclick = () => nudge(1);
$('#actIsolate').onclick = () => setShow(S.show === 'selected' ? 'visible' : 'selected');

// ── pointer: click-select, eye, twisty, drag & drop ──
(() => {
  const tree = $('#layerTree'), wrap = $('#treeWrap'), line = $('#dropLine');
  let press = null, drag = null, ghost = null, scrollTimer = 0;
  tree.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const row = e.target.closest('.row'); if (!row) return;
    const id = +row.parentElement.dataset.id;
    if (e.target.closest('.eye')) { toggleVis(id, e.altKey); return; }
    if (e.target.closest('.twisty')) { S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); drawTree(); return; }
    if (e.target.closest('input')) return;
    tree.focus({ preventScroll: true });
    const mod = modKey(e);
    if (e.shiftKey) { selectRange(id); afterSelect(); return; }
    if (mod) { toggleSel(id); afterSelect(); return; }
    const wasSel = S.selected.has(id);
    if (!wasSel) { selectOnly(id); afterSelect(); }
    press = { id, x: e.clientX, y: e.clientY, wasSel, pid: e.pointerId };
  });
  addEventListener('pointermove', e => {
    if (!press) return;
    if (!drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      drag = { ids: topSelected() }; tree.setPointerCapture && tree.setPointerCapture(press.pid);
      drag.ids.forEach(id => { const r = rowEl(id); r && r.classList.add('dragging'); });
      ghost = document.createElement('div'); ghost.className = 'drag-ghost';
      const nL = selectedLeaves().length; ghost.textContent = drag.ids.length === 1 ? S.names.get(drag.ids[0]) : `${plural(nL, 'layer')}`;
      document.body.appendChild(ghost);
    }
    ghost.style.left = e.clientX + 14 + 'px'; ghost.style.top = e.clientY + 10 + 'px';
    drag.target = targetAt(e.clientY);
    // auto-scroll near the edges
    const wr = wrap.getBoundingClientRect(); clearInterval(scrollTimer);
    if (e.clientY < wr.top + 30) scrollTimer = setInterval(() => { wrap.scrollTop -= 8; }, 16);
    else if (e.clientY > wr.bottom - 30) scrollTimer = setInterval(() => { wrap.scrollTop += 8; }, 16);
  });
  const finish = e => {
    clearInterval(scrollTimer);
    if (drag) {
      $$('.row.dragging, .row.drop-into').forEach(r => r.classList.remove('dragging', 'drop-into')); line.hidden = true; ghost && ghost.remove(); ghost = null;
      const t = drag.target, ids = drag.ids; drag = null; press = null;
      if (t && e.type === 'pointerup') commit(() => moveNodes(ids, t));
      return;
    }
    if (press && e.type === 'pointerup' && press.wasSel) { selectOnly(press.id); afterSelect(); }
    press = null;
  };
  addEventListener('pointerup', finish); addEventListener('pointercancel', finish);
  tree.addEventListener('dblclick', e => { const row = e.target.closest('.row'); if (!row || e.target.closest('.eye, .twisty')) return; const id = +row.parentElement.dataset.id;
    if (e.target.closest('.thumb') && !isGroup(id)) { selectOnly(id); setShow('selected'); return; } startRename(id); });

  function targetAt(y) {
    $$('.row.drop-into').forEach(r => r.classList.remove('drop-into'));
    const ids = visibleRowIds(); if (!ids.length) return null;
    const dragged = new Set(drag.ids); const wr = wrap.getBoundingClientRect();
    let best = null;
    for (const id of ids) {
      const r = rowEl(id); const b = r.getBoundingClientRect();
      if (y < b.top || y > b.bottom) continue; best = { id, b, r }; break;
    }
    if (!best) { // below the last row → end of the stack
      const lastR = rowEl(ids[ids.length - 1]).getBoundingClientRect();
      if (y > lastR.bottom) { showLine(lastR.bottom, 0, wr); return { root: 'end' }; }
      line.hidden = true; return null;
    }
    const { id, b, r } = best; const rel = (y - b.top) / b.height; const depth = ancestors(id).length;
    if (dragged.has(id) || ancestors(id).some(a => dragged.has(a))) { line.hidden = true; return null; }
    if (isGroup(id) && rel > 0.28 && rel < 0.72) { line.hidden = true; r.classList.add('drop-into'); return { ref: id, where: 'into' }; }
    if (isGroup(id) && rel >= 0.72 && !S.collapsed.has(id)) { showLine(b.bottom, depth + 1, wr); return { ref: id, where: 'into' }; }
    const before = rel < 0.5; showLine(before ? b.top : b.bottom, depth, wr);
    return { ref: id, where: before ? 'before' : 'after' };
  }
  function showLine(yAbs, depth, wr) { line.hidden = false; line.style.top = (yAbs - wr.top + wrap.scrollTop - 1) + 'px'; line.style.left = (40 + depth * 16) + 'px'; }
})();

// ── keyboard (tree focused) ──
$('#layerTree').addEventListener('keydown', e => {
  const k = e.key, id = S.focus;
  if ((k === 'ArrowUp' || k === 'ArrowDown') && e.altKey) { e.preventDefault(); nudge(k === 'ArrowUp' ? -1 : 1); return; }
  if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); if (modKey(e)) { const rows = visibleRowIds(); let i = rows.indexOf(S.focus) + (k === 'ArrowUp' ? -1 : 1); if (rows[i] != null) { S.focus = rows[i]; refreshRowsLight(); } } else stepSelection(k === 'ArrowUp' ? -1 : 1, e.shiftKey); return; }
  if (k === ' ' && modKey(e) && id != null) { e.preventDefault(); toggleSel(id); afterSelect(); return; }
  if ((k === 'ArrowLeft' || k === 'ArrowRight') && id != null) {
    e.preventDefault();
    if (isGroup(id)) { const open = !S.collapsed.has(id); if (k === 'ArrowLeft' && open) { S.collapsed.add(id); drawTree(); return; } if (k === 'ArrowRight' && !open) { S.collapsed.delete(id); drawTree(); return; } }
    if (k === 'ArrowLeft') { const a = ancestors(id)[0]; if (a != null) { selectOnly(a); afterSelect(true); } }
    return;
  }
  if ((k === 'Enter' || k === 'F2') && id != null) { e.preventDefault(); startRename(id); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (k === 'a' && modKey(e)) { e.preventDefault(); S.selected = new Set(leaves()); afterSelect(); return; }
  if (k === 'Home' || k === 'End') { e.preventDefault(); const rows = visibleRowIds(); selectOnly(k === 'Home' ? rows[0] : rows[rows.length - 1]); afterSelect(true); }
});
$$('#lpMode button').forEach(b => b.addEventListener('click', () => { set.lpMode = b.dataset.v; saveSet(); applySettings(); }));
