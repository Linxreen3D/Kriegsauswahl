// Erzeugt public/map.json aus Natural-Earth-Daten (world-atlas).
// - projiziert die Welt (Natural Earth 1), vereinfacht Grenzen topologieerhaltend
// - teilt große Länder per Voronoi in benannte Regionen auf
// - berechnet Land- und Seeverbindungen
// Aufruf: npm run build:map
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoNaturalEarth1 } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import countries from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
countries.registerLocale(require('i18n-iso-countries/langs/de.json'));
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)));

const WIDTH = 2000;
const SIMPLIFY = 0.55; // px Toleranz
const MIN_ISLAND_AREA = 2.5; // px² – kleinere Inseln fallen weg (außer Hauptteil)
const SEA_DIST = 16; // px – maximale Distanz für Seeverbindungen

// ---------- Ausschlüsse & Namen ----------
const EXCLUDE_IDS = new Set(['336', '674', '492', '438', '020', '010', '334', '260', '239', '446', '832', '831', '833', '248',
  '663', '652', '534', '660', '500', '092', '850', '086', '612', '654', '570', '876', '666', '574', '016', '580', '316', '136',
  '533', '531', '796', '060', '184']);
const EXCLUDE_NAMES = new Set(['Siachen Glacier', 'Indian Ocean Ter.', 'Ashmore and Cartier Is.']);
const NAME_OVERRIDE = {
  '840': 'USA', '643': 'Russland', '834': 'Tansania', '760': 'Syrien', '203': 'Tschechien', '180': 'DR Kongo',
  '826': 'Großbritannien', '784': 'VAE', '096': 'Brunei', '140': 'Zentralafrika', '214': 'Dominikan. Rep.',
  '070': 'Bosnien', '275': 'Palästina', '410': 'Südkorea', '408': 'Nordkorea', '498': 'Moldau', '807': 'Nordmazedonien',
  '583': 'Mikronesien', '226': 'Äquatorialguinea', '624': 'Guinea-Bissau', '678': 'São Tomé', '670': 'St. Vincent',
  '659': 'St. Kitts', '028': 'Antigua', '780': 'Trinidad', '540': 'Neukaledonien', '258': 'Franz.-Polynesien',
  '238': 'Falklandinseln', '732': 'Westsahara',
};
const NAME_EN = { 'Somaliland': 'Somaliland', 'Kosovo': 'Kosovo', 'N. Cyprus': 'Nordzypern' };

// ---------- Aufteilung großer Länder (lon, lat, Name) ----------
const SPLITS = {
  '643': [[38, 55, 'Moskau'], [40, 64.5, 'Nordwestrussland'], [42, 46.5, 'Südrussland'], [50, 54.5, 'Wolga'], [61, 60, 'Ural'],
    [76, 62, 'Westsibirien'], [96, 64, 'Mittelsibirien'], [122, 64, 'Jakutien'], [134, 49, 'Fernost'], [162, 64, 'Tschukotka'],
    [88, 53, 'Altai'], [110, 54, 'Baikal']],
  '124': [[-124, 54, 'British Columbia'], [-112, 54, 'Alberta'], [-100, 54, 'Prärien'], [-86, 50, 'Ontario'], [-72, 52, 'Québec'],
    [-62, 48, 'Atlantik-Kanada'], [-120, 65, 'Nordwest-Territorien'], [-92, 67, 'Nunavut'], [-95, 77, 'Arktische Inseln'],
    [-136, 64, 'Yukon'], [-62, 55, 'Labrador']],
  '840': [[-151, 63, 'Alaska'], [-120, 37.5, 'Kalifornien'], [-120, 45.5, 'Pazifik-Nordwest'], [-111, 34, 'Arizona'],
    [-107, 43, 'Rocky Mountains'], [-99, 31, 'Texas'], [-97, 41, 'Great Plains'], [-89, 42, 'Mittlerer Westen'],
    [-84, 43.5, 'Große Seen'], [-85, 33.5, 'Südstaaten'], [-81.5, 28, 'Florida'], [-71.5, 43.5, 'Neuengland'],
    [-77, 39, 'Mittelatlantik'], [-157, 20, 'Hawaii'], [-92, 32, 'Mississippi']],
  '156': [[116, 39, 'Nordchina'], [126, 45, 'Mandschurei'], [119, 31, 'Ostchina'], [112, 24, 'Südchina'], [104, 29, 'Sichuan'],
    [88, 32, 'Tibet'], [84, 42, 'Xinjiang'], [111, 42, 'Innere Mongolei'], [98, 37, 'Qinghai'], [112, 32, 'Zentralchina'],
    [102, 24, 'Yunnan']],
  '076': [[-64, -5, 'Amazonas'], [-50, -4, 'Pará'], [-40, -8, 'Nordostbrasilien'], [-53, -14, 'Mato Grosso'],
    [-45, -20, 'Südostbrasilien'], [-51, -28, 'Südbrasilien']],
  '036': [[121, -26, 'Westaustralien'], [133, -18, 'Nordterritorium'], [145, -21, 'Queensland'], [148, -32, 'Neusüdwales'],
    [135, -30, 'Südaustralien'], [144, -37.5, 'Victoria'], [146.5, -42, 'Tasmanien']],
  '356': [[78, 28, 'Nordindien'], [73, 21, 'Westindien'], [78, 13, 'Südindien'], [86, 22, 'Ostindien'], [93, 26, 'Nordostindien'],
    [79, 21, 'Zentralindien']],
  '398': [[55, 48, 'Westkasachstan'], [74, 47, 'Ostkasachstan'], [67, 51, 'Nordkasachstan']],
  '032': [[-63, -26, 'Nordargentinien'], [-61, -35, 'Pampa'], [-68, -45, 'Patagonien']],
  '360': [[101, 0, 'Sumatra'], [110, -7, 'Java'], [114, 0, 'Kalimantan'], [121, -2, 'Sulawesi'], [137, -4, 'Westpapua'],
    [121, -9, 'Kleine Sundainseln']],
  '484': [[-106, 28, 'Nordmexiko'], [-100, 21, 'Zentralmexiko'], [-90, 18.5, 'Yucatán']],
  '012': [[3, 35, 'Nordalgerien'], [3, 26, 'Sahara (Algerien)']],
  '682': [[45, 26, 'Nadschd'], [40, 21, 'Hedschas'], [50, 22, 'Ostprovinz']],
  '304': [[-45, 65, 'Südgrönland'], [-40, 77, 'Nordgrönland']],
  '180': [[22, 0, 'Nordkongo'], [25, -7, 'Südkongo']],
  '364': [[50, 35, 'Westiran'], [59, 32, 'Ostiran']],
  '434': [[16, 30, 'Tripolitanien'], [22, 28, 'Kyrenaika']],
  '729': [[30, 17, 'Nordsudan'], [28, 12, 'Darfur']],
  '152': [[-70, -25, 'Nordchile'], [-72, -45, 'Südchile']],
  '578': [[9, 61, 'Südnorwegen'], [18, 69, 'Nordnorwegen']],
  '752': [[15, 58, 'Südschweden'], [18, 66, 'Nordschweden']],
  '392': [[139, 37, 'Honshū'], [142.5, 43.5, 'Hokkaidō'], [131, 32.5, 'Kyūshū']],
  '554': [[174, -38, 'Nordinsel'], [170, -44, 'Südinsel']],
  '608': [[121, 16, 'Luzon'], [125, 8, 'Mindanao']],
  '566': [[7, 11, 'Nordnigeria'], [6, 7, 'Südnigeria']],
  '710': [[22, -31, 'Kapprovinz'], [28, -26, 'Transvaal']],
  '231': [[38, 9, 'Westäthiopien'], [43, 7, 'Ogaden']],
  '818': [[30.5, 30, 'Unterägypten'], [30.5, 25, 'Oberägypten']],
  '604': [[-77, -9, 'Nordperu'], [-72, -14, 'Südperu']],
  '024': [[15, -10, 'Nordangola'], [18, -15, 'Südangola']],
  '496': [[95, 47, 'Westmongolei'], [108, 46, 'Ostmongolei']],
  '250': [[2, 47, 'Frankreich'], [-53, 4, 'Französisch-Guayana'], [55.5, -21, 'Réunion']],
  '792': [[30, 39.5, 'Westanatolien'], [39, 39, 'Ostanatolien']],
};

const projection = geoNaturalEarth1().rotate([-11, 0]);
// Skalierung so, dass Breite = WIDTH (ohne Antarktis wird später zugeschnitten)
projection.scale(1).translate([0, 0]);
const left = projection([-180 + 11 + 0.0001, 0])[0];
const right = projection([180 + 11 - 0.0001, 0])[0];
const scale = WIDTH / (right - left);
projection.scale(scale).translate([WIDTH / 2, 0]);

// ---------- TopoJSON dekodieren ----------
const { scale: qs, translate: qt } = topo.transform;
const arcsGeo = topo.arcs.map(arc => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * qs[0] + qt[0], y * qs[1] + qt[1]]; });
});

// Arcs projizieren und vereinfachen (gemeinsame Arcs => Topologie bleibt erhalten)
function dp(points, tol) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len; t = Math.max(0, Math.min(1, t));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const arcsProj = arcsGeo.map(arc => {
  const p = arc.map(c => projection(c));
  // geschlossene Arcs (Inseln): in zwei Hälften vereinfachen
  if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) {
    const mid = p.length >> 1;
    return dp(p.slice(0, mid + 1), SIMPLIFY).concat(dp(p.slice(mid), SIMPLIFY).slice(1));
  }
  return dp(p, SIMPLIFY);
});
function ringFromArcs(arcIdx) {
  const out = [];
  for (const a of arcIdx) {
    const pts = a >= 0 ? arcsProj[a] : arcsProj[~a].slice().reverse();
    for (let i = out.length ? 1 : 0; i < pts.length; i++) out.push(pts[i]);
  }
  return out;
}
const ringArea = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return s / 2; };
const polyArea = poly => Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);

// ---------- Länder sammeln ----------
const regions = [];
let minY = Infinity, maxY = -Infinity;
for (const g of topo.objects.countries.geometries) {
  const nameEn = g.properties.name;
  if (EXCLUDE_NAMES.has(nameEn) || (g.id && EXCLUDE_IDS.has(g.id))) continue;
  const polysArcs = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  let polys = polysArcs.map(p => p.map(ringFromArcs)).filter(p => p[0].length >= 4);
  // Polygone, die über die Schnittkante laufen, verwerfen
  polys = polys.filter(p => { const xs = p[0].map(c => c[0]); return Math.max(...xs) - Math.min(...xs) < WIDTH * 0.6; });
  if (!polys.length) continue;
  polys.sort((a, b) => polyArea(b) - polyArea(a));
  polys = polys.filter((p, i) => i === 0 || polyArea(p) >= MIN_ISLAND_AREA);
  let name = g.id ? (NAME_OVERRIDE[g.id] || countries.getName(countries.numericToAlpha2(g.id) || '', 'de', { select: 'alias' }) || countries.getName(countries.numericToAlpha2(g.id) || '', 'de')) : NAME_EN[nameEn];
  name = name || nameEn;
  const country = { cid: g.id || nameEn, name, polys };
  const split = SPLITS[g.id];
  if (split && split.length > 1) {
    for (const r of splitCountry(country, split)) regions.push(r);
  } else {
    regions.push({ name, country: name, polys });
  }
}

function splitCountry(country, seeds) {
  const pts = seeds.map(([lon, lat]) => projection([lon, lat]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of country.polys) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const vor = Delaunay.from(pts).voronoi([x0 - 5, y0 - 5, x1 + 5, y1 + 5]);
  const out = [];
  seeds.forEach((s, i) => {
    const cell = vor.cellPolygon(i);
    if (!cell) return;
    let res;
    try { res = polygonClipping.intersection(country.polys, [cell]); } catch (e) { console.warn('clip fail', s[2], e.message); return; }
    if (!res.length) { console.warn('leer:', s[2]); return; }
    res = res.map(p => p.map(r => r.slice(0, -1).map(([x, y]) => [x, y]))).filter(p => p[0].length >= 3);
    res.sort((a, b) => polyArea(b) - polyArea(a));
    res = res.filter((p, k) => k === 0 || polyArea(p) >= MIN_ISLAND_AREA);
    out.push({ name: s[2], country: country.name, polys: res });
  });
  return out;
}

// ---------- Geometrie-Hilfen ----------
for (const r of regions) {
  // Ringe nicht doppelt schließen
  r.polys = r.polys.map(p => p.map(ring => {
    const a = ring[0], b = ring[ring.length - 1];
    return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring;
  }));
  r.area = r.polys.reduce((s, p) => s + polyArea(p), 0);
  for (const p of r.polys) for (const [, y] of p[0]) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
}
const HEIGHT_OFFSET = minY - 10;
const HEIGHT = Math.ceil(maxY - HEIGHT_OFFSET + 10);
for (const r of regions) r.polys = r.polys.map(p => p.map(ring => ring.map(([x, y]) => [x, y - HEIGHT_OFFSET])));

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}
function poleOfInaccessibility(poly) {
  const ring = poly[0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const inside = (x, y) => pointInRing(x, y, ring) && !poly.slice(1).some(h => pointInRing(x, y, h));
  const dist = (x, y) => { let m = Infinity; for (const r of poly) for (let i = 0, j = r.length - 1; i < r.length; j = i++) m = Math.min(m, segDist2(x, y, r[j][0], r[j][1], r[i][0], r[i][1])); return Math.sqrt(m); };
  let best = [(x0 + x1) / 2, (y0 + y1) / 2], bestD = -1;
  let cx = best[0], cy = best[1], w = x1 - x0, h = y1 - y0;
  for (let iter = 0; iter < 4; iter++) {
    const N = 16;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = cx - w / 2 + (w * i) / N, y = cy - h / 2 + (h * j) / N;
      if (!inside(x, y)) continue;
      const d = dist(x, y);
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    cx = best[0]; cy = best[1]; w /= 3; h /= 3;
  }
  if (bestD < 0) { // Fallback: Schwerpunkt der Eckpunkte
    best = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; bestD = 1;
  }
  return { x: best[0], y: best[1], r: bestD };
}
for (const r of regions) {
  const lp = poleOfInaccessibility(r.polys[0]);
  r.cx = lp.x; r.cy = lp.y; r.labelR = lp.r;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r.polys) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  r.bbox = [x0, y0, x1, y1];
}

// ---------- Nachbarschaften ----------
// Landgrenzen: Regionen, deren Kanten sehr dicht beieinander liegen (geteilte Grenzlinien)
function samplePoints(r, step) {
  const out = [];
  for (const p of r.polys) for (const ring of p) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
const CELL = 4;
const grid = new Map();
regions.forEach((r, idx) => {
  r.samples = samplePoints(r, 1);
  for (const [x, y] of r.samples) {
    const k = ((x / CELL) | 0) + ',' + ((y / CELL) | 0);
    let arr = grid.get(k); if (!arr) grid.set(k, arr = []);
    arr.push(idx, x, y);
  }
});
const landCount = new Map();
regions.forEach((r, idx) => {
  for (const [x, y] of r.samples) {
    const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
    const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get((gx + dx) + ',' + (gy + dy)); if (!arr) continue;
      for (let i = 0; i < arr.length; i += 3) {
        const o = arr[i]; if (o === idx || seen.has(o)) continue;
        if ((arr[i + 1] - x) ** 2 + (arr[i + 2] - y) ** 2 < 0.8 * 0.8) {
          seen.add(o);
          const key = idx < o ? idx + ':' + o : o + ':' + idx;
          landCount.set(key, (landCount.get(key) || 0) + 1);
        }
      }
    }
  }
});
const adj = regions.map(() => new Map()); // idx -> type (1 Land, 2 See)
for (const [key, n] of landCount) {
  if (n < 6) continue; // mind. ~3px gemeinsame Grenze (beide Richtungen gezählt)
  const [a, b] = key.split(':').map(Number);
  adj[a].set(b, 1); adj[b].set(a, 1);
}

// Seewege
function minDist(a, b) {
  const [ax0, ay0, ax1, ay1] = a.bbox, [bx0, by0, bx1, by1] = b.bbox;
  const gapX = Math.max(0, bx0 - ax1, ax0 - bx1), gapY = Math.max(0, by0 - ay1, ay0 - by1);
  if (Math.hypot(gapX, gapY) > SEA_DIST * 3) return Infinity;
  let m = Infinity, pa = null, pb = null;
  const sa = a.coarse, sb = b.coarse;
  for (const [x, y] of sa) for (const [u, v] of sb) { const d = (x - u) ** 2 + (y - v) ** 2; if (d < m) { m = d; pa = [x, y]; pb = [u, v]; } }
  return { d: Math.sqrt(m), pa, pb };
}
// Liegt der Weg zwischen zwei Punkten über Land einer dritten Region?
function crossesLand(pa, pb, skipA, skipB) {
  for (let k = 1; k < 10; k++) {
    const x = pa[0] + ((pb[0] - pa[0]) * k) / 10, y = pa[1] + ((pb[1] - pa[1]) * k) / 10;
    for (let i = 0; i < regions.length; i++) {
      if (i === skipA || i === skipB) continue;
      const bb = regions[i].bbox;
      if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
      for (const poly of regions[i].polys) if (pointInRing(x, y, poly[0])) return true;
    }
  }
  return false;
}
for (const r of regions) r.coarse = samplePoints(r, 3);
const dists = [];
for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
  if (adj[i].has(j)) continue;
  const res = minDist(regions[i], regions[j]);
  if (res === Infinity || res.d > SEA_DIST * 3) continue;
  if (crossesLand(res.pa, res.pb, i, j)) continue;
  dists.push([res.d, i, j]);
}
for (const [d, i, j] of dists) if (d <= SEA_DIST) { adj[i].set(j, 2); adj[j].set(i, 2); }
// Jede Region braucht mind. 2 Verbindungen (abgelegene Inseln)
dists.sort((a, b) => a[0] - b[0]);
for (let i = 0; i < regions.length; i++) {
  if (adj[i].size >= 2) continue;
  const cand = dists.filter(([, a, b]) => (a === i || b === i)).slice(0, 2 - adj[i].size + (adj[i].size ? 1 : 0));
  for (const [, a, b] of cand) { const o = a === i ? b : a; if (!adj[i].has(o)) { adj[i].set(o, 2); adj[o].set(i, 2); } if (adj[i].size >= 2) break; }
}
// manuelle Verbindungen (inkl. Datumsgrenze)
const byName = n => { const i = regions.findIndex(r => r.name === n); if (i < 0) throw new Error('Region fehlt: ' + n); return i; };
const MANUAL = [['Alaska', 'Tschukotka', 3], ['Hawaii', 'Kalifornien', 2], ['Neuseeland', 'Neusüdwales', 2], ['Nordinsel', 'Neusüdwales', 2],
  ['Island', 'Großbritannien', 2], ['Island', 'Südgrönland', 2], ['Brasilien', 'Senegal', 2], ['Nordostbrasilien', 'Senegal', 2],
  ['Kap Verde', 'Senegal', 2]];
for (const [a, b, t] of MANUAL) {
  let i, j; try { i = byName(a); j = byName(b); } catch { continue; }
  adj[i].set(j, t); adj[j].set(i, t);
}
// Zusammenhang sicherstellen
function components() {
  const comp = new Array(regions.length).fill(-1); let c = 0;
  for (let s = 0; s < regions.length; s++) {
    if (comp[s] >= 0) continue;
    const st = [s]; comp[s] = c;
    while (st.length) { const v = st.pop(); for (const o of adj[v].keys()) if (comp[o] < 0) { comp[o] = c; st.push(o); } }
    c++;
  }
  return { comp, c };
}
for (let guard = 0; guard < 200; guard++) {
  const { comp, c } = components();
  if (c === 1) break;
  // kleinste Komponente mit nächstgelegener anderer verbinden (Labelpunkt-Distanz)
  const sizes = new Array(c).fill(0); comp.forEach(x => sizes[x]++);
  const small = sizes.indexOf(Math.min(...sizes));
  let best = null;
  for (let i = 0; i < regions.length; i++) if (comp[i] === small) for (let j = 0; j < regions.length; j++) if (comp[j] !== small) {
    const d = Math.hypot(regions[i].cx - regions[j].cx, regions[i].cy - regions[j].cy);
    if (!best || d < best[0]) best = [d, i, j];
  }
  adj[best[1]].set(best[2], 2); adj[best[2]].set(best[1], 2);
  console.log('verbinde', regions[best[1]].name, '<->', regions[best[2]].name);
}

// ---------- Wert der Region ----------
// Basierend auf Fläche (Wurzel), gedeckelt, kleine Länder bekommen Mindestwert
for (const r of regions) {
  const v = 1 + Math.sqrt(r.area) / 20;
  r.value = Math.round(Math.min(5, Math.max(1, v)) * 10) / 10;
}

// ---------- Ausgabe ----------
const round = v => Math.round(v * 10) / 10;
const out = {
  width: WIDTH, height: HEIGHT,
  regions: regions.map((r, i) => ({
    id: i, name: r.name, country: r.country, value: r.value,
    cx: round(r.cx), cy: round(r.cy), lr: round(r.labelR), area: Math.round(r.area),
    bbox: r.bbox.map(round),
    polys: r.polys.map(p => p.map(ring => ring.flatMap(([x, y]) => [round(x), round(y)]))),
    adj: [...adj[i].entries()].map(([o, t]) => [o, t]),
  })),
};
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/map.json', import.meta.url), JSON.stringify(out));
const verts = out.regions.reduce((s, r) => s + r.polys.reduce((t, p) => t + p.reduce((u, ring) => u + ring.length / 2, 0), 0), 0);
console.log(`Regionen: ${out.regions.length}, Vertices: ${verts}, Größe: ${(JSON.stringify(out).length / 1024).toFixed(0)} KB, Höhe: ${HEIGHT}`);
const lonely = out.regions.filter(r => r.adj.length < 2).map(r => r.name);
if (lonely.length) console.log('wenig Verbindungen:', lonely.join(', '));
