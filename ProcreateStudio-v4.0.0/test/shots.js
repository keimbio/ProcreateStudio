const { chromium } = require('playwright'); const path = require('path');
const S = process.argv[2], f = process.argv[3] || 'reference', W = +(process.argv[4] || 1600), H = +(process.argv[5] || 1000);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await p.setInputFiles('#fileInput', path.resolve(__dirname, `../../samples/${f}.procreate`));
  await p.waitForFunction(() => window.__ps.S.ready && document.getElementById('busy').hidden, null, { timeout: 60000 }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${S}/v_${f}_${W}.png` });
  for (const a of (process.argv[6] || '').split(',').filter(Boolean)) { await p.evaluate(a); await p.waitForTimeout(900); }
  if (process.argv[6]) await p.screenshot({ path: `${S}/v_${f}_${W}_b.png` });
  console.log('errors', errs); await b.close();
})();
