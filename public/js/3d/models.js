// Detaillierte Modelle: Gebäude, Requisiten, Einheiten (texturiert, halbrealistisch).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { soldier as soldierHD } from './units.js';

const M = {};
export function initMaterials() {
  const tex = (t, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: rough, ...extra });
  const stone = TX.stoneWallTex(512, '#a8a090'), stoneDark = TX.stoneWallTex(512, '#8a8478');
  const roofRed = TX.roofTileTex(512, '#a4472f'), roofSlate = TX.roofTileTex(512, '#4d5866'), roofGreen = TX.roofTileTex(512, '#2f5446');
  const thatch = TX.thatchTex(), planks = TX.plankTex(512, '#7a5634'), plankDark = TX.plankTex(512, '#4a3524'), plaster = TX.plasterTex(), cloth = TX.clothTex();
  Object.assign(M, {
    stone: tex(stone), stoneDark: tex(stoneDark), roofRed: tex(roofRed, 0.8), roofSlate: tex(roofSlate, 0.7), roofGreen: tex(roofGreen, 0.7),
    thatch: tex(thatch, 1), planks: tex(planks), beam: tex(plankDark), plaster: tex(plaster, 0.95), cloth,
    glass: new THREE.MeshStandardMaterial({ color: '#2a3440', roughness: 0.2, metalness: 0.3 }),
    lit: new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb050', emissiveIntensity: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: '#b8bec6', roughness: 0.35, metalness: 0.85 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.5, metalness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d8a83a', roughness: 0.35, metalness: 0.9 }),
    leather: new THREE.MeshStandardMaterial({ color: '#5a3c22', roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.8 }),
    rope: new THREE.MeshStandardMaterial({ color: '#b39a6a', roughness: 1 }),
  });
}
const teamMats = new Map();
export function teamCloth(color) {
  if (!teamMats.has(color)) teamMats.set(color, new THREE.MeshStandardMaterial({ map: M.cloth.map, normalMap: M.cloth.normalMap, color, roughness: 0.85, side: THREE.DoubleSide }));
  return teamMats.get(color);
}
const colMats = new Map();
export function col(c, rough = 0.85, metal = 0) { const k = c + rough + metal; if (!colMats.has(k)) colMats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal })); return colMats.get(k); }

// ---------- Geometrie-Helfer ----------
function m(geo, mat, cast = true) { const o = new THREE.Mesh(geo, mat); o.castShadow = cast; o.receiveShadow = true; return o; }
function put(o, x, y, z, rx = 0, ry = 0, rz = 0, s) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s) Array.isArray(s) ? o.scale.set(...s) : o.scale.setScalar(s); return o; }
// Box mit maßstabsgerechten UVs (Textur wiederholt sich je `t` Meter)
export function boxT(w, h, d, t = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
}
export function cylT(rt, rb, h, seg = 16, t = 2, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), uv = g.attributes.uv;
  const c = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * c / t, uv.getY(i) * h / t);
  return g;
}
function coneT(r, h, seg = 16, t = 1.5) {
  const g = new THREE.ConeGeometry(r, h, seg, 4, true), uv = g.attributes.uv;
  const sl = Math.hypot(r, h), c = Math.PI * 2 * r;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * c / t, uv.getY(i) * sl / t);
  return g;
}
// Satteldach: zwei geneigte Platten + Giebeldreiecke
function gableRoof(w, d, h, mat, gableMat, over = 0.35, thick = 0.18) {
  const g = new THREE.Group();
  const slope = Math.hypot(d / 2 + over, h), ang = Math.atan2(h, d / 2 + over);
  for (const s of [-1, 1]) {
    const p = m(boxT(w + over * 2, thick, slope, 1.6), mat);
    p.position.set(0, h / 2, s * (d / 2 + over) / 2);
    p.rotation.x = s * ang;
    g.add(p);
  }
  // First
  g.add(put(m(cylT(0.12, 0.12, w + over * 2, 8, 1), mat), 0, h + 0.05, 0, 0, 0, Math.PI / 2));
  if (gableMat) {
    const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, h); sh.lineTo(-d / 2, 0);
    const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, gg.attributes.position.getX(i) / 2, gg.attributes.position.getY(i) / 2);
    for (const s of [-1, 1]) { const tri = m(gg, gableMat); tri.material = gableMat; tri.rotation.y = Math.PI / 2 * s; tri.position.x = s * w / 2; g.add(tri); }
    gableMat.side = THREE.DoubleSide;
  }
  return g;
}
function windowAt(g, x, y, z, ry, lit = false, w = 0.55, h = 0.75) {
  const wnd = new THREE.Group();
  wnd.add(put(m(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.08), M.beam), 0, 0, 0));
  wnd.add(put(m(new THREE.BoxGeometry(w, h, 0.1), lit ? M.lit : M.glass), 0, 0, 0.01));
  wnd.add(put(m(new THREE.BoxGeometry(0.05, h, 0.12), M.beam), 0, 0, 0.02));
  wnd.add(put(m(new THREE.BoxGeometry(w, 0.05, 0.12), M.beam), 0, 0, 0.02));
  wnd.add(put(m(new THREE.BoxGeometry(w + 0.25, 0.08, 0.2), M.beam), 0, -h / 2 - 0.06, 0.06));
  put(wnd, x, y, z, 0, ry, 0);
  g.add(wnd);
}
function door(g, x, y, z, ry, w = 0.9, h = 1.6) {
  const d = new THREE.Group();
  d.add(put(m(boxT(w, h, 0.12, 1), M.planks), 0, h / 2, 0));
  d.add(put(m(new THREE.BoxGeometry(w + 0.2, 0.15, 0.2), M.beam), 0, h + 0.05, 0.02));
  d.add(put(m(new THREE.BoxGeometry(0.08, 0.08, 0.1), M.darkMetal), w * 0.3, h * 0.5, 0.08));
  put(d, x, y, z, 0, ry, 0);
  g.add(d);
}
export function banner(color, h = 2.2, w = 0.9, len = 1.4, wave = 0.25) {
  const g = new THREE.Group();
  g.add(put(m(cylT(0.04, 0.05, h + len * 0.2, 6, 1), M.wood), 0, (h + len * 0.2) / 2, 0));
  g.add(put(m(new THREE.SphereGeometry(0.08, 8, 6), M.gold), 0, h + len * 0.2 + 0.05, 0));
  const pg = new THREE.PlaneGeometry(len, w, 10, 3);
  const p = pg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + len / 2; p.setZ(i, Math.sin(x * 3) * wave * (x / len)); p.setX(i, x); }
  pg.computeVertexNormals();
  g.add(put(m(pg, teamCloth(color)), 0.03, h - w / 2 + len * 0.2, 0));
  return g;
}

// ---------- Gebäude ----------
export function halfTimberHouse(color, seed = 1, { w = 4.2, d = 3.4, floors = 2, roof = 'red' } = {}) {
  const r = TX.rng(seed), g = new THREE.Group();
  const fh = 1.9, base = 0.6, H = base + floors * fh;
  g.add(put(m(boxT(w + 0.2, base, d + 0.2, 1.5), M.stone), 0, base / 2, 0));
  g.add(put(m(boxT(w, floors * fh, d, 2), M.plaster), 0, base + floors * fh / 2, 0));
  // Fachwerk auf allen Seiten
  const beams = (len, axis, fx, fz, ry) => {
    const grp = new THREE.Group();
    for (let f = 0; f <= floors; f++) grp.add(put(m(boxT(len + 0.1, 0.16, 0.12, 1), M.beam), 0, base + f * fh, 0));
    const posts = Math.max(2, Math.round(len / 1.1));
    for (let k = 0; k <= posts; k++) { const x = -len / 2 + k * len / posts; grp.add(put(m(boxT(0.15, floors * fh, 0.12, 1), M.beam), x, base + floors * fh / 2, 0)); }
    for (let f = 0; f < floors; f++) for (let k = 0; k < posts; k += 2) {
      const x0 = -len / 2 + k * len / posts, x1 = x0 + len / posts, dl = Math.hypot(x1 - x0, fh);
      grp.add(put(m(boxT(0.12, dl, 0.1, 1), M.beam), (x0 + x1) / 2, base + f * fh + fh / 2, 0, 0, 0, (k / 2 + f) % 2 ? Math.atan2(x1 - x0, fh) : -Math.atan2(x1 - x0, fh)));
    }
    put(grp, fx, 0, fz, 0, ry, 0);
    g.add(grp);
  };
  beams(w, 0, 0, d / 2 + 0.05, 0); beams(w, 0, 0, -d / 2 - 0.05, Math.PI); beams(d, 0, w / 2 + 0.05, 0, Math.PI / 2); beams(d, 0, -w / 2 - 0.05, 0, -Math.PI / 2);
  // Fenster & Tür
  for (let f = 0; f < floors; f++) for (const x of [-w * 0.3, w * 0.3]) {
    if (f === 0 && x < 0) continue;
    windowAt(g, x, base + f * fh + 1.0, d / 2 + 0.1, 0, r() < 0.3);
    windowAt(g, x, base + f * fh + 1.0, -d / 2 - 0.1, Math.PI, false);
  }
  for (let f = 0; f < floors; f++) windowAt(g, w / 2 + 0.1, base + f * fh + 1.0, 0, Math.PI / 2, r() < 0.2);
  door(g, -w * 0.3, base, d / 2 + 0.08, 0);
  const roofMat = roof === 'slate' ? M.roofSlate : roof === 'thatch' ? M.thatch : M.roofRed;
  const rf = gableRoof(w, d, d * 0.75, roofMat, M.plaster);
  rf.position.y = H; g.add(rf);
  // Kamin
  g.add(put(m(boxT(0.6, 1.8, 0.6, 1), M.stone), w * 0.25, H + d * 0.45, -d * 0.15));
  g.add(put(m(boxT(0.75, 0.15, 0.75, 1), M.stoneDark), w * 0.25, H + d * 0.45 + 0.95, -d * 0.15));
  // Fahne in Teamfarbe am Giebel
  const b = banner(color, 1.2, 0.5, 0.8, 0.1); put(b, -w / 2 - 0.3, H + 0.2, 0, 0, Math.PI / 2, 0); g.add(b);
  return g;
}
export function cottage(color, seed = 1) {
  const g = new THREE.Group(), w = 3.4, d = 2.8, h = 1.8;
  g.add(put(m(boxT(w + 0.1, 0.35, d + 0.1, 1.5), M.stone), 0, 0.17, 0));
  g.add(put(m(boxT(w, h, d, 1.5), M.planks), 0, 0.35 + h / 2, 0));
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(put(m(boxT(0.2, h, 0.2, 1), M.beam), x, 0.35 + h / 2, z));
  windowAt(g, w * 0.25, 1.3, d / 2 + 0.06, 0, seed % 3 === 0, 0.45, 0.55);
  door(g, -w * 0.2, 0.35, d / 2 + 0.06, 0, 0.8, 1.4);
  const rf = gableRoof(w, d, 1.7, M.thatch, M.planks, 0.5, 0.45); rf.position.y = 0.35 + h; g.add(rf);
  const b = banner(color, 0.9, 0.35, 0.55, 0.08); put(b, w / 2 + 0.2, 0.35 + h, d / 2, 0, 0, 0); g.add(b);
  return g;
}
export function roundTower(color, h = 7, r = 1.5, roofMat) {
  const g = new THREE.Group();
  g.add(put(m(cylT(r, r * 1.08, h, 20, 1.6), M.stone), 0, h / 2, 0));
  g.add(put(m(cylT(r * 1.12, r * 1.12, 0.4, 20, 1.6), M.stoneDark), 0, h - 0.1, 0));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.add(put(m(boxT(0.45, 0.6, 0.35, 1), M.stone), Math.cos(a) * r * 1.05, h + 0.4, Math.sin(a) * r * 1.05, 0, -a + Math.PI / 2, 0)); }
  const roof = m(coneT(r * 1.25, r * 2.0, 20), roofMat || M.roofSlate); roof.material.side = THREE.DoubleSide;
  g.add(put(roof, 0, h + 0.4 + r, 0));
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; g.add(put(m(new THREE.BoxGeometry(0.18, 0.7, 0.15), M.glass), Math.cos(a) * r * 1.01, h * (0.45 + (k % 2) * 0.2), Math.sin(a) * r * 1.01, 0, -a + Math.PI / 2, 0)); }
  const b = banner(color, 1.6, 0.6, 1.1, 0.2); b.position.y = h + 0.4 + r * 2; g.add(b);
  return g;
}
export function wallSeg(len = 6, h = 4.2, thick = 1.6) {
  const g = new THREE.Group();
  g.add(put(m(boxT(len, h, thick, 1.6), M.stone), 0, h / 2, 0));
  g.add(put(m(boxT(len, 0.3, thick + 0.15, 1.6), M.stoneDark), 0, 0.15, 0));
  for (let x = -len / 2 + 0.3; x < len / 2; x += 0.7) g.add(put(m(boxT(0.4, 0.55, 0.35, 1), M.stone), x, h + 0.27, thick / 2 - 0.17));
  for (let x = -len / 2 + 0.3; x < len / 2; x += 0.7) g.add(put(m(boxT(0.4, 0.4, 0.3, 1), M.stone), x, h + 0.2, -thick / 2 + 0.15));
  return g;
}
export function gatehouse(color) {
  const g = new THREE.Group();
  for (const x of [-3.2, 3.2]) g.add(put(roundTower(color, 8, 1.8), x, 0, 0));
  g.add(put(m(boxT(5, 6.2, 3, 1.6), M.stone), 0, 3.1, 0));
  for (let x = -2.2; x <= 2.2; x += 0.7) g.add(put(m(boxT(0.4, 0.55, 0.4, 1), M.stone), x, 6.45, 1.3));
  // Tor mit Fallgitter
  const arch = new THREE.Shape(); arch.moveTo(-1.3, 0); arch.lineTo(1.3, 0); arch.lineTo(1.3, 2.4); arch.absarc(0, 2.4, 1.3, 0, Math.PI, false); arch.lineTo(-1.3, 0);
  const ag = new THREE.ShapeGeometry(arch); g.add(put(m(ag, col('#1a1410')), 0, 0, 1.52));
  for (let x = -1.1; x <= 1.1; x += 0.36) g.add(put(m(new THREE.BoxGeometry(0.07, 3.2, 0.07), M.darkMetal), x, 1.9, 1.56));
  for (let y = 0.6; y < 3.6; y += 0.5) g.add(put(m(new THREE.BoxGeometry(2.6, 0.07, 0.07), M.darkMetal), 0, y, 1.56));
  const b = banner(color, 2.8, 1.2, 0.05, 0); g.add(put(b, 0, 3.2, 1.6));
  g.add(put(m(new THREE.PlaneGeometry(1.4, 2.2), teamCloth(color)), 0, 4.3, 1.55));
  return g;
}
export function keep(color) {
  // Haupthaus/Burg: Bergfried mit Ecktürmen und Halle
  const g = new THREE.Group();
  g.add(put(m(boxT(8, 7, 8, 1.6), M.stone), 0, 3.5, 0));
  g.add(put(m(boxT(8.3, 0.35, 8.3, 1.6), M.stoneDark), 0, 7, 0));
  for (let x = -3.7; x <= 3.7; x += 0.75) for (const z of [-4, 4]) { g.add(put(m(boxT(0.45, 0.6, 0.4, 1), M.stone), x, 7.45, z)); g.add(put(m(boxT(0.4, 0.6, 0.45, 1), M.stone), z, 7.45, x)); }
  const roof = gableRoof(5.5, 5.5, 3.2, M.roofSlate, M.stone, 0.2); roof.position.y = 7; g.add(roof);
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) g.add(put(roundTower(color, 9.5, 1.6), x, 0, z));
  for (let k = 0; k < 3; k++) { windowAt(g, -2 + k * 2, 4.8, 4.05, 0, k === 1, 0.5, 1.1); windowAt(g, 4.05, 4.8, -2 + k * 2, Math.PI / 2, false, 0.5, 1.1); }
  // Eingang + Treppe
  door(g, 0, 0.4, 4.08, 0, 1.6, 2.4);
  for (let k = 0; k < 3; k++) g.add(put(m(boxT(2.6, 0.2, 0.5, 1), M.stoneDark), 0, 0.1 + k * 0.2, 5.2 - k * 0.4));
  for (const x of [-1.6, 1.6]) g.add(put(m(new THREE.PlaneGeometry(1.0, 2.6), teamCloth(color)), x, 4.6, 4.06));
  const b = banner(color, 3, 1.4, 2.2, 0.35); g.add(put(b, 0, 10.2, 0));
  return g;
}
export function barracksB(color) {
  const g = new THREE.Group();
  g.add(put(m(boxT(9, 0.5, 5, 1.5), M.stone), 0, 0.25, 0));
  g.add(put(m(boxT(8.6, 3.2, 4.6, 1.6), M.stone), 0, 2.1, 0));
  const rf = gableRoof(8.6, 4.6, 2.6, M.roofRed, M.stone); rf.position.y = 3.7; g.add(rf);
  for (let k = 0; k < 4; k++) windowAt(g, -3 + k * 2, 2.6, 2.32, 0, k === 2, 0.5, 0.8);
  door(g, 0, 0.5, 2.33, 0, 1.6, 2.2);
  for (const x of [-1.6, 1.6]) g.add(put(m(new THREE.PlaneGeometry(0.8, 1.8), teamCloth(color)), x, 2.5, 2.34));
  // Hof mit Waffenständern und Übungspuppen
  const fence = (len, x, z, ry) => { const f = new THREE.Group(); for (let k = 0; k <= len; k++) f.add(put(m(cylT(0.07, 0.08, 1.1, 6, 1), M.wood), k - len / 2, 0.55, 0)); for (const y of [0.5, 0.95]) f.add(put(m(boxT(len, 0.08, 0.06, 1), M.wood), 0, y, 0)); put(f, x, 0, z, 0, ry, 0); g.add(f); };
  fence(8, 0, 7.5, 0); fence(5, -4.3, 5, Math.PI / 2); fence(5, 4.3, 5, Math.PI / 2);
  for (const x of [-2.5, 0, 2.5]) { const d = new THREE.Group(); d.add(put(m(cylT(0.06, 0.06, 1.6, 6, 1), M.wood), 0, 0.8, 0)); d.add(put(m(boxT(0.9, 0.08, 0.08, 1), M.wood), 0, 1.25, 0)); d.add(put(m(new THREE.SphereGeometry(0.22, 10, 8), M.thatch), 0, 1.75, 0)); d.add(put(m(cylT(0.22, 0.18, 0.6, 10, 1), M.thatch), 0, 1.25, 0)); put(d, x, 0, 5.5); g.add(d); }
  const rack = new THREE.Group(); rack.add(put(m(boxT(1.6, 0.08, 0.1, 1), M.wood), 0, 1.2, 0)); for (let k = 0; k < 5; k++) { rack.add(put(m(cylT(0.025, 0.025, 2.2, 4, 1), M.wood), -0.6 + k * 0.3, 1.1, 0.05, 0.1)); rack.add(put(m(new THREE.ConeGeometry(0.06, 0.25, 4), M.metal), -0.6 + k * 0.3, 2.25, 0.16)); } put(rack, 3.2, 0, 3.2); g.add(rack);
  return g;
}
export function windmill(color, rot = 0.4) {
  const g = new THREE.Group();
  g.add(put(m(cylT(1.6, 2.1, 6, 16, 1.6), M.stone), 0, 3, 0));
  const cap = new THREE.Group();
  cap.add(put(m(boxT(3, 1.8, 3.2, 1.5), M.planks), 0, 0.9, 0));
  const rf = gableRoof(3, 3.2, 1.4, M.thatch, M.planks, 0.3, 0.35); rf.position.y = 1.8; rf.rotation.y = Math.PI / 2; cap.add(rf);
  const sails = new THREE.Group(); sails.position.set(0, 1.2, 1.9); sails.rotation.z = rot;
  sails.add(put(m(cylT(0.18, 0.18, 0.6, 10, 1), M.wood), 0, 0, 0, Math.PI / 2, 0, 0));
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2;
    arm.add(put(m(boxT(0.14, 5.4, 0.12, 1), M.wood), 0, 2.7, 0));
    for (let s = 0; s < 8; s++) arm.add(put(m(boxT(1.1, 0.05, 0.05, 1), M.wood), 0.55, 0.9 + s * 0.6, 0.03));
    for (const x of [0.15, 1.05]) arm.add(put(m(boxT(0.05, 4.4, 0.05, 1), M.wood), x, 3.1, 0.03));
    arm.add(put(m(new THREE.PlaneGeometry(0.9, 4.2), col('#e8dcc4', 1)), 0.6, 3.1, 0.06));
    sails.add(arm);
  }
  cap.add(sails);
  put(cap, 0, 6, 0); g.add(cap);
  door(g, 0, 0, 2.05, 0, 0.9, 1.6);
  windowAt(g, 0, 3.4, 1.85, 0, false, 0.4, 0.6);
  const b = banner(color, 1.4, 0.5, 0.8, 0.12); g.add(put(b, 1.4, 6, 1.2));
  return g;
}
export function marketStall(color, seed = 1) {
  const g = new THREE.Group(), r = TX.rng(seed);
  for (const [x, z] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) g.add(put(m(cylT(0.06, 0.06, 2.2, 6, 1), M.wood), x, 1.1, z));
  g.add(put(m(boxT(2.4, 0.9, 1.4, 1), M.planks), 0, 0.45, 0.1));
  const aw = new THREE.PlaneGeometry(2.8, 2.0, 1, 1);
  const awn = m(aw, teamCloth(r() < 0.5 ? color : '#e8dcc4')); put(awn, 0, 2.25, 0, -Math.PI / 2 + 0.25, 0, 0); g.add(awn);
  const goods = ['#d84a3a', '#e8b03a', '#7ab04a', '#c87a3a'];
  for (let k = 0; k < 10; k++) g.add(put(m(new THREE.SphereGeometry(0.1, 8, 6), col(goods[k % 4], 0.6)), -0.9 + (k % 5) * 0.4, 0.98, -0.2 + Math.floor(k / 5) * 0.35));
  return g;
}
export function well() {
  const g = new THREE.Group();
  g.add(put(m(cylT(0.9, 0.95, 0.9, 16, 1.2), M.stone), 0, 0.45, 0));
  g.add(put(m(new THREE.CircleGeometry(0.75, 16), col('#1d3a48', 0.1)), 0, 0.7, 0, -Math.PI / 2));
  for (const x of [-0.8, 0.8]) g.add(put(m(cylT(0.07, 0.07, 1.8, 6, 1), M.wood), x, 1.3, 0));
  const rf = gableRoof(2.0, 1.6, 0.7, M.roofRed, null, 0.1, 0.1); rf.position.y = 2.1; g.add(rf);
  g.add(put(m(cylT(0.08, 0.08, 1.6, 6, 1), M.wood), 0, 1.7, 0, 0, 0, Math.PI / 2));
  return g;
}
export function barrel() { const g = new THREE.Group(); g.add(m(cylT(0.32, 0.3, 0.85, 12, 0.6), M.planks)); for (const y of [-0.3, 0, 0.3]) g.add(put(m(cylT(0.335, 0.335, 0.05, 12, 1), M.darkMetal), 0, y, 0)); g.position.y = 0.42; const o = new THREE.Group(); o.add(g); return o; }
export function crate() { const o = new THREE.Group(); o.add(put(m(boxT(0.8, 0.8, 0.8, 0.8), M.planks), 0, 0.4, 0)); return o; }
export function cart() {
  const g = new THREE.Group();
  g.add(put(m(boxT(1.6, 0.5, 2.6, 1), M.planks), 0, 0.85, 0));
  for (const x of [-0.9, 0.9]) { const w = m(cylT(0.55, 0.55, 0.12, 14, 1), M.wood); put(w, x, 0.55, 0.3, 0, 0, Math.PI / 2); g.add(w); }
  g.add(put(m(boxT(0.1, 0.1, 1.6, 1), M.wood), -0.3, 0.7, 2.0, 0.2)); g.add(put(m(boxT(0.1, 0.1, 1.6, 1), M.wood), 0.3, 0.7, 2.0, 0.2));
  for (let k = 0; k < 5; k++) g.add(put(m(cylT(0.15, 0.15, 1.3, 8, 1), M.wood), -0.5 + (k % 3) * 0.5, 1.25 + Math.floor(k / 3) * 0.25, 0, Math.PI / 2, 0, 0));
  return g;
}
export function woodpile() { const g = new THREE.Group(); for (let k = 0; k < 12; k++) g.add(put(m(cylT(0.16, 0.16, 1.8, 8, 1), M.wood), -0.8 + (k % 5) * 0.34 + (Math.floor(k / 5) % 2) * 0.17, 0.16 + Math.floor(k / 5) * 0.28, 0, 0, 0, Math.PI / 2)); return g; }
export function haystack() { const g = new THREE.Group(); g.add(put(m(cylT(0.9, 1.1, 1.2, 14, 1), M.thatch), 0, 0.6, 0)); g.add(put(m(coneT(0.95, 1.0, 14, 1), M.thatch), 0, 1.7, 0)); return g; }
export function brazier(fireFn) { const g = new THREE.Group(); g.add(put(m(cylT(0.05, 0.05, 1.4, 6, 1), M.darkMetal), 0, 0.7, 0)); g.add(put(m(cylT(0.3, 0.18, 0.3, 10, 1, true), M.darkMetal), 0, 1.5, 0)); if (fireFn) g.add(put(fireFn(0.5), 0, 1.6, 0)); return g; }
export function field(w = 8, d = 6, seed = 1, ripe = true) {
  const g = new THREE.Group(), r = TX.rng(seed);
  const soil = m(boxT(w, 0.08, d, 1.5), col('#5a4026', 1)); soil.position.y = 0.04; g.add(soil);
  const cg = new THREE.ConeGeometry(0.09, 0.7, 4); cg.translate(0, 0.35, 0);
  let n = 0; for (let z = -d / 2 + 0.25; z < d / 2; z += 0.5) for (let x = -w / 2 + 0.18; x < w / 2; x += 0.35) n++;
  const inst = new THREE.InstancedMesh(cg, col(ripe ? '#c9a84a' : '#6e9a3a', 0.9), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let i = 0;
  for (let z = -d / 2 + 0.25; z < d / 2; z += 0.5) for (let x = -w / 2 + 0.18; x < w / 2; x += 0.35) { q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3)); m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(1, 0.7 + r() * 0.6, 1)); inst.setMatrixAt(i++, m4); }
  inst.count = i; inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
  for (const [x, z, ry, len] of [[0, d / 2 + 0.3, 0, w], [0, -d / 2 - 0.3, 0, w], [w / 2 + 0.3, 0, Math.PI / 2, d], [-w / 2 - 0.3, 0, Math.PI / 2, d]]) {
    const f = new THREE.Group(); for (let k = 0; k <= len; k += 1.5) f.add(put(m(cylT(0.05, 0.06, 0.9, 5, 1), M.wood), k - len / 2, 0.45, 0)); f.add(put(m(boxT(len, 0.06, 0.05, 1), M.wood), 0, 0.7, 0)); put(f, x, 0, z, 0, ry, 0); g.add(f);
  }
  return g;
}
// Asiatische Architektur mit geschwungenen Dächern
function curvedRoof(w, h, mat, lift = 0.5) {
  const g = new THREE.ConeGeometry(w * 0.72, h, 4, 6, true);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (h / 2 - y) / h; // 0 oben, 1 unten
    const corner = Math.abs(Math.abs(x) - Math.abs(z)) < 0.05 * w ? 1 : 0;
    p.setY(i, y - Math.sin(t * Math.PI * 0.5) * h * 0.25 + Math.pow(t, 3) * lift * (0.6 + corner));
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 2, uv.getY(i) * h * 1.5);
  const o = m(g, mat); o.material.side = THREE.DoubleSide; return o;
}
export function pagoda(color, tiers = 4) {
  const g = new THREE.Group();
  g.add(put(m(boxT(6, 0.9, 6, 1.5), M.stone), 0, 0.45, 0));
  for (let k = 0; k < 3; k++) g.add(put(m(boxT(2, 0.2, 0.6, 1), M.stoneDark), 0, 0.1 + k * 0.25, 3.3 - k * 0.3));
  const red = col('#9a2a20', 0.7);
  for (let t = 0; t < tiers; t++) {
    const w = 4.4 - t * 0.75, y = 0.9 + t * 2.3;
    g.add(put(m(boxT(w, 1.7, w, 1), red), 0, y + 0.85, 0));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(put(m(cylT(0.12, 0.12, 1.7, 8, 1), col('#5a1a14')), x * w / 2, y + 0.85, z * w / 2));
    for (let s = 0; s < 4; s++) windowAt(g, Math.sin(s * Math.PI / 2) * (w / 2 + 0.05), y + 0.9, Math.cos(s * Math.PI / 2) * (w / 2 + 0.05), s * Math.PI / 2, t % 2 === 0 && s === 0, 0.6, 0.7);
    g.add(put(curvedRoof(w + 1.8, 1.2, M.roofGreen, 0.7), 0, y + 2.25, 0));
  }
  const top = 0.9 + tiers * 2.3 + 0.6;
  g.add(put(m(cylT(0.05, 0.12, 2.2, 8, 1), M.gold), 0, top + 0.6, 0));
  for (let k = 0; k < 4; k++) g.add(put(m(new THREE.TorusGeometry(0.22 - k * 0.03, 0.04, 6, 12), M.gold), 0, top + 0.2 + k * 0.35, 0, Math.PI / 2));
  const b = banner(color, 2.0, 0.8, 1.4, 0.25); g.add(put(b, 2.6, 0.9, 2.6));
  return g;
}
export function asianHouse(color, seed = 1) {
  const g = new THREE.Group(), w = 4, d = 3.2;
  g.add(put(m(boxT(w + 0.3, 0.45, d + 0.3, 1.5), M.stone), 0, 0.22, 0));
  g.add(put(m(boxT(w, 2.0, d, 2), M.plaster), 0, 1.45, 0));
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) g.add(put(m(cylT(0.1, 0.1, 2.0, 8, 1), col('#6a1e16')), x, 1.45, d / 2 + 0.02));
  windowAt(g, w * 0.32, 1.5, d / 2 + 0.06, 0, seed % 2 === 0, 0.7, 0.6); door(g, -w * 0.15, 0.45, d / 2 + 0.06, 0, 0.9, 1.6);
  const r = curvedRoof(w + 2.2, 1.6, M.roofGreen, 0.5); r.scale.set(1, 1, d / w + 0.15); g.add(put(r, 0, 3.05, 0));
  const b = banner(color, 1.2, 0.4, 0.6, 0.1); g.add(put(b, w / 2 + 0.3, 0.45, d / 2));
  return g;
}

// ---------- Einheiten ----------
const SKIN = ['#e3b08c', '#c68a62', '#8d5a3b', '#efc8a4'];
const LEG = (c) => col(c, 0.9);
export function soldier({ color = '#c33', era = 3, weapon = 'sword', seed = 1, pose = 'idle', shield = false, helmet = true, carry = null, cape = false } = {}) {
  const r = TX.rng(seed), g = new THREE.Group();
  const skin = col(SKIN[Math.floor(r() * 4)], 0.7);
  const team = teamCloth(color);
  const trousers = LEG(era >= 5 ? '#4f5038' : ['#5a4632', '#4a3d33', '#3e3a36'][Math.floor(r() * 3)]);
  const boots = col('#2e2218', 0.8);
  const step = pose === 'walk' ? 0.4 : pose === 'charge' ? 0.6 : 0;
  // Beine
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.13, 0.86, 0); leg.rotation.x = s * step;
    leg.add(put(m(cylT(0.09, 0.075, 0.45, 8, 1), trousers), 0, -0.22, 0));
    leg.add(put(m(cylT(0.075, 0.065, 0.4, 8, 1), trousers), 0, -0.6, 0));
    leg.add(put(m(boxT(0.13, 0.12, 0.26, 1), boots), 0, -0.82, 0.05));
    g.add(leg);
  }
  // Rumpf
  g.add(put(m(cylT(0.21, 0.17, 0.62, 10, 1), era >= 3 && era <= 4 && weapon !== 'bow' ? M.metal : team), 0, 1.18, 0));
  g.add(put(m(cylT(0.2, 0.23, 0.22, 10, 1), team), 0, 0.86, 0)); // Rock/Wams
  if (era >= 3 && era <= 4 && weapon !== 'bow') { g.add(put(m(boxT(0.3, 0.55, 0.05, 1), team), 0, 1.1, 0.18)); g.add(put(m(boxT(0.3, 0.55, 0.05, 1), team), 0, 1.1, -0.18)); }
  g.add(put(m(cylT(0.205, 0.205, 0.07, 10, 1), M.leather), 0, 0.97, 0));
  g.add(put(m(new THREE.SphereGeometry(0.05, 6, 4), M.gold), 0, 0.97, 0.2));
  // Schultern & Kopf
  g.add(put(m(new THREE.SphereGeometry(0.2, 12, 8), era >= 3 && era <= 4 ? M.metal : team), 0, 1.45, 0, 0, 0, 0, [1.25, 0.5, 0.9]));
  g.add(put(m(cylT(0.06, 0.07, 0.1, 8, 1), skin), 0, 1.55, 0));
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head);
  head.add(m(new THREE.SphereGeometry(0.135, 14, 10), skin));
  head.add(put(m(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), col(['#3a2618', '#6a4a2a', '#1e1a16', '#8a6a3a'][Math.floor(r() * 4)])), 0, 0.01, -0.01));
  if (helmet) {
    if (era <= 0) { /* Fell */ head.add(put(m(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), col('#6a4a2e', 1)), 0, 0.02, 0)); }
    else if (era <= 2) { head.add(put(m(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), col('#b8863b', 0.35, 0.8)), 0, 0.01, 0)); head.add(put(m(boxT(0.04, 0.16, 0.34, 1), team), 0, 0.17, -0.02)); }
    else if (era === 3) { head.add(put(m(cylT(0.155, 0.15, 0.24, 12, 1), M.metal), 0, 0.03, 0)); head.add(put(m(new THREE.BoxGeometry(0.2, 0.025, 0.02), col('#111')), 0, 0.02, 0.15)); head.add(put(m(new THREE.SphereGeometry(0.155, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.metal), 0, 0.15, 0)); }
    else if (era === 4) { head.add(put(m(new THREE.ConeGeometry(0.18, 0.2, 12), M.metal), 0, 0.17, 0)); head.add(put(m(cylT(0.26, 0.26, 0.02, 14, 1), M.metal), 0, 0.07, 0)); }
    else if (era === 5) { head.add(put(m(cylT(0.13, 0.15, 0.2, 12, 1), col('#2e3e5e')), 0, 0.12, 0)); head.add(put(m(new THREE.BoxGeometry(0.16, 0.02, 0.1), col('#111')), 0, 0.03, 0.14)); }
    else head.add(put(m(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), col('#4d5633', 0.8)), 0, 0.02, 0));
  }
  if (cape) { const cg = new THREE.PlaneGeometry(0.45, 0.85, 1, 4); const p = cg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow((0.42 - p.getY(i)) / 0.85, 2) * 0.25); cg.computeVertexNormals(); g.add(put(m(cg, team), 0, 1.05, -0.2)); }
  // Arme
  const armRot = pose === 'attack' ? -2.1 : pose === 'aim' ? -1.45 : pose === 'charge' ? -1.3 : -0.25;
  const arm = (s, rx, rz = 0) => {
    const a = new THREE.Group(); a.position.set(s * 0.27, 1.42, 0); a.rotation.set(rx, 0, rz);
    a.add(put(m(cylT(0.065, 0.055, 0.32, 8, 1), era >= 3 && era <= 4 ? M.metal : team), 0, -0.16, 0));
    a.add(put(m(cylT(0.055, 0.05, 0.3, 8, 1), era >= 3 && era <= 4 ? M.metal : skin), 0, -0.45, 0));
    a.add(put(m(new THREE.SphereGeometry(0.055, 8, 6), skin), 0, -0.62, 0));
    g.add(a); return a;
  };
  const R = arm(1, armRot, 0.1), L = arm(-1, pose === 'aim' ? -1.45 : shield ? -0.6 : -0.15, -0.15);
  const hand = new THREE.Group(); hand.position.set(0, -0.62, 0.02); R.add(hand);
  const wood = M.wood;
  if (weapon === 'sword') { hand.add(put(m(new THREE.BoxGeometry(0.05, 0.015, 0.85), M.metal), 0, 0, 0.5)); hand.add(put(m(new THREE.BoxGeometry(0.22, 0.03, 0.04), M.gold), 0, 0, 0.07)); }
  if (weapon === 'club') { hand.add(put(m(cylT(0.035, 0.06, 0.65, 6, 1), wood), 0, 0, 0.3, Math.PI / 2)); }
  if (weapon === 'axe' || weapon === 'tool') { hand.add(put(m(cylT(0.025, 0.025, 0.85, 6, 1), wood), 0, 0, 0.32, Math.PI / 2)); hand.add(put(m(new THREE.BoxGeometry(0.03, 0.22, 0.14), M.metal), 0, 0.08, 0.7)); }
  if (weapon === 'spear' || weapon === 'pike') { const L2 = weapon === 'pike' ? 3.4 : 2.2; hand.add(put(m(cylT(0.022, 0.022, L2, 6, 1), wood), 0, 0, L2 * 0.3, Math.PI / 2)); hand.add(put(m(new THREE.ConeGeometry(0.045, 0.28, 4), M.metal), 0, 0, L2 * 0.8 + 0.14, Math.PI / 2)); }
  if (weapon === 'musket' || weapon === 'rifle') { hand.add(put(m(boxT(0.06, 0.08, 0.8, 1), wood), 0, 0, 0.2)); hand.add(put(m(cylT(0.018, 0.018, 0.7, 6, 1), M.darkMetal), 0, 0.04, 0.75, Math.PI / 2)); }
  if (weapon === 'bow') {
    const lh = new THREE.Group(); lh.position.set(0, -0.62, 0); L.add(lh);
    lh.add(put(m(new THREE.TorusGeometry(0.62, 0.02, 5, 16, Math.PI * 0.85), wood), 0, 0, 0.1, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.075));
    g.add(put(m(cylT(0.08, 0.07, 0.6, 8, 1), M.leather), 0.08, 1.2, -0.22, 0.25));
    for (let k = 0; k < 5; k++) g.add(put(m(cylT(0.008, 0.008, 0.3, 3, 1), wood), 0.04 + k * 0.02, 1.55, -0.24, 0.25));
  }
  if (shield) {
    const lh = new THREE.Group(); lh.position.set(0, -0.45, 0.12); L.add(lh);
    const sg = era >= 3 ? new THREE.CylinderGeometry(0.34, 0.34, 0.05, 3) : new THREE.CylinderGeometry(0.33, 0.33, 0.05, 20);
    lh.add(put(m(sg, team), 0, 0, 0, Math.PI / 2, 0, era >= 3 ? Math.PI : 0, era >= 3 ? [0.85, 1, 1.3] : 1));
    lh.add(put(m(new THREE.TorusGeometry(0.33, 0.022, 5, 20), M.darkMetal), 0, 0, 0.02, 0, 0, 0, era >= 3 ? 0 : 1));
    lh.add(put(m(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.gold), 0, 0, 0.03, Math.PI / 2));
  }
  if (carry) {
    const c = { wood: () => put(m(cylT(0.1, 0.1, 0.7, 8, 1), wood), 0, 1.25, -0.25, 0, 0, Math.PI / 2), food: () => put(m(new THREE.SphereGeometry(0.18, 10, 8), M.thatch), 0, 1.2, -0.25), gold: () => put(m(new THREE.DodecahedronGeometry(0.15), M.gold), 0, 1.2, -0.25), stone: () => put(m(new THREE.DodecahedronGeometry(0.17), col('#9a958e')), 0, 1.2, -0.25) }[carry];
    g.add(c());
  }
  return g;
}
export function horse(seed = 1, coat) {
  const r = TX.rng(seed), g = new THREE.Group();
  const c = col(coat || ['#5a3a24', '#3a2618', '#7a5536', '#c8c0b4', '#2a201a'][Math.floor(r() * 5)], 0.6);
  const dark = col('#1e1610', 0.8);
  g.add(put(m(new THREE.SphereGeometry(0.42, 16, 12), c), 0, 1.35, 0, 0, 0, 0, [0.85, 0.9, 1.7]));
  g.add(put(m(cylT(0.17, 0.26, 0.8, 12, 1), c), 0, 1.75, 0.75, -0.75));
  g.add(put(m(cylT(0.1, 0.15, 0.55, 10, 1), c), 0, 2.03, 1.12, -1.95));
  g.add(put(m(new THREE.BoxGeometry(0.06, 0.55, 0.5), dark), 0, 1.92, 0.68, -0.75));
  for (const x of [-0.07, 0.07]) g.add(put(m(new THREE.ConeGeometry(0.04, 0.14, 6), c), x, 2.25, 1.0));
  for (const [x, z, rx] of [[-0.2, 0.55, 0.1], [0.2, 0.55, -0.1], [-0.2, -0.55, -0.15], [0.2, -0.55, 0.15]]) {
    const l = new THREE.Group(); l.position.set(x, 1.1, z); l.rotation.x = rx;
    l.add(put(m(cylT(0.09, 0.07, 0.55, 8, 1), c), 0, -0.25, 0)); l.add(put(m(cylT(0.055, 0.05, 0.5, 8, 1), c), 0, -0.75, 0)); l.add(put(m(cylT(0.07, 0.08, 0.1, 8, 1), dark), 0, -1.02, 0));
    g.add(l);
  }
  g.add(put(m(cylT(0.04, 0.12, 0.7, 8, 1), dark), 0, 1.25, -0.85, 0.5));
  return g;
}
export function cavalry({ color, era = 3, seed = 1, weapon }) {
  const g = new THREE.Group();
  g.add(horse(seed));
  // Schabracke
  const cp = new THREE.CylinderGeometry(0.47, 0.5, 1.3, 16, 1, true, -Math.PI / 2 - 1.2, Math.PI + 2.4); cp.rotateX(Math.PI / 2);
  g.add(put(m(cp, teamCloth(color)), 0, 1.38, 0, 0, 0, Math.PI, [1, 1, 1]));
  g.add(put(m(boxT(0.5, 0.12, 0.55, 1), M.leather), 0, 1.75, 0));
  const rider = soldier({ color, era, weapon: weapon || (era >= 4 ? 'sword' : 'spear'), seed: seed + 50, pose: 'charge', shield: era <= 3 });
  rider.children.slice(0, 2).forEach(l => { l.rotation.x = -1.2; l.position.y += 0.05; });
  rider.position.set(0, 0.95, 0); g.add(rider);
  return g;
}
export function elephant(color, seed = 1) {
  const g = new THREE.Group(), skin = col('#7e7a74', 0.85), r = TX.rng(seed);
  g.add(put(m(new THREE.SphereGeometry(1, 18, 14), skin), 0, 2.4, 0, 0, 0, 0, [1.05, 1.0, 1.45]));
  g.add(put(m(new THREE.SphereGeometry(0.68, 16, 12), skin), 0, 2.85, 1.45));
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.6, 1.95), new THREE.Vector3(0, 1.8, 2.25), new THREE.Vector3(0, 0.9, 2.15), new THREE.Vector3(0, 0.5, 2.35)]), 12, 0.16, 8);
  g.add(m(trunk, skin));
  for (const s of [-1, 1]) {
    g.add(put(m(new THREE.SphereGeometry(0.6, 12, 8), skin), s * 0.62, 2.85, 1.2, 0, s * 0.4, 0, [0.25, 1, 0.8]));
    g.add(put(m(new THREE.ConeGeometry(0.07, 1.0, 8), col('#efe6d2', 0.5)), s * 0.3, 2.0, 2.2, 1.9, 0, s * 0.2));
  }
  for (const [x, z] of [[-0.55, 0.65], [0.55, 0.65], [-0.55, -0.7], [0.55, -0.7]]) g.add(put(m(cylT(0.3, 0.32, 1.8, 12, 1), skin), x, 0.9, z));
  g.add(put(m(boxT(1.9, 0.12, 2.0, 1), teamCloth(color)), 0, 3.38, -0.1));
  for (const s of [-1, 1]) g.add(put(m(new THREE.PlaneGeometry(1.6, 1.0), teamCloth(color)), s * 0.98, 2.9, -0.1, 0, s * Math.PI / 2, 0));
  const how = new THREE.Group();
  how.add(put(m(boxT(1.3, 0.75, 1.3, 1), M.planks), 0, 0.37, 0));
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) how.add(put(m(cylT(0.04, 0.04, 1.0, 6, 1), M.wood), x, 1.2, z));
  how.add(put(curvedRoof(2.0, 0.6, M.roofGreen, 0.25), 0, 1.9, 0));
  for (let k = 0; k < 2; k++) how.add(put(soldierHD({ color, era: 3, weapon: 'bow', seed: seed * 10 + k, pose: 'aim', shield: false }), -0.3 + k * 0.6, 0.0, 0, 0, 0, 0, 0.8));
  how.position.set(0, 3.45, -0.2); g.add(how);
  g.add(put(soldierHD({ color, era: 3, weapon: 'spear', seed: seed + 3, pose: 'ride' }), 0, 2.2, 1.0, 0, 0, 0, 0.85));
  return g;
}
export function trebuchet(color) {
  const g = new THREE.Group();
  g.add(put(m(boxT(2.4, 0.3, 4.0, 1), M.planks), 0, 0.6, 0));
  for (const [x, z] of [[-1.2, 1.5], [1.2, 1.5], [-1.2, -1.5], [1.2, -1.5]]) g.add(put(m(cylT(0.45, 0.45, 0.18, 14, 1), M.wood), x, 0.45, z, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) { g.add(put(m(boxT(0.25, 4.2, 0.25, 1), M.wood), s * 0.9, 2.6, 0.6, -0.25)); g.add(put(m(boxT(0.25, 4.2, 0.25, 1), M.wood), s * 0.9, 2.6, -0.6, 0.25)); }
  g.add(put(m(cylT(0.12, 0.12, 2.1, 8, 1), M.wood), 0, 4.5, 0, 0, 0, Math.PI / 2));
  const arm = new THREE.Group(); arm.position.set(0, 4.5, 0); arm.rotation.x = -0.9;
  arm.add(put(m(boxT(0.2, 0.2, 7, 1), M.wood), 0, 0, 1.5));
  arm.add(put(m(boxT(1.0, 1.0, 1.0, 1), M.planks), 0, -0.7, -1.9));
  g.add(arm);
  g.add(put(m(new THREE.PlaneGeometry(1.0, 0.8), teamCloth(color)), 0, 1.4, 2.01));
  return g;
}

// ---------- Effekte ----------
let FIRE, SMOKE;
export function fx() {
  FIRE = FIRE || TX.softSprite('rgba(255,200,90,1)', 'rgba(255,60,0,0)');
  SMOKE = SMOKE || TX.softSprite('rgba(90,85,80,0.85)', 'rgba(90,85,80,0)');
}
export function fire(s = 1, seed = 1) {
  fx(); const g = new THREE.Group(), r = TX.rng(seed);
  for (let k = 0; k < 10; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE, blending: THREE.AdditiveBlending, depthWrite: false, color: k % 3 ? '#ffb050' : '#ff7020', transparent: true }));
    sp.position.set((r() - 0.5) * s * 1.2, s * (0.3 + r() * 1.8), (r() - 0.5) * s * 1.2); sp.scale.setScalar(s * (1.2 + r() * 1.4)); g.add(sp);
  }
  const l = new THREE.PointLight('#ff8a30', 25 * s, 10 * s, 1.6); l.position.y = s; g.add(l);
  return g;
}
export function smoke(s = 1, seed = 1, n = 12) {
  fx(); const g = new THREE.Group(), r = TX.rng(seed);
  for (let k = 0; k < n; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE, depthWrite: false, transparent: true, opacity: 0.9 - k * 0.05, color: '#8a8580' }));
    sp.position.set(k * 0.5 * s + (r() - 0.5) * s, 1.5 * s + k * 1.1 * s, (r() - 0.5) * s); sp.scale.setScalar(s * (2 + k * 0.5)); g.add(sp);
  }
  return g;
}
export function arrow() { const g = new THREE.Group(); g.add(put(m(cylT(0.012, 0.012, 0.9, 4, 1), M.wood, false), 0, 0, 0, Math.PI / 2)); g.add(put(m(new THREE.ConeGeometry(0.03, 0.1, 4), M.metal, false), 0, 0, 0.48, Math.PI / 2)); g.add(put(m(new THREE.PlaneGeometry(0.06, 0.15), col('#ddd'), false), 0, 0, -0.4, 0, Math.PI / 2)); return g; }

// ---------- Stadtdetails ----------
let COBBLE;
export function plaza(w, d, round = false) {
  COBBLE = COBBLE || (() => { const t = TX.cobbleTex(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.9 }); })();
  const g = round ? new THREE.CircleGeometry(w, 40) : new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.5, p.getZ(i) / 2.5);
  const o = new THREE.Mesh(g, COBBLE); o.receiveShadow = true; o.position.y = 0.05;
  const grp = new THREE.Group(); grp.add(o); return grp;
}
const PLASTERS = ['#e8dcc0', '#e6c98e', '#e3b9a6', '#c9d0cf', '#efe6d2', '#d9c49a'];
const plasterMats = new Map();
function plasterTint(c) { if (!plasterMats.has(c)) { const m2 = M.plaster.clone(); m2.color = new THREE.Color(c); plasterMats.set(c, m2); } return plasterMats.get(c); }
// Schmales, hohes Stadthaus mit vorkragenden Geschossen
export function townhouse(color, seed = 1) {
  const r = TX.rng(seed), g = new THREE.Group();
  const w = 2.6 + r() * 0.8, d = 3.4, fh = 1.75, floors = 2 + Math.floor(r() * 2);
  const pm = plasterTint(PLASTERS[Math.floor(r() * PLASTERS.length)]);
  g.add(put(m(boxT(w, 0.5, d, 1.5), M.stone), 0, 0.25, 0));
  let y = 0.5;
  for (let f = 0; f < floors; f++) {
    const ext = f * 0.18;
    g.add(put(m(boxT(w + ext, fh, d + ext * 0.5, 2), f === 0 ? M.stone : pm), 0, y + fh / 2, ext * 0.25));
    if (f > 0) {
      for (const x of [-(w + ext) / 2 + 0.06, (w + ext) / 2 - 0.06]) g.add(put(m(boxT(0.13, fh, 0.1, 1), M.beam), x, y + fh / 2, (d + ext * 0.5) / 2 + ext * 0.25 + 0.02));
      g.add(put(m(boxT(w + ext + 0.1, 0.16, 0.12, 1), M.beam), 0, y + 0.05, (d + ext * 0.5) / 2 + ext * 0.25 + 0.03));
      g.add(put(m(boxT(0.1, fh * 0.9, 0.08, 1), M.beam), 0, y + fh / 2, (d + ext * 0.5) / 2 + ext * 0.25 + 0.03, 0, 0, 0.5));
    }
    const zf = (d + ext * 0.5) / 2 + ext * 0.25 + 0.06;
    if (f === 0) { door(g, -w * 0.22, y, zf, 0, 0.8, 1.45); windowAt(g, w * 0.22, y + 1.0, zf, 0, r() < 0.4, 0.6, 0.6); }
    else { windowAt(g, -w * 0.22, y + 0.95, zf, 0, r() < 0.3, 0.45, 0.7); windowAt(g, w * 0.22, y + 0.95, zf, 0, r() < 0.3, 0.45, 0.7); }
    y += fh;
  }
  const ext = (floors - 1) * 0.18;
  const rf = gableRoof(d + ext, w + ext, 2.1, r() < 0.3 ? M.roofSlate : M.roofRed, pm, 0.3);
  rf.rotation.y = Math.PI / 2; rf.position.set(0, y, ext * 0.25); g.add(rf);
  // Gaube
  const dm = new THREE.Group(); dm.add(put(m(boxT(0.8, 0.7, 0.8, 1), pm), 0, 0.35, 0)); windowAt(dm, 0, 0.35, 0.42, 0, false, 0.35, 0.4); const dr = gableRoof(0.8, 0.9, 0.45, M.roofRed, pm, 0.1, 0.08); dr.rotation.y = Math.PI / 2; dr.position.y = 0.7; dm.add(dr);
  put(dm, 0, y + 0.45, (d + ext) / 2 - 0.5); g.add(dm);
  g.add(put(m(boxT(0.5, 1.4, 0.5, 1), M.stone), w * 0.3, y + 1.3, -0.8));
  // Ladenschild
  if (r() < 0.5) { g.add(put(m(cylT(0.02, 0.02, 0.7, 4, 1), M.darkMetal), w / 2, 2.0, d / 2 + 0.3, 0, 0, Math.PI / 2)); g.add(put(m(boxT(0.05, 0.45, 0.45, 1), teamCloth(['#7a2a1a', '#2a4a7a', '#4a6a2a'][seed % 3])), w / 2 + 0.25, 1.7, d / 2 + 0.3)); }
  return g;
}
export function church(color) {
  const g = new THREE.Group();
  g.add(put(m(boxT(6, 6, 13, 1.6), M.stone), 0, 3, 0));
  const rf = gableRoof(13, 6, 3.6, M.roofSlate, M.stone, 0.3); rf.rotation.y = Math.PI / 2; rf.position.y = 6; g.add(rf);
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    g.add(put(m(boxT(0.6, 4.5, 0.9, 1), M.stoneDark), s * 3.25, 2.25, -4.5 + k * 3, 0, 0, s * 0.08));
    const wg = new THREE.Shape(); wg.moveTo(-0.35, 0); wg.lineTo(0.35, 0); wg.lineTo(0.35, 1.6); wg.absarc(0, 1.6, 0.35, 0, Math.PI, false);
    g.add(put(m(new THREE.ShapeGeometry(wg), M.glass), s * 3.02, 2.4, -3 + k * 3, 0, s * Math.PI / 2, 0));
  }
  // Turm mit Spitzhelm
  g.add(put(m(boxT(3.4, 11, 3.4, 1.6), M.stone), 0, 5.5, 7.6));
  for (const s of [-1, 1]) g.add(put(m(boxT(0.9, 1.6, 0.1, 1), col('#1a1410')), s * 0.9, 9.2, 9.32));
  g.add(put(m(boxT(3.7, 0.4, 3.7, 1.6), M.stoneDark), 0, 11, 7.6));
  const spire = m(new THREE.ConeGeometry(2.4, 7, 4, 1, true), M.roofSlate); spire.material.side = THREE.DoubleSide; g.add(put(spire, 0, 14.7, 7.6, 0, Math.PI / 4, 0));
  g.add(put(m(boxT(0.12, 1.1, 0.12, 1), M.gold), 0, 18.6, 7.6)); g.add(put(m(boxT(0.6, 0.12, 0.12, 1), M.gold), 0, 18.8, 7.6));
  // Rosette & Portal
  g.add(put(m(new THREE.CircleGeometry(1.1, 24), col('#2a3a6a', 0.2, 0.3)), 0, 8.2, 9.33));
  g.add(put(m(new THREE.TorusGeometry(1.1, 0.12, 6, 24), M.stoneDark), 0, 8.2, 9.34));
  const arch = new THREE.Shape(); arch.moveTo(-0.8, 0); arch.lineTo(0.8, 0); arch.lineTo(0.8, 1.8); arch.absarc(0, 1.8, 0.8, 0, Math.PI, false);
  g.add(put(m(new THREE.ShapeGeometry(arch), M.planks), 0, 0, 9.33));
  return g;
}
export function blacksmith(fireFn) {
  const g = new THREE.Group();
  g.add(put(m(boxT(5, 0.3, 4, 1.5), M.stone), 0, 0.15, 0));
  g.add(put(m(boxT(5, 2.6, 0.3, 1.5), M.stone), 0, 1.6, -1.85));
  for (const x of [-2.3, 2.3]) g.add(put(m(cylT(0.12, 0.12, 2.8, 8, 1), M.beam), x, 1.7, 1.8));
  const rf = m(boxT(5.6, 0.15, 4.6, 1.6), M.roofRed); g.add(put(rf, 0, 3.2, 0, 0.25));
  g.add(put(m(boxT(1.4, 1.0, 1.2, 1), M.stoneDark), -1.4, 0.8, -1.1));
  g.add(put(m(boxT(0.7, 3.2, 0.7, 1), M.stone), -1.4, 2.5, -1.4));
  g.add(put(m(boxT(0.9, 0.2, 0.7, 1), M.lit), -1.4, 1.32, -0.9));
  if (fireFn) g.add(put(fireFn(0.35), -1.4, 1.35, -0.9));
  const anvil = new THREE.Group(); anvil.add(put(m(cylT(0.18, 0.22, 0.5, 8, 1), M.wood), 0, 0.25, 0)); anvil.add(put(m(boxT(0.6, 0.2, 0.25, 1), M.darkMetal), 0, 0.6, 0)); anvil.add(put(m(new THREE.ConeGeometry(0.12, 0.3, 6), M.darkMetal), 0.4, 0.62, 0, 0, 0, -Math.PI / 2)); put(anvil, 0.6, 0.3, 0); g.add(anvil);
  for (let k = 0; k < 4; k++) g.add(put(m(new THREE.BoxGeometry(0.05, 0.9, 0.02), M.metal), 1.6 + k * 0.18, 1.1, -1.65, 0, 0, 0.05));
  g.add(put(barrel(), 2, 0.3, 1.0));
  return g;
}
export function tavern(color) {
  const g = halfTimberHouse(color, 77, { w: 5.2, d: 4, floors: 2, roof: 'red' });
  g.add(put(m(cylT(0.03, 0.03, 0.9, 4, 1), M.darkMetal), 2.9, 3.3, 2.1, 0, 0, Math.PI / 2));
  g.add(put(m(boxT(0.06, 0.6, 0.6, 1), M.planks), 3.25, 2.95, 2.1));
  g.add(put(m(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 10), M.gold), 3.25, 2.95, 2.4, Math.PI / 2));
  for (let k = 0; k < 2; k++) { const t = new THREE.Group(); t.add(put(m(boxT(1.4, 0.08, 0.7, 1), M.planks), 0, 0.75, 0)); for (const [x, z] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) t.add(put(m(cylT(0.04, 0.04, 0.75, 4, 1), M.wood), x, 0.37, z)); for (const z of [-0.65, 0.65]) t.add(put(m(boxT(1.4, 0.06, 0.25, 1), M.planks), 0, 0.42, z)); put(t, -1.2 + k * 2.4, 0.6, 3.6); g.add(t); }
  return g;
}
export function garden(w = 4, d = 3, seed = 1) {
  const g = new THREE.Group(), r = TX.rng(seed);
  g.add(put(m(boxT(w, 0.1, d, 1), col('#4a3420', 1)), 0, 0.05, 0));
  for (let z = -d / 2 + 0.3; z < d / 2; z += 0.5) for (let x = -w / 2 + 0.3; x < w / 2; x += 0.4) g.add(put(m(new THREE.IcosahedronGeometry(0.13 + r() * 0.06, 0), col(['#4f8a2f', '#6a9a3a', '#8aa848', '#a83a2a'][Math.floor(r() * 4)], 0.8)), x, 0.18, z));
  for (const [x, z, ry, len] of [[0, d / 2 + 0.15, 0, w], [0, -d / 2 - 0.15, 0, w], [w / 2 + 0.15, 0, Math.PI / 2, d], [-w / 2 - 0.15, 0, Math.PI / 2, d]]) {
    for (let k = 0; k <= len; k += 0.25) g.add(put(m(boxT(0.06, 0.6, 0.03, 1), M.wood), x + (ry ? 0 : k - len / 2), 0.3, z + (ry ? k - len / 2 : 0)));
  }
  return g;
}
export function lamp(fireFn) {
  const g = new THREE.Group();
  g.add(put(m(cylT(0.05, 0.07, 2.6, 6, 1), M.darkMetal), 0, 1.3, 0));
  g.add(put(m(boxT(0.4, 0.04, 0.04, 1), M.darkMetal), 0.2, 2.5, 0));
  g.add(put(m(boxT(0.2, 0.3, 0.2, 1), M.lit), 0.38, 2.3, 0));
  g.add(put(m(new THREE.ConeGeometry(0.16, 0.15, 4), M.darkMetal), 0.38, 2.52, 0, 0, Math.PI / 4));
  return g;
}
export function hoardingTower(color) {
  const g = roundTower(color, 8, 1.8);
  g.add(put(m(cylT(2.15, 2.15, 1.2, 16, 1.2, true), M.planks), 0, 7.6, 0));
  return g;
}
export { m, put, coneT, gableRoof, windowAt, door, M };
