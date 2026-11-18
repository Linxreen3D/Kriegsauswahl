// 3D-Renderer für das Spiel (Three.js): Gelände aus der Serverkarte, instanzierte Einheiten/Gebäude/Bäume,
// Nebel des Krieges im Shader, Effekte, Minimap. Schnittstelle kompatibel zum früheren 2D-Renderer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as W from './3d/world.js';
import * as Md from './3d/models.js';
import * as U from './3d/units.js';
import { fabricMat, surcoatMat } from './3d/humans.js';
import { eraBuilding } from './3d/eras.js';
import { nationBuilding } from './3d/nations.js';
import { rng } from './3d/textures.js';
import { BUILDINGS, WONDER_ERA } from '/shared/rules.js';

export const S = 2; // Meter pro Kachel
const QUALITY = (() => { try { return localStorage.getItem('fl_quality') || 'high'; } catch { return 'high'; } })();
const Q = { low: { ao: false, shadow: 1024, dpr: 1, grass: 0 }, medium: { ao: false, shadow: 2048, dpr: 1.25, grass: 0.6 }, high: { ao: true, shadow: 2048, dpr: 1.5, grass: 1 } }[QUALITY] || { ao: true, shadow: 2048, dpr: 1.5, grass: 1 };

// ---------- Nebel des Krieges für alle Materialien ----------
const FOW = { tex: { value: null }, size: { value: new THREE.Vector2(1, 1) } };
function fowify(mat) {
  if (!mat || mat.userData.fow || !(mat.isMeshStandardMaterial || mat.isMeshBasicMaterial)) return;
  mat.userData.fow = true;
  const prev = mat.onBeforeCompile;
  const prevKey = prev ? prev.toString() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.fowTex = FOW.tex; sh.uniforms.fowSize = FOW.size;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFowWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 fw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nfw = instanceMatrix * fw;\n#endif\nvFowWP = (modelMatrix * fw).xz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D fowTex; uniform vec2 fowSize; varying vec2 vFowWP;')
      .replace('#include <fog_fragment>', `{ float fv = texture2D(fowTex, vFowWP / fowSize).r;
        float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
        gl_FragColor.rgb = mix(vec3(lum) * 0.35, gl_FragColor.rgb, smoothstep(0.35, 0.95, fv)) * mix(0.1, 1.0, smoothstep(0.0, 0.5, fv)); }
        #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => 'fow|' + prevKey;
  mat.needsUpdate = true;
}
function fowifyTree(o) { o.traverse(m => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(fowify); }); }

// ---------- Zusammenfassen von Modellen zu wenigen Teilen (pro Material) ----------
function mergeModel(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map(), sprites = [], lights = [];
  group.traverse(o => {
    if (o.isSprite) { sprites.push(o); return; }
    if (o.isLight) { lights.push(o); return; }
    if (!o.isMesh || o.isInstancedMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const parts = [];
  for (const [mat, list] of byMat) parts.push({ geo: mergeGeometries(list), mat });
  // Instanzierte Kindobjekte (z. B. Feldpflanzen) als einzelne Teile übernehmen
  group.traverse(o => {
    if (!o.isInstancedMesh) return;
    const list = [];
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); const g = o.geometry.clone(); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m4)); list.push(g.index ? g.toNonIndexed() : g); }
    if (list.length) parts.push({ geo: mergeGeometries(list), mat: o.material });
  });
  const box = new THREE.Box3().setFromObject(group);
  return { parts, box };
}

// ---------- Pools für instanziertes Zeichnen ----------
class Pool {
  constructor(scene, geo, mat, { shadow = true, color = false } = {}) {
    this.scene = scene; this.geo = geo; this.mat = mat; this.shadow = shadow; this.useColor = color;
    this.cap = 0; this.n = 0; this.mesh = null;
    this.grow(16);
  }
  grow(cap) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
    this.cap = cap;
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.useColor) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    m.frustumCulled = false; m.castShadow = this.shadow; m.receiveShadow = true; m.count = 0;
    this.mesh = m; this.scene.add(m);
  }
  push(m4, color) {
    if (this.n >= this.cap) { const old = this.mesh; this.grow(this.cap * 2); for (let i = 0; i < this.n; i++) { this.mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(i * 16, i * 16 + 16), i * 16); if (this.useColor) this.mesh.instanceColor.array.set(old.instanceColor.array.subarray(i * 3, i * 3 + 3), i * 3); } }
    this.mesh.setMatrixAt(this.n, m4);
    if (this.useColor && color) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  begin() { this.n = 0; }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.useColor && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.visible = this.n > 0; }
}

// ---------- Einheiten-Daten (vorberechnet) ----------
const TEAM_MK = new Set(['teamcloth', 'civtunic', 'surcoat', 'stripes', 'shield3', 'shieldO', 'shieldR:chevron', 'shieldR:stripes']);
const TINT_MK = new Set(['skin', 'hair', 'horsecoat']);
const SKINS = ['#e3b08e', '#cf9a74', '#a8714c', '#7a4e32', '#edc4a2'].map(c => new THREE.Color(c));
const HAIRS = ['#2a1d14', '#4a3018', '#6a4a24', '#151210', '#8a6a3a'].map(c => new THREE.Color(c));
const COATS = ['#5a3a24', '#3a2618', '#7a5536', '#d6cfc4', '#2a201a', '#8a6a48'].map(c => new THREE.Color(c));
function figureMaterial(mk, team) {
  const cached = U.std;
  switch (mk) {
    case 'skin': return cached('fig-skin', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62 }));
    case 'hair': return cached('fig-hair', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
    case 'horsecoat': return cached('fig-coat', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }));
    case 'trousers': return fabricMat('#3e342c');
    case 'boots': return U.mat('#2a1d14', 0.7);
    case 'gauntlet': case 'darkplate': return U.darkPlate();
    case 'leather': return U.mat('#4a2e1a', 0.65);
    case 'fur': return fabricMat('#6a4a2e', 'fur');
    case 'teamcloth': return fabricMat(team);
    case 'civtunic': return fabricMat(team, 'civ');
    case 'bronze': return U.mat('#b5884a', 0.3, 0.9);
    case 'mail': return U.chainmail();
    case 'surcoat': return surcoatMat(team, U.emblemFor(team));
    case 'plate': return U.mat('#aeb3ba', 0.28, 0.92);
    case 'quilt': return fabricMat('#cbb994', 'quilt', 24);
    case 'stripes': return fabricMat(team, 'str', 10);
    case 'white': return fabricMat('#ece8de');
    case 'olive': return fabricMat('#566040');
    case 'webbing': return U.mat('#3e3a2a', 0.8);
    case 'shako': return U.mat('#15151c', 0.5);
    case 'mane': return U.mat('#1e140c', 0.9);
    case 'hoof': return U.mat('#1a120c', 0.6);
    case 'saddle': return U.mat('#3a2414', 0.6);
    case 'chanfron': return U.mat('#aeb3ba', 0.28, 0.92);
    case 'steel': return U.steel();
    case 'wood': return U.wood();
    case 'gold': return U.gold();
    case 'darkleather': return U.darkLeather();
    case 'shield3': case 'shieldO': return U.heraldry(team, U.emblemFor(team));
    case 'shieldR:chevron': return U.heraldry(team, 'chevron');
    case 'shieldR:stripes': return U.heraldry(team, 'stripes');
    default: {
      if (mk.startsWith('c:')) { const [, hex, r, m] = mk.split(':'); return U.mat(hex, +r, +m); }
      return U.mat('#888888', 0.8);
    }
  }
}
export async function loadFigures(base = 'assets/figures') {
  const [json, bin] = await Promise.all([fetch(base + '.json').then(r => r.json()), fetch(base + '.bin').then(r => r.arrayBuffer())]);
  const out = {};
  for (const [key, layers] of Object.entries(json.variants)) {
    out[key] = layers.map(l => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, l.P, l.n * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, l.N, l.n * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, l.T, l.n * 2), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin, l.I, l.i), 1));
      g.computeBoundingSphere();
      return { mk: l.mk, geo: g };
    });
  }
  return out;
}

// ---------- Renderer ----------
export { mergeModel };
export class Renderer3D {
  constructor(canvas, overlay) {
    this.canvas = canvas; this.overlay = overlay; this.octx = overlay.getContext('2d');
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    W.loadTextures(); Md.initMaterials();
    this.world = W.createWorld(canvas, { w: this.vw, h: this.vh, ao: Q.ao, shadowSize: Q.shadow, preserve: false, fogNear: 160, fogFar: 520 });
    this.scene = this.world.scene; this.camera = this.world.camera;
    this.cam = { x: 0, y: 0, z: 1 };
    this.projectiles = []; this.effects = []; this.attach = new Map();
    this.resize();
  }
  async init() { this.figs = await loadFigures(); }

  // ---------- Kamera ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    const { renderer, composer, camera, ao, bloom } = this.world;
    renderer.setPixelRatio(dpr);
    renderer.setSize(this.vw, this.vh, false);
    composer.setPixelRatio(dpr); composer.setSize(this.vw, this.vh);
    if (ao) ao.setSize(this.vw * dpr, this.vh * dpr);
    camera.aspect = this.vw / this.vh; camera.updateProjectionMatrix();
    this.overlay.width = Math.round(this.vw * dpr); this.overlay.height = Math.round(this.vh * dpr); this.odpr = dpr;
  }
  dist() { return 78 / this.cam.z; }
  clampCam() {
    const c = this.cam;
    c.z = Math.max(0.35, Math.min(2.6, c.z));
    if (!this.G) return;
    c.x = Math.max(4, Math.min(this.G.W - 4, c.x)); c.y = Math.max(4, Math.min(this.G.H + 6, c.y));
  }
  applyCam() {
    const c = this.cam, d = this.dist(), pitch = THREE.MathUtils.degToRad(54);
    const tx = c.x * S, tz = c.y * S, ty = this.T ? this.T.height(tx, tz) : 0;
    this.camera.position.set(tx, ty + Math.sin(pitch) * d, tz + Math.cos(pitch) * d);
    this.camera.lookAt(tx, ty, tz);
    this.camera.updateMatrixWorld();
    // Schatten folgen der Kamera
    const sun = this.world.sun, ext = Math.min(140, d * 1.1);
    sun.target.position.set(tx, ty, tz - d * 0.15); sun.position.copy(sun.target.position).add(this.world.sunDir.clone().multiplyScalar(200));
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
  }
  pxPerTile() {
    this.applyCam();
    const a = this.toScreen(this.cam.x, this.cam.y), b = this.toScreen(this.cam.x + 1, this.cam.y);
    return Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  zoomAt(sx, sy, f) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z *= f; this.clampCam(); this.applyCam();
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny; this.clampCam();
  }
  toWorld(sx, sy) {
    this.applyCam();
    const ndc = new THREE.Vector2(sx / this.vw * 2 - 1, -(sy / this.vh) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    let h = this.T ? this.T.height(this.cam.x * S, this.cam.y * S) : 0, p = new THREE.Vector3();
    for (let k = 0; k < 4; k++) {
      const t = (h - ray.ray.origin.y) / ray.ray.direction.y;
      p.copy(ray.ray.direction).multiplyScalar(t).add(ray.ray.origin);
      if (!this.T) break;
      h = this.T.height(p.x, p.z);
    }
    return [p.x / S, p.z / S];
  }
  toScreen(wx, wy, up = 0) {
    const v = new THREE.Vector3(wx * S, (this.T ? this.T.height(wx * S, wy * S) : 0) + up, wy * S).project(this.camera);
    return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh, v.z];
  }
  // Einheit unter dem Mauszeiger (am Körper, nicht am Boden)
  pickUnit(sx, sy) {
    let best = null, bd = 1e9;
    for (const e of this.G.ents.values()) {
      if (e.def.kind !== 'u') continue;
      const h = e.def.cls === 'cav' ? 2.6 : e.def.cls === 'sie' ? 2.2 : 1.9;
      const a = this.toScreen(e.rx, e.ry), b = this.toScreen(e.rx, e.ry, h);
      if (a[2] > 1) continue;
      const w = Math.max(8, Math.abs(a[1] - b[1]) * 0.35);
      if (sx < Math.min(a[0], b[0]) - w || sx > Math.max(a[0], b[0]) + w || sy < b[1] - 4 || sy > a[1] + 4) continue;
      const d = Math.abs(sx - a[0]) + Math.abs(sy - (a[1] + b[1]) / 2) * 0.3;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- Karte aufbauen ----------
  setMap(G) {
    this.G = G;
    const scene = this.scene;
    // alte Kartenobjekte entfernen
    if (this.mapRoot) { scene.remove(this.mapRoot); }
    this.mapRoot = new THREE.Group(); scene.add(this.mapRoot);
    const { W: MW, H: MH, terrain } = G;
    const nz = W.noise2(G.W * 31 + G.H);
    // Höhen je Kachel
    const base = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = terrain[y * MW + x], n = nz(x * 0.15, y * 0.15, 3);
      base[y * MW + x] = t === 3 ? -2.2 : t === 4 ? 2.6 + n * 3.2 : t === 2 ? 0.35 : 0.85 + (n - 0.5) * 0.9;
    }
    const at = (x, y) => base[Math.min(MH - 1, Math.max(0, y)) * MW + Math.min(MW - 1, Math.max(0, x))];
    const VW = MW + 1, VH = MH + 1, vh = new Float32Array(VW * VH);
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) vh[y * VW + x] = (at(x - 1, y - 1) + at(x, y - 1) + at(x - 1, y) + at(x, y)) / 4;
    const height = (X, Z) => {
      const fx = Math.min(MW - 0.001, Math.max(0, X / S)), fz = Math.min(MH - 0.001, Math.max(0, Z / S));
      const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
      const a = vh[iz * VW + ix], b = vh[iz * VW + ix + 1], c = vh[(iz + 1) * VW + ix], d = vh[(iz + 1) * VW + ix + 1];
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    };
    this.T = { height, nz: (x, y, o) => nz(x, y, o) };
    // Gelände-Mesh
    const geo = new THREE.PlaneGeometry(MW * S, MH * S, MW, MH);
    geo.rotateX(-Math.PI / 2); geo.translate(MW * S / 2, 0, MH * S / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, vh[i]);
    geo.computeVertexNormals();
    const splat = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const vx = i % VW, vy = Math.floor(i / VW);
      let g = 0, d = 0, r = 0, s = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const tx = Math.min(MW - 1, Math.max(0, vx + dx)), ty = Math.min(MH - 1, Math.max(0, vy + dy)), t = terrain[ty * MW + tx];
        if (t === 0) g++; else if (t === 1) { g += 0.75; d += 0.25; } else if (t === 4) r++; else s++;
      }
      d += Math.max(0, (nz(vx * 0.08 + 70, vy * 0.08, 3) - 0.66) * 3);
      const tot = g + d + r + s; splat.set([g / tot, d / tot, r / tot, s / tot], i * 4);
    }
    geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
    const tmat = W.terrainMaterial(); fowify(tmat);
    const tm = new THREE.Mesh(geo, tmat); tm.receiveShadow = true; this.mapRoot.add(tm);
    // Wasser (günstig: kein Spiegel-Rendering)
    const wTex = W.TEX.water; wTex.repeat.set(MW / 6, MH / 6);
    const wmat = new THREE.MeshStandardMaterial({ color: '#1f5568', roughness: 0.06, metalness: 0.2, normalMap: wTex, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.86 });
    fowify(wmat); this.waterMat = wmat;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(MW * S + 400, MH * S + 400), wmat);
    water.rotation.x = -Math.PI / 2; water.position.set(MW * S / 2, -0.55, MH * S / 2); water.receiveShadow = true;
    this.mapRoot.add(water);
    // Nebel-Textur
    this.fogData = new Uint8Array(MW * MH * 4);
    this.fogTex = new THREE.DataTexture(this.fogData, MW, MH, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter; this.fogTex.minFilter = THREE.LinearFilter; this.fogTex.needsUpdate = true;
    FOW.tex.value = this.fogTex; FOW.size.value.set(MW * S, MH * S);
    // Gras
    if (Q.grass > 0) {
      const tileAt = (X, Z) => terrain[Math.min(MH - 1, Math.floor(Z / S)) * MW + Math.min(MW - 1, Math.floor(X / S))];
      const grass = W.plantGrass(this.mapRoot, this.T, Math.round(Math.min(70000, MW * MH * 2.2) * Q.grass), [0, 0, MW * S, MH * S], (X, Z) => tileAt(X, Z) !== 0 || G.resAt[Math.floor(Z / S) * MW + Math.floor(X / S)], 5);
      fowify(grass.material);
    }
    this.buildResources();
    // Minimap-Grundbild
    const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
    const mg = mc.getContext('2d'), img = mg.createImageData(MW, MH);
    const TC = [[86, 128, 52], [128, 104, 64], [210, 192, 136], [40, 92, 120], [118, 112, 104]];
    for (let i = 0; i < MW * MH; i++) { const c = TC[terrain[i]], j = (Math.random() - 0.5) * 10; img.data.set([c[0] + j, c[1] + j, c[2] + j, 255], i * 4); }
    mg.putImageData(img, 0, 0); this.miniBase = mc;
    this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = MW; this.fogCanvas.height = MH;
    this.unitPools = new Map(); this.bldPools = new Map(); this.bldModels = new Map();
    for (const [, a] of this.attach) this.scene.remove(a); this.attach.clear();
    this.ringPool = null;
    fowifyTree(this.mapRoot);
  }

  buildResources() {
    const G = this.G, R = rng(G.W * 7 + 3);
    if (!this.treeKinds) { this.treeKinds = W.makeTreeKinds(); for (const k of this.treeKinds) { fowify(k.trunkMat); fowify(k.leafMat); if (k.autumnMat) fowify(k.autumnMat); } }
    const kinds = this.treeKinds;
    const trees = [...G.res.values()].filter(r => r.kind === 'tree');
    const byKind = kinds.map(() => []);
    for (const t of trees) { const h = ((t.x * 73856093) ^ (t.y * 19349663)) >>> 0; const conifer = (h % 100) < 40; t.tk = conifer ? 3 + (h % 2) : h % 3; t.autumn = !conifer && (h % 13) === 0; byKind[t.tk].push(t); }
    this.treeRefs = new Map();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    byKind.forEach((list, ki) => {
      if (!list.length) return;
      const K = kinds[ki];
      const trunk = new THREE.InstancedMesh(K.trunk, K.trunkMat, list.length);
      const leaves = new THREE.InstancedMesh(K.leaves, K.leafMat, list.length);
      const autumn = K.autumnMat ? new THREE.InstancedMesh(K.leaves, K.autumnMat, list.length) : null;
      let ai = 0, li = 0;
      list.forEach((t, i) => {
        const X = (t.x + 0.5 + (R() - 0.5) * 0.5) * S, Z = (t.y + 0.5 + (R() - 0.5) * 0.5) * S, s = 0.75 + R() * 0.45;
        q.setFromAxisAngle(up, R() * 6.28);
        m4.compose(new THREE.Vector3(X, this.T.height(X, Z) - 0.15, Z), q, new THREE.Vector3(s, s * (0.9 + R() * 0.2), s));
        trunk.setMatrixAt(i, m4);
        if (t.autumn && autumn) { autumn.setMatrixAt(ai, m4); this.treeRefs.set(t.id, [[trunk, i], [autumn, ai++]]); }
        else { leaves.setMatrixAt(li, m4); c.setHSL(0.13 + R() * 0.05, 0.28, 0.42 + R() * 0.12); leaves.setColorAt(li, c.multiplyScalar(2.1)); this.treeRefs.set(t.id, [[trunk, i], [leaves, li++]]); }
      });
      leaves.count = li; if (autumn) autumn.count = ai;
      for (const m of [trunk, leaves, autumn]) if (m) { m.castShadow = true; m.receiveShadow = true; this.mapRoot.add(m); }
    });
    // Minen & Beeren
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const gp = rockGeo.attributes.position; for (let i = 0; i < gp.count; i++) { const s2 = 0.8 + Math.sin(gp.getX(i) * 5 + gp.getZ(i) * 3) * 0.15; gp.setXYZ(i, gp.getX(i) * s2, gp.getY(i) * s2 * 0.75, gp.getZ(i) * s2); }
    rockGeo.computeVertexNormals();
    const mines = [...G.res.values()].filter(r => r.kind === 'gold' || r.kind === 'stone');
    const rockMat = new THREE.MeshStandardMaterial({ map: W.TEX.rock.map, normalMap: W.TEX.rock.normalMap, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: W.TEX.rock.map, normalMap: W.TEX.rock.normalMap, color: '#d8d4cc', roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c341', roughness: 0.25, metalness: 0.95, emissive: '#3a2600', emissiveIntensity: 0.3 });
    const nugGeo = new THREE.OctahedronGeometry(0.28, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, mines.length * 6), whites = new THREE.InstancedMesh(rockGeo, stoneMat, mines.length * 6), nugs = new THREE.InstancedMesh(nugGeo, goldMat, mines.length * 14);
    let ri = 0, wi = 0, ni = 0;
    this.mineRefs = new Map();
    for (const r of mines) {
      const cx = (r.x + 1) * S, cz = (r.y + 1) * S, refs = [];
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * 6.28 + R(), d = k === 0 ? 0 : 1.2 + R() * 0.6, X = cx + Math.cos(a) * d, Z = cz + Math.sin(a) * d, s = (k === 0 ? 1.3 : 0.6 + R() * 0.5);
        q.setFromEuler(new THREE.Euler(R(), R() * 6, R())); m4.compose(new THREE.Vector3(X, this.T.height(X, Z) + s * 0.2, Z), q, new THREE.Vector3(s, s, s));
        if (r.kind === 'stone') { whites.setMatrixAt(wi, m4); refs.push([whites, wi++]); } else { rocks.setMatrixAt(ri, m4); refs.push([rocks, ri++]); }
      }
      if (r.kind === 'gold') for (let k = 0; k < 14; k++) {
        const a = R() * 6.28, d = R() * 1.8, X = cx + Math.cos(a) * d, Z = cz + Math.sin(a) * d;
        q.setFromEuler(new THREE.Euler(R(), R() * 6, R())); m4.compose(new THREE.Vector3(X, this.T.height(X, Z) + 0.4 + R() * 0.6, Z), q, new THREE.Vector3(1, 1.5, 1));
        nugs.setMatrixAt(ni, m4); refs.push([nugs, ni++]);
      }
      this.mineRefs.set(r.id, refs);
    }
    rocks.count = ri; whites.count = wi; nugs.count = ni;
    const berries = [...G.res.values()].filter(r => r.kind === 'berry');
    const bushGeo = new THREE.IcosahedronGeometry(0.75, 1); const bp = bushGeo.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) * 0.7);
    bushGeo.computeVertexNormals();
    const bushMat = new THREE.MeshStandardMaterial({ map: W.TEX.leafGreen, color: '#7ab04a', roughness: 0.85 });
    const berryMat = new THREE.MeshStandardMaterial({ color: '#d8243c', roughness: 0.35 });
    const bush = new THREE.InstancedMesh(bushGeo, bushMat, berries.length), bb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 4), berryMat, berries.length * 12);
    let bi = 0;
    berries.forEach((r, i) => {
      const X = (r.x + 0.5) * S, Z = (r.y + 0.5) * S, h = this.T.height(X, Z), refs = [];
      m4.compose(new THREE.Vector3(X, h + 0.4, Z), q.identity(), new THREE.Vector3(1, 1, 1)); bush.setMatrixAt(i, m4); refs.push([bush, i]);
      for (let k = 0; k < 12; k++) { const a = R() * 6.28, e = R() * 1.2; m4.makeTranslation(X + Math.cos(a) * 0.65 * Math.cos(e - 0.5), h + 0.45 + Math.sin(e) * 0.4, Z + Math.sin(a) * 0.65 * Math.cos(e - 0.5)); bb.setMatrixAt(bi, m4); refs.push([bb, bi++]); }
      this.mineRefs.set(r.id, refs);
    });
    bb.count = bi;
    for (const m of [rocks, whites, nugs, bush, bb]) { m.castShadow = true; m.receiveShadow = true; this.mapRoot.add(m); }
  }
  // Rohstoff abgebaut -> Instanzen ausblenden
  invalidateTile(tx, ty) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const [id, refs] of [...(this.treeRefs || []), ...(this.mineRefs || [])]) {
      if (this.G.res.has(id)) continue;
      for (const [m, i] of refs) { m.setMatrixAt(i, zero); m.instanceMatrix.needsUpdate = true; }
      this.treeRefs.delete(id); this.mineRefs.delete(id);
    }
  }

  updateFog() {
    const G = this.G, d = this.fogData, N = G.W * G.H;
    for (let i = 0; i < N; i++) d[i * 4] = G.vis[i] ? 255 : G.explored[i] ? 120 : 0;
    this.fogTex.needsUpdate = true;
    const fg = this.fogCanvas.getContext('2d'), img = fg.createImageData(G.W, G.H);
    for (let i = 0; i < N; i++) img.data[i * 4 + 3] = G.vis[i] ? 0 : G.explored[i] ? 110 : 235;
    fg.putImageData(img, 0, 0);
  }

  // ---------- Einheiten ----------
  unitPool(variant, li, layer, team) {
    const tk = TEAM_MK.has(layer.mk) ? team : '';
    const key = variant + '|' + li + '|' + tk;
    let p = this.unitPools.get(key);
    if (!p) { const mat = figureMaterial(layer.mk, team); fowify(mat); p = new Pool(this.scene, layer.geo, mat, { color: TINT_MK.has(layer.mk) }); this.unitPools.set(key, p); }
    return p;
  }
  drawFigure(variant, m4, team, id) {
    const layers = this.figs[variant];
    if (!layers) return;
    const skin = SKINS[id % SKINS.length], hair = HAIRS[(id * 3) % HAIRS.length], coat = COATS[id % COATS.length];
    layers.forEach((l, i) => this.unitPool(variant, i, l, team).push(m4, l.mk === 'skin' ? skin : l.mk === 'hair' ? hair : l.mk === 'horsecoat' ? coat : null));
  }
  poseOf(e, now) {
    const line = e.def.line, st = e.state, ph = now / 1000 + e.id * 0.37;
    const walkF = ['walk', 'idle', 'walk2', 'idle'][Math.floor(ph * 5.5) % 4];
    if (st === 1 || st === 5) return walkF;
    if (line === 'rng') return st === 2 ? 'aim' : 'idle';
    if (st === 2 || st === 3 || st === 4) return Math.floor(ph * 2.6) % 2 ? 'attack' : 'idle';
    return 'idle';
  }
  // ---------- Gebäude-Modelle ----------
  buildingModel(type, era, color, nation) {
    era = modelEra(era);
    // Nationaler Stil gilt ab dem Frühen Mittelalter (für Mittelalter und Industrialisierung je ein Modell)
    const nk = nation && era >= 3 ? nation + (era >= 7 ? 'W' : era >= 5 ? 'I' : 'M') : '';
    const key = type + '|' + era + '|' + color + '|' + nk;
    let mdl = this.bldModels.get(key);
    if (mdl) return mdl;
    const sz = BUILDINGS[type].size * S;
    const g = type === 'mine' || type === 'quarry' ? producerModel(type, era) : (nk && nationBuilding(type, era, color, nation)) || eraBuilding(type, era, color);
    const mm = mergeModel(g);
    const size = mm.box.getSize(new THREE.Vector3());
    const fit = type === 'wall' ? (sz * 1.0) / Math.max(size.x, size.z) : (sz * 0.96 * (era === 7 ? 1.55 : 1)) / Math.max(size.x, size.z);
    const ctr = mm.box.getCenter(new THREE.Vector3());
    const tf = new THREE.Matrix4().makeScale(fit, fit, fit).multiply(new THREE.Matrix4().makeTranslation(-ctr.x, -mm.box.min.y, -ctr.z));
    for (const p of mm.parts) { p.geo.applyMatrix4(tf); fowify(p.mat); }
    if (!Number.isFinite(fit) || mm.parts.some(p => !Number.isFinite(p.geo.attributes.position.array[0]))) console.warn('Modell ungültig:', key, fit);
    mdl = { parts: mm.parts, h: size.y * fit, key };
    this.bldModels.set(key, mdl);
    return mdl;
  }
  bldPool(mdl, i) {
    const key = mdl.key + '|' + i;
    let p = this.bldPools.get(key);
    if (!p) { p = new Pool(this.scene, mdl.parts[i].geo, mdl.parts[i].mat); this.bldPools.set(key, p); }
    return p;
  }

  // ---------- Einzelobjekte (Belagerung, Panzer, Brände) ----------
  attachment(key, make) { let a = this.attach.get(key); if (!a) { a = make(); a.userData.key = key; fowifyTree(a); this.scene.add(a); this.attach.set(key, a); } a.userData.seen = this.frameNo; return a; }
  siegeModel(e, color) {
    return this.attachment('sie' + e.id, () => {
      const era = e.def.era;
      let g;
      if (e.def.cls === 'cav') g = tank(color);
      else if (era <= 3) g = Md.trebuchet(color);
      else g = cannon(era, color);
      const box = new THREE.Box3().setFromObject(g), s = (e.def.cls === 'cav' ? 3.6 : 3.4) / Math.max(1e-3, Math.max(box.max.x - box.min.x, box.max.z - box.min.z));
      g.scale.setScalar(s);
      const o = new THREE.Group(); o.add(g); return o;
    });
  }
  fireOn(b, h) {
    return this.attachment('fire' + b.id, () => { const g = new THREE.Group(); g.add(Md.fire(1.4, b.id)); const sm = Md.smoke(1.2, b.id + 3, 9); sm.position.y = 1; g.add(sm); g.position.y = h * 0.7; return g; });
  }

  addShot(e, now) {
    const d = Math.hypot(e.tx - e.x, e.ty - e.y);
    this.projectiles.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, t0: now, dur: e.c === 2 ? 90 : Math.max(180, d * 70), arc: e.c === 2 ? 0 : d * 0.18 * S, c: e.c });
  }
  addEffect(kind, x, y, extra = {}) {
    const now = performance.now();
    const X = x * S, Z = y * S, H0 = this.T ? this.T.height(X, Z) : 0;
    let obj = null, dur = 900;
    if (kind === 'dust') { obj = Md.smoke(1.6 * (extra.s || 2) / 2, (x * 7 + y) | 0, 8); dur = 2500; }
    else if (kind === 'boom') { obj = new THREE.Group(); obj.add(Md.fire(3, 3)); obj.add(Md.smoke(2.5, 5, 10)); dur = 1800; }
    else if (kind === 'meteor') { dur = (extra.dur || 3000) + 300; obj = new THREE.Group(); const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: '#3a2a20', emissive: '#ff5a10', emissiveIntensity: 1.5 })); obj.add(rock); obj.add(Md.fire(2.2, 9)); obj.userData.meteor = { dur: extra.dur || 3000 }; }
    else if (kind === 'death') { dur = 600; }
    if (obj) { obj.position.set(X, H0, Z); this.world.fx.add(obj); }
    this.effects.push({ kind, X, Z, H0, t0: now, dur, obj });
  }

  // ---------- Frame ----------
  frame(now, ui) {
    const G = this.G; if (!G || !this.figs) return;
    this.frameNo = (this.frameNo || 0) + 1;
    this.applyCam();
    const t0 = performance.now();
    for (const p of this.unitPools.values()) p.begin();
    for (const p of this.bldPools.values()) p.begin();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    // Sichtbereich grob (Kacheln)
    const corners = [[0, 0], [this.vw, 0], [0, this.vh], [this.vw, this.vh]].map(([x, y]) => this.toWorld(x, y));
    const minX = Math.min(...corners.map(c => c[0])) - 4, maxX = Math.max(...corners.map(c => c[0])) + 4, minY = Math.min(...corners.map(c => c[1])) - 6, maxY = Math.max(...corners.map(c => c[1])) + 4;
    this.view = corners;
    const rider = new THREE.Matrix4().makeTranslation(0, 0.62, -0.1);
    const unitScale = 1.12;
    for (const e of G.ents.values()) {
      const p = G.players[e.owner], color = p ? p.color : '#888888';
      if (e.def.kind === 'u') {
        const k = Math.min(1, (now - e.t0) / 110);
        e.rx = e.px + (e.x - e.px) * k; e.ry = e.py + (e.y - e.py) * k;
        if (e.rx < minX || e.rx > maxX || e.ry < minY || e.ry > maxY) continue;
        const X = e.rx * S, Z = e.ry * S;
        const dir = e.dir ?? 0;
        q.setFromAxisAngle(up, Math.atan2(Math.cos(dir), Math.sin(dir)));
        const line = e.def.line, era = e.def.era;
        const moving = e.state === 1 || e.state === 5;
        const bob = moving ? Math.abs(Math.sin(now / 90 + e.id)) * 0.05 : 0;
        pos.set(X, this.T.height(X, Z) + bob, Z);
        if (line === 'sie' || (line === 'cav' && era >= 6)) {
          const o = this.siegeModel(e, color); o.position.copy(pos); o.quaternion.copy(q);
          if (e.state === 2 && line === 'sie') o.children[0].rotation.x = Math.sin(now / 120) * 0.02;
          continue;
        }
        m4.compose(pos, q, sc.setScalar(unitScale));
        if (line === 'cav') {
          this.drawFigure(era >= 2 ? 'horse_barded' : 'horse', m4, color, e.id);
          const rm = m4.clone().multiply(rider);
          this.drawFigure('rider' + Math.max(1, Math.min(5, era)), rm, color, e.id + 1);
        } else {
          const pose = this.poseOf(e, now);
          const v = line === 'worker' ? 'worker_' + pose : (line === 'rng' ? 'rng' : 'inf') + Math.min(6, era) + '_' + pose;
          this.drawFigure(v, m4, color, e.id);
        }
      } else {
        const sz = BUILDINGS[e.def.key].size;
        if (e.x + sz < minX || e.x > maxX || e.y + sz < minY || e.y > maxY) continue;
        const mdl = this.buildingModel(e.def.key, e.era || 0, color, p ? p.nation : null);
        const X = (e.x + sz / 2) * S, Z = (e.y + sz / 2) * S;
        let h = Infinity; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) h = Math.min(h, this.T.height(X + dx * sz * 0.4 * S, Z + dz * sz * 0.4 * S));
        const prog = (e.prog ?? 100) / 100;
        const sink = prog < 1 ? -(1 - prog) * mdl.h * 0.92 : 0;
        m4.compose(pos.set(X, h - 0.05 + sink, Z), q.identity(), one);
        mdl.parts.forEach((_, i) => this.bldPool(mdl, i).push(m4));
        if (prog >= 1 && e.hp < e.maxHp * 0.5 && !BUILDINGS[e.def.key].yields && e.def.key !== 'wall') { const f = this.fireOn(e, mdl.h); f.position.set(X, h + mdl.h * 0.6, Z); }
      }
    }
    for (const p of this.unitPools.values()) p.end();
    for (const p of this.bldPools.values()) p.end();
    // Einzelobjekte aufräumen
    for (const [k, a] of this.attach) if (a.userData.seen !== this.frameNo) { this.scene.remove(a); this.world.fx.remove(a); this.attach.delete(k); }
    for (const a of this.attach.values()) if (a.parent === this.scene) { const sprites = []; a.traverse(o => { if (o.isSprite) sprites.push(o); }); if (sprites.length) { this.scene.remove(a); this.world.fx.add(a); } }
    this.drawRings(G, ui, now);
    this.drawProjectiles(now);
    this.drawEffects(now);
    // Wasser bewegen
    if (this.waterMat) { this.waterMat.normalMap.offset.x = now * 0.00001; this.waterMat.normalMap.offset.y = now * 0.000013; }
    this.cpuMs = performance.now() - t0;
    this.world.composer.render();
    this.drawOverlay(G, ui, now);
  }

  drawRings(G, ui, now) {
    if (!this.ringPool) {
      const g = new THREE.RingGeometry(0.75, 0.95, 28); g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
      this.ringPool = new Pool(this.scene, g, m, { shadow: false, color: true });
      const gb = new THREE.BoxGeometry(1, 1, 1); gb.translate(0, 0.5, 0);
      this.ghostPool = new Pool(this.scene, gb, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), { shadow: false, color: true });
    }
    this.ringPool.begin(); this.ghostPool.begin();
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (const id of G.selected) {
      const e = G.ents.get(id); if (!e) continue;
      const own = e.owner === G.you;
      c.set(own ? '#6dff8a' : G.allied(e.owner) ? '#8fd0ff' : '#ff6b5e');
      let X, Z, r;
      if (e.def.kind === 'u') { X = e.rx * S; Z = e.ry * S; r = e.def.cls === 'cav' || e.def.cls === 'sie' ? 1.7 : 0.85; }
      else { const sz = BUILDINGS[e.def.key].size; X = (e.x + sz / 2) * S; Z = (e.y + sz / 2) * S; r = sz * S * 0.62; }
      m4.makeScale(r, 1, r).setPosition(X, this.T.height(X, Z) + 0.12, Z);
      this.ringPool.push(m4, c);
    }
    for (const mk of ui.markers || []) {
      const k = (now - mk.t0) / 600; if (k > 1) continue;
      const X = mk.x * S, Z = mk.y * S, r = 1.2 * (1 - k * 0.5);
      m4.makeScale(r, 1, r).setPosition(X, this.T.height(X, Z) + 0.12, Z); this.ringPool.push(m4, c.set(mk.color));
    }
    if (ui.ghost) {
      const sz = BUILDINGS[ui.ghost.type].size;
      for (const [x, y, ok] of ui.ghost.cells) {
        const X = (x + sz / 2) * S, Z = (y + sz / 2) * S;
        m4.makeScale(sz * S, 0.25 + (ui.ghost.type === 'wall' ? 3 : 1.5), sz * S).setPosition(X, this.T.height(X, Z) - 0.1, Z);
        this.ghostPool.push(m4, c.set(ok ? '#5adc78' : '#e6463c'));
      }
    }
    this.ringPool.end(); this.ghostPool.end();
  }
  drawProjectiles(now) {
    if (!this.arrowPool) {
      const ag = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4); ag.rotateX(Math.PI / 2);
      this.arrowPool = new Pool(this.world.fx, ag, U.mat('#3a2a18', 0.8), { shadow: false });
      this.ballPool = new Pool(this.world.fx, new THREE.SphereGeometry(0.22, 8, 6), U.mat('#2a2a2a', 0.5, 0.6), { shadow: false });
      const tg = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4); tg.rotateX(Math.PI / 2);
      this.tracerPool = new Pool(this.world.fx, tg, new THREE.MeshBasicMaterial({ color: '#ffe9a0' }), { shadow: false });
    }
    for (const p of [this.arrowPool, this.ballPool, this.tracerPool]) p.begin();
    this.projectiles = this.projectiles.filter(p => now < p.t0 + p.dur);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), fwd = new THREE.Vector3(0, 0, 1);
    for (const p of this.projectiles) {
      const k = Math.max(0, (now - p.t0) / p.dur), k2 = Math.min(1, k + 0.03);
      const P = kk => { const x = (p.x + (p.tx - p.x) * kk) * S, z = (p.y + (p.ty - p.y) * kk) * S; return new THREE.Vector3(x, this.T.height(x, z) + 1.3 + Math.sin(kk * Math.PI) * p.arc, z); };
      a.copy(P(k)); b.copy(P(k2));
      q.setFromUnitVectors(fwd, b.clone().sub(a).normalize());
      m4.compose(a, q, one);
      (p.c === 1 ? this.ballPool : p.c === 2 ? this.tracerPool : this.arrowPool).push(m4);
    }
    for (const p of [this.arrowPool, this.ballPool, this.tracerPool]) p.end();
  }
  drawEffects(now) {
    this.effects = this.effects.filter(e => {
      const k = (now - e.t0) / e.dur;
      if (k >= 1) { if (e.obj) this.world.fx.remove(e.obj); return false; }
      if (e.obj && e.obj.userData.meteor) {
        const kk = Math.min(1, (now - e.t0) / e.obj.userData.meteor.dur);
        e.obj.position.set(e.X - (1 - kk) * 30, e.H0 + (1 - kk) * 60, e.Z - (1 - kk) * 20);
        if (kk >= 1) e.obj.visible = false;
      }
      if (e.obj && e.kind === 'dust') e.obj.position.y = e.H0 + k * 3;
      return true;
    });
  }
  drawOverlay(G, ui, now) {
    const g = this.octx, d = this.odpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.vw, this.vh);
    // Lebensbalken: Auswahl + beschädigte eigene/sichtbare Einheiten
    for (const e of G.ents.values()) {
      const sel = G.selected.has(e.id);
      if (!sel && e.hp >= e.maxHp) continue;
      let sx, sy, w;
      if (e.def.kind === 'u') { const h = e.def.cls === 'cav' ? 3.2 : e.def.cls === 'sie' ? 3 : 2.35; [sx, sy] = this.toScreen(e.rx, e.ry, h); w = 34; }
      else { const sz = BUILDINGS[e.def.key].size, mdl = this.bldModels.get(this.buildingKey(e)); [sx, sy] = this.toScreen(e.x + sz / 2, e.y + sz / 2, (mdl ? mdl.h : 4) + 0.8); w = 26 + sz * 16; }
      if (sx < -50 || sy < -50 || sx > this.vw + 50 || sy > this.vh + 50) continue;
      const kk = Math.max(0, e.hp / e.maxHp);
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 6);
      g.fillStyle = kk > 0.6 ? '#5fd35f' : kk > 0.3 ? '#e8c03a' : '#e8453a'; g.fillRect(sx - w / 2, sy, w * kk, 4);
      if (e.def.kind === 'b' && e.prog < 100) { g.fillStyle = '#ffd34d'; g.fillRect(sx - w / 2, sy + 6, w * e.prog / 100, 3); }
    }
    if (ui.box) {
      const b = ui.box;
      g.fillStyle = 'rgba(120,220,140,0.12)'; g.strokeStyle = 'rgba(160,255,170,0.95)'; g.lineWidth = 1;
      g.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      g.strokeRect(Math.min(b.x0, b.x1) + 0.5, Math.min(b.y0, b.y1) + 0.5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
  }
  buildingKey(e) { const p = this.G.players[e.owner], era = modelEra(e.era), n = p && p.nation; const nk = n && era >= 3 ? n + (era >= 7 ? 'W' : era >= 5 ? 'I' : 'M') : ''; return e.def.key + '|' + era + '|' + (p ? p.color : '#888888') + '|' + nk; }

  drawMinimap(canvas, ui) {
    const G = this.G, g = canvas.getContext('2d');
    const sx = canvas.width / G.W, sy = canvas.height / G.H;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
    g.drawImage(this.miniBase, 0, 0, canvas.width, canvas.height);
    g.setTransform(sx, 0, 0, sy, 0, 0);
    for (const r of G.res.values()) { if (r.kind === 'tree' || !G.explored[r.y * G.W + r.x]) continue; g.fillStyle = r.kind === 'gold' ? '#ffd34d' : r.kind === 'stone' ? '#d8d8e0' : '#d6324a'; g.fillRect(r.x, r.y, r.kind === 'berry' ? 1 : 2, r.kind === 'berry' ? 1 : 2); }
    for (const e of G.ents.values()) { const p = G.players[e.owner]; g.fillStyle = p ? p.color : '#fff'; if (e.def.kind === 'b') { const s2 = BUILDINGS[e.def.key].size; g.fillRect(e.x - 0.5, e.y - 0.5, s2 + 1, s2 + 1); } else g.fillRect(e.rx - 1, e.ry - 1, 2, 2); }
    g.drawImage(this.fogCanvas, 0, 0, G.W, G.H);
    for (const a of ui.pings || []) { const k = (performance.now() - a.t0) / 3000; if (k > 1) continue; g.strokeStyle = `rgba(255,70,50,${1 - k})`; g.lineWidth = 1.5 / sx; g.beginPath(); g.arc(a.x, a.y, 3 + 10 * (k * 3 % 1), 0, 6.3); g.stroke(); }
    if (this.view) { const v = this.view; g.strokeStyle = '#fff'; g.lineWidth = 1.2 / sx; g.beginPath(); g.moveTo(v[0][0], v[0][1]); g.lineTo(v[1][0], v[1][1]); g.lineTo(v[3][0], v[3][1]); g.lineTo(v[2][0], v[2][1]); g.closePath(); g.stroke(); }
  }
  updateFogOnly() {}
}

// ---------- kleine Zusatzmodelle ----------
function tank(color) {
  const g = new THREE.Group(), olive = U.mat('#56603a', 0.75), dark = U.mat('#2b2d24', 0.8), cloth = U.mat(color, 0.8);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.9, 0.55, 3.2), olive, 0, 0.55, 0); add(new THREE.BoxGeometry(1.6, 0.3, 2.6), olive, 0, 0.95, 0);
  for (const x of [-1.05, 1.05]) { add(new THREE.BoxGeometry(0.45, 0.6, 3.4), dark, x, 0.35, 0); for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10), dark, x, 0.3, -1.3 + k * 0.65, 0, 0, Math.PI / 2); }
  add(new THREE.CylinderGeometry(0.75, 0.85, 0.5, 10), olive, 0, 1.3, -0.2); add(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), dark, 0, 1.35, 1.3, Math.PI / 2);
  add(new THREE.BoxGeometry(0.9, 0.08, 0.5), cloth, 0, 1.57, -0.5);
  return g;
}
// Bergwerk (Förderturm über Stollen) und Steinbruch (gestufte Abbaugrube) – einfache Platzhalter bis zu den Blender-Modellen
function producerModel(type, era) {
  const g = new THREE.Group(), stone = U.mat('#8d8a82', 0.95, 0), dark = U.mat('#2a2622', 1, 0), wood = U.wood();
  const box = (w, h, d, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  if (type === 'quarry') {
    box(2, 0.12, 2, stone, 0, 0.06, 0);
    for (let k = 0; k < 3; k++) box(1.7 - k * 0.45, 0.28, 1.4 - k * 0.3, stone, 0.1, 0.2 + k * 0.28, -0.15 - k * 0.12);
    for (let k = 0; k < 4; k++) box(0.32, 0.26, 0.32, U.mat('#b7b1a3', 0.9, 0), -0.6 + (k % 2) * 0.38, 0.25 + Math.floor(k / 2) * 0.26, 0.6, k * 0.3);
    box(0.08, 1.1, 0.08, wood, 0.75, 0.55, 0.7); box(0.6, 0.06, 0.06, wood, 0.5, 1.08, 0.7);
  } else {
    box(2, 0.1, 2, U.mat('#5b5246', 1, 0), 0, 0.05, 0);
    box(0.9, 0.7, 0.7, dark, -0.35, 0.4, 0.4);
    const iron = era >= 5, frame = iron ? U.mat('#3b3f44', 0.5, 0.7) : wood;
    for (const [x, z] of [[0.15, -0.55], [0.75, -0.55], [0.15, 0.05], [0.75, 0.05]]) box(0.09, 1.9, 0.09, frame, x, 0.95, z);
    box(0.75, 0.08, 0.75, frame, 0.45, 1.88, -0.25);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 18), frame); wheel.position.set(0.45, 2.05, -0.25); g.add(wheel);
    box(0.9, 0.5, 0.6, wood, -0.4, 0.95, -0.5);
  }
  return g;
}

// Gebäude-Epoche -> vorhandenes Modell: Weltwunder (WONDER_ERA) nutzt das Wundermodell (7),
// der Kalte Krieg vorerst die Modelle der 2. Industriellen Revolution, bis eigene Modelle (Blender) kommen.
function modelEra(era) { era = era | 0; return era >= WONDER_ERA ? 7 : Math.max(0, Math.min(6, era)); }

function cannon(era, color) {
  const g = new THREE.Group(), modern = era >= 5, wood = U.wood(), metal = U.mat(modern ? '#3a3d30' : '#2e2e2e', 0.4, 0.7);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.35, 0.3, 1.6), modern ? U.mat('#56603a', 0.7) : wood, 0, 0.5, -0.4, 0.15);
  for (const x of [-0.5, 0.5]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), modern ? U.mat('#2b2d24', 0.8) : wood, x, 0.45, 0, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(modern ? 0.1 : 0.16, modern ? 0.13 : 0.2, modern ? 2.6 : 1.5, 12), metal, 0, 0.85, 0.5, Math.PI / 2 - 0.25);
  add(new THREE.BoxGeometry(0.5, 0.3, 0.02), U.mat(color, 0.8), 0, 0.6, -1.2);
  return g;
}
