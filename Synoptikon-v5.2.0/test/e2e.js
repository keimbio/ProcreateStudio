// End-to-end in Chromium against real sample files: open, layer edits, exports, .procreate save, Compare.
// Usage: node test/e2e.js <screenshot-dir>     (needs /tmp/many.procreate from make_many.js)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || '/tmp/shots'; fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const sample = n => path.resolve(__dirname, '../../samples/' + n + '.procreate');
const assert = (c, m) => { if (!c) throw new Error('assert: ' + m); console.log('  ✓', m); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 940 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  p.on('dialog', d => d.accept());
  await p.goto(url); await p.screenshot({ path: OUT + '/01_empty.png', fullPage: true });
  const S = () => p.evaluate(() => ({ ready: __app.S.ready, sel: [...__app.S.selected], show: __app.S.show }));
  const names = () => p.$$eval('#layerTree .nm', e => e.map(x => x.textContent));

  // ── open ──
  let t0 = Date.now();
  await p.setInputFiles('#fileInput', sample('rgb'));
  await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 }); await p.waitForFunction(() => document.getElementById('busy').hidden);
  console.log('  open + first render', Date.now() - t0, 'ms');
  await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/02_open.png' });
  assert((await names()).length === 3, 'three layers listed: ' + (await names()).join(', '));
  assert(!(await p.$('.stage .pill-info, .stage .chip-toggle')), 'no info balloons on the canvas');
  assert(/3.*visible/.test(await p.textContent('#docCounts')), 'counts in the panel header: ' + (await p.textContent('#docCounts')));
  { // plain wheel over the canvas scrolls the page; Ctrl/⌘ + wheel zooms
    await p.evaluate(() => scrollTo(0, 0)); const z0 = await p.textContent('#zoomVal');
    const bx = await p.locator('#viewport').boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
    assert((await p.evaluate(() => scrollY)) > 0 && (await p.textContent('#zoomVal')) === z0, 'scrolling over the canvas scrolls the page, not the zoom');
    await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await p.waitForTimeout(200);
    assert((await p.textContent('#zoomVal')) !== z0, 'Ctrl + scroll zooms: ' + z0 + ' → ' + (await p.textContent('#zoomVal')));
    await p.click('#zoomFit');
  }
  for (const t of ['canvas', 'layer', 'info']) { await p.click(`[data-panel="${t}"]`); assert(await p.isVisible({ canvas: '#pCanvas', layer: '#pLayer', info: '#pInfo' }[t]), `“${t}” tab shows its panel`); }
  assert((await p.textContent('#layerName')) === 'Blue', 'Selected layer tab names the layer');
  await p.click('[data-panel="layers"]');
  await p.click('#lpMode [data-v="outline"]'); await p.screenshot({ path: OUT + '/03_outline.png' }); await p.click('#lpMode [data-v="preview"]');

  // selection → Selected only
  const rows = await p.$$('#layerTree .row');
  await rows[1].click({ position: { x: 150, y: 10 } });
  await rows[2].click({ position: { x: 150, y: 10 }, modifiers: ['Shift'] });
  assert((await S()).sel.length === 2, 'shift-click selects a range of 2');
  await p.click('[data-show="selected"]'); await p.waitForTimeout(400);
  assert((await p.textContent('#sfLeft')).includes('2 selected'), 'canvas footer says it shows the selection');
  await p.click('[data-panel="canvas"]'); assert((await p.textContent('#viewDesc')).includes('2 selected'), 'Details tab describes the canvas');

  // export window
  await p.click('#btnExportTop'); await p.waitForTimeout(500);
  assert(await p.isVisible('#exportModal .modal-card'), 'Export opens a centred window');
  assert(/2 selected/.test(await p.textContent('#xsView')), '“What you see” names the selection: ' + await p.textContent('#xsView'));
  await p.screenshot({ path: OUT + '/04_export_window.png' });
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#xDoImage')]);
  assert(/layers_/.test(dl1.suggestedFilename()), 'exports the selected layers: ' + dl1.suggestedFilename());
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  assert(!(await p.isVisible('#exportModal .modal-card')), 'Esc closes the window');
  // quick export
  await p.click('[data-panel="export"]'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/05_quick_export.png' });
  const [dlq] = await Promise.all([p.waitForEvent('download'), p.click('#qxImage')]);
  assert(/\.png$/.test(dlq.suggestedFilename()), 'quick export downloads ' + dlq.suggestedFilename());

  // edit: rename, drag, delete, undo/redo, hide
  await p.click('[data-panel="layers"]'); await p.click('[data-show="visible"]');
  await p.dblclick('#layerTree li:nth-child(1) .nm');
  await p.keyboard.press('ControlOrMeta+A'); await p.keyboard.type('Renamed top'); await p.keyboard.press('Enter');
  assert((await names())[0] === 'Renamed top', 'inline rename');
  const r0 = await (await p.$('#layerTree li:nth-child(1) .row')).boundingBox();
  const r2 = await (await p.$('#layerTree li:nth-child(3) .row')).boundingBox();
  await p.mouse.move(r0.x + 140, r0.y + r0.height / 2); await p.mouse.down();
  await p.mouse.move(r0.x + 140, r0.y + 40, { steps: 4 }); await p.mouse.move(r2.x + 140, r2.y + r2.height - 4, { steps: 8 });
  await p.screenshot({ path: OUT + '/06_dragging.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  assert((await names())[2] === 'Renamed top', 'drag & drop moved the layer: ' + (await names()).join(', '));
  await (await p.$('#layerTree li:nth-child(2) .row')).click({ position: { x: 150, y: 10 } });
  await p.click('#actDelete'); await p.waitForTimeout(300);
  assert((await p.$$('#layerTree li')).length === 2, 'delete removes the layer');
  assert(await p.isVisible('#editBadge'), '“Unsaved layer edits” badge shows');
  await p.keyboard.press('ControlOrMeta+Z'); await p.waitForTimeout(200); assert((await p.$$('#layerTree li')).length === 3, 'undo restores it');
  await p.keyboard.press('ControlOrMeta+Shift+Z'); await p.waitForTimeout(200); assert((await p.$$('#layerTree li')).length === 2, 'redo deletes again');
  await p.click('#layerTree li:nth-child(1) .eye'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/07_edited.png' });

  // save .procreate from the window
  await p.click('#btnExportTop'); await p.waitForTimeout(300);
  await p.$eval('#xsecProcreate', e => e.scrollIntoView()); await p.screenshot({ path: OUT + '/08_export_procreate.png' });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#btnSaveProcreate')]);
  const saved = OUT + '/' + dl2.suggestedFilename(); await dl2.saveAs(saved);
  assert(/\.procreate$/.test(saved), 'downloaded ' + path.basename(saved));
  await p.waitForTimeout(300);
  if (!(await p.isHidden('#editBadge'))) console.log('  debug:', await p.evaluate(() => JSON.stringify({ same: __app.S.saved === __app.S.orig, toast: document.getElementById('toastText').textContent, tree: JSON.stringify(__app.S.tree), st: JSON.stringify(__app.S.saved.tree), sv: [...__app.S.saved.vis], v: [...__app.S.vis] })));
  assert(await p.isHidden('#editBadge'), 'badge clears after saving');
  await p.keyboard.press('Escape');
  await p.setInputFiles('#fileInput', saved);
  await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 });
  const reNames = await names(), reHidden = await p.$$eval('#layerTree .row', e => e.map(x => x.classList.contains('hid')));
  assert(reNames.length === 2 && reNames[1] === 'Renamed top' && reHidden[0], 'saved file reopens with the edits: ' + reNames.join(', '));

  // ── long list: selecting must not scroll the list ──
  await p.setInputFiles('#fileInput', '/tmp/many.procreate'); await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 });
  await p.evaluate(() => document.getElementById('treeWrap').scrollTop = 1400); await p.waitForTimeout(150);
  const deep = await p.evaluateHandle(() => { const w = document.getElementById('treeWrap').getBoundingClientRect(); return [...document.querySelectorAll('#layerTree li.layer > .row')].find(r => { const b = r.getBoundingClientRect(); return b.top > w.top + 80 && b.bottom < w.bottom - 20; }); });
  const before = await p.evaluate(() => document.getElementById('treeWrap').scrollTop);
  await deep.asElement().click({ position: { x: 160, y: 10 } }); await p.waitForTimeout(250);
  await deep.asElement().click({ position: { x: 14, y: 14 } }); await p.waitForTimeout(250);
  assert(Math.abs(await p.evaluate(() => document.getElementById('treeWrap').scrollTop) - before) < 2, 'selecting / hiding a layer keeps the list where it is');
  await p.screenshot({ path: OUT + '/09_many_layers.png' });

  // ── panel states ──
  await p.click('#dockHide'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/10_panels_hidden.png' });
  await p.click('#rail [data-rail="layers"]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/11_popout.png' });
  await p.click('#dockPin'); await p.waitForTimeout(200);
  await p.click('#btnSettings'); await p.click('#setSide [data-v="left"]'); await p.screenshot({ path: OUT + '/12_settings.png' }); await p.keyboard.press('Escape');
  await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/13_left_side.png' });
  await p.click('#btnSettings'); await p.click('#setSide [data-v="right"]'); await p.keyboard.press('Escape');

  // ── compare ──
  await p.setInputFiles('#fileInput', sample('rgb')); await p.waitForFunction(() => __app.S.ready, null, { timeout: 60000 });
  await p.click('#tabCompare'); await p.waitForFunction(() => __app.C.a && __app.C.a.ready, null, { timeout: 60000 });
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/14_compare_one.png' });
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cmpEmpty [data-cmp-open="b"]')]); await fc.setFiles(saved);
  await p.waitForFunction(() => __app.C.b && __app.C.b.ready && __app.C.pairs.length, null, { timeout: 60000 });
  await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/15_compare_side.png' });
  const statuses = async () => p.$$eval('#cmpPairs .st', e => e.map(x => x.textContent));
  const all = await statuses();
  assert(all.includes('Removed') && all.includes('Changed'), 'finds removed + changed layers: ' + all.join(', '));
  await p.click('#cmpFilter [data-f="changed"]'); assert((await statuses()).every(s => s === 'Changed') && (await statuses()).length >= 1, '“Changed” filter shows only changed layers');
  await p.click('#cmpFilter [data-f="removed"]'); assert((await statuses()).join() === 'Removed', '“Removed” filter');
  await p.click('#cmpFilter [data-f="all"]');
  await p.selectOption('#cmpSort', 'name'); const byName = await p.$$eval('#cmpPairs .pn b', e => e.map(x => x.textContent));
  assert(byName.join() === [...byName].sort((a, b) => a.localeCompare(b)).join(), 'sort by name: ' + byName.join(', '));
  await p.check('#cmpGroup'); assert((await p.$$('#cmpPairs .grp-h')).length >= 2, 'group by type adds section headers');
  await p.screenshot({ path: OUT + '/16_compare_grouped.png' });
  for (const [i, v] of ['swipe', 'onion', 'diff'].entries()) { await p.click(`[data-cv="${v}"]`); await p.waitForTimeout(500); await p.screenshot({ path: OUT + `/${17 + i}_compare_${v}.png` }); }
  await p.click('#diffColors [data-c="cyan"]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/20_compare_diff_cyan.png' });
  await p.click('#diffColors [data-c="heat"]'); await p.waitForTimeout(300);
  await p.click('#cmpPairs li:not(.grp-h) button'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + '/21_compare_layer.png' });
  assert(await p.isVisible('#cmpWhole'), '“Show the whole artwork” appears for a layer pair');
  await p.click('#cmpFilesBtn'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/22_compare_files.png' });
  await p.click('#cpFiles [data-cmp-remove="b"]'); await p.waitForTimeout(200);
  assert(await p.evaluate(() => !__app.C.b), 'Remove takes B out of the comparison');

  // long compare list keeps its scroll position
  await p.click('#cmpClear'); await p.waitForTimeout(100);
  const [f1] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cmpEmpty [data-cmp-open="a"]')]); await f1.setFiles('/tmp/many.procreate');
  const [f2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cmpEmpty [data-cmp-open="b"]')]); await f2.setFiles('/tmp/many.procreate');
  await p.waitForFunction(() => __app.C.a && __app.C.b && __app.C.a.ready && __app.C.b.ready && __app.C.pairs.length > 50, null, { timeout: 60000 });
  await p.click('[data-cpanel="layers"]'); await p.uncheck('#cmpGroup'); await p.selectOption('#cmpSort', 'stack');
  await p.evaluate(() => document.getElementById('cpLayers').scrollTop = 1200); await p.waitForTimeout(100);
  const cb = await p.evaluate(() => document.getElementById('cpLayers').scrollTop);
  const pb = await p.evaluateHandle(() => { const w = document.getElementById('cpLayers').getBoundingClientRect(); return [...document.querySelectorAll('#cmpPairs button')].find(r => { const b = r.getBoundingClientRect(); return b.top > w.top + 60 && b.bottom < w.bottom - 20; }); });
  await pb.asElement().click(); await p.waitForTimeout(500);
  assert(Math.abs(await p.evaluate(() => document.getElementById('cpLayers').scrollTop) - cb) < 2, 'picking a layer pair keeps the list where it is');

  // light mode + footer
  await p.click('#tabView'); await p.click('#btnSettings'); await p.click('#setMode [data-v="light"]'); await p.click('#setTheme [data-v="meadow"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: OUT + '/23_light_meadow.png' });
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/24_footer.png' });

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '✓ no page errors');
  await b.close(); if (errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
