// Vorschauszenen für den Low-Poly-3D-Look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import * as A from './assets.js';

const RED = '#d8402f', BLUE = '#2f6fd8', GREEN = '#3aa24a', YELLOW = '#e2b12e';

// ---------- Gelände ----------
function noise2(seed) {
  const r = A.rand(seed), N = 256, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y & 255) * N) + (x & 255)];
  const s = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, o = 4) => { let t = 0, a = 1, f = 1, m = 0; for (let k = 0; k < o; k++) { t += n(x * f, y * f) * a; m += a; a *= 0.5; f *= 2; } return t / m; };
}
function makeTerrain({ size = 110, seg = 110, seed = 7, river = null, flats = [], hills = 2.2, palette = 'summer' }) {
  const nz = noise2(seed);
  const riverDist = (x, z) => { if (!river) return 99; let best = 99; for (let k = 0; k < river.length - 1; k++) { const [ax, az] = river[k], [bx, bz] = river[k + 1]; const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = ((x - ax) * dx + (z - az) * dz) / l; t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return best; };
  const height = (x, z) => {
    let h = 0.9 + Math.max(-0.3, (nz(x * 0.035 + 10, z * 0.035 + 10, 4) - 0.45) * hills * 3.2);
    h += Math.max(0, nz(x * 0.02 + 50, z * 0.02, 3) - 0.58) * 22; // Hügel
    h = Math.max(h, 0.45);
    for (const f of flats) { const d = Math.hypot(x - f[0], z - f[1]); if (d < f[2]) { const k = Math.min(1, (f[2] - d) / 4); h = h * (1 - k) + 0.9 * k; } }
    const rd = riverDist(x, z);
    if (rd < 7) { const k = rd / 7; h = h * k + (-1.4 + rd * 0.3) * (1 - k); }
    return h;
  };
  const geo = new THREE.PlaneGeometry(size, size, Math.round(seg * 0.8), Math.round(seg * 0.8)).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const colors = new Float32Array(p.count * 3), c = new THREE.Color();
  const pal = palette === 'lush' ? { g1: '#5f9a3a', g2: '#a3ad48', dirt: '#9a7a4e', sand: '#e2cf98', rock: '#9a958e' } : palette === 'war'
    ? { g1: '#7d9a46', g2: '#8aa64e', dirt: '#8c7350', sand: '#c9b27c', rock: '#8a857c' }
    : { g1: '#62a03f', g2: '#7aae47', dirt: '#9c7a50', sand: '#e2cf98', rock: '#9a958e' };
  const jr = A.rand(seed + 99);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const ny = geo.attributes.normal.getY(i);
    const v = nz(x * 0.08, z * 0.08, 3);
    const dirt = nz(x * 0.05 + 30, z * 0.05, 3);
    if (y < 0.0) c.set(pal.sand).offsetHSL(0, -0.05, -0.12);
    else if (y < 0.35) c.set(pal.sand);
    else if (ny < 0.8 || y > 6.5) { c.set(y > 9.5 ? '#eef2f4' : pal.rock); if (y < 9.5 && ny > 0.9) c.lerp(tmp.set(pal.g1), 0.4); }
    else {
      c.set(pal.g1).lerp(tmp.set(pal.g2), v);
      if (dirt > 0.58) c.lerp(tmp.set(pal.dirt), Math.min(0.85, (dirt - 0.58) * 6));
      if (y < 0.55) c.lerp(tmp.set(pal.sand), (0.55 - y) * 4);
    }
    c.offsetHSL(0, 0, (jr() - 0.5) * 0.035); // leichte Facetten-Variation
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.receiveShadow = true;
  return { mesh: m, height };
}
function makeWater(size = 110, y = -0.35) {
  const geo = new THREE.PlaneGeometry(size, size, 70, 70).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, r = A.rand(4);
  const map = new Map();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(2) + ',' + p.getZ(i).toFixed(2); if (!map.has(k)) map.set(k, (r() - 0.5) * 0.18); p.setY(i, map.get(k)); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#3fb0d0', transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.15, flatShading: true }));
  m.position.y = y; m.receiveShadow = true;
  return m;
}

// ---------- Grundgerüst ----------
export function setup(canvas, { sky = ['#9fd2f2', '#f6e3c4'], fog = [60, 150], sun = [40, 60, 25], sunColor = '#fff1d6', sunI = 2.8, hemi = 0.9, exposure = 1.0, w = 1920, h = 1080 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  // Himmelsverlauf
  const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  scene.fog = new THREE.Fog(sky[1], fog[0], fog[1]);
  scene.add(new THREE.HemisphereLight('#cfe8ff', '#5a6a3a', hemi));
  const s = new THREE.DirectionalLight(sunColor, sunI);
  s.position.set(...sun);
  s.castShadow = true;
  s.shadow.mapSize.set(4096, 4096);
  const sc = s.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 200;
  s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03;
  scene.add(s);
  const camera = new THREE.PerspectiveCamera(36, w / h, 0.5, 400);
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, w, h);
  ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.5, 0.9));
  composer.addPass(new OutputPass());
  return { renderer, scene, camera, composer };
}
function place(scene, height, obj, x, z, ry = 0, s = 1) {
  obj.position.set(x, height(x, z), z);
  obj.rotation.y = ry;
  if (s !== 1) obj.scale.multiplyScalar(s);
  scene.add(obj);
  return obj;
}
function forest(scene, height, cx, cz, r, n, seed, mix = 0.5, avoid = () => false) {
  const rr = A.rand(seed);
  for (let k = 0; k < n; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (height(x, z) < 0.3 || avoid(x, z)) continue;
    place(scene, height, rr() < mix ? A.treeConifer(seed * 100 + k) : A.treeLeaf(seed * 100 + k), x, z, rr() * 6);
  }
}
function scatter(scene, height, fn, n, area, seed, avoid = () => false) {
  const r = A.rand(seed);
  for (let k = 0; k < n; k++) {
    const x = area[0] + r() * (area[2] - area[0]), z = area[1] + r() * (area[3] - area[1]);
    if (height(x, z) < 0.3 || avoid(x, z)) continue;
    place(scene, height, fn(k), x, z, r() * 6);
  }
}
function lookRTS(camera, tx, tz, dist = 48, pitch = 0.95, yaw = 0.35) {
  camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(tx, 0, tz);
}

// ---------- Szene 1: Steinzeit-Siedlung ----------
export function sceneStone(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ seed: 11, river: [[-60, 30], [-20, 18], [5, 22], [30, 8], [60, 12]], flats: [[0, -4, 13, 0.5]] });
  scene.add(T.mesh); scene.add(makeWater());
  const H = T.height;
  const P = (o, x, z, r, s) => place(scene, H, o, x, z, r, s);
  const inVillage = (x, z) => Math.hypot(x, z + 4) < 14;
  // Dorf
  P(A.longhouse(RED), 0, -6, 0.2, 1.4);
  P(A.totem(RED), 3.5, -1.5);
  P(A.campfire(), -1.2, -1);
  [[-7, -9], [7, -10], [-8, -2], [8, -3], [-4, -13], [5, -15]].forEach(([x, z], i) => P(A.hut(RED, i + 1), x, z, Math.atan2(-x, -z - 6) , 0.95));
  // Bewohner am Feuer
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; P(A.soldier({ color: RED, era: 0, weapon: k % 2 ? 'club' : 'tool', seed: 20 + k }), -1.2 + Math.cos(a) * 1.6, -1 + Math.sin(a) * 1.6, -a - Math.PI / 2); }
  // Beeren & Sammler
  for (let k = 0; k < 7; k++) P(A.berryBush(k + 3), 10 + (k % 3) * 1.5, 4 + Math.floor(k / 3) * 1.4);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 31, pose: 'attack' }), 9.4, 5.2, 0.8);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 32, carry: 'food', pose: 'walk' }), 6.5, 2.5, -2.2);
  // Gold & Stein mit Arbeitern
  P(A.goldMine(4), -14, 4); P(A.stoneMine(8), -16, -10);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 33, pose: 'attack' }), -12.2, 3.2, -1.6);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 34, carry: 'gold', pose: 'walk' }), -9, 0.5, 1.2);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 35, pose: 'attack' }), -14.5, -8.0, Math.PI);
  // Holzfäller am Waldrand
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 36, pose: 'attack' }), 14, -12, -1);
  P(A.soldier({ color: RED, era: 0, weapon: 'tool', seed: 37, carry: 'wood', pose: 'walk' }), 10, -9, -2.4);
  // Keulenträger-Trupp
  for (let k = 0; k < 6; k++) P(A.soldier({ color: RED, era: 0, weapon: k % 3 === 2 ? 'sling' : 'club', seed: 50 + k, pose: 'walk' }), 3 + (k % 3) * 1.1, 8 + Math.floor(k / 3) * 1.2, 0.4);
  // Feindlicher Späher jenseits des Flusses
  P(A.soldier({ color: BLUE, era: 0, weapon: 'club', seed: 60, pose: 'walk' }), 8, 30, Math.PI);
  P(A.hut(BLUE, 9), 18, 36, 0.4);
  // Natur
  forest(scene, H, 22, -16, 12, 70, 3, 0.6, inVillage);
  forest(scene, H, -26, -20, 13, 70, 4, 0.4, inVillage);
  forest(scene, H, -10, 38, 14, 60, 5, 0.5);
  forest(scene, H, 30, 30, 10, 40, 6, 0.3);
  scatter(scene, H, k => A.rock(k + 100, 0.6 + (k % 3) * 0.3), 25, [-45, -40, 45, 45], 7, inVillage);
  scatter(scene, H, k => A.grassTuft(k), 220, [-45, -40, 45, 45], 8, inVillage);
  scatter(scene, H, k => A.flower(['#ffffff', '#ffd34d', '#e05a9a'][k % 3], k), 120, [-40, -30, 40, 40], 9, inVillage);
  lookRTS(camera, 0, 2, 50, 0.92, 0.45);
}

// ---------- Szene 2: Mittelalter – Belagerung ----------
export function sceneMedieval(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ seed: 21, river: [[-60, -40], [-35, -28], [-30, 0], [-42, 40]], flats: [[-6, -6, 18, 0.6], [16, 14, 12, 0.5]], hills: 1.8 });
  scene.add(T.mesh); scene.add(makeWater());
  const H = T.height;
  const P = (o, x, z, r, s) => place(scene, H, o, x, z, r, s);
  const town = (x, z) => Math.hypot(x + 6, z + 6) < 16 || Math.hypot(x - 14, z - 12) < 13;
  // Rote Burg mit Mauer
  P(A.castle(RED), -8, -10, 0.2);
  const wallPts = [[-16, 0, 0.2], [-12, 0.8, 0.2], [-4, 2.4, 0.2], [0, 3.2, 0.2], [4.5, 3.8, 0.05]];
  wallPts.forEach(([x, z, r]) => P(A.wallSegment(4.2), x, z, r));
  P(A.roundTower(RED, 3.8, 0.9), -8, 1.6); P(A.roundTower(RED, 3.8, 0.9), 6.6, 4.1);
  [[-15, -16], [-1, -17], [3, -11], [-17, -8], [4, -3]].forEach(([x, z], i) => P(A.timberHouse(RED, i + 3), x, z, (i - 2) * 0.3));
  P(A.windmill(RED, 0.5), -20, -2, 0.8);
  P(A.barracks(RED), 7, -18, -0.3, 0.9);
  P(A.field(5, 4, 3), -24, -14, 0.1); P(A.field(4, 4, 4, false), -24, -7, 0.1);
  // Brennendes Haus
  const burning = P(A.timberHouse(RED, 9), 2, -5.5, 0.4);
  P(A.flame(1.1), 2.3, -5.3); P(A.smoke(8, 3, true), 2.6, -4.6);
  // Verteidiger auf der Mauer / davor
  for (let k = 0; k < 6; k++) P(A.soldier({ color: RED, era: 3, weapon: 'bow', seed: 70 + k, pose: 'aim' }), -14 + k * 3.2, 1.6 + k * 0.45, 0.1).position.y += 2.2;
  for (let k = 0; k < 10; k++) P(A.soldier({ color: RED, era: 3, weapon: 'pike', seed: 90 + k, pose: 'attack' }), -2 + (k % 5) * 1.1, 6.5 + Math.floor(k / 5) * 1.1, 0.15);
  // Blaue Armee greift an
  const r = A.rand(5);
  ctx.cav = [];
  for (let k = 0; k < 12; k++) ctx.cav.push(P(A.cavalry({ color: BLUE, era: 3, seed: k }), 2 + (k % 4) * 2 + r(), 11 + Math.floor(k / 4) * 2.4 + r(), Math.PI + 0.2));
  for (let k = 0; k < 16; k++) P(A.soldier({ color: BLUE, era: 3, weapon: 'sword', seed: 110 + k, shield: true, pose: k % 2 ? 'attack' : 'walk' }), -8 + (k % 6) * 1.2 + r() * 0.4, 9 + Math.floor(k / 6) * 1.3 + r() * 0.4, Math.PI - 0.1);
  for (let k = 0; k < 12; k++) P(A.soldier({ color: BLUE, era: 3, weapon: 'bow', seed: 140 + k, pose: 'aim' }), -10 + (k % 6) * 1.3, 17 + Math.floor(k / 6) * 1.3, Math.PI);
  P(A.catapult(3), 14, 22, Math.PI + 0.3); P(A.catapult(3), 4, 24, Math.PI);
  // Pfeile in der Luft
  for (let k = 0; k < 18; k++) { const a = A.arrow(); a.position.set(-12 + r() * 16, 4 + r() * 4, 5 + r() * 9); a.rotation.set(-0.3 + (k % 2) * 0.6, k % 2 ? 0 : Math.PI, 0); scene.add(a); }
  // Felsbrocken im Flug
  const boulder = A.rock(77, 0.8, '#8a857c'); boulder.position.set(6, 9, 6); scene.add(boulder);
  // Blaues Lager hinten
  P(A.timberHouse(BLUE, 30, '#3d5a8a'), 22, 30, 2.8); P(A.roundTower(BLUE, 3.5, 0.8), 28, 26);
  forest(scene, H, 26, -14, 12, 60, 12, 0.5, town);
  forest(scene, H, -40, 24, 14, 70, 13, 0.5, town);
  forest(scene, H, 34, 4, 8, 30, 14, 0.3, town);
  scatter(scene, H, k => A.rock(k + 200, 0.5 + (k % 3) * 0.3), 20, [-45, -40, 45, 45], 15, town);
  scatter(scene, H, k => A.grassTuft(k), 200, [-45, -40, 45, 45], 16, town);
  lookRTS(camera, -2, 4, 54, 0.88, 0.62);
}

// ---------- Szene 3: Moderne – Panzerangriff ----------
export function sceneModern(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ seed: 31, flats: [[-10, -10, 16, 0.5]], hills: 1.6, palette: 'war' });
  scene.add(T.mesh); scene.add(makeWater(110, -2.5));
  const H = T.height;
  const P = (o, x, z, r, s) => place(scene, H, o, x, z, r, s);
  const base = (x, z) => Math.hypot(x + 10, z + 10) < 17;
  P(A.hq(RED), -12, -14, 0.15);
  P(A.factory(RED), 0, -20, 0.1); P(A.smoke(9, 4), 2.6, -15.2); P(A.smoke(8, 7), 1.4, -16.2);
  P(A.concreteBlock(RED, 4, 6, 4, 2), -22, -10, 0.2); P(A.concreteBlock(RED, 3.5, 4, 3.5, 3), -20, -2, 0.1);
  P(A.cannon(6), -4, -3, 0.2); P(A.cannon(6), -9, 0, 0.3);
  for (let k = 0; k < 3; k++) { P(A.sandbags(6), -6 + k * 6, 3 + k * 0.4, 0.05); for (let j = 0; j < 3; j++) P(A.soldier({ color: RED, era: 6, weapon: j === 1 ? 'mg' : 'rifle', seed: 300 + k * 3 + j, pose: 'aim' }), -7 + k * 6 + j * 1.1, 2.2 + k * 0.4, 0); }
  P(A.tank(RED), -16, 4, 0.2); P(A.tank(RED), 6, -6, 0.5);
  // Blaue Panzerkolonne
  const r = A.rand(8);
  for (let k = 0; k < 7; k++) P(A.tank(BLUE), -10 + k * 4.5 + r(), 20 + (k % 2) * 4 + r() * 2, Math.PI + 0.1);
  for (let k = 0; k < 18; k++) P(A.soldier({ color: BLUE, era: 6, weapon: k % 6 === 0 ? 'mg' : 'rifle', seed: 400 + k, pose: k % 3 ? 'walk' : 'aim' }), -8 + (k % 9) * 2.2 + r(), 15 + Math.floor(k / 9) * 2 + r(), Math.PI);
  P(A.cannon(6), 24, 30, Math.PI * 1.1); P(A.cannon(6), 18, 32, Math.PI);
  // Krater & Explosionen
  [[2, 9], [-12, 12], [12, 5], [-2, 16], [16, 14], [-18, 18]].forEach(([x, z], i) => P(A.crater(1.2 + (i % 3) * 0.4), x, z));
  P(A.explosion(1.2), 1, 9); P(A.explosion(0.9), 12, 5); P(A.explosion(1.4), -14, -6);
  P(A.flame(1.3), -20, -2); P(A.smoke(9, 11, true), -19.5, -1.2);
  scatter(scene, H, k => A.treeLeaf(k + 500, 1, true), 40, [-50, -45, 50, 45], 21, (x, z) => base(x, z) || Math.abs(z - 15) < 9);
  scatter(scene, H, k => A.rock(k + 600, 0.5 + (k % 3) * 0.3, '#7d7468'), 30, [-50, -45, 50, 45], 22, base);
  scatter(scene, H, k => A.grassTuft(k), 160, [-50, -45, 50, 45], 23, base);
  lookRTS(camera, -2, 4, 56, 0.9, -0.5);
}

// ---------- Szene 4: Epochen-Übersicht ----------
export function sceneEras(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ seed: 41, hills: 0.5, flats: [[0, 0, 26, 0.9]] });
  scene.add(T.mesh);
  const eraW = ['club', 'spear', 'sword', 'sword', 'pike', 'musket', 'rifle'];
  const rng = ['sling', 'bow', 'bow', 'bow', 'musket', 'rifle', 'mg'];
  ctx.labelPts = [];
  for (let e = 0; e < 7; e++) {
    const x = (e - 3) * 5.2, y = 0.9;
    const ped = A.mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.45, 8), e % 2 ? '#c9bfa9' : '#d8cfba'); ped.position.set(x, y + 0.2, 0.6); scene.add(ped);
    const inf = A.soldier({ color: RED, era: e, weapon: eraW[e], seed: e + 1, shield: e >= 1 && e <= 3 }); inf.position.set(x - 0.75, y + 0.45, 1.0); inf.rotation.y = 0.25; scene.add(inf);
    const ranged = A.soldier({ color: RED, era: e, weapon: rng[e], seed: e + 11, pose: 'aim' }); ranged.position.set(x + 0.8, y + 0.45, 0.2); ranged.rotation.y = 0.5; scene.add(ranged);
    const bld = e === 0 ? A.hut(RED, 3) : e === 1 ? A.longhouse(RED) : e === 2 ? A.timberHouse(RED, 2, '#b8954f') : e === 3 ? A.roundTower(RED, 4, 1) : e === 4 ? A.windmill(RED) : e === 5 ? A.factory(RED) : A.concreteBlock(RED, 3, 4, 3);
    bld.position.set(x, y, -6.5); bld.scale.multiplyScalar(e === 5 ? 0.6 : e === 4 ? 0.8 : 0.9); scene.add(bld);
    let front = e === 0 ? A.catapult(2) : e <= 3 ? A.cavalry({ color: RED, era: e, seed: e }) : e <= 5 ? A.cannon(e) : A.tank(RED);
    front.position.set(x + 0.2, y, 5.6); front.rotation.y = 0.45; front.scale.multiplyScalar(e === 6 ? 0.85 : 1); scene.add(front);
    ctx.labelPts.push(new THREE.Vector3(x, y, 9));
  }
  const clear = (x, z) => Math.abs(x) < 23 && z > -13;
  forest(scene, T.height, -34, -14, 9, 30, 42, 0.5, clear); forest(scene, T.height, 34, -14, 9, 30, 43, 0.5, clear); forest(scene, T.height, 0, -24, 26, 80, 44, 0.5, clear);
  scatter(scene, T.height, k => A.grassTuft(k), 200, [-40, -20, 40, 20], 45, (x, z) => Math.abs(z) < 8 && Math.abs(x) < 20);
  scatter(scene, T.height, k => A.flower(['#ffffff', '#ffd34d', '#e05a9a'][k % 3], k), 120, [-40, -20, 40, 20], 46, (x, z) => Math.abs(z) < 8 && Math.abs(x) < 20);
  camera.fov = 32; camera.updateProjectionMatrix();
  camera.position.set(0, 17, 40); camera.lookAt(0, 1.5, -1);
}

// ---------- Szene 5: Spielansicht mit Oberfläche ----------
export function sceneHud(ctx) {
  sceneMedieval(ctx);
  const { scene, camera } = ctx;
  lookRTS(camera, 0, 6, 44, 0.9, 0.62);
  // Auswahlringe + Lebensbalken bei blauer Reiterei
  for (const c of ctx.cav) {
    const ring = A.selectionRing(1.05, '#6dff8a'); ring.position.set(c.position.x, c.position.y + 0.08, c.position.z); scene.add(ring);
    const hb = A.healthBar(0.55 + Math.random() * 0.45, 1.4); hb.position.set(c.position.x, c.position.y + 3.4, c.position.z); hb.lookAt(camera.position); scene.add(hb);
  }
  lookRTS(camera, 0, 6, 44, 0.9, 0.62);
}

// ---------- Szene 6: Lebendige Siedlung am See (Antike) ----------
export function sceneVillage(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ size: 170, seg: 150, seed: 52, palette: 'lush', hills: 2.4, river: [[-80, -30], [-45, -12], [-30, 10], [-40, 40], [-80, 60]], flats: [[8, 0, 20, 0.9]] });
  scene.add(T.mesh); scene.add(makeWater(170));
  const H = T.height;
  const P = (o, x, z, r, s) => place(scene, H, o, x, z, r, s);
  const town = (x, z) => Math.hypot(x - 8, z) < 19;
  // Erdflächen & Wege um die Gebäude
  for (const [x, z, r] of [[8, 0, 9], [0, 8, 4], [18, -6, 4], [-4, -8, 4]]) P(A.dirtPatch(r), x, z).position.y += 0.06;
  P(A.longhouse(RED), 8, -1, 0.3, 1.8);
  P(A.campfire(), 8, 5);
  const r = A.rand(3);
  const houses = [[-2, -6], [2, -11], [10, -11], [17, -8], [20, -1], [19, 7], [13, 11], [4, 12], [-3, 7], [-5, 0], [24, 4], [-1, 15]];
  houses.forEach(([x, z], i) => P(i % 3 === 0 ? A.hut(RED, i) : A.timberHouse(RED, i, '#b8954f'), x, z, Math.atan2(8 - x, -z) + Math.PI, 0.95));
  // Palisade mit Toren
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * Math.PI * 2; if (k === 5 || k === 16) continue;
    const x = 8 + Math.cos(a) * 18, z = Math.sin(a) * 18;
    P(A.palisade(5.2), x, z, -a + Math.PI / 2);
  }
  P(A.roundTower(RED, 4, 0.9, '#8a6a44'), 8 + Math.cos(5 / 22 * 6.283) * 18, Math.sin(5 / 22 * 6.283) * 18);
  // Felder vor der Palisade
  for (let k = 0; k < 4; k++) P(A.field(5, 4, k, k % 2 === 0), 32 + (k % 2) * 6.5, -8 + Math.floor(k / 2) * 6, 0.1);
  // viele Arbeiter
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 14;
    P(A.soldier({ color: RED, era: 1, weapon: 'tool', seed: 500 + k, pose: r() < 0.4 ? 'walk' : 'attack', carry: r() < 0.3 ? ['wood', 'food', 'gold'][k % 3] : null }), 8 + Math.cos(a) * d, Math.sin(a) * d, r() * 6);
  }
  for (let k = 0; k < 8; k++) P(A.soldier({ color: RED, era: 1, weapon: 'tool', seed: 600 + k, pose: 'attack' }), 31 + (k % 4) * 3, -8 + Math.floor(k / 4) * 6, r() * 6);
  // Armee auf dem Exerzierplatz
  for (let k = 0; k < 24; k++) P(A.soldier({ color: RED, era: 2, weapon: k < 12 ? 'spear' : 'bow', seed: 700 + k, shield: k < 12 }), 26 + (k % 6) * 1.2, 14 + Math.floor(k / 6) * 1.3, -0.6);
  // Tiere
  for (let k = 0; k < 4; k++) P(A.mammoth(k), 44 + k * 4 + r() * 2, 22 + r() * 6, 2 + r());
  for (let k = 0; k < 7; k++) P(A.deer(k), -12 + r() * 8, 28 + r() * 6, r() * 6);
  for (let k = 0; k < 3; k++) P(A.soldier({ color: RED, era: 1, weapon: 'spear', seed: 800 + k, pose: 'attack' }), 40 + k * 1.5, 18 + k, 0.8);
  // Boote auf dem Fluss
  const boatAt = (b, x, z, ry) => { b.position.set(x, -0.3, z); b.rotation.y = ry; scene.add(b); };
  boatAt(A.boat(RED), -36, 0, 0.3); boatAt(A.boat(RED), -40, 18, -0.4); boatAt(A.boat(RED, 'war'), -33, 26, 0.2);
  P(A.timberHouse(RED, 40, '#b8954f'), -24, 4, Math.PI / 2, 0.9);
  // Gold, Stein, Beeren
  P(A.goldMine(11), 30, 30); P(A.stoneMine(12), -12, -24);
  for (let k = 0; k < 6; k++) P(A.berryBush(k + 40), -8 + (k % 3) * 1.5, -30 + Math.floor(k / 3) * 1.5);
  // dichte, bunte Natur
  forest(scene, H, 38, -34, 16, 160, 61, 0.35, town);
  forest(scene, H, -20, -44, 18, 160, 62, 0.5, town);
  forest(scene, H, 60, 0, 14, 110, 63, 0.4, town);
  forest(scene, H, 10, 46, 16, 120, 64, 0.5, town);
  scatter(scene, H, k => A.treeLeaf(900 + k, 1, true), 70, [-60, -60, 80, 60], 65, town);
  scatter(scene, H, k => A.bush(k, k % 3 === 0), 260, [-60, -60, 80, 60], 66, town);
  scatter(scene, H, k => A.grassTuft(k), 500, [-60, -60, 80, 60], 67, town);
  scatter(scene, H, k => A.flower(['#ffffff', '#ffd34d', '#e05a9a', '#a07ae0'][k % 4], k), 300, [-60, -60, 80, 60], 68, town);
  scatter(scene, H, k => A.rock(k + 950, 0.4 + (k % 4) * 0.3), 60, [-60, -60, 80, 60], 69, town);
  camera.fov = 40; camera.updateProjectionMatrix();
  camera.position.set(-6, 30, 48); camera.lookAt(14, 0, -2);
}

// ---------- Szene 7: Belagerung einer asiatischen Stadt ----------
export function sceneSiege(ctx) {
  const { scene, camera } = ctx;
  const T = makeTerrain({ size: 170, seg: 150, seed: 77, palette: 'lush', hills: 2.0, flats: [[0, -16, 26, 0.9], [0, 16, 22, 0.9]] });
  scene.add(T.mesh); scene.add(makeWater(170, -1.2));
  const H = T.height;
  const P = (o, x, z, r, s) => place(scene, H, o, x, z, r, s);
  const city = (x, z) => z < -2 && Math.abs(x) < 30 || (z > 2 && z < 30 && Math.abs(x) < 26);
  // Grüne (asiatische) Stadt hinter großer Mauer
  for (let x = -28; x <= 28; x += 8) if (Math.abs(x) > 3) P(A.bigWall(8.2), x, -2);
  P(A.gatehouse(GREEN), 0, -2);
  for (const x of [-24, -12, 12, 24]) P(A.roundTower(GREEN, 5.5, 1.2), x + (x > 0 ? 4 : -4), -2);
  P(A.pagoda(GREEN, 4), 0, -18);
  const r = A.rand(9);
  for (let k = 0; k < 22; k++) { const x = -26 + (k % 11) * 5 + r() * 1.5, z = -9 - Math.floor(k / 11) * 6 - r() * 2; if (Math.abs(x) < 5 && z < -12) continue; P(A.asianHouse(GREEN, k), x, z, r() * 0.3); }
  P(A.pagoda(GREEN, 2), -18, -24); P(A.pagoda(GREEN, 2), 20, -26);
  for (let k = 0; k < 8; k++) P(A.soldier({ color: GREEN, era: 3, weapon: 'bow', seed: 1000 + k, pose: 'aim' }), -22 + k * 6 + (k > 3 ? 2 : -2), -2.2, 0).position.y += 3.4;
  // Ausfall: Kriegselefanten + Speerträger vor dem Tor
  for (let k = 0; k < 4; k++) P(A.warElephant(GREEN, k), -6 + k * 4, 4, 0.1 * (k - 1.5));
  for (let k = 0; k < 20; k++) P(A.soldier({ color: GREEN, era: 3, weapon: 'spear', seed: 1100 + k, shield: true, pose: 'attack' }), -8 + (k % 10) * 1.6, 7 + Math.floor(k / 10) * 1.2, 0);
  // Roter Angriff: große Armee
  for (let k = 0; k < 60; k++) P(A.soldier({ color: RED, era: 3, weapon: k % 3 === 0 ? 'pike' : 'sword', seed: 1200 + k, shield: k % 3 !== 0, pose: k % 2 ? 'attack' : 'walk' }), -14 + (k % 15) * 1.9 + r() * 0.5, 10.5 + Math.floor(k / 15) * 1.4 + r() * 0.4, Math.PI);
  for (let k = 0; k < 24; k++) P(A.soldier({ color: RED, era: 3, weapon: 'bow', seed: 1300 + k, pose: 'aim' }), -16 + (k % 12) * 2.8, 19 + Math.floor(k / 12) * 1.4, Math.PI);
  for (let k = 0; k < 14; k++) P(A.cavalry({ color: RED, era: 3, seed: k }), 18 + (k % 4) * 2.2 + r(), 8 + Math.floor(k / 4) * 2.6, Math.PI - 0.5);
  for (const [x, z] of [[-10, 26], [0, 27], [10, 26]]) P(A.catapult(3), x, z, Math.PI);
  // Kampfspuren
  for (let k = 0; k < 30; k++) { const a = A.arrow(); a.position.set(-20 + r() * 40, 4 + r() * 5, 2 + r() * 14); a.rotation.set(-0.3 + (k % 2) * 0.6, k % 2 ? 0 : Math.PI, 0); scene.add(a); }
  P(A.flame(1.2), -10, -10); P(A.smoke(9, 21, true), -9.6, -9.4); P(A.flame(0.9), 14, -14); P(A.smoke(8, 22, true), 14.4, -13.4);
  P(A.explosion(0.7), 6, -2.5); P(A.crater(1.2), -4, 14);
  const b = A.rock(80, 0.8, '#8a857c'); b.position.set(3, 11, 8); scene.add(b);
  forest(scene, H, -48, 10, 16, 140, 71, 0.5, city); forest(scene, H, 48, 14, 16, 140, 72, 0.4, city);
  forest(scene, H, 0, -48, 24, 160, 73, 0.6, city);
  scatter(scene, H, k => A.treeLeaf(950 + k, 1, true), 60, [-70, -60, 70, 60], 74, city);
  scatter(scene, H, k => A.bush(k + 30, k % 3 === 0), 200, [-70, -60, 70, 60], 75, city);
  scatter(scene, H, k => A.grassTuft(k), 400, [-70, -60, 70, 60], 76, city);
  camera.fov = 40; camera.updateProjectionMatrix();
  camera.position.set(22, 30, 46); camera.lookAt(0, 0, 2);
}

export const SCENES = {
  village: { fn: sceneVillage, opts: { sky: ['#8cc6ee', '#f3e2c2'], fog: [70, 170], sun: [-40, 50, 20] } },
  siege: { fn: sceneSiege, opts: { sky: ['#9cc4e0', '#f0d6b0'], fog: [70, 170], sun: [-35, 45, 30], sunColor: '#ffe6c0' } },
  stone: { fn: sceneStone, opts: {} },
  medieval: { fn: sceneMedieval, opts: { sun: [-30, 55, 30], sky: ['#8cc6ee', '#f3dcb8'] } },
  modern: { fn: sceneModern, opts: { sky: ['#9aa8b5', '#d9c7a8'], sunColor: '#ffe2b8', sunI: 2.4, sun: [35, 45, -20], hemi: 0.8 } },
  eras: { fn: sceneEras, opts: { sky: ['#bfe1f7', '#fbeedd'], fog: [70, 160], sun: [20, 40, 30] } },
  hud: { fn: sceneHud, opts: { sun: [-30, 55, 30], sky: ['#8cc6ee', '#f3dcb8'] } },
};
