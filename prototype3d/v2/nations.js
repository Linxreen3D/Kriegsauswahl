// Nationale Architektur (ab Frühem Mittelalter): USA, Russland, Deutschland, China, Österreich-Ungarn, Jugoslawien, Indien.
// nationBuilding(type, era, color, nation) liefert ein Modell oder null (dann gilt der neutrale Stil).
import * as THREE from 'three';
import * as Md from './models.js';
import { E, mats } from './eras.js';
import * as TX from './textures.js';

const { m, put, boxT, cylT, coneT, gableRoof, windowAt, door, banner, col, teamCloth, curvedRoof } = Md;
const M = Md.M;
const G = () => new THREE.Group();
const add = (g, o, ...a) => { g.add(put(o, ...a)); return o; };
const tints = new Map();
function plaster(c) { if (!tints.has(c)) { const t = M.plaster.clone(); t.color = new THREE.Color(c); tints.set(c, t); } return tints.get(c); }
function stoneT(c) { const k = 's' + c; if (!tints.has(k)) { const t = M.stone.clone(); t.color = new THREE.Color(c); tints.set(k, t); } return tints.get(k); }

// ---------- Bausteine ----------
function onion(r, h, mat, tip = true) {
  const pts = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; const rad = t < 0.38 ? r * (0.62 + 0.38 * Math.sin(t / 0.38 * Math.PI / 2)) : r * Math.pow(Math.cos((t - 0.38) / 0.62 * Math.PI / 2), 1.7); pts.push(new THREE.Vector2(Math.max(0.001, rad), t * h)); }
  pts.push(new THREE.Vector2(0.001, h));
  const g = G(); g.add(m(new THREE.LatheGeometry(pts, 20), mat));
  if (tip) { add(g, m(cylT(0.03 * r * 3, 0.03 * r * 3, h * 0.35, 6, 1), E.goldLeaf), 0, h * 1.12, 0); add(g, m(new THREE.SphereGeometry(r * 0.12, 10, 8), E.goldLeaf), 0, h * 1.3, 0); }
  return g;
}
function dome(r, mat) { return m(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); }
function pyramidRoof(w, h, mat) { return m(new THREE.ConeGeometry(w * 0.72, h, 4), mat); }
function columns(g, n, x0, x1, z, h, r = 0.18, mat = E.marble, y = 0) { for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / (n - 1); add(g, m(cylT(r, r * 1.12, h, 12, 1), mat), x, y + h / 2, z); add(g, m(boxT(r * 2.6, 0.15, r * 2.6, 1), mat), x, y + h, z); } }
function pediment(g, w, y, z, mat = E.marble, h = 1.1, d = 0.5) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); add(g, m(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }), mat), 0, y, z - d / 2); }
function crenels(g, w, d, y, mat, size = 0.45, swallow = false) {
  const one = (x, z, ry) => { if (swallow) { const s = new THREE.Shape(); s.moveTo(-size / 2, 0); s.lineTo(size / 2, 0); s.lineTo(size / 2, size * 1.4); s.lineTo(0, size * 0.9); s.lineTo(-size / 2, size * 1.4); add(g, m(new THREE.ExtrudeGeometry(s, { depth: size * 0.5, bevelEnabled: false }), mat), x, y, z, 0, ry); } else add(g, m(boxT(size, size * 1.1, size * 0.8, 1), mat), x, y + size * 0.55, z); };
  for (let x = -w / 2 + size; x <= w / 2 - size / 2; x += size * 2) { one(x, d / 2 - size * 0.25, 0); one(x, -d / 2 + size * 0.25, 0); }
  for (let z = -d / 2 + size * 2; z <= d / 2 - size; z += size * 2) { one(w / 2 - size * 0.25, z, Math.PI / 2); one(-w / 2 + size * 0.25, z, Math.PI / 2); }
}
function archRow(g, n, x0, x1, y, z, w = 0.7, h = 1.4, mat = E.dark) { for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / Math.max(1, n - 1); const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); add(g, m(new THREE.ShapeGeometry(s), mat), x, y, z); } }
function stepGable(g, w, y, z, mat, steps = 5, h = 3) { for (let k = 0; k < steps; k++) { const ww = w * (1 - k / steps); add(g, m(boxT(ww, h / steps, 0.4, 1), mat), 0, y + (k + 0.5) * h / steps, z); } }
function chhatri(r, mat = E.marble, domeMat = E.marble) { const g = G(); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; add(g, m(cylT(r * 0.12, r * 0.12, r * 1.4, 8, 1), mat), Math.cos(a) * r * 0.7, r * 0.7, Math.sin(a) * r * 0.7); } add(g, m(cylT(r * 1.05, r * 1.05, r * 0.15, 16, 1), mat), 0, r * 1.45, 0); g.add(put(onion(r * 0.8, r * 1.1, domeMat), 0, r * 1.5, 0)); return g; }
function minaret(h, r, mat) { const g = G(); add(g, m(cylT(r, r * 1.15, h, 14, 1.5), mat), 0, h / 2, 0); for (const y of [h * 0.4, h * 0.75]) add(g, m(cylT(r * 1.45, r * 1.45, 0.18, 14, 1), mat), 0, y, 0); g.add(put(chhatri(r * 1.1, mat, mat), 0, h, 0)); return g; }
function flagOn(g, color, x, y, z, h = 2) { add(g, banner(color, h, 0.6, 1.0, 0.2), x, y, z); }
function logWall(w, h, mat = E.pole) { const g = G(); for (let y = 0.15; y < h; y += 0.3) add(g, m(cylT(0.15, 0.15, w, 8, 1), mat), 0, y, 0, 0, 0, Math.PI / 2); return g; }

// ---------- USA ----------
const USA = {
  town: [c => { const g = G(); add(g, logWall(6, 2.4), 0, 0, 2.9); add(g, logWall(6, 2.4), 0, 0, -2.9); const s1 = logWall(5.8, 2.4); add(g, s1, 2.9, 0, 0, 0, Math.PI / 2); const s2 = logWall(5.8, 2.4); add(g, s2, -2.9, 0, 0, 0, Math.PI / 2);
    for (const [x, z] of [[-3, -3], [3, 3]]) { const b = G(); add(b, m(boxT(1.8, 2.2, 1.8, 1.5), M.planks), 0, 1.1, 0); add(b, m(boxT(2.3, 1.3, 2.3, 1.5), M.planks), 0, 2.85, 0); add(b, pyramidRoof(2.4, 1.2, E.shingle), 0, 4.1, 0, 0, Math.PI / 4); add(g, b, x, 0, z); }
    add(g, m(boxT(3, 1.8, 2.2, 1.5), M.planks), 0, 0.9, -0.6); const rf = gableRoof(3, 2.2, 1.2, E.shingle, M.planks, 0.3, 0.15); rf.position.set(0, 1.8, -0.6); g.add(rf); flagOn(g, c, 0, 0, 1.6, 4.2); return g; },
  c => { const g = G(); add(g, m(boxT(7, 4, 5, 2), E.brick), 0, 2, 0); for (let k = 0; k < 5; k++) { windowAt(g, -2.6 + k * 1.3, 1.3, 2.55, 0, k % 2 === 0, 0.55, 1.2); windowAt(g, -2.6 + k * 1.3, 3.1, 2.55, 0, false, 0.55, 1.1); } columns(g, 4, -1.5, 1.5, 3.3, 3.6, 0.2, E.marble); pediment(g, 4, 3.75, 3.3); add(g, m(boxT(4, 0.3, 1.2, 1), E.marble), 0, 3.65, 3.2); const rf = gableRoof(7, 5, 1.6, M.roofSlate, E.brick, 0.2); rf.position.y = 4; g.add(rf);
    add(g, m(boxT(1.4, 1.6, 1.4, 1), E.marble), 0, 6.2, 0); add(g, m(new THREE.CircleGeometry(0.45, 18), col('#f4f0e4', 0.4)), 0, 6.3, 0.72); add(g, m(cylT(0.8, 0.8, 0.9, 8, 1), E.marble), 0, 7.4, 0); add(g, dome(0.85, E.marble), 0, 7.85, 0); flagOn(g, c, 0, 8.6, 0, 1.8); return g; }],
  house: [c => { const g = G(); add(g, logWall(3.6, 1.9), 0, 0, 1.3); add(g, logWall(3.6, 1.9), 0, 0, -1.3); add(g, logWall(2.6, 1.9), 1.8, 0, 0, 0, Math.PI / 2); add(g, logWall(2.6, 1.9), -1.8, 0, 0, 0, Math.PI / 2); const rf = gableRoof(3.6, 2.6, 1.3, E.shingle, M.planks, 0.4, 0.15); rf.position.y = 1.95; g.add(rf); add(g, m(boxT(0.6, 2.6, 0.6, 1), M.stone), 1.6, 1.8, 0); door(g, -0.6, 0, 1.45, 0, 0.8, 1.4); windowAt(g, 0.8, 1, 1.45, 0, true, 0.5, 0.5); return g; },
    c => { const g = G(); const wh = plaster('#f2efe6'); add(g, m(boxT(4, 3.6, 3, 2), M.planks), 0, 1.8, 0); add(g, m(boxT(4.02, 3.6, 3.02, 2), wh), 0, 1.8, 0); for (let k = 0; k < 3; k++) { windowAt(g, -1.2 + k * 1.2, 1.1, 1.52, 0, k === 1, 0.5, 0.9); windowAt(g, -1.2 + k * 1.2, 2.8, 1.52, 0, false, 0.5, 0.9); } const rf = gableRoof(4, 3, 1.4, M.roofSlate, wh, 0.25); rf.position.y = 3.6; g.add(rf); add(g, m(boxT(4.4, 0.12, 1.4, 1), M.planks), 0, 0.3, 2.2); add(g, m(boxT(4.4, 0.1, 1.5, 1), M.roofSlate), 0, 1.9, 2.2, 0.15); columns(g, 4, -2, 2, 2.85, 1.6, 0.06, wh, 0.35); door(g, 0, 0.3, 1.52, 0, 0.85, 1.5); return g; }],
  tower: [c => { const g = G(); add(g, m(boxT(2.4, 3, 2.4, 1.5), M.planks), 0, 1.5, 0); add(g, m(boxT(3.1, 2, 3.1, 1.5), M.planks), 0, 4, 0); for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) add(g, m(boxT(0.1, 0.25, 0.35, 1), E.dark), s * 1.56, 4, z); add(g, pyramidRoof(3.4, 1.6, E.shingle), 0, 5.8, 0, 0, Math.PI / 4); flagOn(g, c, 0, 6.6, 0, 1.6); return g; },
    c => { const g = G(); add(g, m(new THREE.CylinderGeometry(2.2, 2.6, 3.4, 8), E.brick), 0, 1.7, 0); crenels(g, 4.2, 4.2, 3.4, E.brick, 0.45); add(g, m(cylT(0.12, 0.16, 1.6, 10, 1), E.iron), 0, 3.9, 0.9, Math.PI / 2 - 0.1); flagOn(g, c, 0, 3.4, -0.8, 3); return g; }],
  wall: [c => { const g = G(); for (let k = 0; k < 7; k++) { add(g, m(cylT(0.15, 0.17, 2.6, 7, 1), E.pole), -0.9 + k * 0.3, 1.3, 0); add(g, m(new THREE.ConeGeometry(0.15, 0.3, 7), E.pole), -0.9 + k * 0.3, 2.75, 0); } add(g, logWall(2, 0.9), 0, 0, 0.6); add(g, logWall(2, 0.9), 0, 0, -0.6); return g; },
    c => { const g = G(); add(g, m(boxT(2, 2.6, 2, 1.5), M.stone), 0, 1.3, 0); add(g, m(boxT(2.05, 0.6, 2.05, 1), E.brick), 0, 2.9, 0); return g; }],
  wonder: c => { const g = G(); // Freiheitsstatue auf Sockel
    const sock = G(); const star = new THREE.Shape(); for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2, r = k % 2 ? 6 : 8; star.lineTo(Math.cos(a) * r, Math.sin(a) * r); } add(sock, m(new THREE.ExtrudeGeometry(star, { depth: 2.2, bevelEnabled: false }), M.stone), 0, 2.2, 0, Math.PI / 2); g.add(sock);
    add(g, m(boxT(6, 5, 6, 2), M.stone), 0, 4.7, 0); add(g, m(boxT(6.6, 0.6, 6.6, 1), M.stoneDark), 0, 7.4, 0); add(g, m(boxT(4.6, 3.6, 4.6, 2), M.stone), 0, 9.5, 0); for (const s of [-1, 1]) { archRow(g, 3, -1.6, 1.6, 8.3, s * 2.32, 0.6, 1.6); }
    const cu = new THREE.MeshStandardMaterial({ color: '#6fb0a0', roughness: 0.5, metalness: 0.4 });
    const st = G(); add(st, m(cylT(1.4, 2.0, 8, 18, 1), cu), 0, 4, 0); add(st, m(new THREE.SphereGeometry(1.4, 16, 12), cu), 0, 8.2, 0, 0, 0, 0, [1, 0.9, 1]); add(st, m(cylT(0.55, 0.65, 1, 12, 1), cu), 0, 9.4, 0); add(st, m(new THREE.SphereGeometry(0.75, 16, 12), cu), 0, 10.4, 0);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI - Math.PI; add(st, m(new THREE.ConeGeometry(0.14, 0.9, 5), cu), Math.cos(a) * 0.6, 11.1 + Math.sin(a + Math.PI) * 0.2, Math.sin(a) * 0.35 + 0.05, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    add(st, m(cylT(0.28, 0.32, 4.6, 10, 1), cu), 1.3, 10.6, 0, 0, 0, -0.18); add(st, m(cylT(0.35, 0.18, 0.9, 10, 1), cu), 1.75, 13.1, 0); add(st, m(new THREE.ConeGeometry(0.42, 1, 10), E.goldLeaf), 1.75, 14, 0); add(st, m(boxT(1.1, 1.4, 0.3, 1), cu), -1.3, 6.2, 0.8, 0, 0, 0.3);
    add(g, st, 0, 11.3, 0); for (const [x, z] of [[-4.8, 4.8], [4.8, 4.8]]) flagOn(g, c, x, 2.2, z, 4); return g; },
};

// ---------- Russland ----------
const domeCols = ['#2f8a5a', '#c8402f', '#2a5aa8', '#e2b12e', '#7a3a8a'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2 }));
function izba(c, w = 3.6, d = 3) { const g = G(); add(g, logWall(w, 2.1, col('#7a5536', 0.9)), 0, 0, d / 2); add(g, logWall(w, 2.1, col('#7a5536', 0.9)), 0, 0, -d / 2); add(g, logWall(d, 2.1, col('#7a5536', 0.9)), w / 2, 0, 0, 0, Math.PI / 2); add(g, logWall(d, 2.1, col('#7a5536', 0.9)), -w / 2, 0, 0, 0, Math.PI / 2); const rf = gableRoof(d, w, 1.9, E.shingle, M.planks, 0.35, 0.15); rf.rotation.y = Math.PI / 2; rf.position.y = 2.15; g.add(rf);
  for (const x of [-0.8, 0.8]) { windowAt(g, x, 1.2, d / 2 + 0.18, 0, x > 0, 0.45, 0.6); add(g, m(boxT(0.75, 0.9, 0.06, 1), col('#e8e0c8', 0.7)), x, 1.25, d / 2 + 0.14); add(g, m(new THREE.ConeGeometry(0.42, 0.3, 3), col('#e8e0c8', 0.7)), x, 1.8, d / 2 + 0.14, 0, 0, 0, [1, 1, 0.15]); }
  add(g, m(new THREE.PlaneGeometry(0.5, 0.35), teamCloth(c)), -1.4, 1.5, d / 2 + 0.2); return g; }
function russChurch(s = 1, white = true) { const g = G(); const wm = white ? plaster('#f4f0e6') : E.brick; add(g, m(boxT(3.4 * s, 4 * s, 3.4 * s, 2), wm), 0, 2 * s, 0); for (const sd of [-1, 1]) archRow(g, 2, -0.8 * s, 0.8 * s, 1.4 * s, sd * 1.71 * s, 0.5 * s, 1.2 * s);
  add(g, m(cylT(0.9 * s, 0.9 * s, 1.6 * s, 16, 1), wm), 0, 4.8 * s, 0); g.add(put(onion(1.1 * s, 2 * s, E.goldLeaf), 0, 5.6 * s, 0));
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { add(g, m(cylT(0.42 * s, 0.42 * s, 1 * s, 12, 1), wm), x * s, 4.5 * s, z * s); g.add(put(onion(0.55 * s, 1.1 * s, domeCols[(x + z + 4) % 5 | 0]), x * s, 5 * s, z * s)); } return g; }
const RUSSIA = {
  town: [c => { const g = G(); const red = E.brick; for (const [x, z, w, d] of [[0, 3, 6.4, 0.6], [0, -3, 6.4, 0.6], [3, 0, 0.6, 6.4], [-3, 0, 0.6, 6.4]]) { add(g, m(boxT(w, 2.2, d, 1.5), red), x, 1.1, z); } crenels(g, 6.4, 6.4, 2.2, red, 0.38, true);
    for (const [x, z] of [[-3.1, -3.1], [3.1, -3.1], [-3.1, 3.1], [3.1, 3.1]]) { add(g, m(boxT(1.2, 3.4, 1.2, 1.5), red), x, 1.7, z); add(g, pyramidRoof(1.4, 1.8, domeCols[0]), x, 4.3, z, 0, Math.PI / 4); add(g, m(new THREE.SphereGeometry(0.12, 8, 6), E.goldLeaf), x, 5.3, z); }
    g.add(put(russChurch(0.75), 0.4, 0, -0.6)); flagOn(g, c, 0, 2.2, 3.3, 2.4); return g; },
  c => { const g = G(); const gr = plaster('#9fd0b8'), wh = plaster('#f4f0e6'); add(g, m(boxT(9, 4.6, 4, 2), gr), 0, 2.3, 0); for (let k = 0; k < 9; k++) { const x = -4 + k; add(g, m(boxT(0.16, 4.6, 0.12, 1), wh), x - 0.5, 2.3, 2.05); if (k < 8) { windowAt(g, x, 1.4, 2.07, 0, k % 3 === 0, 0.45, 1.1); windowAt(g, x, 3.4, 2.07, 0, false, 0.45, 1.0); } } columns(g, 6, -2, 2, 2.6, 4.2, 0.18, wh); pediment(g, 4.8, 4.6, 2.6, wh, 1.2); add(g, m(boxT(9.2, 0.3, 4.2, 1), wh), 0, 4.7, 0); const rf = gableRoof(9, 4, 1, M.roofGreen, gr, 0.15); rf.position.y = 4.8; g.add(rf); add(g, m(cylT(0.9, 0.9, 1.2, 16, 1), gr), 0, 6, 0); add(g, dome(0.95, E.goldLeaf), 0, 6.6, 0); add(g, m(cylT(0.06, 0.06, 1.2, 6, 1), E.goldLeaf), 0, 7.9, 0); flagOn(g, c, 4, 4.8, 0, 2); return g; }],
  house: [c => izba(c), c => { const g = izba(c, 4, 3.2); add(g, m(boxT(4.2, 0.5, 3.4, 1.5), M.stoneDark), 0, 0.05, 0); add(g, m(boxT(0.6, 2.6, 0.6, 1), E.brick), 1.4, 3.2, -0.6); return g; }],
  tower: [c => { const g = G(); add(g, m(boxT(2.4, 6, 2.4, 1.5), E.brick), 0, 3, 0); crenels(g, 2.4, 2.4, 6, E.brick, 0.32, true); add(g, m(boxT(1.6, 1.4, 1.6, 1.5), E.brick), 0, 6.7, 0); add(g, pyramidRoof(1.9, 2.8, domeCols[0]), 0, 8.8, 0, 0, Math.PI / 4); add(g, m(new THREE.SphereGeometry(0.18, 10, 8), E.goldLeaf), 0, 10.3, 0); archRow(g, 1, 0, 0, 0, 1.22, 1, 1.8); return g; },
    c => { const g = G(); add(g, m(boxT(2.6, 6.5, 2.6, 1.5), E.brick), 0, 3.25, 0); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; windowAt(g, Math.sin(a) * 1.32, 4.8, Math.cos(a) * 1.32, a, false, 0.5, 1.2); } add(g, m(boxT(1.8, 1.8, 1.8, 1.5), plaster('#f4f0e6')), 0, 7.4, 0); add(g, pyramidRoof(2.1, 3.4, domeCols[0]), 0, 10, 0, 0, Math.PI / 4); add(g, m(new THREE.SphereGeometry(0.2, 10, 8), E.goldLeaf), 0, 11.8, 0); return g; }],
  wall: [c => { const g = G(); add(g, m(boxT(2, 3, 1.4, 1.5), E.brick), 0, 1.5, 0); crenels(g, 2, 1.4, 3, E.brick, 0.34, true); return g; }, c => { const g = G(); add(g, m(boxT(2, 3.2, 1.6, 1.5), E.brick), 0, 1.6, 0); crenels(g, 2, 1.6, 3.2, E.brick, 0.36, true); return g; }],
  wonder: c => { const g = G(); add(g, m(boxT(12, 1.2, 12, 2), E.brick), 0, 0.6, 0); add(g, m(boxT(7, 6, 7, 2), E.brick), 0, 4.2, 0); for (const s of [-1, 1]) { archRow(g, 3, -2.2, 2.2, 1.4, s * 3.52, 0.8, 2); archRow(g, 3, -2.2, 2.2, 3.8, s * 3.52, 0.6, 1.2); }
    add(g, m(cylT(1.4, 1.5, 6, 8, 1.5), E.brick), 0, 10.2, 0); g.add(put(onion(1.6, 3, E.goldLeaf), 0, 13.2, 0)); add(g, pyramidRoof(2.4, 4, domeCols[0]), 0, 15.5, 0, 0, Math.PI / 8);
    const ring = [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6], [0, -4.6], [0, 4.6], [-4.6, 0], [4.6, 0]];
    ring.forEach(([x, z], i) => { const h = 6 + (i % 3) * 1.4; add(g, m(cylT(0.9, 1, h, 14, 1.5), i % 2 ? E.brick : plaster('#f4f0e6')), x, 1.2 + h / 2, z); add(g, m(cylT(1.05, 1.05, 0.35, 14, 1), E.marble), x, 1.2 + h, z); const on = onion(1.15, 2.1, domeCols[i % 5]); on.children[0].geometry = on.children[0].geometry.clone(); g.add(put(on, x, 1.3 + h, z)); });
    for (const [x, z] of [[-5.6, 5.6], [5.6, 5.6]]) flagOn(g, c, x, 1.2, z, 3.6); return g; },
};

// ---------- Deutschland ----------
const GERMANY = {
  town: [c => { const g = Md.keep(c); add(g, m(boxT(3, 12, 3, 1.6), M.stone), -4.6, 6, -4.6); crenels(g, 3, 3, 12, M.stone, 0.45); return g; },
    c => { const g = G(); add(g, m(boxT(8, 6, 4.4, 2), E.brick), 0, 3, 0); for (let k = 0; k < 5; k++) { windowAt(g, -3 + k * 1.5, 1.8, 2.25, 0, k % 2 === 0, 0.6, 1.5); windowAt(g, -3 + k * 1.5, 4.2, 2.25, 0, false, 0.6, 1.4); }
      stepGable(g, 4.4, 6, 2.0, E.brick, 6, 4); const rf = gableRoof(8, 4.4, 3.4, M.roofSlate, E.brick, 0.2); rf.position.y = 6; g.add(rf); add(g, m(boxT(1.8, 10, 1.8, 1.6), E.brick), 3.6, 5, 2); add(g, m(new THREE.ConeGeometry(1.3, 4, 8), M.roofGreen), 3.6, 12, 2); add(g, m(new THREE.CircleGeometry(0.55, 18), col('#f4f0e4', 0.4)), 3.6, 8.6, 2.92); flagOn(g, c, 3.6, 14, 2, 1.6); door(g, -0.6, 0, 2.25, 0, 1.4, 2.2); return g; }],
  house: [c => Md.halfTimberHouse(c, 21, { w: 3.6, d: 3.4, floors: 2, roof: 'red' }), c => { const g = G(); const p = plaster('#e8dcc4'); add(g, m(boxT(4, 6, 3.4, 2), p), 0, 3, 0); for (let f = 0; f < 3; f++) for (const x of [-1.2, 0, 1.2]) windowAt(g, x, 1 + f * 1.9, 1.72, 0, (f + x) % 2 === 0, 0.5, 1.1); for (let f = 1; f < 3; f++) add(g, m(boxT(4.1, 0.12, 3.5, 1), M.stone), 0, f * 2, 0); const rf = gableRoof(4, 3.4, 1.8, M.roofRed, p, 0.2); rf.position.y = 6; g.add(rf); add(g, m(boxT(1, 1, 0.9, 1), p), 0, 6.5, 1.3); return g; }],
  tower: [c => { const g = G(); add(g, m(boxT(2.6, 9, 2.6, 1.6), M.stone), 0, 4.5, 0); add(g, m(boxT(3.2, 1.6, 3.2, 1.5), M.planks), 0, 9.6, 0); add(g, pyramidRoof(3.4, 3, M.roofRed), 0, 11.9, 0, 0, Math.PI / 4); flagOn(g, c, 0, 13.3, 0, 1.4); return g; },
    c => { const g = G(); add(g, m(cylT(1.5, 1.7, 8, 16, 1.6), E.brick), 0, 4, 0); crenels(g, 3.2, 3.2, 8, E.brick, 0.4); add(g, m(new THREE.ConeGeometry(1.2, 3, 12), M.roofSlate), 0, 10.2, 0); flagOn(g, c, 0, 11.6, 0, 1.4); return g; }],
  wall: [c => Md.wallSeg(2, 3.4, 2), c => { const g = G(); add(g, m(boxT(2, 3.2, 1.8, 1.5), E.brick), 0, 1.6, 0); crenels(g, 2, 1.8, 3.2, E.brick, 0.4); return g; }],
  wonder: c => { const g = G(); const st = stoneT('#8f8576'); add(g, m(boxT(6, 9, 13, 2), st), 0, 4.5, -1); const rf = gableRoof(13, 6, 5, M.roofSlate, st, 0.2); rf.rotation.y = Math.PI / 2; rf.position.set(0, 9, -1); g.add(rf);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { add(g, m(boxT(0.7, 7, 1, 1), st), s * 3.3, 3.5, -6 + k * 2.6); add(g, m(new THREE.ConeGeometry(0.35, 1.6, 4), st), s * 3.3, 7.8, -6 + k * 2.6); archRow(g, 1, 0, 0, 2, 0, 0.8, 4.5, M.glass); }
    for (const x of [-2, 2]) { add(g, m(boxT(2.8, 16, 2.8, 2), st), x, 8, 6.2); for (let y = 3; y < 15; y += 3.6) archRow(g, 1, x, x, y, 7.62, 0.8, 2.4); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; add(g, m(new THREE.ConeGeometry(0.3, 2.2, 4), st), x + Math.cos(a) * 1.3, 17, 6.2 + Math.sin(a) * 1.3); } add(g, m(new THREE.ConeGeometry(1.5, 8, 8), st), x, 20, 6.2); add(g, m(new THREE.SphereGeometry(0.25, 8, 6), E.goldLeaf), x, 24.2, 6.2); }
    archRow(g, 1, 0, 0, 0, 7.62, 1.6, 4, E.dark); add(g, m(new THREE.CircleGeometry(1.2, 24), col('#2a3a6a', 0.2, 0.3)), 0, 6.5, 7.63); for (const [x, z] of [[-4.4, 8.4], [4.4, 8.4]]) flagOn(g, c, x, 0, z, 4); return g; },
};

// ---------- China ----------
const red = () => col('#a8261c', 0.6);
const tileMats = new Map();
function tile(c) { if (!tileMats.has(c)) { const t = TX.roofTileTex(512, c); tileMats.set(c, new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.6, side: THREE.DoubleSide })); } return tileMats.get(c); }
const yellowTile = () => tile('#e8b030');
function chinaHall(c, w, d, h, roofMat, double = false) { const g = G(); add(g, m(boxT(w + 1.4, 0.8, d + 1.4, 1.5), E.marble), 0, 0.4, 0); for (let k = 0; k < 3; k++) add(g, m(boxT(1.6, 0.25, 0.5, 1), E.marble), 0, 0.12 + k * 0.25, d / 2 + 1.2 - k * 0.3);
  add(g, m(boxT(w, h, d, 2), red()), 0, 0.8 + h / 2, 0); for (let k = 0; k <= 6; k++) add(g, m(cylT(0.13, 0.13, h, 10, 1), col('#7a1a12', 0.6)), -w / 2 + k * w / 6, 0.8 + h / 2, d / 2 + 0.25);
  for (let k = 0; k < 5; k++) add(g, m(boxT(w / 7, h * 0.6, 0.05, 1), col('#d8a050', 0.6)), -w / 2 + w / 12 + (k + 0.5) * w / 6, 0.8 + h * 0.45, d / 2 + 0.02);
  const r1 = curvedRoof(w + 2.6, 1.6, roofMat === M.roofGreen ? tile('#3e6a52') : roofMat, 0.8); r1.scale.set(1, 1, (d + 2.4) / (w + 2.6)); add(g, r1, 0, 0.8 + h + 0.7, 0);
  if (double) { add(g, m(boxT(w * 0.75, 1, d * 0.75, 1.5), red()), 0, 0.8 + h + 1.5, 0); const r2 = curvedRoof(w * 0.75 + 2, 1.4, roofMat === M.roofGreen ? tile('#3e6a52') : roofMat, 0.7); r2.scale.set(1, 1, (d * 0.75 + 1.8) / (w * 0.75 + 2)); add(g, r2, 0, 0.8 + h + 2.6, 0); }
  return g; }
const CHINA = {
  town: [c => { const g = chinaHall(c, 6, 3.4, 2.6, M.roofGreen, true); for (const s of [-1, 1]) add(g, m(new THREE.SphereGeometry(0.4, 10, 8), M.stone), s * 2.2, 1.2, 3.1); flagOn(g, c, 4, 0.8, 2.6, 3); return g; },
    c => { const g = chinaHall(c, 7, 3.8, 3, yellowTile(), true); for (const s of [-1, 1]) add(g, m(new THREE.SphereGeometry(0.45, 10, 8), E.goldLeaf), s * 2.6, 1.3, 3.4); flagOn(g, c, 4.4, 0.8, 3, 3.4); return g; }],
  house: [c => Md.asianHouse(c, 3), c => { const g = G(); add(g, m(boxT(4, 2.4, 3, 2), stoneT('#8a8a8e')), 0, 1.2, 0); const r = curvedRoof(5, 1.3, M.roofSlate, 0.35); r.scale.set(1, 1, 0.8); add(g, r, 0, 2.95, 0); door(g, 0, 0, 1.52, 0, 0.9, 1.7); add(g, m(boxT(1.2, 0.3, 0.06, 1), red()), 0, 1.9, 1.54); for (const s of [-1, 1]) windowAt(g, s * 1.3, 1.3, 1.52, 0, s > 0, 0.6, 0.6); return g; }],
  tower: [c => Md.pagoda(c, 3), c => Md.pagoda(c, 4)],
  wall: [c => { const g = G(); add(g, m(boxT(2, 3.4, 2, 1.5), stoneT('#9a968e')), 0, 1.7, 0); crenels(g, 2, 2, 3.4, stoneT('#9a968e'), 0.4); add(g, m(boxT(2, 0.1, 1.2, 1), M.stoneDark), 0, 3.42, 0); return g; }, c => { const g = G(); add(g, m(boxT(2, 3.8, 2, 1.5), stoneT('#8e8a82')), 0, 1.9, 0); crenels(g, 2, 2, 3.8, stoneT('#8e8a82'), 0.42); return g; }],
  wonder: c => { const g = G(); // Himmelstempel
    for (let k = 0; k < 3; k++) { add(g, m(cylT(8 - k * 1.6, 8.2 - k * 1.6, 0.9, 40, 2), E.marble), 0, 0.45 + k * 0.9, 0); add(g, m(new THREE.TorusGeometry(8 - k * 1.6, 0.08, 4, 48), E.marble), 0, 0.95 + k * 0.9, 0, Math.PI / 2); }
    const blue = tile('#3456b0');
    const y0 = 2.7; add(g, m(cylT(3.6, 3.6, 3, 24, 2), red()), 0, y0 + 1.5, 0); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(g, m(cylT(0.16, 0.16, 3, 8, 1), col('#7a1a12', 0.6)), Math.cos(a) * 3.75, y0 + 1.5, Math.sin(a) * 3.75); }
    const roofs = [[5.4, 1.4, 4.6], [4.4, 1.3, 6.8], [3.4, 1.6, 9]]; roofs.forEach(([r, h, y], i) => { add(g, m(new THREE.ConeGeometry(r, h, 40, 1, true), blue), 0, y0 + y - 1, 0); if (i < 2) add(g, m(cylT(r * 0.62, r * 0.62, 1.2, 24, 1.5), red()), 0, y0 + y + 0.1, 0); });
    add(g, m(cylT(0.12, 0.25, 1.4, 10, 1), E.goldLeaf), 0, y0 + 9.4, 0); add(g, m(new THREE.SphereGeometry(0.45, 14, 10), E.goldLeaf), 0, y0 + 10.2, 0);
    for (const [x, z] of [[-6, 6], [6, 6]]) flagOn(g, c, x, 0.9, z, 4); return g; },
};

// ---------- Österreich-Ungarn ----------
const yellow = () => plaster('#e8c45a'), copperRoof = () => E.copper;
function baroqueTower(h = 7, w = 1.8, mat = plaster('#e8c45a')) { const g = G(); add(g, m(boxT(w, h, w, 2), mat), 0, h / 2, 0); add(g, m(boxT(w + 0.2, 0.25, w + 0.2, 1), plaster('#f4f0e6')), 0, h, 0); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; windowAt(g, Math.sin(a) * (w / 2 + 0.02), h * 0.75, Math.cos(a) * (w / 2 + 0.02), a, false, 0.4, 0.9); }
  const bulb = onion(w * 0.65, w * 1.1, copperRoof(), false); g.add(put(bulb, 0, h, 0)); add(g, m(cylT(w * 0.18, w * 0.25, w * 0.8, 10, 1), copperRoof()), 0, h + w * 1.3, 0); g.add(put(onion(w * 0.3, w * 0.6, copperRoof()), 0, h + w * 1.6, 0)); return g; }
const AUSTRIA = {
  town: [c => { const g = G(); const wh = plaster('#f2ede2'); add(g, m(boxT(6.4, 4, 4.4, 2), wh), 0, 2, 0); for (let k = 0; k < 4; k++) { windowAt(g, -2.2 + k * 1.45, 1.4, 2.22, 0, k % 2 === 0, 0.5, 0.8); windowAt(g, -2.2 + k * 1.45, 3.1, 2.22, 0, false, 0.5, 0.8); } add(g, m(boxT(6.6, 0.12, 0.9, 1), M.planks), 0, 2.5, 2.6); for (let k = 0; k < 14; k++) add(g, m(boxT(0.06, 0.8, 0.06, 1), M.planks), -3.2 + k * 0.49, 2.9, 3); const rf = gableRoof(6.4, 4.4, 1.8, E.shingle, wh, 1.0, 0.2); rf.position.y = 4; g.add(rf); g.add(put(baroqueTower(7.5, 1.6, wh), 3.8, 0, -1)); flagOn(g, c, -3.6, 0, 2.6, 3); return g; },
    c => { const g = G(); const y = yellow(), wh = plaster('#f4f0e6'); add(g, m(boxT(11, 5, 4.4, 2), y), 0, 2.5, 0); for (let k = 0; k < 9; k++) { windowAt(g, -4.4 + k * 1.1, 1.5, 2.22, 0, k % 3 === 0, 0.5, 1.2); windowAt(g, -4.4 + k * 1.1, 3.6, 2.22, 0, false, 0.5, 1.1); } add(g, m(boxT(4, 6, 1.2, 2), y), 0, 3, 2.6); columns(g, 4, -1.5, 1.5, 3.3, 4.8, 0.16, wh, 0.4); pediment(g, 4.2, 6, 3.2, wh, 1.1); add(g, m(boxT(11.2, 0.3, 4.6, 1), wh), 0, 5.1, 0); const rf = gableRoof(11, 4.4, 1.4, copperRoof(), y, 0.1); rf.position.y = 5.2; g.add(rf); g.add(put(dome(1.5, copperRoof()), 0, 6.6, 0)); g.add(put(onion(0.4, 0.8, E.goldLeaf), 0, 8, 0)); flagOn(g, c, 0, 8.8, 0, 1.6); return g; }],
  house: [c => { const g = G(); const wh = plaster('#f2ede2'); add(g, m(boxT(3.8, 1.6, 3.2, 1.5), M.stone), 0, 0.8, 0); add(g, m(boxT(3.8, 1.6, 3.2, 1.5), M.planks), 0, 2.4, 0); add(g, m(boxT(4, 0.1, 0.8, 1), M.planks), 0, 1.8, 1.9); for (let k = 0; k < 9; k++) add(g, m(boxT(0.06, 0.6, 0.06, 1), M.planks), -1.9 + k * 0.48, 2.1, 2.25); windowAt(g, -0.8, 0.9, 1.62, 0, true, 0.45, 0.6); windowAt(g, 0.9, 2.5, 1.62, 0, false, 0.45, 0.6); const rf = gableRoof(3.8, 3.2, 1.2, E.shingle, M.planks, 0.9, 0.15); rf.position.y = 3.2; g.add(rf); for (let k = 0; k < 5; k++) add(g, m(new THREE.DodecahedronGeometry(0.16), M.stoneDark), -1.5 + k * 0.75, 3.85, 0.4); return g; },
    c => { const g = G(); const y = yellow(), wh = plaster('#f4f0e6'); add(g, m(boxT(4.2, 5.4, 3.4, 2), y), 0, 2.7, 0); for (let f = 0; f < 3; f++) for (const x of [-1.3, 0, 1.3]) { windowAt(g, x, 1 + f * 1.7, 1.72, 0, f === 1 && x === 0, 0.45, 1); add(g, m(boxT(0.7, 0.12, 0.08, 1), wh), x, 1.65 + f * 1.7, 1.74); } add(g, m(boxT(4.3, 0.2, 3.5, 1), wh), 0, 5.4, 0); const rf = gableRoof(4.2, 3.4, 1.5, copperRoof(), y, 0.15); rf.position.y = 5.5; g.add(rf); return g; }],
  tower: [c => baroqueTower(7, 2, plaster('#f2ede2')), c => baroqueTower(8, 2.2, yellow())],
  wall: [c => { const g = Md.wallSeg(2, 3.2, 2); return g; }, c => { const g = G(); add(g, m(boxT(2, 3, 1.8, 1.5), M.stone), 0, 1.5, 0); add(g, m(boxT(2.05, 0.4, 1.85, 1), yellow()), 0, 3.1, 0); return g; }],
  wonder: c => { const g = G(); const st = plaster('#ece4d4'), red2 = M.roofRed; // Parlament
    add(g, m(boxT(18, 1, 7, 2), M.stone), 0, 0.5, 0); add(g, m(boxT(16, 5.5, 5.6, 2), st), 0, 3.75, 0); for (let k = 0; k < 14; k++) { archRow(g, 1, -6.8 + k * 1.05, 0, 1.2, 2.82, 0.6, 1.8, M.glass); archRow(g, 1, -6.8 + k * 1.05, 0, 3.7, 2.82, 0.55, 1.5, M.glass); add(g, m(boxT(0.18, 5.5, 0.2, 1), st), -7.3 + k * 1.05, 3.75, 2.86); }
    const rf = gableRoof(16, 5.6, 2.6, red2, st, 0.15); rf.position.y = 6.5; g.add(rf);
    for (const x of [-7.6, -3.6, 3.6, 7.6]) { add(g, m(boxT(1, 4, 1, 1), st), x, 8.5, 2.6); add(g, m(new THREE.ConeGeometry(0.6, 3, 4), red2), x, 12, 2.6, 0, Math.PI / 4); }
    add(g, m(cylT(2.6, 2.8, 4, 16, 2), st), 0, 8.5, 0); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(g, m(new THREE.ConeGeometry(0.22, 1.8, 4), st), Math.cos(a) * 2.7, 11.3, Math.sin(a) * 2.7); }
    add(g, m(new THREE.SphereGeometry(2.6, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), red2), 0, 10.5, 0); add(g, m(new THREE.ConeGeometry(0.9, 5, 12), st), 0, 15.2, 0); add(g, m(new THREE.SphereGeometry(0.3, 10, 8), E.goldLeaf), 0, 17.8, 0);
    for (const [x, z] of [[-8.5, 4.6], [8.5, 4.6]]) flagOn(g, c, x, 1, z, 4); return g; },
};

// ---------- Jugoslawien ----------
function balkanHouse(c, w = 3.6, d = 3.2, upper = true) { const g = G(); add(g, m(boxT(w, 2, d, 1.5), stoneT('#b8ab94')), 0, 1, 0); if (upper) { add(g, m(boxT(w + 0.5, 1.7, d + 0.5, 2), plaster('#f4f0e6')), 0, 2.85, 0.25); for (let k = 0; k < 5; k++) add(g, m(boxT(0.12, 0.12, 0.6, 1), M.beam), -w / 2 + 0.2 + k * (w - 0.4) / 4, 1.95, d / 2 + 0.15); for (const x of [-1, 0, 1]) windowAt(g, x * 1.1, 2.9, d / 2 + 0.52, 0, x === 0, 0.45, 0.8); }
  const H = upper ? 3.7 : 2; const rf = new THREE.Mesh(new THREE.ConeGeometry((w + 1.2) * 0.72, 1.6, 4), M.roofRed); rf.castShadow = rf.receiveShadow = true; rf.scale.set(1, 1, (d + 1.2) / (w + 1.2)); add(g, rf, 0, H + 0.8, upper ? 0.25 : 0, 0, Math.PI / 4); door(g, -0.8, 0, d / 2 + 0.03, 0, 0.8, 1.5); add(g, m(boxT(0.4, 1, 0.4, 1), stoneT('#b8ab94')), 1, H + 1.2, 0); return g; }
function orthodox(s = 1) { const g = G(); const st = stoneT('#d8c8a8'); add(g, m(boxT(3.6 * s, 3.6 * s, 3.6 * s, 2), st), 0, 1.8 * s, 0); for (const [x, z] of [[0, 2.2], [0, -2.2], [2.2, 0], [-2.2, 0]]) { add(g, m(cylT(1.2 * s, 1.2 * s, 2.8 * s, 16, 1), st), x * s, 1.4 * s, z * s); add(g, dome(1.2 * s, M.roofRed), x * s, 2.8 * s, z * s); }
  add(g, m(cylT(1.2 * s, 1.2 * s, 1.6 * s, 16, 1), st), 0, 4.4 * s, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; archRow(g, 1, Math.cos(a) * 1.21 * s, 0, 4 * s, Math.sin(a) * 1.21 * s, 0.3 * s, 0.8 * s); } add(g, dome(1.25 * s, M.roofRed), 0, 5.2 * s, 0); add(g, m(new THREE.SphereGeometry(0.18 * s, 8, 6), E.goldLeaf), 0, 6.6 * s, 0); return g; }
const YUGO = {
  town: [c => { const g = G(); const st = stoneT('#a89c86'); for (const [x, z, w, d] of [[0, 3, 6.4, 0.9], [0, -3, 6.4, 0.9], [3, 0, 0.9, 6.4], [-3, 0, 0.9, 6.4]]) add(g, m(boxT(w, 2.6, d, 1.5), st), x, 1.3, z); crenels(g, 6.4, 6.4, 2.6, st, 0.42); for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { add(g, m(cylT(1, 1.1, 3.8, 14, 1.5), st), x, 1.9, z); add(g, m(new THREE.ConeGeometry(1.2, 1.2, 14), M.roofRed), x, 4.4, z); } g.add(put(orthodox(0.65), 0, 0, -0.5)); flagOn(g, c, 0, 2.6, 3.4, 2.4); return g; },
    c => { const g = G(); const st = stoneT('#e2d4b8'), rd = E.brick; add(g, m(boxT(9, 5, 5, 2), st), 0, 2.5, 0); for (let k = 0; k < 8; k++) add(g, m(boxT(9.02, 0.25, 5.02, 1), rd), 0, 0.5 + k * 0.6, 0); for (let k = 0; k < 6; k++) archRow(g, 1, -3.6 + k * 1.45, 0, 1.6, 2.52, 0.7, 2.2, M.glass); add(g, m(cylT(2, 2.1, 2.2, 20, 1.5), st), 0, 6.1, 0); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; archRow(g, 1, Math.cos(a) * 2.02, 0, 5.4, Math.sin(a) * 2.02, 0.4, 1); } add(g, dome(2.1, E.copper), 0, 7.2, 0); for (const x of [-3.6, 3.6]) { add(g, m(cylT(0.8, 0.8, 1.2, 14, 1), st), x, 5.6, 0); add(g, dome(0.85, E.copper), x, 6.2, 0); } add(g, m(new THREE.SphereGeometry(0.25, 10, 8), E.goldLeaf), 0, 9.5, 0); flagOn(g, c, 4.2, 5, 2.4, 2); return g; }],
  house: [c => balkanHouse(c, 3.4, 3, false), c => balkanHouse(c, 3.6, 3.2, true)],
  tower: [c => { const g = G(); const st = stoneT('#a89c86'); add(g, m(boxT(2.6, 7, 2.6, 1.5), st), 0, 3.5, 0); crenels(g, 2.6, 2.6, 7, st, 0.4); add(g, pyramidRoof(2.8, 1.8, M.roofRed), 0, 8.2, 0, 0, Math.PI / 4); flagOn(g, c, 0, 9, 0, 1.4); return g; },
    c => { const g = G(); const st = stoneT('#d8c8a8'); add(g, m(cylT(1.1, 1.3, 8, 16, 1.5), st), 0, 4, 0); add(g, m(cylT(1.5, 1.5, 0.3, 16, 1), st), 0, 6.2, 0); add(g, m(new THREE.ConeGeometry(1.1, 3.2, 16), E.copper), 0, 9.6, 0); add(g, m(new THREE.SphereGeometry(0.18, 8, 6), E.goldLeaf), 0, 11.3, 0); return g; }],
  wall: [c => { const g = G(); add(g, m(boxT(2, 3, 2, 1.5), stoneT('#a89c86')), 0, 1.5, 0); crenels(g, 2, 2, 3, stoneT('#a89c86'), 0.42); return g; }, c => { const g = G(); add(g, m(boxT(2, 3.2, 1.8, 1.5), stoneT('#b8ab94')), 0, 1.6, 0); add(g, m(boxT(2.05, 0.3, 1.85, 1), M.roofRed), 0, 3.3, 0); return g; }],
  wonder: c => { const g = G(); const st = plaster('#f6f3ec'); // großer weißer Kuppeltempel
    add(g, m(boxT(14, 1.2, 14, 2), stoneT('#c8bca4')), 0, 0.6, 0); add(g, m(boxT(9, 8, 9, 2), st), 0, 5.2, 0);
    for (const [x, z] of [[0, 5.6], [0, -5.6], [5.6, 0], [-5.6, 0]]) { add(g, m(cylT(3.2, 3.2, 6, 24, 2), st), x, 4.2, z); add(g, dome(3.2, st), x, 7.2, z); add(g, m(new THREE.SphereGeometry(0.3, 10, 8), E.goldLeaf), x, 10.6, z); archRow(g, 3, x - 1.4, x + 1.4, 2.2, z + (z > 0 ? 3.21 : z < 0 ? -3.21 : 0), 0.6, 2.4, M.glass); }
    add(g, m(cylT(4, 4.2, 3.6, 32, 2), st), 0, 11, 0); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; archRow(g, 1, Math.cos(a) * 4.05, 0, 9.8, Math.sin(a) * 4.05, 0.5, 1.8, M.glass); }
    add(g, dome(4.2, E.copper), 0, 12.8, 0); add(g, m(cylT(0.6, 0.8, 1.4, 12, 1), st), 0, 17.6, 0); add(g, m(new THREE.SphereGeometry(0.6, 14, 10), E.goldLeaf), 0, 18.8, 0);
    for (const [x, z] of [[-6.4, 6.4], [6.4, 6.4]]) { add(g, m(boxT(1.4, 9, 1.4, 1.5), st), x, 5.7, z); add(g, dome(0.9, E.copper), x, 10.2, z); flagOn(g, c, x, 1.2, z + 1.2, 3); } return g; },
};

// ---------- Indien ----------
const sandstone = () => stoneT('#c0603f'), pinkPlaster = () => plaster('#e8a888');
const INDIA = {
  town: [c => { const g = G(); const ss = sandstone(); for (const [x, z, w, d] of [[0, 3, 6.4, 0.8], [0, -3, 6.4, 0.8], [3, 0, 0.8, 6.4], [-3, 0, 0.8, 6.4]]) add(g, m(boxT(w, 3, d, 1.5), ss), x, 1.5, z); crenels(g, 6.4, 6.4, 3, ss, 0.4); for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { add(g, m(cylT(1, 1.15, 4, 14, 1.5), ss), x, 2, z); g.add(put(chhatri(0.8, ss, ss), x, 4, z)); }
    add(g, m(boxT(3.6, 3, 3, 1.5), ss), 0, 1.5, -0.6); for (const x of [-1, 0, 1]) archRow(g, 1, x * 1.1, 0, 0.6, 0.92, 0.6, 1.4); g.add(put(chhatri(1, ss, E.marble), 0, 3, -0.6)); add(g, m(new THREE.PlaneGeometry(1.4, 1.8), teamCloth(c)), 0, 1.2, 3.42); return g; },
    c => { const g = G(); const ss = sandstone(), wh = E.marble; add(g, m(boxT(10, 4.6, 4.6, 2), ss), 0, 2.3, 0); for (let k = 0; k < 7; k++) archRow(g, 1, -4.2 + k * 1.4, 0, 0.6, 2.32, 0.8, 1.6); for (let k = 0; k < 7; k++) archRow(g, 1, -4.2 + k * 1.4, 0, 2.7, 2.32, 0.6, 1.3, M.glass); add(g, m(boxT(10.2, 0.3, 4.8, 1), wh), 0, 4.65, 0); crenels(g, 10, 4.6, 4.8, wh, 0.3);
      add(g, m(cylT(1.6, 1.6, 1.8, 18, 1.5), wh), 0, 5.7, 0); g.add(put(onion(1.8, 2.8, wh), 0, 6.5, 0)); for (const x of [-4.6, 4.6]) { add(g, m(cylT(0.6, 0.7, 3, 12, 1), ss), x, 6.3, 1.8); g.add(put(chhatri(0.6, wh, wh), x, 7.8, 1.8)); } flagOn(g, c, -2.6, 4.8, -1.6, 2.4); return g; }],
  house: [c => { const g = G(); const p = plaster('#e2b468'); add(g, m(boxT(3.6, 3, 3.2, 2), p), 0, 1.5, 0); add(g, m(boxT(3.7, 0.3, 3.3, 1), sandstone()), 0, 3.1, 0); crenels(g, 3.6, 3.2, 3.2, p, 0.28); const jh = G(); add(jh, m(boxT(1.2, 1, 0.6, 1), sandstone()), 0, 0, 0); add(jh, m(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), sandstone()), 0, 0.5, 0, 0, 0, 0, [1.2, 0.6, 0.6]); add(g, jh, 0.6, 2, 1.85); door(g, -0.9, 0, 1.62, 0, 0.8, 1.6); add(g, m(new THREE.PlaneGeometry(0.6, 0.4), teamCloth(c)), -0.9, 2.1, 1.63); return g; },
    c => { const g = G(); const p = pinkPlaster(); add(g, m(boxT(4, 5, 3.4, 2), p), 0, 2.5, 0); for (let f = 0; f < 2; f++) for (const x of [-1.2, 0, 1.2]) { const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.6); s.absarc(0, 0.6, 0.3, 0, Math.PI, false); add(g, m(new THREE.ShapeGeometry(s), E.dark), x, 1 + f * 2.2, 1.71); } add(g, m(boxT(4.2, 0.3, 3.6, 1), plaster('#f4f0e6')), 0, 5.1, 0); crenels(g, 4, 3.4, 5.2, plaster('#f4f0e6'), 0.25); g.add(put(chhatri(0.5, plaster('#f4f0e6'), plaster('#f4f0e6')), 1.3, 5.25, -1)); return g; }],
  tower: [c => { const g = G(); const ss = sandstone(); add(g, m(cylT(1.3, 1.6, 7, 16, 1.5), ss), 0, 3.5, 0); for (const y of [2.5, 5]) add(g, m(cylT(1.7, 1.7, 0.2, 16, 1), ss), 0, y, 0); g.add(put(chhatri(1.2, ss, ss), 0, 7, 0)); flagOn(g, c, 0, 9.6, 0, 1.4); return g; }, c => minaret(9, 0.9, sandstone())],
  wall: [c => { const g = G(); add(g, m(boxT(2, 3.4, 2, 1.5), sandstone()), 0, 1.7, 0); crenels(g, 2, 2, 3.4, sandstone(), 0.36); return g; }, c => { const g = G(); add(g, m(boxT(2, 3.6, 1.8, 1.5), sandstone()), 0, 1.8, 0); crenels(g, 2, 1.8, 3.6, sandstone(), 0.36); return g; }],
  wonder: c => { const g = G(); const mb = E.marble; // Marmormausoleum
    add(g, m(boxT(18, 1.4, 18, 2), mb), 0, 0.7, 0); add(g, m(boxT(9, 8, 9, 2), mb), 0, 5.4, 0);
    for (const s of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const fx = Math.sin(s) * 4.52, fz = Math.cos(s) * 4.52; const ar = new THREE.Shape(); ar.moveTo(-1.6, 0); ar.lineTo(1.6, 0); ar.lineTo(1.6, 3.6); ar.quadraticCurveTo(1.6, 5.6, 0, 6.4); ar.quadraticCurveTo(-1.6, 5.6, -1.6, 3.6); const am = m(new THREE.ShapeGeometry(ar), E.dark); add(g, am, fx, 1.4, fz, 0, s); for (const k of [-1, 1]) archRow(g, 2, 0, 0, 0, 0, 0.1, 0.1); }
    for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) g.add(put(chhatri(1.2, mb, mb), x, 9.4, z));
    add(g, m(cylT(3.2, 3.2, 2.4, 32, 2), mb), 0, 10.6, 0); g.add(put(onion(4, 6.4, mb), 0, 11.8, 0));
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) g.add(put(minaret(13, 0.75, mb), x, 1.4, z));
    add(g, m(boxT(2.2, 0.15, 14, 1), col('#2a5a78', 0.1)), 0, 1.45, 14.5); for (const [x, z] of [[-3, 16], [3, 16]]) flagOn(g, c, x, 1.4, z, 3.6); return g; },
};

export const NATION_STYLES = { usa: USA, russia: RUSSIA, germany: GERMANY, china: CHINA, austria: AUSTRIA, yugoslavia: YUGO, india: INDIA };
// Nationaler Stil ab Frühem Mittelalter: Index 0 = Mittelalter (3–4), 1 = Industrialisierung (5–6)
export function nationBuilding(type, era, color, nation) {
  mats();
  const N = NATION_STYLES[nation];
  if (!N) return null;
  if (era >= 7) return type === 'town' && N.wonder ? N.wonder(color) : nationBuilding(type, 6, color, nation);
  if (era < 3) return null;
  const list = N[type];
  if (!list) return null;
  return list[era >= 5 ? 1 : 0](color);
}
