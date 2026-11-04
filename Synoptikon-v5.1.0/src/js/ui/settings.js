// ═══════════════ settings (localStorage: light prefs only) ═══════════════
const SET_KEY = 'synoptikon';
const THEMES = ['desert', 'retro', 'meadow', 'candle', 'studio'];
const DEF = { mode: 'dark', theme: 'desert', size: 'm', checker: 'dark', orient: true, pixel: true, palCount: 12, palSort: 'share',
  side: 'right', dock: 'docked', dockW: 340, panel: 'layers', lpMode: 'preview', thumb: 'm', tint: true, autoClose: true, cdock: 'docked',
  cpanel: 'layers', cmpSort: 'stack', cmpGroup: false, diffColor: 'magenta' };
const set = { ...DEF };
try {
  const old = localStorage.getItem('procreate-studio'); // carry over v4 preferences once
  Object.assign(set, JSON.parse(localStorage.getItem(SET_KEY) || old || '{}'));
} catch (e) { }
if (!THEMES.includes(set.theme)) set.theme = 'desert'; // v4/v5.0 theme names
if (set.dock === 'float') set.dock = 'hidden';
const saveSet = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(set)); } catch (e) { } };
const mq = matchMedia('(prefers-color-scheme: light)');
const THUMB_PX = { s: 34, m: 46, l: 64 };
function applySettings() {
  root.dataset.mode = set.mode === 'system' ? (mq.matches ? 'light' : 'dark') : set.mode;
  root.dataset.theme = set.theme; root.dataset.size = set.size; root.dataset.checker = set.checker;
  appEl.dataset.side = set.side;
  appEl.style.setProperty('--dock-w', Math.round(set.dockW) + 'px');
  for (const [sel, key] of [['#setMode', 'mode'], ['#setTheme', 'theme'], ['#setSize', 'size'], ['#sizeSeg', 'size'], ['#setChecker', 'checker'], ['#setSide', 'side'], ['#setLpMode', 'lpMode'], ['#setThumb', 'thumb']])
    $$(sel + ' button').forEach(b => b.setAttribute(sel === '#sizeSeg' ? 'aria-checked' : 'aria-pressed', b.dataset.v === set[key]));
  $('#setOrient').checked = set.orient; $('#setPixel').checked = set.pixel; $('#setTint').checked = set.tint; $('#setAutoClose').checked = set.autoClose;
  $$('#lpMode button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === set.lpMode));
  const tree = $('#layerTree'); tree.classList.toggle('outline', set.lpMode === 'outline'); tree.classList.toggle('preview', set.lpMode === 'preview');
  tree.style.setProperty('--th', THUMB_PX[set.thumb] + 'px'); $('#treeWrap').classList.toggle('tint-off', !set.tint);
  if (typeof viewVP !== 'undefined') { viewVP.pixel(set.pixel); cmpVPs.forEach(v => v.pixel(set.pixel)); }
}
mq.addEventListener('change', () => set.mode === 'system' && applySettings());
