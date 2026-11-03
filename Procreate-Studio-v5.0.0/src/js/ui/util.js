// ═══════════════ shared helpers ═══════════════
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const root = document.documentElement, appEl = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = s => String(s).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'layer';
const rgbCss = c => `rgb(${c.slice(0, 3).map(v => Math.round(v * 255)).join(',')})`;
const hexOf = c => '#' + c.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const fmtBytes = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const modKey = e => isMac ? e.metaKey : e.ctrlKey;
const fmtTime = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const ORIENT_TXT = i => (i.orientation ? `Rotated ${i.orientation}°` : 'Upright') + (i.flipH ? ', flipped ↔' : '') + (i.flipV ? ', flipped ↕' : '');

const ICON = {
  eyeOn: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
  layer: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6V5h14v1M12 5v14M9 19h6"/></svg>'
};

// ── busy indicators (one per stage) ──
function busyOn(el, txtEl, msg) { if (!msg) { el.hidden = true; return; } txtEl.textContent = msg; el.hidden = false; }
const busy = msg => busyOn($('#busy'), $('#busyText'), msg);

// ── toast, with an optional action button (e.g. Undo) ──
let toastT = 0, toastFn = null;
function toast(msg, err, action) {
  const t = $('#toast'), b = $('#toastAct');
  $('#toastText').textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
  toastFn = action ? action.fn : null; b.hidden = !action; if (action) b.textContent = action.label;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 6500 : action ? 6000 : 3200);
}
$('#toastAct').onclick = () => { const f = toastFn; $('#toast').classList.remove('show'); toastFn = null; f && f(); };

function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); }
function copyText(text) {
  const done = () => toast(`Copied ${text}`);
  if (navigator.clipboard && isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(text); } t.remove(); }
}
function imgToCanvas(img, c) { c = c || document.createElement('canvas'); c.width = img.w; c.height = img.h; c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0); return c; }
function orientedSize(info, orient) { const sw = orient && (info.orientation === 90 || info.orientation === 270); return { W: sw ? info.height : info.width, H: sw ? info.width : info.height }; }
const dispK = info => Math.max(1, Math.ceil(Math.sqrt(info.width * info.height / 16e6)));
