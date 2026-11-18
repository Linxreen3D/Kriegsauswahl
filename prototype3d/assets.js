// Prozedurale Low-Poly-Assets (Prototyp für den 3D-Look).
import * as THREE from 'three';

// ---------- Hilfen ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts }));
  return matCache.get(key);
}
export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, color instanceof THREE.Material ? color : mat(color, opts));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function at(obj, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz);
  if (typeof s === 'number') obj.scale.setScalar(s); else obj.scale.set(...s);
  return obj;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const prism = (w, h, d) => { // Satteldach
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
};
export function jitter(geo, amt, seed = 1) {
  const p = geo.attributes.position;
  const r = rand(seed);
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]);
    const j = map.get(k);
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
export function rand(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- Natur ----------
export function treeConifer(seed = 1, s = 1) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(cyl(0.12, 0.18, 0.9, 5), '#6b4a2e'), 0, 0.45, 0));
  const greens = ['#2f6b3a', '#356f3f', '#3c7a45'];
  for (let k = 0; k < 3; k++) {
    const c = jitter(cone(1.05 - k * 0.27, 1.3, 7), 0.12, seed * 7 + k);
    g.add(at(mesh(c, greens[k]), 0, 1.1 + k * 0.62, 0, 0, r() * 3, 0));
  }
  g.scale.setScalar(s * (0.85 + r() * 0.4));
  return g;
}
export function treeLeaf(seed = 1, s = 1, autumn = false) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(cyl(0.12, 0.2, 1.3, 5), '#6e4c30'), 0, 0.65, 0));
  const cols = autumn ? ['#d98b2b', '#c4682a', '#e0a83a'] : ['#4f9a3a', '#5aa843', '#468c34'];
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const b = jitter(ico(0.75 + r() * 0.3, 0), 0.25, seed * 13 + k);
    g.add(at(mesh(b, cols[k % 3]), (r() - 0.5) * 0.7, 1.7 + r() * 0.5, (r() - 0.5) * 0.7, r(), r(), r()));
  }
  g.scale.setScalar(s * (0.85 + r() * 0.35));
  return g;
}
export function rock(seed = 1, s = 1, color = '#8f8c88') {
  const g = jitter(new THREE.DodecahedronGeometry(0.6, 0), 0.35, seed);
  const m = mesh(g, color);
  m.scale.set(s, s * 0.65, s);
  return m;
}
export function goldMine(seed = 3) {
  const g = new THREE.Group(), r = rand(seed);
  for (let k = 0; k < 5; k++) g.add(at(rock(seed + k, 0.9 + r() * 0.6, '#7d7468'), (r() - 0.5) * 2.2, 0.2, (r() - 0.5) * 2.2, 0, r() * 6, 0));
  for (let k = 0; k < 9; k++) {
    const c = mesh(new THREE.OctahedronGeometry(0.22 + r() * 0.15, 0), '#ffcc33', { metalness: 0.6, roughness: 0.3, emissive: '#5a4000', emissiveIntensity: 0.4 });
    g.add(at(c, (r() - 0.5) * 2, 0.5 + r() * 0.5, (r() - 0.5) * 2, r(), r(), r(), [1, 1.6, 1]));
  }
  return g;
}
export function stoneMine(seed = 5) {
  const g = new THREE.Group(), r = rand(seed);
  for (let k = 0; k < 7; k++) g.add(at(rock(seed + k, 0.8 + r() * 0.7, k % 2 ? '#a5a3a0' : '#bdbab5'), (r() - 0.5) * 2.4, 0.2 + r() * 0.3, (r() - 0.5) * 2.4, 0, r() * 6, 0));
  return g;
}
export function berryBush(seed = 9) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(jitter(ico(0.55, 0), 0.2, seed), '#3f8a3a'), 0, 0.4, 0, 0, 0, 0, [1, 0.75, 1]));
  for (let k = 0; k < 10; k++) {
    const a = r() * Math.PI * 2, e = r() * 1.2;
    g.add(at(mesh(ico(0.08, 0), '#d8344f'), Math.cos(a) * 0.5 * Math.cos(e - 0.6), 0.4 + Math.sin(e) * 0.3, Math.sin(a) * 0.5 * Math.cos(e - 0.6)));
  }
  return g;
}
export function grassTuft(seed = 1) {
  const g = new THREE.Group(), r = rand(seed);
  for (let k = 0; k < 4; k++) g.add(at(mesh(cone(0.05, 0.35, 3), '#6fae3c'), (r() - 0.5) * 0.25, 0.17, (r() - 0.5) * 0.25, (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5));
  return g;
}
export function flower(color, seed = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(0.015, 0.015, 0.3, 3), '#4f8f30'), 0, 0.15, 0));
  g.add(at(mesh(ico(0.07, 0), color), 0, 0.32, 0));
  return g;
}

// ---------- Figuren ----------
const SKIN = ['#e7b48f', '#c98d63', '#8d5a3b', '#f0c7a2'];
export function soldier({ color = '#d33', era = 3, weapon = 'sword', seed = 1, pose = 'idle', shield = false, carry = null } = {}) {
  const g = new THREE.Group(), r = rand(seed);
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const pants = era >= 5 ? '#5b5a3c' : era >= 3 ? '#4a3d33' : '#6b5238';
  const tunic = era >= 6 ? '#5f6a3d' : color;
  // Beine
  const step = pose === 'walk' ? 0.35 : 0;
  g.add(at(mesh(box(0.17, 0.55, 0.2), pants), -0.12, 0.28, 0, step, 0, 0));
  g.add(at(mesh(box(0.17, 0.55, 0.2), pants), 0.12, 0.28, 0, -step, 0, 0));
  // Torso
  g.add(at(mesh(box(0.48, 0.58, 0.3), tunic), 0, 0.85, 0));
  if (era >= 6) g.add(at(mesh(box(0.5, 0.12, 0.32), color), 0, 0.98, 0)); // Armbinde/Teamfarbe
  if (era >= 3 && era <= 4 && weapon !== 'bow') g.add(at(mesh(box(0.5, 0.4, 0.32), '#a8adb3', { metalness: 0.5, roughness: 0.4 }), 0, 0.92, 0)); // Rüstung
  g.add(at(mesh(box(0.5, 0.08, 0.32), '#3a2a1c'), 0, 0.6, 0)); // Gürtel
  // Kopf
  g.add(at(mesh(ico(0.18, 1), skin), 0, 1.33, 0));
  // Helm je Epoche
  if (era === 0) g.add(at(mesh(jitter(ico(0.19, 0), 0.06, seed), '#4a3020'), 0, 1.42, -0.03, 0, 0, 0, [1, 0.6, 1]));
  else if (era <= 2) { g.add(at(mesh(new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#b8863b', { metalness: 0.5, roughness: 0.4 }), 0, 1.36, 0)); g.add(at(mesh(box(0.05, 0.18, 0.4), color), 0, 1.58, 0)); }
  else if (era === 3) g.add(at(mesh(cyl(0.2, 0.2, 0.3, 8), '#b9bec4', { metalness: 0.6, roughness: 0.35 }), 0, 1.4, 0));
  else if (era === 4) { g.add(at(mesh(cone(0.24, 0.25, 8), '#b9bec4', { metalness: 0.6, roughness: 0.35 }), 0, 1.52, 0)); }
  else if (era === 5) g.add(at(mesh(cyl(0.17, 0.19, 0.2, 8), '#3a4a6a'), 0, 1.48, 0));
  else g.add(at(mesh(new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#4d5a33'), 0, 1.38, 0));
  // Arme
  const armUp = pose === 'attack' ? -1.9 : pose === 'aim' ? -1.45 : -0.15;
  const armR = new THREE.Group(); armR.position.set(0.32, 1.08, 0); armR.rotation.x = armUp;
  armR.add(at(mesh(box(0.14, 0.5, 0.15), tunic), 0, -0.22, 0));
  armR.add(at(mesh(ico(0.08, 0), skin), 0, -0.5, 0));
  const armL = new THREE.Group(); armL.position.set(-0.32, 1.08, 0); armL.rotation.x = pose === 'aim' ? -1.45 : -0.1;
  armL.add(at(mesh(box(0.14, 0.5, 0.15), tunic), 0, -0.22, 0));
  armL.add(at(mesh(ico(0.08, 0), skin), 0, -0.5, 0));
  g.add(armR, armL);
  // Waffe in der rechten Hand
  const hand = new THREE.Group(); hand.position.set(0, -0.5, 0.02); armR.add(hand);
  if (weapon === 'club') { hand.add(at(mesh(cyl(0.04, 0.05, 0.6, 5), '#6b4a2e'), 0, 0, 0.25, Math.PI / 2, 0, 0)); hand.add(at(mesh(jitter(ico(0.12, 0), 0.05, seed), '#5a3c22'), 0, 0, 0.55)); }
  if (weapon === 'spear') { hand.add(at(mesh(cyl(0.025, 0.025, 2.0, 4), '#7a5a36'), 0, 0, 0.2, Math.PI / 2, 0, 0)); hand.add(at(mesh(cone(0.06, 0.25, 4), '#c9ced4', { metalness: 0.6 }), 0, 0, 1.3, Math.PI / 2, 0, 0)); }
  if (weapon === 'sword') { hand.add(at(mesh(box(0.06, 0.04, 0.85), '#d6dade', { metalness: 0.8, roughness: 0.25 }), 0, 0, 0.5)); hand.add(at(mesh(box(0.25, 0.05, 0.05), '#8a6a3a'), 0, 0, 0.08)); }
  if (weapon === 'pike') { hand.add(at(mesh(cyl(0.025, 0.025, 3.0, 4), '#7a5a36'), 0, 0, 0.6, Math.PI / 2, 0, 0)); hand.add(at(mesh(cone(0.05, 0.3, 4), '#c9ced4', { metalness: 0.6 }), 0, 0, 2.2, Math.PI / 2, 0, 0)); }
  if (weapon === 'rifle' || weapon === 'musket' || weapon === 'mg') {
    const len = weapon === 'musket' ? 1.25 : weapon === 'mg' ? 1.0 : 0.95;
    hand.add(at(mesh(box(0.08, 0.1, len), weapon === 'musket' ? '#6b4a2e' : '#2f2f2f'), 0, 0.02, len / 2 - 0.2));
    hand.add(at(mesh(cyl(0.025, 0.025, 0.5, 5), '#222', { metalness: 0.7 }), 0, 0.05, len - 0.05, Math.PI / 2, 0, 0));
    if (weapon === 'mg') hand.add(at(mesh(box(0.14, 0.14, 0.18), '#3a3a3a'), 0, -0.1, 0.3));
  }
  if (weapon === 'bow') {
    const bow = mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 10, Math.PI * 0.9), '#6b4a2e');
    const lh = new THREE.Group(); lh.position.set(0, -0.5, 0); armL.add(lh);
    lh.add(at(bow, 0, 0, 0.12, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.05));
    g.add(at(mesh(cyl(0.09, 0.09, 0.6, 6), '#5a3c22'), 0.05, 1.05, -0.22, 0.3, 0, 0)); // Köcher
  }
  if (weapon === 'sling') hand.add(at(mesh(ico(0.07, 0), '#888'), 0, 0, 0.1));
  if (weapon === 'tool') { hand.add(at(mesh(cyl(0.03, 0.03, 0.8, 4), '#7a5a36'), 0, 0, 0.3, Math.PI / 2, 0, 0)); hand.add(at(mesh(box(0.08, 0.3, 0.06), '#9a9a9a', { metalness: 0.6 }), 0, 0.08, 0.7)); }
  if (shield) {
    const sh = mesh(cyl(0.32, 0.32, 0.06, era >= 3 ? 4 : 8), color);
    const sb = mesh(cyl(0.1, 0.1, 0.08, 6), '#c8a24a', { metalness: 0.6 });
    const lh = new THREE.Group(); lh.position.set(-0.05, -0.35, 0.2); armL.add(lh);
    lh.add(at(sh, 0, 0, 0, Math.PI / 2, 0, era >= 3 ? Math.PI / 4 : 0)); lh.add(at(sb, 0, 0, 0.03, Math.PI / 2, 0, 0));
  }
  g.scale.setScalar(1.3);
  if (carry) {
    const c = { wood: ['#8a5a2b', box(0.5, 0.18, 0.18)], gold: ['#ffcc33', ico(0.15, 0)], food: ['#d8344f', ico(0.17, 0)], stone: ['#a5a3a0', ico(0.17, 0)] }[carry];
    g.add(at(mesh(c[1], c[0]), 0, 1.0, -0.28));
  }
  return g;
}
export function horse(color = '#6b4a2e') {
  const g = new THREE.Group();
  g.add(at(mesh(box(0.55, 0.55, 1.4), color), 0, 1.05, 0));
  g.add(at(mesh(box(0.32, 0.7, 0.35), color), 0, 1.45, 0.65, -0.5, 0, 0));
  g.add(at(mesh(box(0.28, 0.28, 0.6), color), 0, 1.75, 0.95, 0.15, 0, 0));
  g.add(at(mesh(box(0.08, 0.5, 0.5), '#2a1d12'), 0, 1.6, 0.55, -0.5, 0, 0)); // Mähne
  for (const [x, z] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) g.add(at(mesh(box(0.14, 0.8, 0.16), color), x, 0.4, z));
  g.add(at(mesh(box(0.1, 0.6, 0.1), '#2a1d12'), 0, 0.95, -0.75, 0.6, 0, 0));
  return g;
}
export function cavalry({ color, era = 3, seed = 1 }) {
  const g = new THREE.Group();
  g.add(horse(['#6b4a2e', '#4a3322', '#8a6a4a', '#d8d2c8'][seed % 4]));
  // Satteldecke in Teamfarbe
  g.add(at(mesh(box(0.62, 0.12, 0.8), color), 0, 1.35, -0.05));
  const rider = soldier({ color, era, weapon: era >= 5 ? 'rifle' : era === 3 ? 'spear' : 'sword', seed, pose: 'idle', shield: era === 3 });
  rider.scale.setScalar(0.9);
  rider.position.set(0, 0.9, -0.05);
  g.scale.setScalar(1.15);
  // Beine des Reiters ausblenden (sitzend)
  rider.children[0].visible = rider.children[1].visible = false;
  g.add(rider);
  return g;
}
export function tank(color = '#c33') {
  const g = new THREE.Group();
  g.add(at(mesh(box(1.9, 0.55, 3.2), '#56603a'), 0, 0.55, 0));
  g.add(at(mesh(box(1.6, 0.3, 2.6), '#626d44'), 0, 0.95, 0));
  for (const x of [-1.05, 1.05]) {
    g.add(at(mesh(box(0.45, 0.6, 3.4), '#2b2d24'), x, 0.35, 0));
    for (let k = 0; k < 5; k++) g.add(at(mesh(cyl(0.24, 0.24, 0.5, 8), '#3a3d30'), x, 0.3, -1.3 + k * 0.65, 0, 0, Math.PI / 2));
  }
  const tur = new THREE.Group(); tur.position.set(0, 1.25, -0.2);
  tur.add(mesh(cyl(0.75, 0.85, 0.5, 7), '#5c6740'));
  tur.add(at(mesh(cyl(0.08, 0.1, 2.4, 6), '#3a3d30'), 0, 0.05, 1.5, Math.PI / 2, 0, 0));
  tur.add(at(mesh(box(0.9, 0.08, 0.5), color), 0, 0.27, -0.3));
  tur.add(at(mesh(cyl(0.18, 0.18, 0.2, 6), '#3a3d30'), 0.3, 0.35, -0.2));
  g.add(tur);
  g.add(at(mesh(box(1.9, 0.08, 0.4), color), 0, 0.84, -1.5));
  return g;
}
export function catapult(era = 2) {
  const g = new THREE.Group(), wood = '#8a6238', dark = '#5a3c22';
  g.add(at(mesh(box(1.2, 0.2, 2.0), wood), 0, 0.45, 0));
  for (const [x, z] of [[-0.7, 0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]]) g.add(at(mesh(cyl(0.32, 0.32, 0.15, 8), dark), x, 0.32, z, 0, 0, Math.PI / 2));
  if (era <= 2) {
    g.add(at(mesh(box(0.15, 1.0, 0.15), wood), -0.45, 1.0, 0.2)); g.add(at(mesh(box(0.15, 1.0, 0.15), wood), 0.45, 1.0, 0.2));
    g.add(at(mesh(box(1.05, 0.15, 0.15), wood), 0, 1.45, 0.2));
    g.add(at(mesh(box(0.15, 0.12, 2.0), dark), 0, 0.9, -0.3, -0.5, 0, 0));
    g.add(at(mesh(cyl(0.25, 0.18, 0.18, 7), dark), 0, 1.35, -1.1));
    g.add(at(mesh(jitter(ico(0.18, 0), 0.06), '#8f8c88'), 0, 1.5, -1.1));
  } else {
    g.add(at(mesh(box(0.2, 2.6, 0.2), wood), -0.45, 1.6, 0)); g.add(at(mesh(box(0.2, 2.6, 0.2), wood), 0.45, 1.6, 0));
    g.add(at(mesh(box(0.15, 0.15, 4.0), dark), 0, 2.8, 0.2, -0.6, 0, 0));
    g.add(at(mesh(box(0.6, 0.6, 0.6), '#7a7a7a'), 0, 2.0, 1.9));
  }
  return g;
}
export function cannon(era = 4) {
  const g = new THREE.Group(), modern = era >= 5;
  g.add(at(mesh(box(0.35, 0.3, 1.6), modern ? '#56603a' : '#6b4a2e'), 0, 0.5, -0.4, 0.15, 0, 0));
  for (const x of [-0.5, 0.5]) g.add(at(mesh(cyl(0.45, 0.45, 0.12, 10), modern ? '#2b2d24' : '#5a3c22'), x, 0.45, 0, 0, 0, Math.PI / 2));
  g.add(at(mesh(cyl(modern ? 0.1 : 0.16, modern ? 0.13 : 0.2, modern ? 2.6 : 1.5, 8), modern ? '#3a3d30' : '#2e2e2e', { metalness: 0.6, roughness: 0.4 }), 0, 0.85, 0.5, Math.PI / 2 - 0.25, 0, 0));
  return g;
}

// ---------- Gebäude ----------
export function hut(color = '#d33', seed = 1) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(cyl(1.1, 1.2, 0.5, 9), '#7a5a3a'), 0, 0.25, 0));
  g.add(at(mesh(jitter(cone(1.6, 2.2, 9), 0.1, seed), '#c9a35a'), 0, 1.6, 0));
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r(); g.add(at(mesh(cyl(0.04, 0.04, 0.8, 3), '#5a3c22'), Math.cos(a) * 0.15, 2.85, Math.sin(a) * 0.15, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4)); }
  g.add(at(mesh(box(0.55, 0.75, 0.2), '#3a2616'), 0, 0.4, 1.12));
  g.add(at(mesh(box(0.7, 0.3, 0.05), color), 0, 1.4, 1.42, -0.55, 0, 0));
  return g;
}
export function campfire() {
  const g = new THREE.Group();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(at(rock(k + 40, 0.35, '#6e6a66'), Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6)); }
  for (let k = 0; k < 4; k++) g.add(at(mesh(cyl(0.06, 0.06, 0.9, 4), '#5a3c22'), 0, 0.2, 0, Math.PI / 2, k * 0.8, 0.3));
  g.add(at(mesh(cone(0.35, 0.9, 5), '#ff8a1e', { emissive: '#ff6a00', emissiveIntensity: 2.2 }), 0, 0.55, 0));
  g.add(at(mesh(cone(0.2, 0.6, 5), '#ffe066', { emissive: '#ffcc33', emissiveIntensity: 2.6 }), 0.05, 0.55, 0.05));
  const l = new THREE.PointLight('#ff9a3c', 6, 8, 1.6); l.position.y = 1.2; g.add(l);
  return g;
}
export function totem(color) {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(0.22, 0.28, 3.2, 6), '#7a5a3a'), 0, 1.6, 0));
  g.add(at(mesh(box(0.9, 0.12, 0.2), '#5a3c22'), 0, 2.6, 0));
  g.add(at(mesh(box(0.5, 0.4, 0.5), color), 0, 3.3, 0));
  return g;
}
export function longhouse(color, seed = 2) {
  const g = new THREE.Group();
  g.add(at(mesh(box(3.2, 1.1, 2.0), '#8a6a44'), 0, 0.55, 0));
  g.add(at(mesh(jitter(prism(2.6, 1.5, 3.6), 0.05, seed), '#b8954f'), 0, 1.1, 0, 0, Math.PI / 2, 0));
  g.add(at(mesh(box(0.6, 0.8, 0.1), '#3a2616'), 0, 0.4, 1.02));
  g.add(at(mesh(box(3.4, 0.15, 0.1), color), 0, 1.15, 1.05));
  return g;
}
// Mittelalter
export function timberHouse(color, seed = 3, roofColor = '#a5463a') {
  const g = new THREE.Group(), r = rand(seed);
  const w = 2.2 + r() * 0.6, d = 1.8, h = 1.5;
  g.add(at(mesh(box(w, 0.4, d), '#8c8478'), 0, 0.2, 0));
  g.add(at(mesh(box(w, h, d), '#efe3c8'), 0, 0.4 + h / 2, 0));
  for (const x of [-w / 2 + 0.05, 0, w / 2 - 0.05]) g.add(at(mesh(box(0.12, h, 0.08), '#4a3020'), x, 0.4 + h / 2, d / 2 + 0.01));
  g.add(at(mesh(box(w, 0.1, 0.08), '#4a3020'), 0, 0.4 + h * 0.55, d / 2 + 0.02));
  g.add(at(mesh(prism(d + 0.4, 1.3, w + 0.3), roofColor), 0, 0.4 + h, 0, 0, Math.PI / 2, 0));
  g.add(at(mesh(box(0.35, 0.9, 0.35), '#8c8478'), w * 0.25, 0.4 + h + 0.9, -0.3));
  g.add(at(mesh(box(0.5, 0.9, 0.08), '#5a3c22'), -w * 0.25, 0.85, d / 2 + 0.03));
  g.add(at(mesh(box(0.35, 0.35, 0.06), '#ffd98a', { emissive: '#7a5a20', emissiveIntensity: 0.4 }), w * 0.25, 1.35, d / 2 + 0.03));
  g.add(at(mesh(box(0.25, 0.6, 0.04), color), -w * 0.25, 1.75, d / 2 + 0.06));
  return g;
}
function crenels(g, w, d, y, color) {
  for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += 0.5) { g.add(at(mesh(box(0.28, 0.35, 0.28), color), x, y, d / 2 - 0.1)); g.add(at(mesh(box(0.28, 0.35, 0.28), color), x, y, -d / 2 + 0.1)); }
  for (let z = -d / 2 + 0.6; z <= d / 2 - 0.5; z += 0.5) { g.add(at(mesh(box(0.28, 0.35, 0.28), color), w / 2 - 0.1, y, z)); g.add(at(mesh(box(0.28, 0.35, 0.28), color), -w / 2 + 0.1, y, z)); }
}
export function roundTower(color, h = 5, r = 1, stone = '#b3aa9a') {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(r, r * 1.12, h, 9), stone), 0, h / 2, 0));
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; g.add(at(mesh(box(0.3, 0.35, 0.3), stone), Math.cos(a) * r * 0.95, h + 0.17, Math.sin(a) * r * 0.95, 0, -a, 0)); }
  g.add(at(mesh(cone(r * 1.2, 1.8, 9), color), 0, h + 1.2, 0));
  g.add(at(mesh(cyl(0.03, 0.03, 1.2, 3), '#333'), 0, h + 2.6, 0));
  g.add(at(mesh(box(0.6, 0.35, 0.03), color), 0.3, h + 2.95, 0));
  for (let k = 0; k < 3; k++) g.add(at(mesh(box(0.15, 0.35, 0.05), '#2a2420'), Math.cos(k * 2.1) * r * 1.01, h * 0.55, Math.sin(k * 2.1) * r * 1.01, 0, -k * 2.1 + Math.PI / 2, 0));
  return g;
}
export function castle(color) {
  const g = new THREE.Group(), stone = '#b9b0a0';
  g.add(at(mesh(box(5, 4, 5), stone), 0, 2, 0));
  crenels(g, 5, 5, 4.17, stone);
  g.add(at(mesh(box(2.6, 2.2, 2.6), '#aaa190'), 0, 5.1, 0));
  crenels(g, 2.6, 2.6, 6.37, '#aaa190');
  g.add(at(mesh(cyl(0.04, 0.04, 2, 3), '#333'), 0, 7.4, 0));
  g.add(at(mesh(box(1.4, 0.8, 0.04), color), 0.7, 7.9, 0));
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) g.add(at(roundTower(color, 5.2, 0.95, stone), x, 0, z));
  g.add(at(mesh(box(1.4, 2.0, 0.2), '#3a2616'), 0, 1.0, 2.52));
  g.add(at(mesh(box(1.8, 0.3, 0.3), stone), 0, 2.15, 2.6));
  for (const x of [-1.2, 1.2]) g.add(at(mesh(box(0.7, 1.8, 0.05), color), x, 2.6, 2.53));
  return g;
}
export function wallSegment(len = 4, stone = '#b3aa9a') {
  const g = new THREE.Group();
  g.add(at(mesh(box(len, 2.2, 0.8), stone), 0, 1.1, 0));
  for (let x = -len / 2 + 0.25; x < len / 2; x += 0.55) g.add(at(mesh(box(0.3, 0.35, 0.8), stone), x, 2.37, 0));
  return g;
}
export function windmill(color, rot = 0.3) {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(0.8, 1.2, 4, 8), '#e8dcc0'), 0, 2, 0));
  g.add(at(mesh(cone(1.05, 1.4, 8), '#7a4a35'), 0, 4.7, 0));
  const blades = new THREE.Group(); blades.position.set(0, 3.9, 1.1); blades.rotation.z = rot;
  for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.rotation.z = k * Math.PI / 2; b.add(at(mesh(box(0.1, 2.6, 0.06), '#5a3c22'), 0, 1.3, 0)); b.add(at(mesh(box(0.55, 2.0, 0.03), '#f2ead8'), 0.3, 1.5, 0)); blades.add(b); }
  blades.add(mesh(cyl(0.15, 0.15, 0.3, 6), '#5a3c22').rotateX(Math.PI / 2));
  g.add(blades);
  g.add(at(mesh(box(0.6, 0.6, 0.05), color), 0, 2.7, 0.85));
  return g;
}
export function barracks(color) {
  const g = new THREE.Group();
  g.add(at(mesh(box(5, 2, 3), '#b3aa9a'), 0, 1, 0));
  g.add(at(mesh(prism(3.4, 1.4, 5.3), '#6a6f7a'), 0, 2, 0, 0, Math.PI / 2, 0));
  g.add(at(mesh(box(1.2, 1.4, 0.1), '#3a2616'), 0, 0.7, 1.52));
  for (const x of [-1.8, 1.8]) g.add(at(mesh(box(0.8, 1.2, 0.05), color), x, 1.3, 1.53));
  // Übungspuppen
  for (const x of [-1.5, 0, 1.5]) { g.add(at(mesh(cyl(0.06, 0.06, 1.4, 4), '#7a5a36'), x, 0.7, 3)); g.add(at(mesh(box(0.7, 0.08, 0.08), '#7a5a36'), x, 1.1, 3)); g.add(at(mesh(ico(0.18, 0), '#c9a35a'), x, 1.5, 3)); }
  return g;
}
export function field(w = 4, d = 4, seed = 1, ripe = true) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(box(w, 0.1, d), '#8a6640'), 0, 0.05, 0));
  for (let z = -d / 2 + 0.35; z < d / 2; z += 0.5) for (let x = -w / 2 + 0.3; x < w / 2; x += 0.42) {
    g.add(at(mesh(cone(0.13, 0.45 + r() * 0.1, 4), ripe ? (r() < 0.5 ? '#e0c050' : '#d4b143') : '#7fae3c'), x, 0.3, z, 0, r() * 3, 0));
  }
  // Zaun
  for (const [x, z, rot, len] of [[0, d / 2 + 0.2, 0, w], [0, -d / 2 - 0.2, 0, w], [w / 2 + 0.2, 0, Math.PI / 2, d], [-w / 2 - 0.2, 0, Math.PI / 2, d]]) {
    g.add(at(mesh(box(len, 0.06, 0.06), '#7a5a36'), x, 0.45, z, 0, rot, 0));
  }
  return g;
}
// Moderne
export function concreteBlock(color, w = 4, h = 5, d = 4, seed = 1) {
  const g = new THREE.Group(), r = rand(seed);
  g.add(at(mesh(box(w, h, d), '#9ea3a6'), 0, h / 2, 0));
  g.add(at(mesh(box(w + 0.2, 0.25, d + 0.2), '#7d8285'), 0, h, 0));
  for (let y = 1; y < h - 0.5; y += 1.1) for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.9) {
    const lit = r() < 0.3;
    g.add(at(mesh(box(0.5, 0.55, 0.05), lit ? '#ffe7a3' : '#384a5a', lit ? { emissive: '#ffcc66', emissiveIntensity: 0.6 } : { metalness: 0.4, roughness: 0.2 }), x, y, d / 2 + 0.01));
  }
  g.add(at(mesh(box(w * 0.6, 0.6, 0.05), color), 0, h - 0.6, d / 2 + 0.03));
  return g;
}
export function factory(color) {
  const g = new THREE.Group();
  g.add(at(mesh(box(7, 3, 4.5), '#8a6a5a'), 0, 1.5, 0));
  for (let k = 0; k < 3; k++) g.add(at(mesh(prism(4.6, 1.2, 2.3), '#5d6166'), -2.3 + k * 2.3, 3, 0, 0, 0, 0));
  for (const [x, h] of [[2.5, 6], [1.3, 5]]) { g.add(at(mesh(cyl(0.35, 0.45, h, 8), '#7a5040'), x, h / 2, -1.2)); g.add(at(mesh(cyl(0.4, 0.4, 0.3, 8), color), x, h - 0.6, -1.2)); }
  g.add(at(mesh(box(2, 1.8, 0.1), '#3a3d40'), -2, 0.9, 2.27));
  return g;
}
export function smoke(n = 6, seed = 1, dark = false) {
  const g = new THREE.Group(), r = rand(seed);
  for (let k = 0; k < n; k++) {
    const m = mesh(jitter(ico(0.45 + k * 0.12, 0), 0.15, seed + k), dark ? '#3a3a3a' : '#c8c8c8', { transparent: true, opacity: 0.75 - k * 0.08 });
    m.castShadow = false;
    g.add(at(m, (r() - 0.5) * 0.4 + k * 0.25, k * 0.75, (r() - 0.5) * 0.4, r(), r(), r()));
  }
  return g;
}
export function hq(color) {
  const g = new THREE.Group();
  g.add(concreteBlock(color, 6, 4, 5, 9));
  g.add(at(mesh(cyl(0.08, 0.08, 2.5, 4), '#555'), 2, 5.2, -1.5));
  const dish = mesh(new THREE.SphereGeometry(0.9, 8, 4, 0, Math.PI * 2, 0, Math.PI / 3), '#d8dadc', { side: THREE.DoubleSide });
  g.add(at(dish, 2, 6.4, -1.5, -0.8, 0, 0));
  g.add(at(mesh(cyl(0.04, 0.04, 3, 3), '#333'), -2.5, 5.5, 2));
  g.add(at(mesh(box(1.5, 0.9, 0.04), color), -1.75, 6.6, 2));
  return g;
}
export function sandbags(n = 6) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) for (let row = 0; row < 2; row++) g.add(at(mesh(jitter(box(0.6, 0.28, 0.35), 0.05, k + row * 10), '#b8a57a'), (k - n / 2) * 0.58 + row * 0.29, 0.14 + row * 0.27, 0));
  return g;
}
export function crater(s = 1.5) {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(s, s * 1.2, 0.15, 9), '#3d3226'), 0, 0.02, 0));
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.add(at(rock(k + 70, 0.35, '#5a4a38'), Math.cos(a) * s * 1.1, 0.05, Math.sin(a) * s * 1.1)); }
  return g;
}
export function explosion(s = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(jitter(ico(1.0 * s, 1), 0.3 * s, 3), '#ffb347', { emissive: '#ff7a00', emissiveIntensity: 2.5 }), 0, s, 0));
  g.add(at(mesh(jitter(ico(0.6 * s, 1), 0.2 * s, 4), '#fff2a8', { emissive: '#ffd34d', emissiveIntensity: 3 }), 0.2 * s, 1.2 * s, 0.3 * s));
  g.add(at(smoke(5, 9, true), 0.3 * s, 1.8 * s, 0));
  const l = new THREE.PointLight('#ff8a30', 30 * s, 12 * s, 1.5); l.position.y = s; g.add(l);
  return g;
}
export function flame(s = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(cone(0.5 * s, 1.4 * s, 5), '#ff7a1e', { emissive: '#ff5a00', emissiveIntensity: 2.4 }), 0, 0.7 * s, 0));
  g.add(at(mesh(cone(0.3 * s, 0.9 * s, 5), '#ffe066', { emissive: '#ffcc33', emissiveIntensity: 2.8 }), 0.15 * s, 0.5 * s, 0.1 * s));
  const l = new THREE.PointLight('#ff8a30', 8 * s, 7 * s, 1.6); l.position.y = s; g.add(l);
  return g;
}
export function arrow() {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(0.02, 0.02, 1.0, 3), '#6b4a2e'), 0, 0, 0, Math.PI / 2, 0, 0));
  g.add(at(mesh(cone(0.05, 0.15, 3), '#999'), 0, 0, 0.55, Math.PI / 2, 0, 0));
  return g;
}
export function selectionRing(r = 0.6, color = '#6dff8a') {
  const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.08, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05;
  return m;
}
export function healthBar(k = 0.8, w = 1) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.24), new THREE.MeshBasicMaterial({ color: '#111', depthTest: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(w * k, 0.16), new THREE.MeshBasicMaterial({ color: k > 0.5 ? '#5fd35f' : '#e8c03a', depthTest: false }));
  fg.position.set(-(w - w * k) / 2, 0, 0.001);
  bg.renderOrder = fg.renderOrder = 10;
  g.add(bg, fg);
  return g;
}

// ---------- Tiere ----------
export function mammoth(seed = 1) {
  const g = new THREE.Group(), fur = ['#6b4a32', '#5a3c26', '#7a5638'][seed % 3];
  g.add(at(mesh(jitter(ico(1.3, 1), 0.15, seed), fur), 0, 2.2, 0, 0, 0, 0, [1, 0.95, 1.35]));
  g.add(at(mesh(jitter(ico(0.85, 0), 0.1, seed + 1), fur), 0, 2.7, 1.5));
  g.add(at(mesh(cyl(0.25, 0.12, 1.7, 6), fur), 0, 1.6, 2.1, 0.35, 0, 0));
  for (const x of [-0.35, 0.35]) g.add(at(mesh(new THREE.TorusGeometry(0.6, 0.08, 4, 8, Math.PI * 0.8), '#f1e9d6'), x, 1.8, 2.1, 0, Math.PI / 2, Math.PI * 0.9));
  for (const [x, z] of [[-0.6, 0.7], [0.6, 0.7], [-0.6, -0.8], [0.6, -0.8]]) g.add(at(mesh(cyl(0.32, 0.3, 1.5, 6), fur), x, 0.75, z));
  return g;
}
export function deer(seed = 1) {
  const g = new THREE.Group(), c = '#a8763f';
  g.add(at(mesh(box(0.35, 0.4, 1.0), c), 0, 0.85, 0));
  g.add(at(mesh(box(0.18, 0.5, 0.2), c), 0, 1.15, 0.45, -0.4, 0, 0));
  g.add(at(mesh(box(0.2, 0.2, 0.38), c), 0, 1.4, 0.62));
  for (const x of [-0.1, 0.1]) g.add(at(mesh(cyl(0.02, 0.02, 0.5, 3), '#d8c8a8'), x, 1.7, 0.55, 0, 0, x * 3));
  for (const [x, z] of [[-0.12, 0.35], [0.12, 0.35], [-0.12, -0.35], [0.12, -0.35]]) g.add(at(mesh(box(0.08, 0.65, 0.08), c), x, 0.33, z));
  return g;
}
export function warElephant(color, seed = 1) {
  const g = new THREE.Group(), skin = '#8d8a86';
  g.add(at(mesh(jitter(ico(1.2, 1), 0.08, seed), skin), 0, 2.0, 0, 0, 0, 0, [1, 0.9, 1.3]));
  g.add(at(mesh(jitter(ico(0.7, 0), 0.06, seed + 1), skin), 0, 2.4, 1.45));
  g.add(at(mesh(cyl(0.2, 0.08, 1.5, 6), skin), 0, 1.5, 1.95, 0.25, 0, 0));
  for (const x of [-0.6, 0.6]) g.add(at(mesh(box(0.08, 0.7, 0.55), skin), x, 2.4, 1.3, 0, x > 0 ? 0.3 : -0.3, 0));
  for (const x of [-0.3, 0.3]) g.add(at(mesh(cone(0.07, 0.8, 4), '#f1e9d6'), x, 1.8, 1.9, 1.3, 0, 0));
  for (const [x, z] of [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.7], [0.55, -0.7]]) g.add(at(mesh(cyl(0.3, 0.28, 1.4, 6), skin), x, 0.7, z));
  g.add(at(mesh(box(1.5, 0.15, 1.6), color), 0, 2.95, -0.1));
  g.add(at(mesh(box(1.1, 0.7, 1.1), '#8a6238'), 0, 3.35, -0.1));
  for (const [x, z] of [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.4], [0.5, 0.4]]) g.add(at(mesh(cyl(0.04, 0.04, 0.9, 3), '#5a3c22'), x, 3.9, z));
  g.add(at(mesh(cone(0.9, 0.6, 4), color), 0, 4.55, -0.1, 0, Math.PI / 4, 0));
  return g;
}
// ---------- Wasser ----------
export function boat(color, kind = 'fish') {
  const g = new THREE.Group();
  const hull = new THREE.Shape(); hull.moveTo(0, 1.6); hull.quadraticCurveTo(0.8, 0.6, 0.7, -1.4); hull.lineTo(-0.7, -1.4); hull.quadraticCurveTo(-0.8, 0.6, 0, 1.6);
  const s = kind === 'war' ? 1.8 : 1;
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.6, bevelEnabled: false }); hg.rotateX(Math.PI / 2); hg.translate(0, 0.6, 0);
  g.add(at(mesh(hg, '#7a5530'), 0, -0.1, 0, 0, 0, 0, s));
  g.add(at(mesh(cyl(0.05, 0.06, 2.6 * s, 4), '#5a3c22'), 0, 1.4 * s, 0));
  const sail = mesh(box(1.5 * s, 1.6 * s, 0.04), kind === 'war' ? color : '#efe6d2'); g.add(at(sail, 0, 1.6 * s, 0.05));
  if (kind !== 'war') g.add(at(mesh(box(0.5, 0.06, 0.06), color), 0, 2.6, 0));
  else { for (let k = -2; k <= 2; k++) for (const x of [-1, 1]) g.add(at(mesh(box(1.4, 0.05, 0.08), '#6b4a2e'), x * 1.2, 0.2, k * 0.6, 0, 0, x * 0.4)); }
  return g;
}
// ---------- Kulturen ----------
export function pagoda(color, tiers = 3) {
  const g = new THREE.Group();
  g.add(at(mesh(box(4, 0.6, 4), '#b8ad98'), 0, 0.3, 0));
  for (let k = 0; k < tiers; k++) {
    const w = 3 - k * 0.6, y = 0.6 + k * 1.6;
    g.add(at(mesh(box(w, 1.1, w), '#c8402f'), 0, y + 0.55, 0));
    const roof = mesh(cyl(w * 0.35, w * 0.82, 0.5, 4), '#2f4a3a'); g.add(at(roof, 0, y + 1.3, 0, 0, Math.PI / 4, 0));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(at(mesh(cone(0.1, 0.35, 4), '#2f4a3a'), x * w * 0.55, y + 1.15, z * w * 0.55, z * 0.6, 0, -x * 0.6));
  }
  g.add(at(mesh(cyl(0.04, 0.04, 1.2, 3), '#c8a24a'), 0, 0.6 + tiers * 1.6 + 0.6, 0));
  g.add(at(mesh(box(0.6, 0.4, 0.03), color), 0.3, 0.6 + tiers * 1.6 + 1.0, 0));
  return g;
}
export function asianHouse(color, seed = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(box(2.4, 1.3, 1.8), '#e8dcc0'), 0, 0.65, 0));
  for (const x of [-1.1, 1.1]) g.add(at(mesh(box(0.1, 1.3, 0.1), '#7a2a20'), x, 0.65, 0.9));
  const roof = mesh(cyl(0.8, 1.9, 0.7, 4), '#3d5a4a'); g.add(at(roof, 0, 1.6, 0, 0, Math.PI / 4, 0, [1.15, 1, 0.9]));
  g.add(at(mesh(box(0.25, 0.6, 0.04), color), 0.6, 0.9, 0.92));
  return g;
}
export function palisade(len = 4) {
  const g = new THREE.Group(), r = rand(len * 7);
  for (let x = -len / 2; x < len / 2; x += 0.32) { g.add(at(mesh(cyl(0.15, 0.17, 2.2 + r() * 0.3, 5), '#7a5a36'), x, 1.1, 0)); g.add(at(mesh(cone(0.15, 0.35, 5), '#6b4a2e'), x, 2.4, 0)); }
  g.add(at(mesh(box(len, 0.1, 0.1), '#5a3c22'), 0, 1.6, 0.15));
  return g;
}
export function gatehouse(color) {
  const g = new THREE.Group(), stone = '#b3aa9a';
  for (const x of [-2, 2]) g.add(at(roundTower(color, 5, 1.1, stone), x, 0, 0));
  g.add(at(mesh(box(3, 3.4, 1.6), stone), 0, 3.3, 0));
  g.add(at(mesh(box(2.0, 2.6, 1.7), '#3a2616'), 0, 1.3, 0));
  for (let x = -1.3; x <= 1.3; x += 0.52) g.add(at(mesh(box(0.3, 0.35, 1.6), stone), x, 5.2, 0));
  g.add(at(mesh(box(1.2, 1.6, 0.05), color), 0, 3.4, 0.83));
  return g;
}
export function bigWall(len = 8, stone = '#b3aa9a') {
  const g = new THREE.Group();
  g.add(at(mesh(box(len, 3.4, 1.4), stone), 0, 1.7, 0));
  for (let x = -len / 2 + 0.25; x < len / 2; x += 0.55) g.add(at(mesh(box(0.3, 0.4, 1.4), stone), x, 3.6, 0));
  return g;
}
export function plane(color) {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(0.35, 0.18, 4, 7), '#6d7550'), 0, 0, 0, Math.PI / 2, 0, 0));
  g.add(at(mesh(box(6, 0.1, 1), '#6d7550'), 0, 0.15, 0.5));
  g.add(at(mesh(box(2.2, 0.08, 0.6), '#6d7550'), 0, 0.1, -1.8));
  g.add(at(mesh(box(0.08, 0.8, 0.6), '#6d7550'), 0, 0.45, -1.8));
  for (const x of [-2.2, 2.2]) g.add(at(mesh(cyl(0.38, 0.38, 0.06, 8), color), x, 0.21, 0.5));
  g.add(at(mesh(box(1.4, 0.04, 0.12), '#222'), 0, 0, 2.05));
  return g;
}
export function dirtPatch(r = 3, color = '#9c7a50') {
  const m = new THREE.Mesh(jitter(new THREE.CircleGeometry(r, 9), 0.6, r * 10), mat(color));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}
export function bush(seed = 1, autumn = false) {
  const g = new THREE.Group(), r = rand(seed);
  const cols = autumn ? ['#c98a2b', '#a8902f', '#7f9a3a'] : ['#3f7f35', '#4f9440', '#5a8a2f'];
  for (let k = 0; k < 3; k++) g.add(at(mesh(jitter(ico(0.35 + r() * 0.2, 0), 0.1, seed + k), cols[k]), (r() - 0.5) * 0.6, 0.3, (r() - 0.5) * 0.6));
  return g;
}
