// node bake.cjs  -> ../public/assets/figures.json + figures.bin  (Server auf :8099 muss laufen)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.error('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
  await p.goto('http://localhost:8099/v2/bake.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 0 });
  const r = await p.evaluate(() => window.__result);
  fs.writeFileSync('../public/assets/figures.json', r.json); fs.writeFileSync('../public/assets/figures.bin', Buffer.from(r.b64, 'base64'));
  const j = JSON.parse(r.json); console.log('Dauer', j.ms, 'ms;', j.stats.join(' '), '; bin', (Buffer.from(r.b64, 'base64').length / 1024).toFixed(0), 'KB');
  await b.close();
})();
