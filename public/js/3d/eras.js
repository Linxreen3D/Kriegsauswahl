// Neutrale Gebäude pro Epoche (0 Steinzeit … 6 Zweite Industrielle Revolution) und das Weltwunder (7).
import * as THREE from 'three';
import * as Md from './models.js';
import * as TX from './textures.js';

const { m, put, boxT, cylT, coneT, gableRoof, windowAt, door, banner, col, teamCloth } = Md;
const M = Md.M;
const E = {};
function mats() {
  if (E.ready) return;
  const tex = (t, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: rough, ...extra });
  Object.assign(E, {
    hide: tex(TX.hideTex(), 0.9, { side: THREE.DoubleSide }), adobe: tex(TX.adobeTex(), 0.95), wattle: tex(TX.wattleTex(), 0.95),
    brick: tex(TX.brickTex(512, '#9a4a32')), darkBrick: tex(TX.brickTex(512, '#6e3424', '#8a8070')), yellowBrick: tex(TX.brickTex(512, '#b8925a', '#d8ccb4')),
    metal: tex(TX.metalTex(256, '#6e7378'), 0.55, { metalness: 0.6, side: THREE.DoubleSide }), rust: tex(TX.metalTex(256, '#8a5a3a'), 0.7, { metalness: 0.4, side: THREE.DoubleSide }),
    concrete: tex(TX.concreteTex(), 0.95), shingle: tex(TX.shingleTex(), 0.9),
    copper: new THREE.MeshStandardMaterial({ color: '#5fa892', roughness: 0.55, metalness: 0.45 }),
    marble: new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.35 }), goldLeaf: new THREE.MeshStandardMaterial({ color: '#f2c341', roughness: 0.22, metalness: 1, emissive: '#3a2600', emissiveIntensity: 0.25 }),
    iron: new THREE.MeshStandardMaterial({ color: '#3a3c40', roughness: 0.5, metalness: 0.75 }),
    pole: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.85 }), dark: col('#1a1410', 0.9), glow: new THREE.MeshStandardMaterial({ color: '#ffb050', emissive: '#ff8a30', emissiveIntensity: 1.6 }),
    ready: true,
  });
}
const G = () => new THREE.Group();
const add = (g, o, ...a) => { g.add(put(o, ...a)); return o; };

// ---------- Bausteine ----------
function tent(color, r = 1.6, h = 2.6) {
  const g = G();
  const c = m(new THREE.ConeGeometry(r, h, 9, 1, true), E.hide); add(g, c, 0, h / 2, 0);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(g, m(cylT(0.035, 0.035, h + 0.9, 5, 1), E.pole), Math.cos(a) * 0.12, h / 2 + 0.3, Math.sin(a) * 0.12, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); }
  add(g, m(new THREE.PlaneGeometry(0.7, 1.1), E.dark), 0, 0.55, r * 0.62, -0.32);
  add(g, m(new THREE.PlaneGeometry(0.5, 0.35), teamCloth(color)), 0, h * 0.62, r * 0.42 + 0.03, -0.55);
  return g;
}
function roundHut(color, r = 1.8, wall = 1.2, roofH = 2.4, wallMat = E.wattle) {
  const g = G();
  add(g, m(cylT(r, r * 1.04, wall, 18, 1.4), wallMat), 0, wall / 2, 0);
  const roof = m(coneT(r * 1.3, roofH, 18, 1.2), M.thatch); roof.material.side = THREE.DoubleSide; add(g, roof, 0, wall + roofH / 2 - 0.1, 0);
  door(g, 0, 0, r + 0.02, 0, 0.8, 1.15);
  add(g, m(new THREE.PlaneGeometry(0.6, 0.4), teamCloth(color)), 0.9, wall + 0.25, r * 0.95, 0, 0.45);
  return g;
}
function adobeBox(color, w = 3.4, d = 3, h = 2.4, seed = 1) {
  const g = G(), r = TX.rng(seed);
  add(g, m(boxT(w, h, d, 2), E.adobe), 0, h / 2, 0);
  add(g, m(boxT(w + 0.12, 0.3, d + 0.12, 2), E.adobe), 0, h + 0.1, 0); // Brüstung
  add(g, m(boxT(w - 0.3, 0.12, d - 0.3, 2), col('#8a6a4a', 1)), 0, h + 0.18, 0);
  for (let k = 0; k < 5; k++) add(g, m(cylT(0.07, 0.07, d + 0.5, 6, 1), E.pole), -w / 2 + 0.3 + k * (w - 0.6) / 4, h - 0.25, 0, Math.PI / 2);
  add(g, m(boxT(0.9, 1.5, 0.12, 1), E.dark), -w * 0.2, 0.75, d / 2 + 0.01);
  for (const x of [w * 0.25]) add(g, m(boxT(0.45, 0.45, 0.1, 1), E.dark), x, h * 0.6, d / 2 + 0.01);
  const aw = m(new THREE.PlaneGeometry(1.6, 1.1), teamCloth(color)); add(g, aw, w * 0.15, h * 0.72, d / 2 + 0.5, -1.1);
  for (const x of [w * 0.15 - 0.75, w * 0.15 + 0.75]) add(g, m(cylT(0.04, 0.04, h * 0.72, 5, 1), E.pole), x, h * 0.36, d / 2 + 0.95);
  if (r() < 0.6) for (let k = 0; k < 3; k++) add(g, m(new THREE.CylinderGeometry(0.22, 0.16, 0.5, 10), col('#a8643a', 0.8)), -w / 2 - 0.3, 0.25, -0.6 + k * 0.6);
  return g;
}
function brickHouse(color, w = 3.6, d = 3.2, floors = 2, seed = 1, mat = E.brick, roofMat = M.roofSlate) {
  const g = G(), r = TX.rng(seed), fh = 1.9, H = 0.4 + floors * fh;
  add(g, m(boxT(w + 0.15, 0.4, d + 0.15, 1.5), M.stoneDark), 0, 0.2, 0);
  add(g, m(boxT(w, floors * fh, d, 2), mat), 0, 0.4 + floors * fh / 2, 0);
  for (let f = 0; f < floors; f++) {
    add(g, m(boxT(w + 0.08, 0.1, d + 0.08, 1), col('#d8d0c0', 0.8)), 0, 0.4 + (f + 1) * fh, 0);
    for (const x of [-w * 0.28, w * 0.28]) { if (f === 0 && x < 0) continue; windowAt(g, x, 0.4 + f * fh + 1.0, d / 2 + 0.06, 0, r() < 0.35, 0.55, 0.95); windowAt(g, x, 0.4 + f * fh + 1.0, -d / 2 - 0.06, Math.PI, false, 0.55, 0.95); }
  }
  door(g, -w * 0.28, 0.4, d / 2 + 0.06, 0, 0.85, 1.6);
  const rf = gableRoof(w, d, d * 0.42, roofMat, mat, 0.25); rf.position.y = H; g.add(rf);
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) { add(g, m(boxT(0.5, 1.4, 0.5, 1), mat), x, H + 0.7, 0); add(g, m(boxT(0.6, 0.12, 0.6, 1), M.stoneDark), x, H + 1.42, 0); }
  add(g, m(new THREE.PlaneGeometry(0.7, 0.45), teamCloth(color)), w * 0.28, 0.4 + 0.55, d / 2 + 0.08);
  return g;
}
function chimney(h = 9, r = 0.55, mat = E.brick) {
  const g = G();
  add(g, m(cylT(r, r * 1.25, h, 14, 1.5), mat), 0, h / 2, 0);
  add(g, m(cylT(r * 1.15, r * 1.15, 0.35, 14, 1), M.stoneDark), 0, h, 0);
  const sm = Md.smoke(0.9, Math.round(h * 13), 7); sm.position.y = h + 0.6; g.add(sm);
  return g;
}
function palisadeRing(R, n, gap = -1, h = 2) {
  const g = G();
  for (let k = 0; k < n; k++) {
    if (k === gap) continue;
    const a = k / n * Math.PI * 2;
    add(g, m(cylT(0.13, 0.15, h + (k % 3) * 0.15, 6, 1), E.pole), Math.cos(a) * R, h / 2, Math.sin(a) * R);
    add(g, m(new THREE.ConeGeometry(0.13, 0.3, 6), E.pole), Math.cos(a) * R, h + 0.2 + (k % 3) * 0.15, Math.sin(a) * R);
  }
  return g;
}
function fire(s = 0.6) { const g = G(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; add(g, m(new THREE.DodecahedronGeometry(0.16), col('#6e6a66', 0.9)), Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45); } g.add(put(Md.fire(s, 4), 0, 0.1, 0)); return g; }
function targets(n = 3, spacing = 1.6) { const g = G(); for (let k = 0; k < n; k++) { const t = G(); const d2 = m(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16), M.thatch); d2.rotation.x = Math.PI / 2; d2.position.y = 1.0; t.add(d2); t.add(put(m(new THREE.TorusGeometry(0.25, 0.05, 6, 16), col('#b8261c')), 0, 1.0, 0.13)); t.add(put(m(cylT(0.05, 0.05, 1, 5, 1), E.pole), 0, 0.5, -0.1)); add(g, t, (k - (n - 1) / 2) * spacing, 0, 0); } return g; }
function weaponRack(steel = M.metal) { const g = G(); add(g, m(boxT(1.5, 0.08, 0.1, 1), E.pole), 0, 1.1, 0); for (let k = 0; k < 5; k++) { add(g, m(cylT(0.022, 0.022, 2.0, 4, 1), E.pole), -0.6 + k * 0.3, 1.0, 0.06, 0.1); add(g, m(new THREE.ConeGeometry(0.05, 0.22, 4), steel), -0.6 + k * 0.3, 2.05, 0.16); } return g; }
function fence(len, h = 1, mat = E.pole) { const g = G(); for (let k = 0; k <= len; k += 1.2) add(g, m(cylT(0.05, 0.06, h, 5, 1), mat), k - len / 2, h / 2, 0); for (const y of [h * 0.45, h * 0.85]) add(g, m(boxT(len, 0.06, 0.05, 1), mat), 0, y, 0); return g; }
function trough() { const g = G(); add(g, m(boxT(1.6, 0.45, 0.5, 1), M.planks), 0, 0.3, 0); add(g, m(new THREE.PlaneGeometry(1.45, 0.38), col('#2a4a58', 0.1)), 0, 0.5, 0, -Math.PI / 2); return g; }
function silo(r = 1.1, h = 5, mat = E.metal) { const g = G(); add(g, m(cylT(r, r, h, 18, 1.2), mat), 0, h / 2, 0); add(g, m(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat), 0, h, 0); for (let y = 0.8; y < h; y += 1.2) add(g, m(new THREE.TorusGeometry(r + 0.02, 0.03, 4, 24), E.iron), 0, y, 0, Math.PI / 2); return g; }
function crane(h = 4) { const g = G(); add(g, m(boxT(0.25, h, 0.25, 1), M.beam), 0, h / 2, 0); add(g, m(boxT(2.2, 0.2, 0.2, 1), M.beam), 0.9, h - 0.1, 0); add(g, m(cylT(0.015, 0.015, 1.6, 3, 1), Md.col('#b39a6a')), 1.8, h - 0.9, 0); add(g, m(boxT(0.5, 0.5, 0.5, 1), M.planks), 1.8, h - 1.9, 0); return g; }

// ---------- Typen je Epoche ----------
const BUILDERS = {
  town: [
    c => { const g = G(); add(g, roundHut(c, 3.2, 1.6, 3.8, E.hide)); add(g, tent(c, 1, 1.8), -3, 0, 2.2, 0, 0.5); add(g, tent(c, 0.9, 1.6), 3, 0, 2.3); add(g, fire(0.7), 0, 0, 3.6); const tot = G(); add(tot, m(cylT(0.22, 0.28, 3.6, 8, 1), E.pole), 0, 1.8, 0); add(tot, m(boxT(1, 0.15, 0.2, 1), E.pole), 0, 3, 0); add(tot, m(boxT(0.5, 0.45, 0.5, 1), teamCloth(c)), 0, 3.8, 0); add(g, tot, 2.2, 0, 3.4); return g; },
    c => { const g = G(); for (let k = 0; k < 3; k++) add(g, m(boxT(6.2 - k * 1.6, 1.3, 6.2 - k * 1.6, 2), E.adobe), 0, 0.65 + k * 1.3, 0); add(g, adobeBox(c, 2, 2, 1.6, 4), 0, 3.9, 0); for (let k = 0; k < 4; k++) add(g, m(boxT(1.2, 0.2, 0.35, 1), E.adobe), 0, 0.1 + k * 0.33, 3.3 - k * 0.3); add(g, banner(c, 2.4, 0.7, 1.0, 0.15), 2.4, 2.6, 2.4); add(g, banner(c, 2.4, 0.7, 1.0, 0.15), -2.4, 2.6, 2.4); return g; },
    c => { const g = G(); add(g, roundHut(c, 3, 1.6, 3.6, E.wattle)); add(g, m(cylT(3.2, 3.4, 0.5, 20, 1.5), M.stoneDark), 0, 0.25, 0); add(g, palisadeRing(5.4, 30, 7, 1.8)); add(g, roundHut(c, 1.2, 1, 1.6), -3.8, 0, -2); add(g, fire(0.6), 2.5, 0, 3); return g; },
    c => { const g = G(); add(g, m(boxT(8, 2.4, 4.2, 2), M.planks), 0, 1.2, 0); const rf = gableRoof(8, 4.2, 3.2, E.shingle, M.planks, 0.5, 0.2); rf.position.y = 2.4; g.add(rf); for (const s of [-1, 1]) { const hd = m(new THREE.ConeGeometry(0.15, 1.2, 5), M.beam); add(g, hd, s * 4.4, 5.6, 0, 0, 0, -s * 0.6); } door(g, 0, 0, 2.12, 0, 1.4, 1.9); add(g, m(new THREE.PlaneGeometry(1.2, 1.6), teamCloth(c)), -2.4, 1.3, 2.12); add(g, m(new THREE.PlaneGeometry(1.2, 1.6), teamCloth(c)), 2.4, 1.3, 2.12); add(g, palisadeRing(6.2, 34, 8, 2.2)); return g; },
    c => Md.keep(c),
    c => { const g = G(); add(g, brickHouse(c, 7, 4.6, 2, 3, E.brick, M.roofSlate)); for (let k = 0; k < 4; k++) add(g, m(cylT(0.22, 0.25, 3.4, 12, 1), Md.col('#ece6da', 0.5)), -1.8 + k * 1.2, 2.1, 2.9); add(g, m(boxT(5.2, 0.4, 1.2, 1), Md.col('#ece6da', 0.5)), 0, 4, 2.8); add(g, m(boxT(1.8, 4.5, 1.8, 2), E.brick), 0, 6.4, 0); add(g, m(new THREE.CircleGeometry(0.6, 20), Md.col('#f4f0e4', 0.4)), 0, 7.6, 0.92); add(g, m(new THREE.ConeGeometry(1.4, 2.4, 4), M.roofSlate), 0, 9.8, 0, 0, Math.PI / 4); add(g, banner(c, 1.6, 0.6, 1.0, 0.2), 0, 11, 0); return g; },
    c => { const g = G(); add(g, m(boxT(9, 5, 6, 2), E.yellowBrick), 0, 2.5, 0); for (let k = 0; k < 6; k++) { windowAt(g, -3.6 + k * 1.45, 1.6, 3.05, 0, k % 2 === 0, 0.6, 1.2); windowAt(g, -3.6 + k * 1.45, 3.6, 3.05, 0, k % 3 === 0, 0.6, 1.2); } for (let k = 0; k < 6; k++) add(g, m(cylT(0.25, 0.28, 4.2, 12, 1), E.marble), -2.5 + k * 1, 2.1, 3.7); add(g, m(boxT(6.4, 0.5, 1.6, 1), E.marble), 0, 4.45, 3.5); const tri = new THREE.Shape(); tri.moveTo(-3.2, 0); tri.lineTo(3.2, 0); tri.lineTo(0, 1.2); add(g, m(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }), E.marble), 0, 4.7, 3.3); add(g, m(cylT(2, 2.2, 1.4, 24, 1.5), E.yellowBrick), 0, 5.7, 0); add(g, m(new THREE.SphereGeometry(2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), E.copper), 0, 6.4, 0); add(g, m(cylT(0.35, 0.35, 1, 10, 1), E.copper), 0, 8.7, 0); add(g, banner(c, 2, 0.8, 1.2, 0.2), 0, 9.2, 0); return g; },
  ],
  house: [
    c => tent(c, 1.5, 2.4),
    c => adobeBox(c, 3.2, 2.8, 2.3, 2),
    c => roundHut(c, 1.7, 1.2, 2.4),
    c => { const g = G(); add(g, m(boxT(3.6, 1.8, 2.8, 2), M.planks), 0, 0.9, 0); const rf = gableRoof(3.6, 2.8, 2, M.thatch, M.planks, 0.5, 0.4); rf.position.y = 1.8; g.add(rf); door(g, 0, 0, 1.42, 0, 0.8, 1.4); add(g, m(new THREE.PlaneGeometry(0.5, 0.35), teamCloth(c)), 1, 1.3, 1.42); return g; },
    c => Md.halfTimberHouse(c, 5, { w: 3.6, d: 3.2, floors: 2, roof: 'red' }),
    c => brickHouse(c, 3.4, 3, 2, 4),
    c => { const g = brickHouse(c, 3.6, 3.2, 3, 5, E.darkBrick, E.metal); add(g, m(boxT(1.8, 0.08, 0.6, 1), E.iron), 0.9, 2.3, 1.9); for (let k = 0; k < 6; k++) add(g, m(cylT(0.02, 0.02, 0.7, 4, 1), E.iron), 0.1 + k * 0.32, 2.65, 2.15); return g; },
  ],
  storage: [
    c => { const g = G(); add(g, m(cylT(1.4, 1.2, 0.3, 14, 1), col('#4a3420', 1)), 0, 0.05, 0); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; add(g, m(new THREE.CylinderGeometry(0.32, 0.25, 0.6, 10), col('#a07a48', 0.9)), Math.cos(a) * 1, 0.3, Math.sin(a) * 1); } add(g, tent(c, 1, 1.6), 0, 0, -1.6); return g; },
    c => { const g = adobeBox(c, 3.4, 3, 2.2, 7); for (let k = 0; k < 4; k++) add(g, m(new THREE.CylinderGeometry(0.28, 0.2, 0.7, 10), col('#a8643a', 0.8)), -1.2 + k * 0.8, 0.35, 2); return g; },
    c => { const g = G(); for (let k = 0; k < 2; k++) { const gr = G(); add(gr, m(cylT(0.9, 0.9, 1.4, 12, 1), E.wattle), 0, 1.3, 0); const rf = m(coneT(1.2, 1.4, 12, 1), M.thatch); rf.material.side = THREE.DoubleSide; add(gr, rf, 0, 2.7, 0); for (let j = 0; j < 4; j++) { const a = j / 4 * 6.28; add(gr, m(cylT(0.08, 0.08, 0.7, 5, 1), E.pole), Math.cos(a) * 0.6, 0.35, Math.sin(a) * 0.6); } add(g, gr, -1.2 + k * 2.4, 0, 0); } add(g, Md.woodpile(), 0, 0, 1.8); return g; },
    c => { const g = Md.cottage(c, 5); add(g, Md.woodpile(), 1.4, 0, 2.2); for (let k = 0; k < 3; k++) add(g, Md.barrel(), -1.4 + k * 0.7, 0, 2.1); return g; },
    c => { const g = Md.halfTimberHouse(c, 8, { w: 4.4, d: 3.4, floors: 1, roof: 'slate' }); add(g, crane(3.6), 1.6, 0, 1.9); for (let k = 0; k < 4; k++) add(g, Md.crate(), -1.6 + k * 0.9, 0, 2.3); return g; },
    c => { const g = brickHouse(c, 4.6, 3.6, 2, 9, E.brick, M.roofSlate); add(g, crane(4.4), 2.2, 0, 2.1); for (let k = 0; k < 4; k++) add(g, Md.barrel(), -2 + k * 0.7, 0, 2.3); return g; },
    c => { const g = G(); add(g, m(boxT(4.2, 3.2, 3.2, 2), E.darkBrick), -0.8, 1.6, 0); const rf = gableRoof(4.2, 3.2, 1, E.metal, E.darkBrick, 0.2); rf.position.set(-0.8, 3.2, 0); g.add(rf); add(g, silo(1, 5.5), 2.2, 0, -0.6); add(g, silo(0.8, 4.5), 2.4, 0, 1.4); return g; },
  ],
  farm: [0, 1, 2, 3, 4, 5, 6].map(e => c => { const g = Md.field(4, 4, 3 + e, e !== 0); if (e >= 5) add(g, Md.haystack(), 1.5, 0, 1.5, 0, 0, 0, 0.5); if (e === 0) for (let k = 0; k < 6; k++) add(g, m(new THREE.DodecahedronGeometry(0.15), col('#7a6a5a')), -1.8 + k * 0.7, 0.1, 2.2); return g; }),
  barracks: [
    c => { const g = G(); for (let k = 0; k < 3; k++) add(g, tent(c, 1.2, 2), -2.4 + k * 2.4, 0, -1.2); add(g, fire(0.7), 0, 0, 1.6); add(g, weaponRack(col('#7a6a5a')), 2.6, 0, 2); return g; },
    c => { const g = adobeBox(c, 5.4, 3.6, 2.6, 3); add(g, weaponRack(M.gold), -2, 0, 2.6); add(g, m(boxT(5.6, 1.2, 0.3, 2), E.adobe), 0, 0.6, 3.6); return g; },
    c => { const g = G(); add(g, roundHut(c, 2.2, 1.3, 2.8)); add(g, roundHut(c, 1.4, 1, 1.9), -3.2, 0, 1); add(g, weaponRack(), 2.8, 0, 2.2); add(g, palisadeRing(4.8, 24, 6, 1.6)); return g; },
    c => { const g = G(); add(g, m(boxT(6, 2.2, 3.6, 2), M.planks), 0, 1.1, -0.6); const rf = gableRoof(6, 3.6, 2.4, E.shingle, M.planks, 0.4, 0.2); rf.position.set(0, 2.2, -0.6); g.add(rf); door(g, 0, 0, 1.22, 0, 1.2, 1.7); add(g, weaponRack(), 2.2, 0, 2.4); add(g, fence(6), 0, 0, 3.3); return g; },
    c => Md.barracksB(c),
    c => { const g = brickHouse(c, 7, 4, 2, 11, E.brick, M.roofSlate); add(g, banner(c, 3, 0.9, 1.4, 0.25), 3.8, 0, 2.6); for (let k = 0; k < 6; k++) add(g, m(cylT(0.04, 0.04, 1.2, 5, 1), E.iron), -3 + k * 1.2, 0.6, 3.4); return g; },
    c => { const g = brickHouse(c, 7.4, 4.2, 3, 12, E.darkBrick, E.metal); add(g, m(cylT(0.05, 0.05, 6, 5, 1), E.iron), 4, 3, 2.6); add(g, banner(c, 5.8, 0.9, 1.4, 0.2), 4, 0, 2.6); return g; },
  ],
  range: [
    c => { const g = G(); add(g, tent(c, 1.2, 2), -2, 0, -1.4); add(g, targets(2, 2), 1, 0, 1.8); return g; },
    c => { const g = adobeBox(c, 4, 3, 2.2, 5); add(g, targets(3), 0, 0, 3.2); return g; },
    c => { const g = roundHut(c, 1.8, 1.1, 2.3); add(g, targets(3), 0, 0, 3); return g; },
    c => { const g = G(); add(g, m(boxT(4.4, 1.9, 2.8, 2), M.planks), 0, 0.95, -1); const rf = gableRoof(4.4, 2.8, 1.8, M.thatch, M.planks, 0.5, 0.3); rf.position.set(0, 1.9, -1); g.add(rf); add(g, targets(3), 0, 0, 2.6); return g; },
    c => { const g = Md.halfTimberHouse(c, 11, { w: 5, d: 3.6, floors: 1, roof: 'slate' }); add(g, targets(3, 1.8), 0, 0, 3.2); return g; },
    c => { const g = brickHouse(c, 5, 3.4, 1, 13); add(g, targets(3, 1.8), 0, 0, 3.2); return g; },
    c => { const g = brickHouse(c, 5.4, 3.6, 2, 14, E.darkBrick, E.metal); add(g, Md.wallSeg ? m(boxT(5, 1.2, 0.8, 1.5), E.concrete) : G(), 0, 0.6, 3.2); add(g, targets(3, 1.8), 0, 0.6, 3.4); return g; },
  ],
  stable: [
    c => G(),
    c => { const g = adobeBox(c, 4.4, 3, 2.2, 6); add(g, fence(5), 0, 0, 3); add(g, trough(), 0, 0, 2.3); return g; },
    c => { const g = roundHut(c, 1.8, 1.2, 2.4); add(g, fence(5), 0.6, 0, 2.8); add(g, Md.haystack(), 2.4, 0, 0.8, 0, 0, 0, 0.7); return g; },
    c => { const g = G(); add(g, m(boxT(5, 2, 3, 2), M.planks), 0, 1, -0.8); const rf = gableRoof(5, 3, 1.8, M.thatch, M.planks, 0.4, 0.35); rf.position.set(0, 2, -0.8); g.add(rf); add(g, fence(5.4), 0, 0, 2.6); add(g, trough(), 0, 0, 1.6); return g; },
    c => { const g = Md.cottage(c, 9); add(g, Md.haystack(), 2.3, 0, 1.6, 0, 0, 0, 0.7); add(g, fence(5.4), 0, 0, 2.8); return g; },
    c => { const g = brickHouse(c, 5.4, 3.4, 1, 15, E.brick, M.roofSlate); add(g, fence(5.6, 1.1, M.beam), 0, 0, 3); add(g, trough(), 1.4, 0, 2.3); return g; },
    c => { const g = G(); add(g, m(boxT(6, 3.4, 4, 2), E.darkBrick), 0, 1.7, -0.4); for (let k = 0; k < 3; k++) add(g, m(boxT(1.5, 2.4, 0.1, 1), E.metal), -2 + k * 2, 1.2, 1.62); const rf = gableRoof(6, 4, 1.2, E.metal, E.darkBrick, 0.2); rf.position.set(0, 3.4, -0.4); g.add(rf); add(g, m(boxT(3, 0.15, 1.4, 1), E.concrete), 0, 0.07, 2.6); return g; },
  ],
  tower: [
    c => { const g = G(); for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) add(g, m(cylT(0.12, 0.15, 4.4, 6, 1), E.pole), x, 2.2, z); add(g, m(boxT(2.2, 0.15, 2.2, 1), M.planks), 0, 4.2, 0); add(g, m(new THREE.ConeGeometry(1.6, 1.4, 4, 1, true), E.hide), 0, 5.2, 0, 0, Math.PI / 4); add(g, banner(c, 1.2, 0.4, 0.6, 0.1), 0.9, 4.3, 0.9); return g; },
    c => { const g = G(); add(g, m(boxT(2.6, 5, 2.6, 2), E.adobe), 0, 2.5, 0); for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { add(g, m(boxT(0.4, 0.5, 0.4, 1), E.adobe), s * 1.1, 5.25, -1.1 + k * 0.73); add(g, m(boxT(0.4, 0.5, 0.4, 1), E.adobe), -1.1 + k * 0.73, 5.25, s * 1.1); } add(g, m(boxT(0.3, 0.6, 0.1, 1), E.dark), 0, 3.6, 1.31); add(g, banner(c, 1.6, 0.6, 0.9, 0.15), 0, 5.3, 0); return g; },
    c => { const g = G(); add(g, m(cylT(1.5, 1.7, 1.6, 16, 1.5), M.stoneDark), 0, 0.8, 0); add(g, m(cylT(1.3, 1.4, 3.2, 16, 1.5), E.wattle), 0, 3.2, 0); const rf = m(coneT(1.8, 2, 16, 1), M.thatch); rf.material.side = THREE.DoubleSide; add(g, rf, 0, 5.8, 0); add(g, banner(c, 1.2, 0.5, 0.8, 0.12), 0, 6.6, 0); return g; },
    c => { const g = G(); add(g, m(boxT(2.4, 5.4, 2.4, 2), M.planks), 0, 2.7, 0); add(g, m(boxT(3.2, 1.1, 3.2, 2), M.planks), 0, 5.9, 0); const rf = m(new THREE.ConeGeometry(2.6, 2.2, 4), E.shingle); add(g, rf, 0, 7.5, 0, 0, Math.PI / 4); add(g, banner(c, 1.4, 0.5, 0.8, 0.12), 0, 8.4, 0); return g; },
    c => Md.roundTower(c, 8, 1.6),
    c => { const g = G(); const base = m(new THREE.CylinderGeometry(2.4, 2.8, 3, 6), M.stone); add(g, base, 0, 1.5, 0); add(g, m(cylT(2.5, 2.5, 0.5, 6, 1), M.stoneDark), 0, 3.2, 0); const cn = G(); add(cn, m(cylT(0.13, 0.17, 1.6, 10, 1), E.iron), 0, 0.5, 0.6, Math.PI / 2 - 0.1); add(cn, m(cylT(0.35, 0.35, 0.12, 12, 1), E.pole), 0.35, 0.35, 0, 0, 0, Math.PI / 2); add(cn, m(cylT(0.35, 0.35, 0.12, 12, 1), E.pole), -0.35, 0.35, 0, 0, 0, Math.PI / 2); add(g, cn, 0, 3.4, 0.4); add(g, banner(c, 2.2, 0.6, 1, 0.15), -1.5, 3.4, -1.5); return g; },
    c => { const g = G(); add(g, m(new THREE.CylinderGeometry(2.2, 2.6, 2.6, 10), E.concrete), 0, 1.3, 0); add(g, m(new THREE.BoxGeometry(2.8, 0.3, 0.3), E.dark), 0, 1.8, 2.2); const tur = G(); add(tur, m(new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), E.iron), 0, 0, 0); add(tur, m(cylT(0.12, 0.14, 2.2, 10, 1), E.iron), 0, 0.5, 1.4, Math.PI / 2); add(g, tur, 0, 2.6, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; add(g, m(boxT(0.6, 0.5, 0.5, 1), col('#c8b88a', 1)), Math.cos(a) * 2.6, 0.25, Math.sin(a) * 2.6, 0, -a); } add(g, banner(c, 2, 0.6, 0.9, 0.12), 1.6, 2.6, -1.4); return g; },
  ],
  workshop: [
    c => G(), c => G(),
    c => { const g = roundHut(c, 1.9, 1.2, 2.4); add(g, m(boxT(1, 0.8, 1, 1), M.stoneDark), 2, 0.4, 1.5); add(g, m(boxT(0.6, 0.15, 0.6, 1), E.glow), 2, 0.85, 1.5); add(g, m(cylT(0.18, 0.22, 0.5, 8, 1), E.pole), 0.6, 0.25, 2.4); add(g, m(boxT(0.5, 0.18, 0.2, 1), E.iron), 0.6, 0.58, 2.4); return g; },
    c => { const g = G(); add(g, m(boxT(4.4, 2, 3, 2), M.planks), 0, 1, -0.6); const rf = gableRoof(4.4, 3, 1.8, E.shingle, M.planks, 0.4, 0.2); rf.position.set(0, 2, -0.6); g.add(rf); add(g, m(boxT(1, 0.9, 1, 1), M.stoneDark), -1.4, 0.45, 1.6); add(g, m(boxT(0.6, 0.15, 0.6, 1), E.glow), -1.4, 0.95, 1.6); add(g, Md.woodpile(), 1.2, 0, 1.8, 0, 0, 0, 0.7); return g; },
    c => Md.blacksmith(Md.fire),
    c => { const g = brickHouse(c, 6, 4, 1, 16, E.brick, M.roofSlate); add(g, chimney(9, 0.5), 2.4, 0, -1.2); add(g, m(cylT(1.4, 1.4, 0.25, 20, 1), M.wood), -3.2, 1.6, 0.5, 0, 0, Math.PI / 2); return g; },
    c => Md.factory ? Md.factory(c) : (() => { const g = G(); add(g, m(boxT(8, 4, 5, 2), E.darkBrick), 0, 2, 0); for (let k = 0; k < 4; k++) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2, 0); sh.lineTo(0, 1.4); const rg = new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false }); add(g, m(rg, E.metal), -4 + k * 2, 4, -2.5); add(g, m(new THREE.PlaneGeometry(1.7, 5), M.glass), -3.2 + k * 2, 4.7, 0, 0, -Math.PI / 2, -0.6); } add(g, chimney(12, 0.6, E.darkBrick), 3, 0, -2); add(g, chimney(10, 0.5, E.darkBrick), 1.6, 0, -2); for (let k = 0; k < 3; k++) add(g, m(boxT(1.6, 2.6, 0.1, 1), E.metal), -2.8 + k * 2.4, 1.3, 2.52); return g; })(),
  ],
  wall: [
    c => { const g = G(); for (let k = 0; k < 6; k++) { add(g, m(cylT(0.16, 0.18, 2.3, 6, 1), E.pole), -0.85 + (k % 3) * 0.85, 1.15, -0.4 + Math.floor(k / 3) * 0.8); add(g, m(new THREE.ConeGeometry(0.16, 0.35, 6), E.pole), -0.85 + (k % 3) * 0.85, 2.45, -0.4 + Math.floor(k / 3) * 0.8); } return g; },
    c => { const g = G(); add(g, m(boxT(2, 2.6, 2, 2), E.adobe), 0, 1.3, 0); for (const s of [-1, 1]) add(g, m(boxT(0.5, 0.5, 2, 1), E.adobe), s * 0.6, 2.85, 0); return g; },
    c => { const g = G(); add(g, m(boxT(2, 1.4, 2, 1.5), M.stoneDark), 0, 0.7, 0); for (let k = 0; k < 6; k++) add(g, m(cylT(0.15, 0.16, 1.6, 6, 1), E.pole), -0.85 + (k % 3) * 0.85, 2.2, -0.4 + Math.floor(k / 3) * 0.8); return g; },
    c => { const g = G(); for (let k = 0; k < 9; k++) add(g, m(cylT(0.18, 0.2, 3, 6, 1), E.pole), -0.8 + (k % 3) * 0.8, 1.5, -0.8 + Math.floor(k / 3) * 0.8); add(g, m(boxT(2, 0.12, 1, 1), M.planks), 0, 2.2, -0.3); return g; },
    c => Md.wallSeg(2, 3.2, 2),
    c => { const g = G(); add(g, m(boxT(2, 3.2, 2, 2), E.brick), 0, 1.6, 0); add(g, m(boxT(2.1, 0.25, 2.1, 1), M.stoneDark), 0, 3.3, 0); return g; },
    c => { const g = G(); add(g, m(boxT(2, 2.8, 1.8, 2), E.concrete), 0, 1.4, 0); for (let k = 0; k < 4; k++) add(g, m(cylT(0.03, 0.03, 0.9, 4, 1), E.iron), -0.8 + k * 0.53, 3.2, 0); add(g, m(new THREE.TorusGeometry(0.25, 0.012, 3, 10), E.iron), 0, 3.5, 0, 0, Math.PI / 2, 0, [3.5, 1, 1]); return g; },
  ],
};

// ---------- Weltwunder ----------
export function wonder(color) {
  mats();
  const g = G();
  for (let k = 0; k < 3; k++) add(g, m(boxT(16 - k * 3, 1, 16 - k * 3, 2), E.marble), 0, 0.5 + k, 0);
  for (let k = 0; k < 6; k++) add(g, m(boxT(4, 0.3, 0.8, 1), E.marble), 0, 0.15 + k * 0.5, 9 - k * 0.45);
  // Säulenhalle
  const R = 5.2;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(g, m(cylT(0.36, 0.42, 5.6, 14, 1), E.marble), Math.cos(a) * R, 5.8, Math.sin(a) * R); add(g, m(boxT(0.95, 0.3, 0.95, 1), E.marble), Math.cos(a) * R, 8.75, Math.sin(a) * R); }
  add(g, m(cylT(R + 0.6, R + 0.6, 0.9, 32, 2), E.marble), 0, 9.3, 0);
  add(g, m(new THREE.TorusGeometry(R + 0.6, 0.12, 6, 40), E.goldLeaf), 0, 9.75, 0, Math.PI / 2);
  add(g, m(cylT(3.6, 3.6, 5.4, 32, 2), E.marble), 0, 5.8, 0);
  // Tambour + goldene Kuppel
  add(g, m(cylT(4.2, 4.4, 2.2, 32, 2), E.marble), 0, 10.9, 0);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; windowAt(g, Math.cos(a) * 4.32, 10.9, Math.sin(a) * 4.32, Math.PI / 2 - a, k % 2 === 0, 0.55, 1.2); }
  add(g, m(new THREE.SphereGeometry(4.3, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), E.goldLeaf), 0, 12, 0);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const rib = m(new THREE.TorusGeometry(4.32, 0.06, 4, 24, Math.PI / 2), E.marble); rib.rotation.set(0, -a, 0); rib.position.y = 12; g.add(rib); }
  add(g, m(cylT(0.9, 1.1, 1.6, 16, 1), E.marble), 0, 16.9, 0);
  add(g, m(new THREE.SphereGeometry(0.8, 16, 12), E.goldLeaf), 0, 18.2, 0);
  add(g, m(new THREE.ConeGeometry(0.25, 1.8, 10), E.goldLeaf), 0, 19.5, 0);
  // Vier Obelisken mit Flammen
  for (const [x, z] of [[-6.6, -6.6], [6.6, -6.6], [-6.6, 6.6], [6.6, 6.6]]) {
    add(g, m(boxT(1.4, 1.2, 1.4, 1), E.marble), x, 3.6, z);
    add(g, m(new THREE.CylinderGeometry(0.35, 0.6, 7, 4), E.marble), x, 7.7, z, 0, Math.PI / 4);
    add(g, m(new THREE.ConeGeometry(0.5, 1, 4), E.goldLeaf), x, 11.7, z, 0, Math.PI / 4);
    add(g, banner(color, 3.2, 1.2, 2.2, 0.35), x * 0.78, 3, z * 0.78);
  }
  // Statue vorne
  const st = G(); add(st, m(boxT(1.6, 1.6, 1.6, 1), E.marble), 0, 0.8, 0); add(st, m(new THREE.CapsuleGeometry(0.45, 1.4, 4, 10), E.goldLeaf), 0, 2.6, 0); add(st, m(new THREE.SphereGeometry(0.35, 12, 10), E.goldLeaf), 0, 3.85, 0); add(st, m(cylT(0.06, 0.06, 2.6, 6, 1), E.goldLeaf), 0.6, 3.6, 0, 0, 0, -0.3); add(g, st, 0, 3, 7.6);
  for (const s of [-1, 1]) add(g, m(new THREE.PlaneGeometry(2.2, 4), teamCloth(color)), s * 2.4, 6.2, 3.62);
  return g;
}

export function eraBuilding(type, era, color) {
  mats();
  if (era >= 7) return type === 'town' ? wonder(color) : eraBuilding(type, 6, color);
  const list = BUILDERS[type];
  if (!list) return Md.crate();
  let e = Math.max(0, Math.min(6, era));
  while (e < 6 && list[e](color).children.length === 0) e++; // Typen, die es in frühen Epochen noch nicht gibt
  return list[e](color);
}
export const ERA_TYPES = Object.keys(BUILDERS);
export { E, mats };
