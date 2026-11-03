// ═══════════════ zoom / pan viewport ═══════════════
// Shared by the Viewer and both Compare panes. `content` is sized to the artwork's pixel
// size and moved with one CSS transform; canvases inside fill it.
function makeViewport(vp, content, opts = {}) {
  const st = { zoom: 1, px: 0, py: 0, fit: true, W: 0, H: 0 }; let pixelOn = true;
  const pad = opts.pad || { top: 72, bottom: 84, x: 30 };
  const api = {
    st,
    setSize(W, H) { if (W === st.W && H === st.H) return; st.W = W; st.H = H; content.style.width = W + 'px'; content.style.height = H + 'px'; if (st.fit) api.fit(); else api.apply(); },
    fit(silent) {
      const vw = vp.clientWidth, vh = vp.clientHeight; if (!vw || !st.W) return;
      st.zoom = Math.max(0.01, Math.min((vw - pad.x * 2) / st.W, (vh - pad.top - pad.bottom) / st.H, 8));
      st.px = (vw - st.W * st.zoom) / 2; st.py = pad.top + (vh - pad.top - pad.bottom - st.H * st.zoom) / 2; st.fit = true; api.apply(silent);
    },
    zoomAt(f, cx, cy) {
      const z = Math.min(32, Math.max(0.02, st.zoom * f)); f = z / st.zoom;
      if (cx == null) { cx = vp.clientWidth / 2; cy = vp.clientHeight / 2; }
      st.px = cx - (cx - st.px) * f; st.py = cy - (cy - st.py) * f; st.zoom = z; st.fit = false; api.apply();
    },
    actual() { api.zoomAt(1 / st.zoom); },
    copyFrom(o) { st.zoom = o.zoom; st.px = o.px; st.py = o.py; st.fit = o.fit; api.apply(true); },
    apply(silent) {
      content.style.transform = `translate(${st.px}px, ${st.py}px) scale(${st.zoom})`;
      content.classList.toggle('pixel', pixelOn && st.zoom >= 2);
      if (!silent && opts.onChange) opts.onChange(st);
    },
    pixel(on) { pixelOn = on; content.classList.toggle('pixel', pixelOn && st.zoom >= 2); }
  };
  vp.addEventListener('wheel', e => { e.preventDefault(); const r = vp.getBoundingClientRect(); api.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  vp.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (opts.ignore && opts.ignore(e))) return;
    drag = { x: e.clientX, y: e.clientY, px: st.px, py: st.py }; vp.setPointerCapture(e.pointerId); vp.classList.add('panning');
    if (opts.onPointerDown) opts.onPointerDown(e);
  });
  vp.addEventListener('pointermove', e => { if (!drag) return; st.px = drag.px + e.clientX - drag.x; st.py = drag.py + e.clientY - drag.y; st.fit = false; api.apply(); });
  const end = () => { drag = null; vp.classList.remove('panning'); };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('dblclick', () => api.fit());
  new ResizeObserver(() => st.fit && api.fit()).observe(vp);
  return api;
}
