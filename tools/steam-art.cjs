// Erzeugt Entwürfe der Steam-Grafiken nach build/steam/ (Kapseln, Bibliothek, Errungenschaften).
// Aufruf: node tools/steam-art.cjs   (benötigt Playwright: npx playwright install chromium, falls nicht vorhanden)
// Die Entwürfe sind typografisch und können später durch gemalte Motive ersetzt werden.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'build', 'steam');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const icons = await import(path.join(ROOT, 'public/js/icons.js'));
  const rules = await import(path.join(ROOT, 'shared/rules.js'));
  const fontUrl = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'public/fonts', f)).toString('base64');
  const svg = (n, color) => icons.icon(n).replace('<svg ', `<svg style="color:${color}" `);
  const scene = fs.existsSync(path.join(OUT, 'scene.png')) ? 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'scene.png')).toString('base64') : '';
  const base = `<style>
    @font-face { font-family: Oswald; font-weight: 600; src: url(${fontUrl('oswald-latin-600-normal.woff2')}); }
    @font-face { font-family: Oswald; font-weight: 500; src: url(${fontUrl('oswald-latin-500-normal.woff2')}); }
    @font-face { font-family: Plex; src: url(${fontUrl('ibm-plex-sans-condensed-latin-500-normal.woff2')}); }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    .bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 70% 40%, #23262a, #0d0e0f 75%); }
    .topo { position: absolute; inset: 0; opacity: .14; }
    .scene { position: absolute; inset: 0; background: url(${scene}) center/cover; filter: grayscale(.35) brightness(.55) contrast(1.1); }
    .fade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(13,14,15,.95) 0%, rgba(13,14,15,.6) 55%, rgba(13,14,15,.2)); }
    .wrap { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 7%; color: #e6e1d4; }
    .title { font-family: Oswald; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; line-height: .95; }
    .bar { width: 14%; height: 1.2%; min-height: 3px; background: #c9a55c; margin: 3% 0; }
    .tag { font-family: Plex; color: #b9b3a6; }
    .eras { display: flex; gap: 3%; align-items: center; color: #c9a55c; }
    .eras svg { width: 100%; height: 100%; }
    .eras .e { flex: 1; aspect-ratio: 1; opacity: .85; }
    .arrow { color: #6c685f; font-family: Oswald; }
  </style>`;
  const topo = w => { let p = ''; for (let i = 0; i < 26; i++) { const y = i * 40; p += `<path d="M0 ${y} C ${w * .25} ${y - 30 + (i % 3) * 20}, ${w * .5} ${y + 40}, ${w} ${y - 10}" fill="none" stroke="#c9a55c" stroke-width="1.2"/>`; } return `<svg class="topo" viewBox="0 0 ${w} 1000" preserveAspectRatio="none">${p}</svg>`; };
  const eraRow = (n = 6) => ['spear', 'sword', 'musket', 'cannon', 'tank', 'fighter'].slice(0, n).map(k => `<div class="e">${svg(k, '#c9a55c')}</div>`).join('');
  // Kapseln: [Datei, Breite, Höhe, Layout]
  const CAPS = [
    ['header_capsule_920x430', 920, 430, 'wide'], ['small_capsule_462x174', 462, 174, 'small'], ['main_capsule_1232x706', 1232, 706, 'wide'],
    ['vertical_capsule_748x896', 748, 896, 'tall'], ['library_capsule_600x900', 600, 900, 'tall'], ['library_hero_3840x1240', 3840, 1240, 'hero'],
    ['page_background_1438x810', 1438, 810, 'bgonly'],
  ];
  const b = await chromium.launch();
  for (const [file, w, h, lay] of CAPS) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const fs1 = Math.round(h * (lay === 'tall' ? 0.11 : lay === 'small' ? 0.3 : lay === 'hero' ? 0.16 : 0.2) * (lay === 'tall' ? w / h * 1.2 : 1));
    let inner = '';
    if (lay === 'wide') inner = `<div class="wrap"><div class="title" style="font-size:${fs1}px">Frontlinien</div><div class="bar"></div><div class="tag" style="font-size:${Math.round(h * 0.055)}px">Von der Steinzeit bis zum Kalten Krieg</div><div class="eras" style="width:48%;margin-top:5%">${eraRow()}</div></div>`;
    if (lay === 'small') inner = `<div class="wrap"><div class="title" style="font-size:${fs1}px">Frontlinien</div><div class="eras" style="width:52%;margin-top:4%">${eraRow()}</div></div>`;
    if (lay === 'tall') inner = `<div class="wrap" style="justify-content:flex-end;padding-bottom:14%"><div class="eras" style="flex-direction:column;width:18%;gap:6px;position:absolute;right:9%;top:8%">${eraRow()}</div><div class="title" style="font-size:${fs1}px">Front<br>linien</div><div class="bar"></div><div class="tag" style="font-size:${Math.round(w * 0.045)}px">Echtzeitstrategie<br>Steinzeit bis Kalter Krieg</div></div>`;
    if (lay === 'hero') inner = `<div class="scene"></div><div class="fade"></div>`;
    if (lay === 'bgonly') inner = `<div class="scene" style="opacity:.5"></div>`;
    await p.setContent(`<html><head>${base}</head><body><div class="bg"></div>${topo(w)}${inner}</body></html>`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, file + '.png') });
    await p.close();
  }
  // Bibliothekslogo (transparent)
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.setContent(`<html><head>${base}</head><body style="background:transparent"><div class="wrap" style="align-items:center"><div class="title" style="font-size:190px">Frontlinien</div><div class="bar" style="width:18%"></div></div></body></html>`);
    await p.screenshot({ path: path.join(OUT, 'library_logo_1280x720.png'), omitBackground: true }); await p.close();
  }
  // Errungenschaften: 256×256 freigeschaltet (Messing) und gesperrt (grau)
  const ACH_ICON = { FIRST_WIN: 'crown', WIN_HARD: 'medal', ERA_MEDIEVAL: 'town', ERA_INDUSTRY: 'workshop', ERA_COLD_WAR: 'tank', LEADER: 'scale', FREIGHT: 'train', LANDING: 'transport', VETERAN: 'star', PEACE: 'dove', MEDIATOR: 'handshake', WONDER: 'wonder', INTERCEPT: 'abm', CELO: 'celo' };
  fs.mkdirSync(path.join(OUT, 'achievements'), { recursive: true });
  for (const id of Object.keys(rules.ACHIEVEMENTS)) for (const [suffix, fg, ring, bg] of [['', '#e6e1d4', '#c9a55c', '#1c1d1f'], ['_locked', '#55534e', '#3a3a3a', '#141516']]) {
    const p = await b.newPage({ viewport: { width: 256, height: 256 } });
    await p.setContent(`<html><body style="margin:0;background:${bg}"><div style="position:absolute;inset:10px;border:6px solid ${ring};border-radius:8px"></div><div style="position:absolute;inset:52px">${svg(ACH_ICON[id] || 'star', fg).replace('<svg ', '<svg width="152" height="152" ')}</div></body></html>`);
    await p.screenshot({ path: path.join(OUT, 'achievements', id + suffix + '.png') }); await p.close();
  }
  await b.close();
  console.log('Steam-Grafiken erstellt in', OUT);
})();
