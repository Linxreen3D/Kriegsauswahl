// Freiheitsstatue als modellierte Skulptur (SDF + Surface Nets) mit Sockel und Sternfort.
import * as THREE from 'three';
import * as S from './sdf.js';
import * as Md from './models.js';
import * as TX from './textures.js';

const { sphere, ellipsoid, cone, box, smin, smax } = S;
const V = (x, y, z) => [x, y, z];

// Kupferpatina: grün mit dunklen Rinnen und helleren Graten
function patina() {
  const N = 512, nz = TX.rng(7);
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#6fae9a'; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 2500; k++) { const v = nz(); g.fillStyle = v < 0.5 ? `rgba(40,90,78,${0.03 + nz() * 0.06})` : `rgba(170,220,200,${0.03 + nz() * 0.05})`; g.beginPath(); g.ellipse(nz() * N, nz() * N, 4 + nz() * 18, 3 + nz() * 10, nz() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < 140; k++) { g.strokeStyle = `rgba(30,70,60,${0.15 + nz() * 0.2})`; g.lineWidth = 1 + nz() * 2; const x = nz() * N; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < N; y += 16) g.lineTo(x + Math.sin(y * 0.05 + k) * 6, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.5);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35, color: '#ffffff' });
}

// ---------- Skulptur (Höhe ca. 9.3 m inkl. Fackel) ----------
function statueSDF() {
  const SH_R = V(0.42, 5.55, 0.05), EL_R = V(0.6, 6.55, 0.15), HA_R = V(0.62, 7.55, 0.2);
  const SH_L = V(-0.42, 5.55, 0.0), EL_L = V(-0.62, 4.75, 0.25), HA_L = V(-0.3, 4.85, 0.6);
  const HEAD = V(0, 6.25, 0.08);
  const robe = p => {
    // Gewand: konisch, mit tiefen senkrechten Falten, die nach unten stärker werden
    const y = p[1], a = Math.atan2(p[2], p[0]);
    const t = Math.min(1, Math.max(0, y / 5.2));
    const r = 0.98 - 0.5 * Math.pow(t, 0.8) + 0.06 * Math.sin(t * Math.PI) + (t < 0.08 ? (0.08 - t) * 1.6 : 0);
    const drape = Math.max(0, 0.18 - Math.abs(y - (3.2 + p[0] * 1.6)) * 0.35); // schräger Überwurf von rechts unten nach links oben
    const folds = (Math.sin(a * 9 + y * 0.6) * 0.07 + Math.sin(a * 17 - y * 0.9) * 0.03) * (1.15 - t) + drape;
    const d = Math.hypot(p[0] * 1.0, (p[2] - 0.05) * 1.18) - (r + folds);
    return smax(smax(d, -y, 0.02), y - 5.3, 0.05);
  };
  const torso = p => smin(ellipsoid(p, V(0, 5.0, 0.05), V(0.52, 0.75, 0.4)), ellipsoid(p, V(0, 5.45, 0.08), V(0.5, 0.32, 0.36)), 0.15);
  const sash = p => smax(cone(p, V(0.45, 5.6, 0.18), V(-0.45, 4.3, 0.32), 0.09, 0.09), -torso(p) - 0.04, 0.02); // Schärpe/Toga diagonal
  const neck = p => cone(p, V(0, 5.6, 0.06), V(0, 6.05, 0.08), 0.17, 0.15);
  const head = p => {
    let d = ellipsoid(p, HEAD, V(0.22, 0.28, 0.25));
    d = smin(d, ellipsoid(p, V(HEAD[0], HEAD[1] - 0.15, HEAD[2] + 0.07), V(0.16, 0.13, 0.16)), 0.06); // Kinn
    d = smin(d, cone(p, V(0, HEAD[1] + 0.04, HEAD[2] + 0.21), V(0, HEAD[1] - 0.05, HEAD[2] + 0.27), 0.025, 0.045), 0.02); // Nase
    d = smin(d, ellipsoid(p, V(0, HEAD[1] + 0.08, HEAD[2] + 0.18), V(0.17, 0.04, 0.07)), 0.03); // Brauen
    for (const s of [-1, 1]) d = smax(d, -sphere(p, V(s * 0.085, HEAD[1] + 0.03, HEAD[2] + 0.24), 0.045), 0.02); // Augenhöhlen
    d = smin(d, ellipsoid(p, V(0, HEAD[1] - 0.02, HEAD[2] - 0.14), V(0.24, 0.24, 0.16)), 0.05); // Haar/Knoten
    return d;
  };
  const crown = p => {
    let d = smax(S.cylY(p, V(HEAD[0], HEAD[1] + 0.2, HEAD[2]), 0.25, 0.06), -S.cylY(p, V(HEAD[0], HEAD[1] + 0.2, HEAD[2]), 0.2, 0.2), 0.01);
    for (let k = 0; k < 7; k++) { // sieben Strahlen nach vorne/oben gefächert
      const a = (k - 3) * 0.42, dir = V(Math.sin(a) * 0.95, 0.55, Math.cos(a) * 0.5 + 0.15);
      const b = V(HEAD[0] + Math.sin(a) * 0.24, HEAD[1] + 0.22, HEAD[2] + Math.cos(a) * 0.15);
      d = Math.min(d, cone(p, b, V(b[0] + dir[0] * 0.55, b[1] + dir[1] * 0.55, b[2] + dir[2] * 0.55), 0.05, 0.004));
    }
    return d;
  };
  const armR = p => smin(smin(cone(p, SH_R, EL_R, 0.16, 0.13), cone(p, EL_R, HA_R, 0.13, 0.1), 0.05), sphere(p, SH_R, 0.17), 0.08);
  const sleeveR = p => smax(smax(cone(p, SH_R, EL_R, 0.24, 0.27) + Math.sin(Math.atan2(p[2] - EL_R[2], p[0] - EL_R[0]) * 7) * 0.015, -cone(p, SH_R, EL_R, 0.15, 0.12), 0.01), (p[1] - 6.35), 0.04); // weiter Ärmel hängt am Oberarm
  const armL = p => smin(cone(p, SH_L, EL_L, 0.16, 0.13), cone(p, EL_L, HA_L, 0.13, 0.1), 0.05);
  const tablet = p => box(p, V(-0.42, 4.95, 0.62), V(0.12, 0.62, 0.42), 0.02); // Tafel, gegen den Körper gehalten
  const torch = p => smin(cone(p, V(0.62, 7.45, 0.2), V(0.66, 8.25, 0.22), 0.07, 0.09), smin(cone(p, V(0.66, 8.15, 0.22), V(0.67, 8.6, 0.22), 0.13, 0.26), S.cylY(p, V(0.67, 8.62, 0.22), 0.28, 0.04), 0.03), 0.04);
  const flame = p => {
    const y = p[1] - 8.66, a = Math.atan2(p[2] - 0.22, p[0] - 0.67);
    const r = Math.max(0, 0.24 * (1 - y / 0.75)) * (1 + 0.15 * Math.sin(a * 5 + y * 8));
    return smax(Math.hypot(p[0] - 0.67, p[2] - 0.22) - r, Math.abs(y - 0.375) - 0.375, 0.03);
  };
  const feet = p => Math.min(ellipsoid(p, V(0.22, 0.12, 0.62), V(0.13, 0.1, 0.24)), ellipsoid(p, V(-0.2, 0.12, 0.55), V(0.13, 0.1, 0.22)));
  const body = p => smin(smin(smin(smin(robe(p), torso(p), 0.25), sash(p), 0.04), neck(p), 0.08), head(p), 0.06);
  const copper = p => Math.min(smin(smin(body(p), armR(p), 0.08), armL(p), 0.08), sleeveR(p), crown(p), tablet(p), feet(p));
  return { copper: p => Math.min(copper(p), torch(p)), flame };
}

export function libertyStatue() {
  const sdf = statueSDF();
  const g = new THREE.Group();
  const mat = patina();
  const body = new THREE.Mesh(S.mesh(sdf.copper, [-1.4, -0.05, -1.3, 1.4, 9.2, 1.5], 0.035, { uvScale: 0.35 }), mat);
  const flame = new THREE.Mesh(S.mesh(sdf.flame, [0.3, 8.55, -0.15, 1.05, 9.5, 0.6], 0.02), new THREE.MeshStandardMaterial({ color: '#f2c341', roughness: 0.25, metalness: 1, emissive: '#6a4a00', emissiveIntensity: 0.6 }));
  for (const m of [body, flame]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  return g;
}

// ---------- Sockel & Fort ----------
export function libertyMonument(color) {
  Md.initMaterials && Md.M.stone || Md.initMaterials();
  const M = Md.M, { m, put, boxT, cylT } = Md;
  const add = (g, o, ...a) => { g.add(put(o, ...a)); return o; };
  const g = new THREE.Group();
  const granite = M.stone.clone(); granite.color = new THREE.Color('#d6cfc2');
  const fortStone = M.stone.clone(); fortStone.color = new THREE.Color('#b9b0a0');
  // Sternfort mit elf Spitzen, Böschung und Brüstung
  const star = new THREE.Shape(); for (let k = 0; k <= 22; k++) { const a = k / 22 * Math.PI * 2, r = k % 2 ? 7.2 : 9.6; (k ? star.lineTo : star.moveTo).call(star, Math.cos(a) * r, Math.sin(a) * r); }
  const fort = new THREE.ExtrudeGeometry(star, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.6, bevelSegments: 2 });
  const uv = fort.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4);
  add(g, m(fort, fortStone), 0, 2.4, 0, Math.PI / 2);
  add(g, m(new THREE.CylinderGeometry(6.4, 6.6, 0.2, 40), Md.col('#7a8a5a', 1)), 0, 2.95, 0); // Rasen im Fort
  // Sockel: Fundament, Schaft mit Loggien, Gesims, Brüstung
  add(g, m(boxT(7, 1.4, 7, 2), granite), 0, 3.6, 0);
  for (let k = 0; k < 3; k++) add(g, m(boxT(6.4 - k * 0.6, 0.35, 6.4 - k * 0.6, 1.5), granite), 0, 4.45 + k * 0.35, 0);
  add(g, m(boxT(4.8, 6.2, 4.8, 2), granite), 0, 8.6, 0);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    for (let k = -1; k <= 1; k++) { // Loggia: drei Bögen mit Säulen
      const ox = Math.cos(a) * k * 1.2, oz = -Math.sin(a) * k * 1.2;
      const arch = new THREE.Shape(); arch.moveTo(-0.38, 0); arch.lineTo(0.38, 0); arch.lineTo(0.38, 1.3); arch.absarc(0, 1.3, 0.38, 0, Math.PI, false);
      add(g, m(new THREE.ShapeGeometry(arch), Md.col('#3a352e', 0.9)), nx * 2.42 + ox, 8.9, nz * 2.42 + oz, 0, a);
    }
    for (let k = -1.5; k <= 1.5; k += 1) add(g, m(cylT(0.13, 0.15, 2.2, 10, 1), granite), nx * 2.55 + Math.cos(a) * k * 1.2, 9.6, nz * 2.55 - Math.sin(a) * k * 1.2);
    add(g, m(boxT(1.6, 0.9, 0.15, 1), granite), nx * 2.45, 6.6, nz * 2.45, 0, a); // Wappenfeld
  }
  add(g, m(boxT(5.4, 0.5, 5.4, 1.5), granite), 0, 11.95, 0);
  add(g, m(boxT(5.0, 0.6, 5.0, 1.5), granite), 0, 12.5, 0);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; for (let j = -2; j <= 2; j++) add(g, m(boxT(0.28, 0.5, 0.28, 1), granite), Math.sin(a) * 2.35 + Math.cos(a) * j * 0.95, 13.05, Math.cos(a) * 2.35 - Math.sin(a) * j * 0.95); }
  // Statue
  const st = libertyStatue(); st.position.set(0, 12.8, 0); st.scale.setScalar(1.6); g.add(st);
  // Fahnen in Teamfarbe an den Fortspitzen
  for (const a of [Math.PI * 0.25, Math.PI * 0.75]) add(g, Md.banner(color, 4.2, 1.1, 1.8, 0.3), Math.cos(a) * 8.4, 2.9, Math.sin(a) * 8.4);
  return g;
}
