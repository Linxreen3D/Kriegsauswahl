// Realistischere Figuren: organischer Körper (SDF) + passgenaue Kleidungs-/Rüstungsschichten.
import * as THREE from 'three';
import * as S from './sdf.js';
import * as U from './units.js';
import { rng } from './textures.js';

const { sphere, ellipsoid, cone, box, smin, smax } = S;
const geoCache = new Map();

// ---------- Materialien ----------
function fabricMat(color, key = 'fab', stripes = 0) {
  return U.std(`fab${color}${key}${stripes}`, () => {
    const map = U.canvasTex(256, (g, N) => {
      g.fillStyle = color; g.fillRect(0, 0, N, N);
      for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + Math.random() * 0.04})`; g.fillRect(Math.random() * N, Math.random() * N, 1 + Math.random() * 3, 1); }
      if (stripes) for (let x = 0; x < N; x += N / stripes) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, 0, 2, N); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, 0, 2, N); }
    }, true, true);
    const nm = U.canvasTex(256, (g, N) => {
      g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, N, N);
      for (let y = 0; y < N; y += 3) { g.fillStyle = 'rgba(128,150,255,0.5)'; g.fillRect(0, y, N, 1); }
      for (let x = 0; x < N; x += 3) { g.fillStyle = 'rgba(150,128,255,0.4)'; g.fillRect(x, 0, 1, N); }
      if (stripes) for (let x = 0; x < N; x += N / stripes) { g.fillStyle = 'rgb(60,128,255)'; g.fillRect(x, 0, 3, N); g.fillStyle = 'rgb(200,128,255)'; g.fillRect(x + 3, 0, 3, N); }
    }, false, true);
    map.repeat.set(stripes ? 1 : 6, stripes ? 3 : 8); nm.repeat.copy(map.repeat);
    return new THREE.MeshStandardMaterial({ map, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 });
  });
}
function surcoatMat(color, emblem) {
  return U.std(`sur${color}${emblem}`, () => {
    const her = U.heraldry('#000000', emblem).map.image;
    const map = U.canvasTex(512, (g, N) => {
      g.fillStyle = color; g.fillRect(0, 0, N, N);
      for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(Math.random() * N, Math.random() * N, 2, 1); }
      // Wappen vorne (u=0.5) und hinten (u=0/1); v: y=1.25 m ~ Zeile
      const put = (cx) => {
        const tmp = document.createElement('canvas'); tmp.width = tmp.height = 256; const t = tmp.getContext('2d'); t.drawImage(her, 0, 0);
        const d = t.getImageData(0, 0, 256, 256); for (let i = 0; i < d.data.length; i += 4) if (d.data[i] + d.data[i + 1] + d.data[i + 2] < 120) d.data[i + 3] = 0; t.putImageData(d, 0, 0);
        t.clearRect(0, 0, 256, 14); t.clearRect(0, 242, 256, 14); t.clearRect(0, 0, 14, 256); t.clearRect(242, 0, 14, 256);
        g.drawImage(tmp, cx - 70, 70, 140, 150);
      };
      put(N / 2); put(0); put(N);
      g.fillStyle = '#d8b04a'; g.fillRect(0, N - 18, N, 10); // Goldsaum unten
    });
    map.wrapS = THREE.RepeatWrapping; map.offset.y = -0.45;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide });
  });
}
const SKIN = ['#e3b08e', '#cf9a74', '#a8714c', '#7a4e32', '#edc4a2'];
const HAIRC = ['#2a1d14', '#4a3018', '#6a4a24', '#151210', '#8a6a3a'];

// ---------- Skelett je Haltung ----------
function skeleton(pose, weapon, hasShield) {
  const J = { hip: [0, 0.95, 0] };
  const walk = pose === 'walk' ? 0.32 : pose === 'charge' ? 0.42 : 0;
  for (const s of [-1, 1]) {
    const k = s > 0 ? 'R' : 'L';
    const hip = [s * 0.095, 0.93, 0];
    let knee, ankle;
    if (pose === 'ride') { knee = [s * 0.21, 0.9, 0.3]; ankle = [s * 0.23, 0.5, 0.24]; }
    else if (walk) {
      const fwd = s > 0;
      knee = fwd ? [s * 0.1, 0.52, 0.17] : [s * 0.1, 0.51, -0.12];
      ankle = fwd ? [s * 0.1, 0.09, 0.26] : [s * 0.1, 0.16, -0.36];
    } else { knee = [s * 0.105, 0.51, 0.02]; ankle = [s * 0.11, 0.09, -0.01]; }
    J['hip' + k] = hip; J['knee' + k] = knee; J['ankle' + k] = ankle;
    J['toe' + k] = [ankle[0] + s * 0.01, Math.max(0.03, ankle[1] - 0.06), ankle[2] + 0.15];
    J['shoulder' + k] = [s * 0.19, 1.43, 0];
  }
  const lean = pose === 'charge' ? 0.06 : 0;
  J.chest = [0, 1.3, 0.012 + lean]; J.neck = [0, 1.52, lean]; J.head = [0, 1.675, 0.01 + lean];
  // Arme (wie zuvor, aber anatomisch angepasst)
  let rE, rH, lE, lH;
  if (pose === 'attack') { rE = [0.3, 1.62, -0.04]; rH = [0.24, 1.84, 0.1]; }
  else if (pose === 'aim' && weapon === 'bow') { rE = [0.24, 1.45, -0.14]; rH = [0.1, 1.5, -0.04]; }
  else if (pose === 'aim') { rE = [0.2, 1.27, 0.17]; rH = [0.07, 1.39, 0.2]; }
  else if (pose === 'charge' || pose === 'ride') { rE = [0.28, 1.22, 0.12]; rH = [0.25, 1.2, 0.35]; }
  else { rE = [0.225, 1.16, 0.0]; rH = [0.215, 0.93, 0.08]; }
  if (pose === 'aim' && weapon === 'bow') { lE = [-0.33, 1.47, 0.22]; lH = [-0.29, 1.5, 0.5]; }
  else if (pose === 'aim') { lE = [-0.15, 1.22, 0.32]; lH = [-0.02, 1.35, 0.46]; }
  else if (hasShield) { lE = [-0.3, 1.15, 0.13]; lH = [-0.24, 1.17, 0.31]; }
  else { lE = [-0.225, 1.16, -0.01]; lH = [-0.215, 0.93, 0.05]; }
  J.elbowR = rE; J.handR = rH; J.elbowL = lE; J.handL = lH;
  return J;
}
const ext = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- Körper-SDF-Bausteine ----------
function parts(J) {
  const L = {};
  L.pelvis = p => ellipsoid(p, [0, 0.95, 0], [0.165, 0.12, 0.115]);
  L.abdomen = p => ellipsoid(p, [0, 1.12, J.chest[2] * 0.5], [0.145, 0.13, 0.105]);
  L.chest = p => ellipsoid(p, J.chest, [0.185, 0.14, 0.12]);
  L.traps = p => Math.min(cone(p, [0, 1.47, J.neck[2] - 0.01], J.shoulderL, 0.06, 0.05), cone(p, [0, 1.47, J.neck[2] - 0.01], J.shoulderR, 0.06, 0.05));
  L.neck = p => cone(p, [0, 1.43, J.neck[2]], [0, 1.57, J.neck[2] + 0.01], 0.058, 0.05);
  L.torso = p => smin(smin(smin(L.pelvis(p), L.abdomen(p), 0.06), L.chest(p), 0.06), L.traps(p), 0.05);
  L.head = p => {
    const h = J.head;
    let d = ellipsoid(p, h, [0.088, 0.112, 0.1]);
    d = smin(d, ellipsoid(p, [h[0], h[1] - 0.06, h[2] + 0.025], [0.07, 0.055, 0.075]), 0.04); // Kiefer
    d = smin(d, cone(p, [h[0], h[1] + 0.015, h[2] + 0.088], [h[0], h[1] - 0.022, h[2] + 0.11], 0.011, 0.017), 0.012); // Nase
    d = smin(d, ellipsoid(p, [h[0], h[1] + 0.03, h[2] + 0.074], [0.072, 0.018, 0.03]), 0.02); // Brauen
    for (const s of [-1, 1]) {
      d = smax(d, -sphere(p, [h[0] + s * 0.033, h[1] + 0.012, h[2] + 0.098], 0.017), 0.012); // Augenhöhlen
      d = smin(d, sphere(p, [h[0] + s * 0.033, h[1] + 0.012, h[2] + 0.085], 0.013), 0.004); // Augäpfel
      d = smin(d, ellipsoid(p, [h[0] + s * 0.088, h[1], h[2] - 0.005], [0.014, 0.03, 0.022]), 0.01); // Ohren
    }
    d = smax(d, -box(p, [h[0], h[1] - 0.052, h[2] + 0.1], [0.022, 0.003, 0.02]), 0.004); // Mund
    return d;
  };
  for (const k of ['L', 'R']) {
    const sh = J['shoulder' + k], el = J['elbow' + k], ha = J['hand' + k];
    L['upper' + k] = p => smin(sphere(p, sh, 0.064), smin(cone(p, sh, el, 0.054, 0.042), ellipsoid(p, ext(sh, el, 0.45), [0.05, 0.05, 0.05]), 0.03), 0.03);
    L['fore' + k] = p => smin(cone(p, el, ha, 0.045, 0.031), sphere(p, el, 0.042), 0.02);
    const tip = ext(el, ha, 1.32);
    L['hand' + k] = p => smin(cone(p, ha, tip, 0.032, 0.022), ellipsoid(p, ext(ha, tip, 0.4), [0.038, 0.022, 0.038]), 0.02);
    const hp = J['hip' + k], kn = J['knee' + k], an = J['ankle' + k], to = J['toe' + k];
    L['thigh' + k] = p => smin(cone(p, hp, kn, 0.09, 0.056), ellipsoid(p, ext(hp, kn, 0.35), [0.075, 0.12, 0.08]), 0.04);
    L['calf' + k] = p => smin(smin(sphere(p, kn, 0.054), cone(p, kn, an, 0.054, 0.035), 0.02), ellipsoid(p, [kn[0] + (an[0] - kn[0]) * 0.3, kn[1] + (an[1] - kn[1]) * 0.3, kn[2] + (an[2] - kn[2]) * 0.3 - 0.022], [0.045, 0.09, 0.045]), 0.03);
    L['foot' + k] = p => smin(cone(p, an, to, 0.038, 0.03), sphere(p, an, 0.038), 0.02);
  }
  L.arms = p => Math.min(smin(L.upperL(p), L.foreL(p), 0.02), smin(L.upperR(p), L.foreR(p), 0.02));
  L.hands = p => Math.min(L.handL(p), L.handR(p));
  L.legs = p => Math.min(smin(L.thighL(p), L.calfL(p), 0.02), smin(L.thighR(p), L.calfR(p), 0.02));
  L.feet = p => Math.min(L.footL(p), L.footR(p));
  L.body = p => smin(smin(smin(smin(L.torso(p), L.neck(p), 0.04), L.head(p), 0.02), smin(L.arms(p), L.hands(p), 0.015), 0.04), smin(L.legs(p), L.feet(p), 0.02), 0.05);
  return L;
}
// Grenzen aus den Gelenken
function bounds(pts, m = 0.12) {
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of pts) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], p[i] - m); b[i + 3] = Math.max(b[i + 3], p[i] + m); }
  return b;
}
const hemWave = (p, y0, amp = 0.015, f = 9) => (y0 + Math.sin(Math.atan2(p[0], p[2]) * f) * amp) - p[1];

// ---------- Figur ----------
// outfit je Epoche/Waffe
function outfitFor(era, weapon) {
  if (era === 0) return 'fur';
  if (era <= 2) return weapon === 'bow' || weapon === 'sling' ? 'tunic' : 'bronze';
  if (era === 3) return weapon === 'bow' ? 'gambeson' : weapon === 'none' || weapon === 'tool' ? 'civil' : 'mail';
  if (era === 4) return weapon === 'musket' ? 'musketeer' : 'pike';
  if (era === 5) return 'coat';
  return 'modern';
}
export function soldierR(o = {}) {
  const { color = '#1f4fa8', era = 3, weapon = 'sword', seed = 1, pose = 'idle', shield: hasShield = false, helmet = true, greatHelm = null, civilian = false } = o;
  const r = rng(seed * 11 + 7);
  const outfit = civilian ? 'civil' : outfitFor(era, weapon);
  const gHelm = greatHelm ?? (outfit === 'mail' && weapon === 'sword' && seed % 3 === 0);
  const skinC = SKIN[seed % SKIN.length], hairC = HAIRC[(seed * 3) % HAIRC.length];
  const beard = seed % 3 !== 1;
  const key = [outfit, pose, weapon, hasShield, helmet, gHelm, color, seed % 5, era].join('|');
  let layers = geoCache.get(key);
  if (!layers) {
    const J = skeleton(pose, weapon, hasShield), L = parts(J);
    const all = Object.values(J).filter(Array.isArray);
    const B = bounds(all, 0.14), cell = 0.014;
    const headB = bounds([J.head, J.neck], 0.16);
    layers = [];
    const add = (sdf, matKey, b = B, c = cell, uvScale = 1) => { const g = S.mesh(sdf, b, c, { uvScale }); if (g.index.count) layers.push([g, matKey]); };
    // Haut: Kopf fein, Rest gröber
    add(p => smax(L.body(p), 1.45 - p[1], 0.02), 'skin', headB, 0.007);
    add(p => smax(L.body(p), p[1] - 1.47, 0.02), 'skin');
    // Haare & Bart
    const H = J.head;
    if (!helmet || outfit === 'civil') add(p => smax(smax(S.ellipsoid(p, [H[0], H[1] + 0.012, H[2] - 0.008], [0.095, 0.115, 0.105]), (H[1] + 0.0) - p[1] + (p[2] - H[2] > 0.05 ? 0.06 : 0), 0.02), -L.head(p) - 0.0, 0.005), 'hair', headB, 0.007);
    if (beard) add(p => smax(smax(smax(L.head(p) - 0.006, p[1] - (H[1] - 0.05), 0.008), H[2] + 0.04 - p[2], 0.015), -(L.head(p)), 0.002), 'hair', headB, 0.006);
    const legs = p => smin(L.legs(p), L.pelvis(p), 0.05);
    const torsoArms = p => smin(L.torso(p), L.arms(p), 0.04);
    // Hose & Stiefel
    add(p => smax(legs(p) - 0.008, p[1] - 1.02, 0.02), 'trousers');
    add(p => smax(smin(L.feet(p), L.legs(p), 0.02) - 0.014, hemWave(p, 0.4, 0.01, 4) * -1, 0.01), 'boots');
    add(p => L.hands(p) - 0.005, outfit === 'mail' || outfit === 'pike' ? 'gauntlet' : 'skin');
    const belt = p => smax(smax(L.abdomen(p) - 0.03, Math.abs(p[1] - 1.02) - 0.022, 0.005), -(L.abdomen(p) + 0.005), 0.002);
    switch (outfit) {
      case 'fur':
        add(p => smax(smax(L.torso(p) - 0.022, hemWave(p, 0.72, 0.03, 7), 0.02), p[1] - 1.38, 0.03), 'fur'); break;
      case 'tunic':
      case 'civil':
        add(p => smax(smax(smin(torsoArms(p), legs(p), 0.05) - 0.016, hemWave(p, 0.68, 0.02, 8), 0.02), Math.max(-(p[1] - 1.0) * 0, 0) + (Math.abs(p[0]) > 0.3 ? (Math.abs(p[0]) - 0.3) : -1), 0.02), civilian ? 'civtunic' : 'teamcloth');
        add(belt, 'leather'); break;
      case 'bronze':
        add(p => smax(smin(L.torso(p), legs(p), 0.05) - 0.014, hemWave(p, 0.7, 0.02, 10), 0.02), 'teamcloth');
        add(p => smax(smax(L.torso(p) - 0.03, 0.98 - p[1], 0.01), p[1] - 1.5, 0.01), 'bronze');
        add(p => smax(smax(L.legs(p) - 0.012, p[1] - 0.48, 0.01), 0.14 - p[1], 0.01), 'bronze');
        break;
      case 'mail':
        add(p => smax(smin(torsoArms(p), legs(p), 0.05) - 0.014, hemWave(p, 0.6, 0.015, 10), 0.02), 'mail');
        add(p => smax(smax(smin(L.torso(p), legs(p), 0.05) - 0.032, hemWave(p, 0.56, 0.02, 7), 0.02), p[1] - 1.47, 0.02), 'surcoat');
        add(belt, 'leather');
        add(p => smax(smax(L.legs(p) - 0.02, p[1] - 0.5, 0.01), 0.16 - p[1], 0.01), 'plate');
        for (const k of ['L', 'R']) { const sh = J['shoulder' + k]; add(p => smax(smax(S.sphere(p, [sh[0] * 1.05, sh[1] + 0.02, sh[2]], 0.09), -S.sphere(p, [sh[0] * 1.05, sh[1] + 0.02, sh[2]], 0.075), 0.005), sh[1] - 0.03 - p[1], 0.01), 'plate', bounds([sh], 0.13), 0.01); }
        break;
      case 'gambeson':
        add(p => smax(smin(torsoArms(p), legs(p), 0.05) - 0.026, hemWave(p, 0.62, 0.015, 9), 0.02), 'quilt');
        add(p => smax(smax(L.torso(p) - 0.04, hemWave(p, 0.8, 0.02, 7), 0.02), p[1] - 1.45, 0.02), 'teamcloth');
        add(belt, 'leather'); break;
      case 'pike':
      case 'musketeer':
        add(p => smax(torsoArms(p) - 0.03, 0.9 - p[1], 0.02), 'teamcloth');
        add(p => smax(legs(p) - 0.03, p[1] - 1.0, 0.02), 'stripes');
        if (outfit === 'pike') add(p => smax(smax(L.torso(p) - 0.045, 0.95 - p[1], 0.01), p[1] - 1.45, 0.01), 'plate');
        add(belt, 'leather'); break;
      case 'coat':
        add(p => smax(smin(torsoArms(p), legs(p), 0.05) - 0.022, hemWave(p, 0.62, 0.0, 2) + (p[2] > 0.02 && p[1] < 1.0 ? 1 : 0), 0.02), 'teamcloth');
        add(p => smax(legs(p) - 0.012, p[1] - 1.0, 0.02), 'white');
        add(belt, 'white'); break;
      default: // modern
        add(p => smax(torsoArms(p) - 0.024, 0.9 - p[1], 0.02), 'olive');
        add(p => smax(legs(p) - 0.018, p[1] - 1.02, 0.02), 'olive');
        add(belt, 'leather');
        add(p => smax(smax(L.torso(p) - 0.05, 1.0 - p[1], 0.01), p[1] - 1.42, 0.01), 'webbing');
    }
    // Helme
    if (helmet && outfit !== 'civil') {
      const hb = bounds([H], 0.2), hc = 0.007;
      if (outfit === 'mail' && gHelm) add(p => smax(smax(S.cylY(p, [H[0], H[1] + 0.02, H[2]], 0.122, 0.13) - 0.004, -S.box(p, [H[0], H[1] + 0.02, H[2] + 0.12], [0.09, 0.008, 0.06]), 0.003), -S.box(p, [H[0], H[1] - 0.04, H[2] + 0.13], [0.006, 0.04, 0.05]) * 0 - 1, 0.002), 'plate', hb, hc);
      else if (outfit === 'mail' || outfit === 'gambeson') {
        add(p => smax(smax(L.head(p) - 0.018, H[1] + 0.03 - p[1], 0.01), -(L.head(p) - 0.004), 0.003), 'plate', hb, hc); // Kalotte
        add(p => smax(S.box(p, [H[0], H[1] + 0.0, H[2] + 0.112], [0.008, 0.045, 0.008]), 0, 0), 'plate', hb, hc); // Nasal
        if (outfit === 'mail') add(p => smax(smax(smax(smin(L.head(p), L.neck(p), 0.04) - 0.02, p[1] - (H[1] + 0.04), 0.01), 1.42 - p[1], 0.01), -S.ellipsoid(p, [H[0], H[1] - 0.02, H[2] + 0.09], [0.07, 0.07, 0.08]), 0.01), 'mail', hb, hc);
      } else if (outfit === 'bronze') add(p => smin(smax(L.head(p) - 0.016, H[1] - 0.02 - p[1] + (p[2] - H[2] > 0.04 && Math.abs(p[0] - H[0]) < 0.05 && p[1] < H[1] + 0.02 ? 1 : 0), 0.01), S.box(p, [H[0], H[1] + 0.15, H[2] - 0.01], [0.012, 0.04, 0.11], 0.01), 0.01), 'bronze', hb, hc);
      else if (outfit === 'pike') add(p => smin(smax(L.head(p) - 0.016, H[1] + 0.02 - p[1], 0.01), smax(S.ellipsoid(p, [H[0], H[1] + 0.035, H[2]], [0.16, 0.012, 0.19]), -0.0, 0), 0.02), 'plate', hb, hc);
      else if (outfit === 'coat' || outfit === 'musketeer') add(p => smax(S.cylY(p, [H[0], H[1] + 0.1, H[2]], 0.105, 0.09) - 0.004, H[1] + 0.02 - p[1], 0.005), 'shako', hb, hc);
      else if (outfit === 'modern') add(p => smax(L.head(p) - 0.03, H[1] + 0.0 - p[1], 0.01), 'olive', hb, hc);
      else if (outfit === 'fur') add(p => smax(L.head(p) - 0.02, H[1] + 0.03 - p[1], 0.02), 'fur', hb, hc);
    }
    geoCache.set(key, layers);
  }
  // Materialien zuordnen
  const M = {
    skin: U.mat(skinC, 0.62), hair: U.mat(hairC, 0.9), trousers: fabricMat(['#3e342c', '#4a3d33', '#352f2a'][seed % 3]), boots: U.mat('#2a1d14', 0.7),
    gauntlet: U.darkPlate(), leather: U.mat('#4a2e1a', 0.65), fur: fabricMat('#6a4a2e', 'fur'), teamcloth: fabricMat(color),
    civtunic: fabricMat(color, 'civ'), bronze: U.mat('#b5884a', 0.3, 0.9), mail: U.chainmail(), surcoat: surcoatMat(color, U.emblemFor(color)),
    plate: U.mat('#aeb3ba', 0.28, 0.92), quilt: fabricMat('#cbb994', 'quilt', 24), stripes: fabricMat(color, 'str', 10), white: fabricMat('#ece8de'),
    olive: fabricMat('#566040'), webbing: U.mat('#3e3a2a', 0.8), shako: U.mat('#15151c', 0.5),
  };
  const g = new THREE.Group();
  for (const [geo, mk] of layers) { const m = new THREE.Mesh(geo, M[mk]); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // Waffen & Schild an den Händen
  const J = skeleton(pose, weapon, hasShield);
  const hand = new THREE.Group(); hand.position.set(...J.handR); g.add(hand);
  if (weapon === 'sword') { const w = U.sword(); w.rotation.x = pose === 'attack' ? -0.6 : pose === 'charge' || pose === 'ride' ? 1.2 : 0.3; hand.add(w); }
  if (weapon === 'spear' || weapon === 'pike') { const sp = U.spear(weapon === 'pike' ? 3.6 : 2.3, weapon === 'pike'); sp.rotation.x = pose === 'attack' || pose === 'charge' || pose === 'ride' ? 1.35 : 0.08; hand.add(sp); }
  if (weapon === 'musket' || weapon === 'rifle') { const mu = U.musket(weapon === 'rifle' ? 1.05 : 1.3, weapon === 'rifle'); if (pose === 'aim') { mu.rotation.y = -Math.PI / 2; mu.position.set(0.04, -0.06, -0.25); } else { mu.rotation.set(0, -Math.PI / 2, Math.PI / 2 - 0.15); mu.position.set(0, -0.15, 0); } hand.add(mu); }
  if (weapon === 'tool') { const t = new THREE.Group(); t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.8, 6), U.wood())); t.children[0].position.y = 0.3; const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.22), U.darkPlate()); hd.position.set(0, 0.68, 0.06); t.add(hd); t.rotation.x = pose === 'attack' ? -0.6 : 0.3; hand.add(t); }
  if (weapon === 'bow') {
    const b = U.bow(); b.position.set(...J.handL); b.rotation.set(0, pose === 'aim' ? 0 : 0.2, pose === 'aim' ? 0.15 : 0.1); if (pose !== 'aim') b.position.y += 0.15; g.add(b);
    const q = new THREE.Group(); q.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 10, 1, true), U.leather())); for (let k = 0; k < 7; k++) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.03), U.mat('#e8e0d0')); a.position.set((k % 3 - 1) * 0.02, 0.3, (Math.floor(k / 3) - 1) * 0.02); q.add(a); }
    q.position.set(0.1, 1.27, -0.17); q.rotation.set(0.3, 0, -0.25); g.add(q);
  }
  if (hasShield) { const s = U.shield(color, era, U.emblemFor(color)); s.position.set(J.handL[0] - 0.06, J.handL[1], J.handL[2] + 0.03); s.rotation.y = -0.25; g.add(s); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.scale.setScalar(1 + (r() - 0.5) * 0.06);
  return g;
}

// ---------- Pferd (organisch) ----------
const COATS = ['#5a3a24', '#3a2618', '#7a5536', '#d6cfc4', '#2a201a', '#8a6a48'];
const horseCache = new Map();
export function horseR({ color = '#1f4fa8', seed = 1, barding = true, rider = null } = {}) {
  const key = barding + '|' + color;
  let layers = horseCache.get(key);
  if (!layers) {
    layers = [];
    const legs = [];
    for (const s of [-1, 1]) {
      legs.push(p => smin(smin(cone(p, [s * 0.15, 1.08, 0.5], [s * 0.14, 0.6, 0.53], 0.09, 0.055), cone(p, [s * 0.14, 0.6, 0.53], [s * 0.14, 0.2, 0.52], 0.045, 0.035), 0.03), cone(p, [s * 0.14, 0.2, 0.52], [s * 0.14, 0.07, 0.57], 0.04, 0.042), 0.02));
      legs.push(p => smin(smin(cone(p, [s * 0.16, 1.18, -0.52], [s * 0.15, 0.62, -0.72], 0.14, 0.055), cone(p, [s * 0.15, 0.62, -0.72], [s * 0.15, 0.2, -0.64], 0.045, 0.035), 0.03), cone(p, [s * 0.15, 0.2, -0.64], [s * 0.15, 0.07, -0.6], 0.04, 0.042), 0.02));
    }
    const legSDF = p => Math.min(legs[0](p), legs[1](p), legs[2](p), legs[3](p));
    const body = p => {
      let d = ellipsoid(p, [0, 1.25, 0], [0.3, 0.33, 0.62]);
      d = smin(d, ellipsoid(p, [0, 1.28, 0.5], [0.27, 0.32, 0.3]), 0.12);
      d = smin(d, ellipsoid(p, [0, 1.3, -0.5], [0.29, 0.31, 0.33]), 0.12);
      d = smin(d, ellipsoid(p, [0, 1.5, 0.38], [0.12, 0.12, 0.22]), 0.1);
      d = smin(d, cone(p, [0, 1.42, 0.6], [0, 1.95, 0.95], 0.21, 0.11), 0.12);
      d = smin(d, cone(p, [0, 2.02, 0.98], [0, 1.66, 1.24], 0.105, 0.065), 0.06);
      d = smin(d, ellipsoid(p, [0, 1.87, 1.05], [0.075, 0.1, 0.12]), 0.05);
      for (const s of [-1, 1]) {
        d = smin(d, cone(p, [s * 0.05, 2.08, 0.95], [s * 0.065, 2.2, 0.92], 0.025, 0.006), 0.02);
        d = smax(d, -sphere(p, [s * 0.035, 1.66, 1.255], 0.016), 0.008);
        d = smin(d, sphere(p, [s * 0.075, 1.98, 1.06], 0.018), 0.005);
      }
      return smin(d, legSDF(p), 0.06);
    };
    const B = [-0.45, 0, -1.15, 0.45, 2.3, 1.4];
    const add = (sdf, mk, b = B, c = 0.016) => { const g = S.mesh(sdf, b, c); if (g.index.count) layers.push([g, mk]); };
    add(body, 'coat');
    add(p => smax(Math.min(sphere(p, [0.14, 0.04, 0.57], 0.05), sphere(p, [-0.14, 0.04, 0.57], 0.05), sphere(p, [0.15, 0.04, -0.6], 0.05), sphere(p, [-0.15, 0.04, -0.6], 0.05)), -p[1], 0.005), 'hoof', [-0.3, -0.02, -0.75, 0.3, 0.14, 0.7], 0.01);
    add(p => smax(smax(cone(p, [0, 1.48, 0.62], [0, 2.02, 0.95], 0.2, 0.1) - 0.03, -(cone(p, [0, 1.48, 0.62], [0, 2.02, 0.95], 0.2, 0.1)) - 0.0 + 0.0, 0.004), (p[1] - 1.45) * -0.0 + (Math.abs(p[0]) - 0.03), 0.01), 'mane', [-0.15, 1.3, 0.4, 0.15, 2.2, 1.1], 0.01);
    if (barding) {
      add(p => smax(smax(smin(ellipsoid(p, [0, 1.25, 0], [0.3, 0.33, 0.62]), smin(ellipsoid(p, [0, 1.28, 0.5], [0.27, 0.32, 0.3]), ellipsoid(p, [0, 1.3, -0.5], [0.29, 0.31, 0.33]), 0.12), 0.12) - 0.05, hemWave(p, 0.82, 0.03, 14), 0.02), -(smin(ellipsoid(p, [0, 1.25, 0], [0.3, 0.33, 0.62]), legSDF(p), 0.06)) - 0.0 + 0.0 > 0 ? -1 : -1, 0), 'barding');
      add(p => smax(ellipsoid(p, [0, 1.56, -0.08], [0.24, 0.1, 0.28]), 1.52 - p[1], 0.02), 'saddle');
      add(p => smax(smin(cone(p, [0, 2.02, 0.98], [0, 1.66, 1.24], 0.105, 0.065), ellipsoid(p, [0, 1.87, 1.05], [0.075, 0.1, 0.12]), 0.05) - 0.02, 1.72 - p[1], 0.02), 'chanfron', [-0.2, 1.5, 0.8, 0.2, 2.2, 1.4], 0.008);
    }
    horseCache.set(key, layers);
  }
  const coat = COATS[seed % COATS.length];
  const M = { coat: U.mat(coat, 0.55), hoof: U.mat('#1a120c', 0.6), mane: U.mat(seed % COATS.length === 3 ? '#cfc6b8' : '#1e140c', 0.9), barding: surcoatMat(color, U.emblemFor(color)), saddle: U.mat('#3a2414', 0.6), chanfron: U.mat('#aeb3ba', 0.28, 0.92) };
  const g = new THREE.Group();
  for (const [geo, mk] of layers) { const m = new THREE.Mesh(geo, M[mk]); m.castShadow = m.receiveShadow = true; g.add(m); }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.45, -0.82), new THREE.Vector3(0, 1.3, -1.0), new THREE.Vector3(0, 0.95, -1.05), new THREE.Vector3(0, 0.62, -0.98)]), 12, 0.055, 8), M.mane);
  tail.castShadow = true; g.add(tail);
  if (rider) { const rd = soldierR({ ...rider, color, pose: 'ride' }); rd.position.set(0, 0.62, -0.1); g.add(rd); }
  return g;
}
