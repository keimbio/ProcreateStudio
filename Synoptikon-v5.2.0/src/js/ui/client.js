// ═══════════════ engine client ═══════════════
// One client per open document (Viewer, Compare A, Compare B). Runs the engine in a
// Web Worker built from the inlined source; falls back to the main thread if workers fail.
let engineUrl = null; // one blob URL of the engine source, shared by every worker and decode helper
function engineURL() { return engineUrl || (engineUrl = URL.createObjectURL(new Blob([$('#engineSrc').textContent], { type: 'text/javascript' }))); }
function makeClient(onEvent) {
  let worker = null, rid = 0, opened = false, file = null, local = null;
  const waits = new Map();
  // helper workers for decoding = spare cores (the engine thread decodes too); ?pool=N overrides for testing
  const POOL = +new URLSearchParams(location.search).get('pool') || Math.max(0, Math.min((navigator.hardwareConcurrency || 4) - 1, 7));
  function start() {
    try {
      worker = new Worker(engineURL());
      worker.onmessage = e => recv(e.data);
      worker.onerror = e => { e.preventDefault(); if (!opened && file) { worker = null; local = createEngine(); send({ type: 'open', file }); } };
    } catch (e) { worker = null; local = createEngine(); }
  }
  function send(msg, tr) { if (worker) worker.postMessage(msg, tr || []); else (local || (local = createEngine())).handle(msg, recv); }
  function recv(m) {
    if (m.type === 'progress') { const w = waits.get(m.rid); if (w && w.onProgress) w.onProgress(m.text); return; }
    if (m.rid && waits.has(m.rid)) { const w = waits.get(m.rid); waits.delete(m.rid); m.type === 'error' ? w.rej(new Error(m.message)) : w.res(m); return; }
    if (m.type === 'opened') opened = true;
    onEvent(m);
  }
  return {
    open(f) { file = f; opened = false; start(); send({ type: 'open', file: f, poolUrl: worker ? engineURL() : null, pool: POOL }); },
    ask(type, extra, onProgress) { const id = ++rid; return new Promise((res, rej) => { waits.set(id, { res, rej, onProgress }); send({ type, rid: id, ...extra }); }); },
    close() { if (worker) worker.terminate(); worker = null; local = null; waits.clear(); }
  };
}
