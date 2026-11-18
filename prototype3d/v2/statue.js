// Freiheitsstatue nach Referenzfotos: modellierte Skulptur (SDF + Surface Nets) mit Granitsockel und Sternfort.
// Maßstab: 1 Einheit ≈ 5 m. Statue (Ferse bis Flammenspitze) 9.3, Sockelturm 6.05, Stufenfundament 2.0, Fort 3.0.
// Blickrichtung +z. Rechte Hand der Statue (Fackel) liegt bei -x, die Tafel bei +x.
import * as THREE from 'three';
import * as S from './sdf.js';
import * as Md from './models.js';
import * as TX from './textures.js';

const { sphere, ellipsoid, cone, box, cylY, smin, smax } = S;
const V = (x, y, z) => [x, y, z];
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const interp = (T, y) => {
  if (y <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const [y0, a] = T[i - 1], [y1, b] = T[i]; return a + (b - a) * (y - y0) / (y1 - y0); }
  return T[T.length - 1][1];
};
// Abstand Punkt–Strecke in der x/y-Ebene
const seg2 = (x, y, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)); return Math.hypot(x - ax - vx * t, y - ay - vy * t); };

// ---------- Skulptur ----------
// Silhouette des Gewands (halbe Breite / halbe Tiefe über der Höhe), aus dem Frontalfoto abgemessen
const WX = [[0, 1.08], [0.3, 1.02], [1.2, 0.97], [2.4, 0.98], [3.4, 1.0], [4.3, 0.98], [5.0, 0.95], [5.5, 0.9]];
const DZ = [[0, 0.74], [0.3, 0.68], [1.5, 0.6], [3, 0.6], [4.2, 0.64], [4.9, 0.63], [5.5, 0.55]];

function robe(p) {
  const [x, y, z] = p, w = interp(WX, y), dd = interp(DZ, y), zz = z - 0.02;
  let d = (Math.hypot(x / w, zz / dd) - 1) * Math.min(w, dd);
  const a = Math.atan2(zz / dd, x / w), fw = sstep(-0.25, 0.35, zz / dd); // fw: Vorderseite
  // Saum des Mantels: diagonal von links oben (rechte Hüfte) nach rechts unten, rechts mit herabhängendem Zipfel
  const hemF = 2.5 - 1.0 * x - 0.5 * Math.exp(-(((x - 0.9) / 0.2) ** 2)), hemB = 1.7 - 0.35 * x;
  const hem = hemB + (hemF - hemB) * fw;
  const inM = sstep(hem - 0.015, hem + 0.015, y);
  // Untergewand (Chiton): dichte senkrechte Plisseefalten, unten über den Füßen gestaucht
  const pleat = (0.045 * Math.sin(a * 15 + Math.sin(y * 1.7) * 0.5) + 0.02 * Math.sin(a * 31 + y)) * (1 + 0.5 * sstep(0.6, 0, y));
  // Mantel: Falten strahlen von der linken Schulter aus (vorne), hinten lange senkrechte Bahnen
  const th = Math.atan2(y - 5.75, x - 0.55), rr = Math.hypot(y - 5.75, x - 0.55);
  const mf = (0.06 * Math.sin(th * 15 + rr * 0.8) + 0.025 * Math.sin(th * 33 + y)) * sstep(0.3, 1.2, rr);
  const mb = 0.05 * Math.sin(a * 9 + y * 0.25) + 0.02 * Math.sin(a * 21);
  const mantle = 0.13 + mb + (mf - mb) * fw;
  // aufgerollte Mantelkante quer über die Brust und Saumwulst
  const ridge = 0.09 * Math.max(0, 1 - (seg2(x, y, 0.62, 5.7, -0.9, 3.8) / 0.14) ** 2) * fw;
  const hemRoll = 0.03 * sstep(hem - 0.02, hem + 0.12, y) * sstep(hem + 0.35, hem + 0.12, y); // leicht verdickte Saumkante
  const bust = (0.07 * Math.exp(-((x - 0.3) ** 2 + (y - 4.85) ** 2) / 0.05) + 0.06 * Math.exp(-((x + 0.32) ** 2 + (y - 4.8) ** 2) / 0.05)) * fw;
  d -= (1 - inM) * pleat + inM * mantle + ridge + hemRoll + bust;
  d = smax(d, -y, 0.02);
  d = smax(d, y - 5.6, 0.25);
  // Schultern, über der linken Schulter liegender Mantelbausch
  d = smin(d, ellipsoid(p, V(0, 5.5, 0.0), V(0.92, 0.4, 0.56)), 0.25);
  d = smin(d, ellipsoid(p, V(0.58, 5.52, 0.08), V(0.4, 0.3, 0.5)) - 0.02 * Math.sin(Math.atan2(p[2], p[0] - 0.58) * 7), 0.12);
  // weiter Ärmel des Fackelarms hängt seitlich herab
  const sl = ellipsoid(p, V(-0.95, 5.3, 0.05), V(0.33, 0.95, 0.42)) - 0.03 * Math.sin(Math.atan2(p[2] - 0.05, p[0] + 0.95) * 9 + p[1] * 0.6);
  d = smin(d, sl, 0.15);
  // Zehen unter dem Saum
  d = smin(d, Math.min(ellipsoid(p, V(-0.3, 0.06, 0.66), V(0.12, 0.07, 0.17)), ellipsoid(p, V(0.34, 0.06, 0.62), V(0.11, 0.07, 0.15))), 0.04);
  return d;
}

// Fackelarm mit Fackel (ohne Flamme)
const SH_R = V(-0.78, 5.8, 0.02), EL_R = V(-0.98, 6.95, 0.08), HA_R = V(-1.1, 7.95, 0.1), TX0 = -1.12, TZ0 = 0.1;
function armR(p) {
  let d = smin(cone(p, SH_R, EL_R, 0.2, 0.16), cone(p, EL_R, HA_R, 0.155, 0.115), 0.06);
  // am Oberarm zusammengeschobener Ärmel
  const cuff = cone(p, SH_R, V(-0.88, 6.45, 0.05), 0.32, 0.22) - 0.03 * Math.sin(Math.atan2(p[2] - 0.04, p[0] + 0.85) * 8 + p[1] * 4);
  d = smin(d, cuff, 0.08);
  d = smin(d, ellipsoid(p, V(-1.1, 8.0, 0.1), V(0.15, 0.17, 0.15)), 0.05); // Faust
  for (let i = 0; i < 4; i++) { const y = 7.9 + i * 0.065; d = smin(d, cone(p, V(-1.24, y, 0.16), V(-1.0, y, 0.22), 0.038, 0.034), 0.015); }
  // Fackel: Schaft mit Ringen, Kelch, Balkon mit Geländer
  const c = (y, r, h) => cylY(p, V(TX0, y, TZ0), r, h);
  let t = cone(p, V(TX0, 7.75, TZ0), V(TX0, 8.5, TZ0), 0.085, 0.11);
  t = Math.min(t, c(8.2, 0.13, 0.025), c(8.48, 0.145, 0.03));
  t = smin(t, cone(p, V(TX0, 8.5, TZ0), V(TX0, 8.68, TZ0), 0.12, 0.3), 0.04);
  t = Math.min(t, c(8.72, 0.4, 0.03));
  const ang = Math.atan2(p[2] - TZ0, p[0] - TX0), u = ((ang / (Math.PI * 2) * 18) % 1 + 1) % 1;
  let rail = smax(c(8.8, 0.39, 0.055), -c(8.8, 0.36, 0.2), 0.005);
  rail = smax(rail, -Math.max(Math.abs(u - 0.5) * 0.131 - 0.035, Math.abs(p[1] - 8.79) - 0.025), 0.005);
  rail = Math.min(rail, smax(c(8.86, 0.4, 0.014), -c(8.86, 0.355, 0.2), 0.004));
  return Math.min(d, t, rail);
}
function flame(p) {
  const t = (p[1] - 8.8) / 0.52, a = Math.atan2(p[2] - TZ0, p[0] - TX0);
  const r = 0.2 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t))), 0.7) * (1 - 0.35 * clamp(t)) * (1 + 0.18 * Math.sin(a * 5 + t * 6));
  return smax(Math.hypot(p[0] - TX0, p[2] - TZ0) - r, Math.abs(t - 0.5) * 0.52 - 0.26, 0.02);
}

// Kopf mit Gesicht, Haar und Strahlenkrone
const CC = V(0, 6.66, 0.04);
const RAYS = [-90, -60, -30, 0, 30, 60, 90].map((az, k) => {
  const f = az * Math.PI / 180, e = [-5, 27, 41, 55, 41, 27, -5][k] * Math.PI / 180;
  const b = V(CC[0] + Math.sin(f) * 0.3, CC[1] + 0.1, CC[2] + Math.cos(f) * 0.3);
  const L = 0.78, dir = [Math.sin(f) * Math.cos(e), Math.sin(e), Math.cos(f) * Math.cos(e)];
  return [b, V(b[0] + dir[0] * L, b[1] + dir[1] * L, b[2] + dir[2] * L)];
});
function head(p) {
  let d = ellipsoid(p, V(0, 6.43, 0.04), V(0.25, 0.29, 0.28)); // Schädel
  d = smin(d, ellipsoid(p, V(0, 6.27, 0.14), V(0.2, 0.26, 0.21)), 0.08); // Gesicht
  d = smin(d, ellipsoid(p, V(0, 6.07, 0.22), V(0.1, 0.075, 0.09)), 0.07); // Kinn
  d = smin(d, cone(p, V(0, 6.42, 0.33), V(0, 6.27, 0.385), 0.03, 0.042), 0.03); // gerade Nase
  d = smin(d, ellipsoid(p, V(0, 6.445, 0.3), V(0.17, 0.035, 0.06)), 0.04); // Brauenbogen
  for (const s of [-1, 1]) {
    d = smax(d, -ellipsoid(p, V(s * 0.085, 6.39, 0.34), V(0.055, 0.035, 0.05)), 0.025); // Augenhöhlen
    d = smin(d, sphere(p, V(s * 0.085, 6.39, 0.29), 0.038), 0.01); // Augäpfel
  }
  d = smin(d, smin(ellipsoid(p, V(0, 6.19, 0.335), V(0.065, 0.02, 0.03)), ellipsoid(p, V(0, 6.155, 0.325), V(0.055, 0.022, 0.03)), 0.015), 0.02); // Lippen
  d = smax(d, -box(p, V(0, 6.172, 0.36), V(0.05, 0.004, 0.03)), 0.006);
  d = smin(d, cone(p, V(0, 5.7, 0.0), V(0, 6.15, 0.08), 0.2, 0.16), 0.08); // Hals
  // Haar: gewellte Kappe (Gesicht freigeschnitten), Seitenlocken, Knoten im Nacken
  const wave = 0.015 * Math.sin(Math.atan2(p[2], p[0]) * 14 + p[1] * 10);
  let h = ellipsoid(p, V(0, 6.42, -0.02), V(0.29, 0.31, 0.29)) - wave;
  h = smax(h, -Math.max(0.13 - p[2], p[1] - 6.55), 0.04);
  for (const s of [-1, 1]) h = smin(h, cone(p, V(s * 0.22, 6.4, 0.05), V(s * 0.25, 5.95, -0.02), 0.09, 0.07) - wave, 0.05);
  h = smin(h, ellipsoid(p, V(0, 6.25, -0.22), V(0.16, 0.14, 0.12)), 0.05);
  h = smin(h, ellipsoid(p, V(0, 5.95, -0.18), V(0.22, 0.25, 0.12)) - wave, 0.06);
  d = smin(d, h, 0.03);
  // Diadem mit Fensterreihe, Ränder, sieben Strahlen
  let band = smax(cylY(p, CC, 0.31, 0.085), -cylY(p, CC, 0.255, 0.2), 0.01);
  const ang = Math.atan2(p[0], p[2] - CC[2]), rr = Math.hypot(p[0], p[2] - CC[2]);
  if (Math.abs(ang) < 1.5) {
    const u = ((ang / 0.2 + 0.5) % 1 + 1) % 1;
    band = smax(band, -Math.max(Math.abs(u - 0.5) * 0.062 - 0.016, Math.abs(p[1] - 6.665) - 0.04, 0.29 - rr), 0.004);
  }
  band = Math.min(band, smax(cylY(p, V(0, 6.76, CC[2]), 0.34, 0.02), -cylY(p, V(0, 6.76, CC[2]), 0.26, 0.2), 0.005));
  band = Math.min(band, smax(cylY(p, V(0, 6.575, CC[2]), 0.325, 0.016), -cylY(p, V(0, 6.575, CC[2]), 0.25, 0.2), 0.005));
  for (const [a, b] of RAYS) band = Math.min(band, cone(p, a, b, 0.055, 0.006));
  return Math.min(d, band);
}

// Linker Arm mit Tafel "JULY IV MDCCLXXVI" (lokales Tafelsystem: gedreht und gekippt)
const TC = V(1.3, 4.25, 0.32), TRZ = -0.33, TRY = 0.35;
const cz = Math.cos(TRZ), sz = Math.sin(TRZ), cy = Math.cos(TRY), sy = Math.sin(TRY);
const toLocal = p => { // Ry(-TRY) dann Rz(-TRZ)
  const x = p[0] - TC[0], y = p[1] - TC[1], z = p[2] - TC[2];
  const x1 = cy * x - sy * z, z1 = sy * x + cy * z;
  return [cz * x1 + sz * y, -sz * x1 + cz * y, z1];
};
const toWorld = l => { const x1 = cz * l[0] - sz * l[1], y = sz * l[0] + cz * l[1]; return V(TC[0] + cy * x1 + sy * l[2], TC[1] + y, TC[2] - sy * x1 + cy * l[2]); };
const WRIST = toWorld(V(0.56, -0.02, -0.02)), ELB_L = V(1.02, 3.85, 0.1), SH_L = V(0.8, 5.5, 0.0);
function tablet(p) {
  const l = toLocal(p);
  let d = box(l, V(0, 0, 0), V(0.42, 0.72, 0.1), 0.02);
  d = smax(d, -box(l, V(0, 0, 0.11), V(0.34, 0.63, 0.025), 0.005), 0.008); // vertieftes Feld mit Rahmen
  for (const ly of [0.28, 0.08, -0.12]) d = smax(d, -box(l, V(0, ly, 0.085), V(0.24 - Math.abs(ly) * 0.2, 0.022, 0.02)), 0.006); // Inschriftzeilen
  // Hand umgreift die rechte Tafelkante
  let h = ellipsoid(l, V(0.48, -0.02, 0.0), V(0.1, 0.16, 0.14));
  for (let i = 0; i < 4; i++) { const y = 0.12 - i * 0.075; h = smin(h, cone(l, V(0.46, y, 0.12), V(0.3, y - 0.02, 0.135), 0.036, 0.032), 0.015); }
  h = smin(h, cone(l, V(0.5, 0.02, -0.1), V(0.36, 0.12, -0.13), 0.04, 0.035), 0.02); // Daumen hinten
  // Unterarm und Oberarm im Mantelärmel
  let arm = cone(p, ELB_L, WRIST, 0.2, 0.11) - 0.025 * Math.sin(Math.atan2(p[2] - 0.1, p[0] - 1.1) * 7 + p[1] * 3);
  arm = smin(arm, cone(p, SH_L, ELB_L, 0.24, 0.22), 0.1);
  return Math.min(d, smin(h, arm, 0.05));
}

const ALL = p => Math.min(robe(p), armR(p), head(p), tablet(p));

// Kupferpatina: Farbe pro Vertex aus Umgebungsverdeckung (Faltentiefen dunkel, Grate hell) plus feine Schlieren
function patinaMat() {
  const N = 256, nz = TX.rng(11);
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#eef4f0'; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 120; k++) { g.strokeStyle = `rgba(60,110,95,${0.05 + nz() * 0.08})`; g.lineWidth = 1 + nz() * 3; const x = nz() * N; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= N; y += 8) g.lineTo(x + Math.sin(y * 0.04 + k) * 3, y); g.stroke(); }
  for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(255,255,255,${0.05 + nz() * 0.1})`; g.fillRect(nz() * N, nz() * N, 1 + nz() * 4, 1 + nz() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.62, metalness: 0.12 });
}
function shadeAO(geo) {
  const P = geo.attributes.position.array, Nn = geo.attributes.normal.array, col = new Float32Array(P.length);
  const lo = new THREE.Color('#2f5e53'), hi = new THREE.Color('#9ad3bb'), q = [0, 0, 0], c = new THREE.Color();
  for (let i = 0; i < P.length; i += 3) {
    let occ = 0;
    for (const [dd, w] of [[0.05, 0.5], [0.13, 0.3], [0.3, 0.2]]) {
      q[0] = P[i] + Nn[i] * dd; q[1] = P[i + 1] + Nn[i + 1] * dd; q[2] = P[i + 2] + Nn[i + 2] * dd;
      occ += w * clamp((dd - ALL(q)) / dd);
    }
    const ao = clamp(1 - occ * 1.6 + Nn[i + 1] * 0.08 + Math.sin(P[i] * 13 + P[i + 1] * 2.1) * 0.03);
    c.copy(lo).lerp(hi, ao); col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

let cache = null;
function statueGeometries() {
  if (cache) return cache;
  cache = {
    robe: shadeAO(S.mesh(robe, [-1.45, -0.03, -0.95, 1.35, 6.05, 1.0], 0.03, { uvScale: 0.5 })),
    arm: shadeAO(S.mesh(armR, [-1.6, 5.5, -0.45, -0.45, 8.95, 0.6], 0.02, { uvScale: 0.5, center: [TX0, TZ0] })),
    head: shadeAO(S.mesh(head, [-1.15, 5.65, -0.5, 1.15, 7.45, 1.0], 0.017, { uvScale: 0.5 })),
    tablet: shadeAO(S.mesh(tablet, [0.35, 3.2, -0.55, 2.25, 5.65, 1.05], 0.018, { uv: 'planar', uvScale: 0.5 })),
    flame: S.mesh(flame, [TX0 - 0.3, 8.75, TZ0 - 0.3, TX0 + 0.3, 9.4, TZ0 + 0.3], 0.015),
  };
  return cache;
}

export function libertyStatue() {
  const G = statueGeometries(), g = new THREE.Group(), mat = patinaMat();
  for (const k of ['robe', 'arm', 'head', 'tablet']) g.add(new THREE.Mesh(G[k], mat));
  g.add(new THREE.Mesh(G.flame, new THREE.MeshStandardMaterial({ color: '#f4c542', roughness: 0.22, metalness: 1, emissive: '#7a5200', emissiveIntensity: 0.7 })));
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}

// ---------- Sockel & Fort ----------
export function libertyMonument(color) {
  Md.initMaterials && Md.M.stone || Md.initMaterials();
  const M = Md.M, { m, put, boxT, cylT } = Md;
  const add = (g, o, ...a) => { g.add(put(o, ...a)); return o; };
  const g = new THREE.Group();
  const rust = M.stone.clone(); rust.color = new THREE.Color('#ffc49a');      // Granitquader, rötlich-beige
  const ashlar = Md.col('#c99f80', 0.85);                                      // glatter Granit
  const fortStone = M.stone.clone(); fortStone.color = new THREE.Color('#e4ddd0');
  const footStone = M.stone.clone(); footStone.color = new THREE.Color('#f6e6cc');
  const dark = Md.col('#2b2622', 0.95), copper = Md.col('#79b29c', 0.6, 0.1);

  // Sternfort (Fort Wood), elf Spitzen
  const FH = 3.0;
  const starShape = (ro, ri) => { const s = new THREE.Shape(); for (let k = 0; k <= 22; k++) { const a = k / 22 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? ri : ro; (k ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); } return s; };
  const ext = (shape, depth) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35, uv.getY(i) * 0.35); return geo; };
  add(g, m(ext(starShape(10.3, 7.7), FH), fortStone), 0, FH, 0, Math.PI / 2);
  add(g, m(ext(starShape(10.45, 7.85), 0.22), Md.col('#a0988a', 0.95)), 0, FH + 0.12, 0, Math.PI / 2); // Abdeckplatten
  add(g, m(new THREE.CylinderGeometry(7.2, 7.2, 0.06, 44), Md.col('#bdb6a6', 0.95)), 0, FH + 0.15, 0); // gepflasterter Hof
  for (let k = 0; k < 11; k++) { // Tore/Scharten an den inneren Ecken
    const a = (k + 0.5) / 11 * Math.PI * 2 + Math.PI / 2, r = 7.75;
    add(g, m(new THREE.BoxGeometry(0.5, 0.9, 0.1), dark), Math.cos(a) * r, 0.9, Math.sin(a) * r, 0, Math.PI / 2 - a);
  }

  // Stufenfundament mit Eingängen
  let y = FH + 0.12;
  add(g, m(boxT(11.6, 1.0, 11.6, 3), footStone), 0, y + 0.5, 0);
  add(g, m(boxT(8.2, 1.0, 8.2, 3), footStone), 0, y + 1.5, 0);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    add(g, m(new THREE.BoxGeometry(1.1, 0.75, 0.06), dark), nx * 4.11, y + 1.4, nz * 4.11, 0, a);
    for (const o of [-3.6, 3.6]) add(g, m(new THREE.BoxGeometry(0.5, 0.45, 0.06), dark), nx * 5.81 + nz * o, y + 0.5, nz * 5.81 - nx * o, 0, a);
  }
  y += 2.0;

  // Sockelturm (Fassade einmal bauen, viermal drehen)
  const T0 = y, face = new THREE.Group();
  const shaft = m(cylT(2.15 * Math.SQRT2, 2.45 * Math.SQRT2, 2.2, 4, 2), rust); shaft.rotation.y = Math.PI / 4; shaft.position.y = T0 + 1.7; g.add(shaft);
  add(g, m(boxT(5.4, 0.45, 5.4, 2), ashlar), 0, T0 + 0.225, 0);
  add(g, m(boxT(5.1, 0.17, 5.1, 2), ashlar), 0, T0 + 0.53, 0);
  const lean = Math.atan(0.3 / 2.2);
  add(face, m(new THREE.BoxGeometry(1.5, 1.55, 0.12), ashlar), 0, T0 + 1.7, 2.32, -lean); // Mittelfeld
  add(face, m(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), ashlar), 0, T0 + 1.8, 2.4, Math.PI / 2 - lean); // Medaillon
  add(g, m(boxT(4.6, 0.26, 4.6, 2), ashlar), 0, T0 + 2.93, 0); // Gurtgesims
  // Loggia: dunkle Nischen, Eckpfeiler aus Bossenquadern, vier dorische Säulen je Seite
  add(g, m(new THREE.BoxGeometry(3.0, 1.4, 3.0), dark), 0, T0 + 3.76, 0);
  add(g, m(boxT(3.5, 0.12, 3.5, 2), ashlar), 0, T0 + 3.12, 0);
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(g, m(boxT(0.62, 1.4, 0.62, 1), rust), px * 1.43, T0 + 3.76, pz * 1.43);
  for (const cx of [-0.88, -0.3, 0.3, 0.88]) {
    add(face, m(new THREE.CylinderGeometry(0.1, 0.12, 1.16, 12), ashlar), cx, T0 + 3.76, 1.55);
    add(face, m(new THREE.BoxGeometry(0.3, 0.08, 0.3), ashlar), cx, T0 + 4.38, 1.55);
    add(face, m(new THREE.BoxGeometry(0.3, 0.08, 0.3), ashlar), cx, T0 + 3.14, 1.55);
  }
  add(g, m(boxT(3.65, 0.3, 3.65, 2), ashlar), 0, T0 + 4.6, 0); // Gebälk
  add(g, m(boxT(3.85, 0.09, 3.85, 2), ashlar), 0, T0 + 4.79, 0);
  // Balkon: Brüstung mit Pfosten
  for (let k = 0; k < 6; k++) add(face, m(boxT(0.28, 0.42, 0.28, 1), ashlar), -1.75 + k * 0.7, T0 + 5.04, 1.8);
  add(face, m(new THREE.BoxGeometry(3.6, 0.13, 0.16), ashlar), 0, T0 + 4.9, 1.8);
  add(face, m(new THREE.BoxGeometry(3.6, 0.08, 0.2), ashlar), 0, T0 + 5.27, 1.8);
  // Attika mit kleinem Fenster, Kranzgesims
  add(g, m(boxT(2.95, 0.95, 2.95, 1.5), rust), 0, T0 + 5.31, 0);
  add(face, m(new THREE.BoxGeometry(0.34, 0.26, 0.05), dark), 0, T0 + 5.35, 1.48);
  add(face, m(new THREE.BoxGeometry(0.9, 0.12, 0.1), ashlar), 0, T0 + 5.55, 1.5);
  add(g, m(boxT(3.2, 0.18, 3.2, 2), ashlar), 0, T0 + 5.87, 0);
  add(g, m(boxT(2.9, 0.14, 2.9, 2), ashlar), 0, T0 + 6.02, 0);
  for (let s = 0; s < 4; s++) { const f = s ? face.clone() : face; f.rotation.y = s * Math.PI / 2; g.add(f); }

  // Kupferplinthe und Statue
  y = T0 + 6.09;
  add(g, m(new THREE.BoxGeometry(2.6, 0.35, 2.6), copper), 0, y + 0.175, 0);
  const st = libertyStatue(); st.position.set(0, y + 0.35, 0); g.add(st);

  // Fahnen in Teamfarbe an zwei Fortspitzen
  for (const a of [Math.PI * 0.5 + Math.PI * 2 / 11 * 2, Math.PI * 0.5 - Math.PI * 2 / 11 * 2]) add(g, Md.banner(color, 3.2, 1.1, 1.8, 0.3), Math.cos(a) * 9.4, FH + 0.2, Math.sin(a) * 9.4);
  return g;
}
