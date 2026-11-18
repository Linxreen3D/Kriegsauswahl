// Engine-Grundlage: Renderer, Himmel, Gelände mit Textur-Überblendung, Wasser, instanzierte Vegetation, Nachbearbeitung.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

export const TEX = {};
export function loadTextures() {
  Object.assign(TEX, {
    grass: TX.grassTex(), dirt: TX.dirtTex(), rock: TX.rockTex(), sand: TX.sandTex(),
    leafGreen: TX.leafTex(80), leafLight: TX.leafTex(81, ['#4a7a2a', '#6a9a3a', '#8ab04a', '#5a8a30']),
    leafAutumn: TX.leafTex(82, ['#b8642a', '#d8922f', '#c9a23a', '#9a7a2a', '#7a8a30']),
    needle: TX.needleTex(), grassCard: TX.grassCardTex(), bark: TX.barkTex(), water: TX.waterNormals(),
  });
}

// ---------------- Renderer & Szene ----------------
export function createWorld(canvas, { w = 1920, h = 1080, sunElev = 28, sunAz = 135, exposure = 0.62, fog = '#cfd9de', fogNear = 90, fogFar = 260, ao: useAO = true, shadowSize = 4096, preserve = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fog, fogNear, fogFar);
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 2000);

  // Himmel
  const sky = new Sky(); sky.scale.setScalar(5000);
  const u = sky.material.uniforms;
  u.turbidity.value = 5; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - sunElev), THREE.MathUtils.degToRad(sunAz));
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  // Umgebungslicht aus dem Himmel
  const pm = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(5000); Object.assign(sky2.material.uniforms, THREE.UniformsUtils.clone(u)); sky2.material.uniforms.sunPosition.value.copy(sunDir); skyScene.add(sky2);
  scene.environment = pm.fromScene(skyScene, 0.04).texture;
  scene.environmentIntensity = 0.55;

  const sun = new THREE.DirectionalLight('#ffe2b0', 3.8);
  sun.position.copy(sunDir).multiplyScalar(150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#bcd4ff', '#4a5a30', 0.35));

  // Nachbearbeitung
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const fx = new THREE.Scene(); fx.fog = scene.fog;
  const fxPass = new RenderPass(fx, camera); fxPass.clear = false; composer.addPass(fxPass);
  let ao = null;
  if (useAO) {
    ao = new GTAOPass(scene, camera, w, h);
    ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.6, thickness: 2, scale: 1.3, samples: 16 });
    ao.blendIntensity = 0.9;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.28, 0.45, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GRADE));
  return { renderer, scene, camera, composer, sun, sunDir, fx, ao, bloom, sky };
}
// Farbkorrektur: Kontrast, Sättigung, warme Lichter, Vignette
const GRADE = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.1 }, saturation: { value: 0.96 }, vignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, vignette; varying vec2 vUv;
  void main(){ vec4 c = texture2D(tDiffuse, vUv);
    float l = dot(c.rgb, vec3(0.299,0.587,0.114));
    c.rgb = mix(vec3(l), c.rgb, saturation);
    c.rgb = (c.rgb - 0.5) * contrast + 0.5;
    c.rgb *= mix(vec3(0.96,0.98,1.04), vec3(1.08,1.01,0.88), smoothstep(0.25,0.85,l));
    float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
    gl_FragColor = c; }`,
};

// ---------------- Gelände ----------------
export function noise2(seed) {
  const r = TX.rng(seed), N = 256, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y & 255) * N) + (x & 255)];
  const s = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, o = 4) => { let t = 0, a = 1, f = 1, m = 0; for (let k = 0; k < o; k++) { t += n(x * f, y * f) * a; m += a; a *= 0.5; f *= 2; } return t / m; };
}
const segDist = (x, z, pts) => { let best = 1e9; for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1]; const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = ((x - ax) * dx + (z - az) * dz) / l; t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return best; };

export function createTerrain(scene, { size = 240, seg = 240, seed = 7, river = null, riverW = 7, flats = [], paths = [], dirt = [], hills = 1, mountains = [] } = {}) {
  const nz = noise2(seed);
  const height = (x, z) => {
    let h = 1.2 + (nz(x * 0.025 + 10, z * 0.025 + 10, 5) - 0.5) * 6 * hills;
    h += Math.pow(Math.max(0, nz(x * 0.012 + 40, z * 0.012, 4) - 0.52), 1.5) * 90 * hills;
    for (const [mx, mz, mr, mh] of mountains) { const d = Math.hypot(x - mx, z - mz); if (d < mr) h += Math.pow(1 - d / mr, 1.6) * mh * (0.7 + nz(x * 0.08, z * 0.08, 3) * 0.6); }
    for (const f of flats) { const d = Math.hypot(x - f[0], z - f[1]); if (d < f[2]) { const k = Math.min(1, (f[2] - d) / 6); h = h * (1 - k) + (f[3] ?? 1.2) * k; } }
    if (river) { const rd = segDist(x, z, river); if (rd < riverW * 2) { const k = Math.min(1, rd / (riverW * 2)); h = h * k * k * (3 - 2 * k) + (-2.2 + k * 2) * (1 - k * k * (3 - 2 * k)); } }
    return h;
  };
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, height(x, z)); uv.setXY(i, x * 0.12, z * 0.12); }
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const splat = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i);
    let g = 1, d = 0, r = 0, s = 0;
    const dn = nz(x * 0.06 + 70, z * 0.06, 3);
    d += Math.max(0, (dn - 0.56) * 3.2);
    for (const [px, pz, pr] of dirt) { const dd = Math.hypot(x - px, z - pz); if (dd < pr) d += Math.min(1, (pr - dd) / 3) * (0.7 + dn * 0.6); }
    for (const pts of paths) { const dd = segDist(x, z, pts); if (dd < 2.2) d += (2.2 - dd) / 1.4; }
    r += Math.max(0, (0.86 - ny) * 7) + Math.max(0, (y - 14) * 0.15);
    if (y < 0.15) s += Math.min(1.5, (0.15 - y) * 2.2);
    const tot = g + d + r + s;
    splat.set([g / tot, d / tot, r / tot, s / tot], i * 4);
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  const mat = terrainMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, height, nz };
}

export function terrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ map: TEX.grass.map, normalMap: TEX.grass.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tDirt: { value: TEX.dirt.map }, tRock: { value: TEX.rock.map }, tSand: { value: TEX.sand.map } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWP = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDirt, tRock, tSand; varying vec4 vSplat; varying vec3 vWP;')
      .replace('#include <map_fragment>', `
        vec2 w = vWP.xz * 0.12;
        vec4 cg = mix(texture2D(map, w), texture2D(map, w * 0.27 + 0.37), 0.45);
        vec4 cd = mix(texture2D(tDirt, w * 1.2), texture2D(tDirt, w * 0.31 + 0.2), 0.4);
        vec4 cr = texture2D(tRock, vec2(vWP.x + vWP.z, vWP.y * 1.6) * 0.07);
        vec4 cs = texture2D(tSand, w * 1.4);
        vec4 sp = vSplat;
        // weichere, natürlich ausgefranste Übergänge
        float edge = cg.g * 0.6;
        sp.y = smoothstep(0.15, 0.55, sp.y + (edge - 0.3) * 0.5);
        sp.z = smoothstep(0.2, 0.6, sp.z);
        sp.w = smoothstep(0.1, 0.5, sp.w);
        vec4 col = cg;
        col = mix(col, cd, sp.y); col = mix(col, cr, sp.z); col = mix(col, cs, sp.w);
        float macro = 0.82 + 0.36 * texture2D(map, vWP.xz * 0.009).g;
        col.rgb *= macro;
        diffuseColor *= col;`);
  };
  return mat;
}

export function createWater(scene, sunDir, size = 400, level = -0.25) {
  const water = new Water(new THREE.PlaneGeometry(size, size), {
    textureWidth: 1024, textureHeight: 1024, waterNormals: TEX.water, sunDirection: sunDir.clone(),
    sunColor: 0xfff2d8, waterColor: 0x1d4a5a, distortionScale: 2.2, fog: true, alpha: 0.95,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = level;
  water.material.uniforms.size.value = 3.5;
  scene.add(water);
  return water;
}

// ---------------- Vegetation (instanziert) ----------------
function outwardNormals(geo, cx, cy, cz, k = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i) - cx, (p.getY(i) - cy) * 0.8 + 0.4, p.getZ(i) - cz).normalize();
    const o = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
    o.lerp(v, k).normalize();
    n.setXYZ(i, o.x, o.y, o.z);
  }
  return geo;
}
function cards(count, r, cx, cy, cz, ry, size, seed) {
  const rr = TX.rng(seed), list = [];
  for (let k = 0; k < count; k++) {
    const g = new THREE.PlaneGeometry(size * (0.75 + rr() * 0.5), size * (0.75 + rr() * 0.5));
    g.rotateX(rr() * Math.PI); g.rotateY(rr() * Math.PI * 2); g.rotateZ(rr() * Math.PI);
    const a = rr() * Math.PI * 2, e = (rr() - 0.35) * Math.PI * 0.7, d = Math.cbrt(rr()) * r;
    g.translate(cx + Math.cos(a) * Math.cos(e) * d, cy + Math.sin(e) * d * ry, cz + Math.sin(a) * Math.cos(e) * d);
    list.push(g);
  }
  return outwardNormals(mergeGeometries(list), cx, cy, cz, 0.85);
}
function trunkGeo(h, r, branches, seed) {
  const rr = TX.rng(seed), list = [];
  const t = new THREE.CylinderGeometry(r * 0.6, r, h, 8, 3); t.translate(0, h / 2, 0);
  const tp = t.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 1.3 + seed) * 0.08); }
  const tuv = t.attributes.uv; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 2, tuv.getY(i) * h * 0.5);
  list.push(t);
  for (let k = 0; k < branches; k++) {
    const b = new THREE.CylinderGeometry(r * 0.18, r * 0.35, h * 0.55, 5);
    b.translate(0, h * 0.27, 0); b.rotateZ(0.7 + rr() * 0.4); b.rotateY(k / branches * Math.PI * 2 + rr());
    b.translate(0, h * (0.55 + rr() * 0.25), 0);
    list.push(b);
  }
  return mergeGeometries(list.map(g => g.toNonIndexed ? g.toNonIndexed() : g));
}
const leafMat = (tex, tint = '#ffffff') => new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: tint });
export function makeTreeKinds() {
  const bark = new THREE.MeshStandardMaterial({ map: TEX.bark.map, normalMap: TEX.bark.normalMap, roughness: 0.95 });
  const kinds = [];
  for (let s = 0; s < 3; s++) {
    const h = 3.2 + s * 0.6;
    kinds.push({ trunk: trunkGeo(h, 0.28, 4, s + 1), trunkMat: bark,
      leaves: mergeGeometries([cards(26, 1.9, 0, h + 1.0, 0, 0.75, 2.2, s * 11 + 3), cards(10, 1.3, 0.6, h + 0.2, 0.3, 0.6, 1.6, s * 11 + 5)]),
      leafMat: leafMat(s === 1 ? TEX.leafLight : TEX.leafGreen), autumnMat: leafMat(TEX.leafAutumn) });
  }
  // Nadelbäume
  for (let s = 0; s < 2; s++) {
    const h = 6 + s, list = [];
    const rr = TX.rng(200 + s);
    for (let l = 0; l < 7; l++) {
      const y = 1.4 + l * (h - 1.6) / 7, rad = 2.0 * (1 - l / 8) + 0.3;
      for (let k = 0; k < 7; k++) {
        const g = new THREE.PlaneGeometry(rad * 1.3, rad * 1.5);
        g.translate(0, -rad * 0.55, 0); g.rotateX(-1.1 - rr() * 0.3); g.rotateY(k / 7 * Math.PI * 2 + l * 0.4); g.translate(0, y + rad * 0.3, 0);
        list.push(g);
      }
    }
    kinds.push({ trunk: trunkGeo(h, 0.25, 0, 30 + s), trunkMat: bark, leaves: outwardNormals(mergeGeometries(list), 0, h * 0.5, 0, 0.7), leafMat: leafMat(TEX.needle), conifer: true });
  }
  return kinds;
}
// Bäume verteilen; avoid(x,z) -> true blockiert
export function plantForest(scene, T, kinds, spots) {
  const byKind = kinds.map(() => []);
  for (const s of spots) byKind[s.k].push(s);
  byKind.forEach((list, ki) => {
    if (!list.length) return;
    const K = kinds[ki];
    const mT = new THREE.InstancedMesh(K.trunk, K.trunkMat, list.length);
    const normal = list.filter(s => !s.autumn), autumn = list.filter(s => s.autumn);
    const mL = new THREE.InstancedMesh(K.leaves, K.leafMat, Math.max(1, normal.length));
    const mA = autumn.length && K.autumnMat ? new THREE.InstancedMesh(K.leaves, K.autumnMat, autumn.length) : null;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let ni = 0, ai = 0;
    list.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.r);
      m4.compose(new THREE.Vector3(s.x, T.height(s.x, s.z) - 0.2, s.z), q, new THREE.Vector3(s.s, s.s * (0.9 + (i % 5) * 0.05), s.s));
      mT.setMatrixAt(i, m4);
      if (s.autumn && mA) { mA.setMatrixAt(ai, m4); ai++; }
      else { mL.setMatrixAt(ni, m4); c.setHSL(0.13 + (i % 7) * 0.014, 0.28, 0.42 + (i % 5) * 0.05); mL.setColorAt(ni, c.multiplyScalar(2.15)); ni++; }
    });
    mL.count = ni;
    for (const m of [mT, mL, mA]) if (m) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  });
}
export function forestSpots(T, cx, cz, r, n, seed, avoid = () => false, mixConifer = 0.4, autumn = 0.08) {
  const rr = TX.rng(seed), out = [];
  for (let k = 0; k < n; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const h = T.height(x, z);
    if (h < 0.6 || h > 22 || avoid(x, z)) continue;
    const con = rr() < mixConifer;
    out.push({ x, z, r: rr() * 6.28, s: 0.8 + rr() * 0.6, k: con ? 3 + Math.floor(rr() * 2) : Math.floor(rr() * 3), autumn: !con && rr() < autumn });
  }
  return out;
}
export function plantGrass(scene, T, count, area, avoid, seed = 5) {
  const list = [], rr = TX.rng(seed);
  for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(1.1, 0.6); g.translate(0, 0.28, 0); g.rotateY(k * Math.PI / 3); list.push(g); }
  const geo = mergeGeometries(list);
  const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const mat = new THREE.MeshStandardMaterial({ map: TEX.grassCard, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  const m = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let i = 0;
  for (let t = 0; t < count * 3 && i < count; t++) {
    const x = area[0] + rr() * (area[2] - area[0]), z = area[1] + rr() * (area[3] - area[1]);
    const h = T.height(x, z);
    if (h < 0.7 || h > 14 || avoid(x, z)) continue;
    if (T.nz(x * 0.06 + 70, z * 0.06, 3) > 0.62) continue; // nicht auf Erdflächen
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr() * 6.28);
    const s = 0.6 + rr() * 0.9;
    m4.compose(new THREE.Vector3(x, h - 0.05, z), q, new THREE.Vector3(s, s * (0.8 + rr() * 0.5), s));
    m.setMatrixAt(i, m4);
    c.setHSL(0.11 + rr() * 0.06, 0.32, 0.5 + rr() * 0.15); m.setColorAt(i, c.multiplyScalar(1.75));
    i++;
  }
  m.count = i; m.receiveShadow = true;
  scene.add(m);
  return m;
}
export function scatterRocks(scene, T, count, area, avoid, seed = 9) {
  const rr = TX.rng(seed);
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const s = 0.75 + Math.sin(p.getX(i) * 5 + p.getZ(i) * 3) * 0.15 + rr() * 0.1; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s); }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: TEX.rock.map, normalMap: TEX.rock.normalMap, roughness: 0.9 });
  const m = new THREE.InstancedMesh(g, mat, count), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  let i = 0;
  for (let t = 0; t < count * 4 && i < count; t++) {
    const x = area[0] + rr() * (area[2] - area[0]), z = area[1] + rr() * (area[3] - area[1]);
    const h = T.height(x, z); if (h < 0.5 || avoid(x, z)) continue;
    q.setFromEuler(new THREE.Euler(rr(), rr() * 6, rr()));
    const s = 0.25 + Math.pow(rr(), 3) * 1.6;
    m4.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(s, s, s)); m.setMatrixAt(i++, m4);
  }
  m.count = i; m.castShadow = m.receiveShadow = true; scene.add(m);
}
export function bushes(scene, T, count, area, avoid, seed = 13) {
  const geo = cards(14, 0.7, 0, 0.5, 0, 0.6, 0.9, seed);
  const mat = leafMat(TEX.leafGreen);
  const m = new THREE.InstancedMesh(geo, mat, count), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), rr = TX.rng(seed);
  let i = 0;
  for (let t = 0; t < count * 4 && i < count; t++) {
    const x = area[0] + rr() * (area[2] - area[0]), z = area[1] + rr() * (area[3] - area[1]);
    const h = T.height(x, z); if (h < 0.7 || h > 16 || avoid(x, z)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr() * 6.28);
    const s = 0.6 + rr() * 0.9;
    m4.compose(new THREE.Vector3(x, h - 0.1, z), q, new THREE.Vector3(s, s, s)); m.setMatrixAt(i, m4);
    c.setHSL(0.18 + rr() * 0.1, 0.4, 0.5); m.setColorAt(i, c.multiplyScalar(1.7)); i++;
  }
  m.count = i; m.castShadow = true; m.receiveShadow = true; scene.add(m);
}
