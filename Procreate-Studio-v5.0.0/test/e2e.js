// End-to-end in Chromium against real sample files: open, layer edits, exports, .procreate save, Compare.
// Usage: node test/e2e.js <screenshot-dir>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || '/tmp/shots'; fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const sample = n => path.resolve(__dirname, '../../samples/' + n + '.procreate');
const assert = (c, m) => { if (!c) throw new Error('assert: ' + m); console.log('  ✓', m); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 920 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto(url); await p.screenshot({ path: OUT + '/01_empty.png' });
  const S = () => p.evaluate(() => ({ ready: __app.S.ready, n: __app.S.tree.length, sel: [...__app.S.selected], show: __app.S.show }));

  // ── open ──
  await p.setInputFiles('#fileInput', sample('rgb'));
  await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 }); await p.waitForFunction(() => document.getElementById('busy').hidden);
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/02_open_preview.png' });
  const names = await p.$$eval('#layerTree .nm', e => e.map(x => x.textContent));
  assert(names.length === 3, 'three layers listed: ' + names.join(', '));

  // outline mode
  await p.click('#lpMode [data-v="outline"]'); await p.screenshot({ path: OUT + '/03_outline.png' });
  await p.click('#lpMode [data-v="preview"]');

  // selection: click second row, shift-click third
  const rows = await p.$$('#layerTree .row');
  await rows[1].click({ position: { x: 120, y: 10 } });
  await rows[2].click({ position: { x: 120, y: 10 }, modifiers: ['Shift'] });
  let st = await S(); assert(st.sel.length === 2, 'shift-click selects a range of 2');
  await p.click('[data-show="selected"]'); await p.waitForTimeout(400);
  assert((await p.textContent('#viewLabel')).includes('2 selected'), 'label states the canvas shows the selection');
  await p.screenshot({ path: OUT + '/04_selected_only.png' });

  // export panel reflects “what you see”
  await p.click('[data-panel="export"]'); await p.waitForTimeout(400);
  const sub = await p.textContent('#whatViewSub'); assert(/Selected only/.test(sub), 'export “What you see” names the selection: ' + sub);
  await p.screenshot({ path: OUT + '/05_export_panel.png' });
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#btnExport')]);
  assert(/layers_/.test(dl1.suggestedFilename()), 'exports the selected layers: ' + dl1.suggestedFilename());

  // back to layers: rename via double-click, delete, drag reorder, undo
  await p.click('[data-panel="layers"]'); await p.click('[data-show="visible"]');
  await p.dblclick('#layerTree li:nth-child(1) .nm');
  await p.keyboard.press('ControlOrMeta+A'); await p.keyboard.type('Renamed top'); await p.keyboard.press('Enter');
  assert((await p.$$eval('#layerTree .nm', e => e.map(x => x.textContent)))[0] === 'Renamed top', 'inline rename');
  // drag first row below the last
  const r0 = await (await p.$('#layerTree li:nth-child(1) .row')).boundingBox();
  const r2 = await (await p.$('#layerTree li:nth-child(3) .row')).boundingBox();
  await p.mouse.move(r0.x + 140, r0.y + r0.height / 2); await p.mouse.down();
  await p.mouse.move(r0.x + 140, r0.y + 40, { steps: 4 }); await p.mouse.move(r2.x + 140, r2.y + r2.height - 4, { steps: 8 });
  await p.screenshot({ path: OUT + '/06_dragging.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  const after = await p.$$eval('#layerTree .nm', e => e.map(x => x.textContent));
  assert(after[2] === 'Renamed top', 'drag & drop moved the layer to the bottom: ' + after.join(', '));
  // delete middle layer
  await (await p.$('#layerTree li:nth-child(2) .row')).click({ position: { x: 140, y: 10 } });
  await p.click('#actDelete'); await p.waitForTimeout(300);
  assert((await p.$$('#layerTree li')).length === 2, 'delete removes the layer from the list');
  assert(!(await p.isHidden('#editBanner')), 'edited banner visible');
  await p.screenshot({ path: OUT + '/07_edited.png' });
  await p.keyboard.press('ControlOrMeta+Z'); await p.waitForTimeout(200);
  assert((await p.$$('#layerTree li')).length === 3, 'undo restores it');
  await p.keyboard.press('ControlOrMeta+Shift+Z'); await p.waitForTimeout(200);
  assert((await p.$$('#layerTree li')).length === 2, 'redo deletes again');
  // hide one layer via eye
  await p.click('#layerTree li:nth-child(1) .eye'); await p.waitForTimeout(200);

  // save .procreate
  await p.click('[data-panel="export"]'); await p.click('#expKind [data-kind="procreate"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/08_export_procreate.png' });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#btnSaveProcreate')]);
  const saved = OUT + '/' + dl2.suggestedFilename(); await dl2.saveAs(saved);
  assert(/\.procreate$/.test(saved), 'downloaded ' + path.basename(saved));
  // reopen the saved file
  await p.click('[data-panel="layers"]');
  p.once('dialog', d => d.accept());
  await p.setInputFiles('#fileInput', saved);
  await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 });
  const reNames = await p.$$eval('#layerTree .nm', e => e.map(x => x.textContent));
  const reHidden = await p.$$eval('#layerTree .row', e => e.map(x => x.classList.contains('hid')));
  assert(reNames.length === 2 && reNames[1] === 'Renamed top', 'saved file reopens with edits: ' + reNames.join(', ') + ' hidden=' + reHidden.join(','));
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/09_reopened.png' });

  // ── panel states ──
  await p.click('#dockHide'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/10_panels_hidden.png' });
  await p.click('#rail [data-rail="layers"]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/11_popout.png' });
  await p.click('#dockPin'); await p.waitForTimeout(200);
  await p.click('#btnSettings'); await p.click('#setSide [data-v="left"]'); await p.screenshot({ path: OUT + '/12_settings.png' }); await p.keyboard.press('Escape');
  await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/13_left_side.png' });
  await p.click('#btnSettings'); await p.click('#setSide [data-v="right"]'); await p.keyboard.press('Escape');

  // ── compare ──
  await p.click('#tabCompare'); await p.waitForTimeout(200);
  await p.setInputFiles('#cmpFileInput', sample('rgb')); // slot A was auto-filled from the viewer → this goes to B? use explicit slots
  await p.evaluate(() => 0);
  await p.click('[data-cmp-open="a"]').catch(() => { });
  await p.setInputFiles('#cmpFileInput', sample('rgb'));
  await p.click('[data-cmp-open="b"]').catch(() => { });
  await p.setInputFiles('#cmpFileInput', saved);
  await p.waitForFunction(() => __app.C.a && __app.C.b && __app.C.a.ready && __app.C.b.ready && __app.C.pairs.length, null, { timeout: 60000 });
  await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/14_compare_side.png' });
  const statuses = await p.$$eval('#cmpPairs .st', e => e.map(x => x.textContent));
  assert(statuses.includes('Removed') && statuses.includes('Changed'), 'compare finds removed + changed layers: ' + statuses.join(', '));
  for (const [i, v] of ['swipe', 'onion', 'diff'].entries()) { await p.click(`[data-cv="${v}"]`); await p.waitForTimeout(500); await p.screenshot({ path: OUT + `/${15 + i}_compare_${v}.png` }); }
  await p.click('#cmpPairs li:first-child button'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + '/18_compare_layer.png' });

  // light mode look
  await p.click('#tabView'); await p.click('#btnSettings'); await p.click('#setMode [data-v="light"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/19_light.png' });

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '✓ no page errors');
  await b.close(); if (errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
