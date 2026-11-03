// ═══════════════ engine client ═══════════════
// One client per open document (Viewer, Compare A, Compare B). Runs the engine in a
// Web Worker built from the inlined source; falls back to the main thread if workers fail.
function makeClient(onEvent) {
  let worker = null, rid = 0, opened = false, file = null, local = null;
  const waits = new Map();
  function start() {
    try {
      const url = URL.createObjectURL(new Blob([$('#engineSrc').textContent], { type: 'text/javascript' }));
      worker = new Worker(url);
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
    open(f) { file = f; opened = false; start(); send({ type: 'open', file: f }); },
    ask(type, extra, onProgress) { const id = ++rid; return new Promise((res, rej) => { waits.set(id, { res, rej, onProgress }); send({ type, rid: id, ...extra }); }); },
    close() { if (worker) worker.terminate(); worker = null; local = null; waits.clear(); }
  };
}
