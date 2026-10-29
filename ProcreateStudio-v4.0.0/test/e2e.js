const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const S = process.argv[2]; const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto(url); await p.screenshot({ path: S + '/s0_empty.png' });
  let t0 = Date.now();
  await p.setInputFiles('#fileInput', path.resolve(__dirname, '../../samples/reference.procreate'));
  await p.waitForFunction(() => window.__ps.S.ready, null, { timeout: 60000 }); await p.waitForFunction(() => document.getElementById('busy').hidden);
  console.log('open+decode+render', Date.now() - t0, 'ms; worker?', await p.evaluate(() => 'ok'));
  const info = await p.evaluate(() => ({ rows: document.querySelectorAll('.row').length, groups: document.querySelectorAll('.grow').length, thumbs: document.querySelectorAll('.thumb canvas').length, status: document.getElementById('status').innerText, cw: canvas.width, ch: canvas.height }));
  console.log(JSON.stringify(info));
  // canvas content vs Procreate's stored render
  const px = () => p.evaluate(() => { const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let s = 0, a = 0; for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i + 1] + d[i + 2]; a += d[i + 3]; } return [Math.round(s / (d.length / 4)), Math.round(a / (d.length / 4))]; });
  console.log('composite mean rgb,alpha', await px());
  await p.screenshot({ path: S + '/s1_composite.png' });
  // toggle visibility of top layer → status must change
  const st1 = await p.locator('#status').innerText(); await p.locator('.row .eye').first().click(); await p.waitForTimeout(400);
  const st2 = await p.locator('#status').innerText(); console.log('status before/after hide:', st1.split('\n')[0], '→', st2.split('\n')[0]);
  await p.locator('.row .eye').first().click();
  // single layer browse: layers must differ from each other
  await p.keyboard.press('2'); await p.waitForTimeout(500); const a1 = await px(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500); const a2 = await px();
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500); const a3 = await px();
  console.log('single layers differ:', JSON.stringify([a1, a2, a3]), await p.locator('#viewLabel').innerText());
  await p.screenshot({ path: S + '/s2_single.png' });
  // range selection
  await p.fill('#rangeInput', '1-5, 7'); await p.press('#rangeInput', 'Enter'); await p.waitForTimeout(600);
  console.log('range:', await p.locator('#rangeMsg').innerText(), '| status', (await p.locator('#status').innerText()).replace(/\n/g, ' '));
  await p.fill('#rangeInput', '1-99'); await p.press('#rangeInput', 'Enter'); console.log('bad range msg:', await p.locator('#rangeMsg').innerText());
  await p.screenshot({ path: S + '/s3_selected.png' });
  // palette
  await p.locator('#rangeInput').blur(); await p.keyboard.press('1'); await p.waitForTimeout(1200);
  console.log('palette swatches', await p.locator('#swatches li button').count(), await p.locator('#paletteSource').innerText());
  // exports
  const dl = async (fn) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), fn()]); const f = S + '/dl_' + d.suggestedFilename(); await d.saveAs(f); return f; };
  console.log('png:', await dl(() => p.click('#btnExport')));
  await p.click('[data-fmt="tiff"]'); console.log('tiff:', await dl(() => p.click('#btnExport')));
  await p.click('[data-fmt="jpg"]'); await p.check('input[value="every"]'); console.log('every jpg zip:', await dl(() => p.click('#btnExport')));
  console.log('swatches:', await dl(() => p.click('[data-pal="swatches"]')), 'ase:', await dl(() => p.click('[data-pal="ase"]')));
  // original + light mode screenshot
  await p.keyboard.press('4'); await p.waitForTimeout(600); console.log('original mean', await px());
  await p.click('#btnSettings'); await p.click('#setMode [data-v="light"]'); await p.click('#setTheme [data-v="ember"]'); await p.screenshot({ path: S + '/s4_settings.png' });
  await p.keyboard.press('Escape'); await p.keyboard.press('1'); await p.waitForTimeout(800); await p.screenshot({ path: S + '/s5_light.png' });
  // mask file
  await p.setInputFiles('#fileInput', path.resolve(__dirname, '../../samples/Mask_Test_File.procreate'));
  await p.waitForFunction(() => window.__ps.S.ready && document.getElementById('busy').hidden, null, { timeout: 30000 }); await p.waitForTimeout(600);
  await p.screenshot({ path: S + '/s6_mask.png' });
  // narrow viewport
  await p.setViewportSize({ width: 820, height: 1100 }); await p.waitForTimeout(500); await p.screenshot({ path: S + '/s7_narrow.png', fullPage: true });
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
