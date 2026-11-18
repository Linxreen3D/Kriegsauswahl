// Detaillierte Einheiten: Infanterie, Schützen, Reiterei – mit Rüstungen, Wappen, ordentlichen Proportionen.
import * as THREE from 'three';
import { rng } from './textures.js';

// ---------- Materialien ----------
const cache = new Map();
const std = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const mat = (c, rough = 0.8, metal = 0, extra = {}) => std(`m${c}${rough}${metal}${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, ...extra }));

function canvasTex(N, draw, srgb = true, repeat = false) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  draw(c.getContext('2d'), N);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// Kettenhemd: Ringmuster als Farbe + Relief
const chainmail = () => std('chain', () => {
  const draw = (g, N, normal) => {
    g.fillStyle = normal ? 'rgb(128,128,255)' : '#3e4247'; g.fillRect(0, 0, N, N);
    const s = 8;
    for (let y = 0; y < N + s; y += s * 0.75) for (let x = 0; x < N + s; x += s) {
      const ox = (Math.round(y / (s * 0.75)) % 2) * s / 2;
      g.lineWidth = 2;
      if (normal) { g.strokeStyle = 'rgb(170,170,255)'; g.beginPath(); g.arc(x + ox, y, s * 0.42, Math.PI, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgb(90,90,255)'; g.beginPath(); g.arc(x + ox, y, s * 0.42, 0, Math.PI); g.stroke(); }
      else { g.strokeStyle = '#8a9098'; g.beginPath(); g.arc(x + ox, y, s * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.strokeStyle = '#3a3e44'; g.beginPath(); g.arc(x + ox, y, s * 0.42, 0.1, Math.PI - 0.1); g.stroke(); }
    }
  };
  const map = canvasTex(128, (g, N) => draw(g, N, false), true, true), nm = canvasTex(128, (g, N) => draw(g, N, true), false, true);
  map.repeat.set(3, 3); nm.repeat.set(3, 3);
  return new THREE.MeshStandardMaterial({ map, normalMap: nm, roughness: 0.5, metalness: 0.7 });
});
const plate = () => mat('#a9aeb5', 0.32, 0.9);
const darkPlate = () => mat('#6d7279', 0.35, 0.85);
const bronze = () => mat('#b88a46', 0.3, 0.9);
const gold = () => mat('#e0b24a', 0.25, 0.95);
const leather = () => mat('#5a3a22', 0.75);
const darkLeather = () => mat('#2f2118', 0.8);
const wood = () => mat('#6b4a2e', 0.7);
const steel = () => mat('#d9dde2', 0.2, 0.95);
// Wappen: Teamfarbe + Wappenbild
const EMBLEMS = ['lion', 'cross', 'chevron', 'eagle', 'stripes'];
const TEAM_EMBLEM = { '#1f4fa8': 'fleur', '#b8261c': 'cross', '#1f7a3a': 'eagle', '#d8a020': 'chevron' };
const emblemFor = c => TEAM_EMBLEM[c] || ['fleur', 'cross', 'eagle', 'chevron'][(c.charCodeAt(2) + c.charCodeAt(4)) % 4];
function heraldry(color, emblem = 'lion', shape = 'kite') {
  return std(`her${color}${emblem}${shape}`, () => {
    const tex = canvasTex(256, (g, N) => {
      g.fillStyle = color; g.fillRect(0, 0, N, N);
      // Stoffstruktur
      for (let k = 0; k < 2000; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(Math.random() * N, Math.random() * N, 2, 2); }
      g.fillStyle = '#f2d27a'; g.strokeStyle = '#3a2a10'; g.lineWidth = 4;
      const c = N / 2;
      if (emblem === 'cross') { g.fillRect(c - 22, 30, 44, N - 60); g.fillRect(40, c - 40, N - 80, 44); }
      else if (emblem === 'chevron') { g.beginPath(); g.moveTo(20, c + 60); g.lineTo(c, c - 40); g.lineTo(N - 20, c + 60); g.lineTo(N - 20, c + 110); g.lineTo(c, c + 10); g.lineTo(20, c + 110); g.fill(); }
      else if (emblem === 'stripes') { for (let k = 0; k < 4; k++) g.fillRect(0, 30 + k * 60, N, 26); }
      else if (emblem === 'eagle') { g.beginPath(); g.moveTo(c, 50); g.lineTo(c + 20, 90); g.lineTo(c + 100, 70); g.lineTo(c + 40, 130); g.lineTo(c + 50, 200); g.lineTo(c, 160); g.lineTo(c - 50, 200); g.lineTo(c - 40, 130); g.lineTo(c - 100, 70); g.lineTo(c - 20, 90); g.closePath(); g.fill(); g.stroke(); }
      else if (emblem === 'fleur') { // Lilie
        g.lineWidth = 5;
        const petal = (dir) => { g.beginPath(); g.moveTo(c, c + 10); g.bezierCurveTo(c + dir * 20, c - 20, c + dir * 95, c - 30, c + dir * 75, c + 30); g.bezierCurveTo(c + dir * 60, c + 5, c + dir * 30, c + 20, c + dir * 18, c + 40); g.closePath(); g.fill(); g.stroke(); };
        g.beginPath(); g.moveTo(c, 28); g.bezierCurveTo(c + 40, 70, c + 30, 130, c, c + 40); g.bezierCurveTo(c - 30, 130, c - 40, 70, c, 28); g.fill(); g.stroke();
        petal(1); petal(-1);
        g.fillRect(c - 55, c + 40, 110, 22); g.strokeRect(c - 55, c + 40, 110, 22);
        g.beginPath(); g.moveTo(c - 14, c + 62); g.lineTo(c + 14, c + 62); g.lineTo(c, c + 105); g.closePath(); g.fill(); g.stroke();
      }
      else { // Löwe (stilisiert)
        g.beginPath(); g.ellipse(c, c + 10, 46, 62, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.arc(c + 6, c - 62, 30, 0, Math.PI * 2); g.fill(); g.stroke();
        for (const [x, y, a] of [[c - 40, c + 70, 0.4], [c + 40, c + 70, -0.4], [c - 50, c - 10, -0.8], [c + 52, c - 18, 0.9]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-9, -2, 18, 52); g.strokeRect(-9, -2, 18, 52); g.restore(); }
        g.beginPath(); g.moveTo(c + 40, c + 30); g.quadraticCurveTo(c + 110, c + 20, c + 90, c - 50); g.lineWidth = 10; g.strokeStyle = '#f2d27a'; g.stroke();
      }
      // Rand
      g.strokeStyle = '#d8b04a'; g.lineWidth = 14; g.strokeRect(0, 0, N, N);
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  });
}
const cloth = (c) => mat(c, 0.9, 0, { side: THREE.DoubleSide });
// nur das Wappenbild (transparent), als Aufnäher
function emblemOnly(emblem) {
  return std('eo' + emblem, () => {
    const h = heraldry('#000000', emblem).map.image; // gleiche Zeichnung
    const tex = canvasTex(256, (g, N) => {
      g.drawImage(h, 0, 0);
      const d = g.getImageData(0, 0, N, N);
      for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] + d.data[i + 1] + d.data[i + 2]; if (v < 120) d.data[i + 3] = 0; }
      g.putImageData(d, 0, 0);
      g.clearRect(0, 0, N, 12); g.clearRect(0, N - 12, N, 12); g.clearRect(0, 0, 12, N); g.clearRect(N - 12, 0, 12, N);
    });
    return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  });
}

// ---------- Geometrie-Helfer ----------
const M = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, s) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s) Array.isArray(s) ? o.scale.set(...s) : o.scale.setScalar(s); return o; };
const cap = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, len, 4, seg);
const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// Gliedmaße zwischen zwei Punkten
function limb(a, b, r1, r2, m, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1); g.translate(0, len / 2, 0);
  const o = M(g, m); o.position.copy(a); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
function joint(p, r, m) { const o = M(new THREE.SphereGeometry(r, 10, 8), m); o.position.copy(p); return o; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Kopf ----------
const SKINS = ['#e8b996', '#d29c76', '#a8714c', '#7a4e32', '#f0caa8'];
const HAIR = ['#2a1d14', '#4a3018', '#6a4a24', '#1a1612', '#8a6a3a', '#a07848'];
function head(r, era, helmet, team, opts) {
  const g = new THREE.Group();
  const skin = mat(SKINS[Math.floor(r() * SKINS.length)], 0.65);
  const h = M(new THREE.SphereGeometry(0.105, 16, 12), skin); h.scale.set(0.9, 1.08, 0.98); g.add(h);
  g.add(at(M(new THREE.ConeGeometry(0.018, 0.045, 6), skin), 0, -0.005, 0.1, Math.PI / 2 + 0.3));
  for (const s of [-1, 1]) {
    g.add(at(M(new THREE.SphereGeometry(0.012, 6, 4), mat('#1a1410', 0.4)), s * 0.035, 0.02, 0.088));
    g.add(at(M(new THREE.SphereGeometry(0.022, 6, 5), skin), s * 0.095, 0, 0, 0, 0, 0, [0.5, 1, 0.8]));
  }
  const hairC = mat(HAIR[Math.floor(r() * HAIR.length)], 0.9);
  if (r() < 0.55) g.add(at(M(new THREE.SphereGeometry(0.075, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4), hairC), 0, -0.04, 0.03, 0.15, 0, 0, [1.1, 1.1, 1])); // Bart
  if (!helmet) g.add(at(M(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairC), 0, 0.012, -0.008, -0.15));
  if (helmet) {
    if (era === 0) g.add(at(M(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#7a5a3a', 1)), 0, 0.02, 0, -0.1));
    else if (era <= 2) { // Bronzehelm mit Kamm
      g.add(at(M(new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze()), 0, 0.015, 0));
      for (const s of [-1, 1]) g.add(at(M(new THREE.BoxGeometry(0.025, 0.09, 0.06), bronze()), s * 0.1, -0.04, 0.05, 0, s * 0.3));
      const crest = new THREE.Shape(); crest.moveTo(-0.12, 0); crest.quadraticCurveTo(0, 0.12, 0.13, 0.02); crest.lineTo(0.12, -0.02); crest.quadraticCurveTo(0, 0.07, -0.11, -0.03);
      g.add(at(M(new THREE.ExtrudeGeometry(crest, { depth: 0.025, bevelEnabled: false }), cloth(team)), -0.012, 0.11, 0, 0, Math.PI / 2));
    } else if (era === 3) {
      if (opts.greatHelm) { // Topfhelm
        g.add(at(M(new THREE.CylinderGeometry(0.118, 0.125, 0.25, 16), plate()), 0, 0.01, 0));
        g.add(at(M(new THREE.SphereGeometry(0.118, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), plate()), 0, 0.135, 0, 0, 0, 0, [1, 0.5, 1]));
        g.add(at(M(new THREE.BoxGeometry(0.17, 0.018, 0.02), mat('#0a0a0a')), 0, 0.03, 0.118));
        g.add(at(M(new THREE.BoxGeometry(0.018, 0.12, 0.02), gold()), 0, -0.01, 0.123));
      } else { // Nasalhelm mit Kettenhaube
        g.add(at(M(new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), plate()), 0, 0.02, 0, 0, 0, 0, [1, 1.25, 1]));
        g.add(at(M(new THREE.BoxGeometry(0.02, 0.08, 0.02), plate()), 0, -0.01, 0.112));
        g.add(at(M(new THREE.CylinderGeometry(0.115, 0.13, 0.16, 14, 1, true, Math.PI * 0.25, Math.PI * 1.5), chainmail()), 0, -0.06, 0));
      }
    } else if (era === 4) { // Morion
      g.add(at(M(new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), plate()), 0, 0.04, 0));
      g.add(at(M(new THREE.TorusGeometry(0.14, 0.02, 6, 20), plate()), 0, 0.04, 0, Math.PI / 2, 0, 0, [1, 1.3, 1]));
      g.add(at(M(new THREE.BoxGeometry(0.012, 0.09, 0.22), plate()), 0, 0.14, 0));
      g.add(at(M(new THREE.ConeGeometry(0.02, 0.1, 6), cloth(team)), 0, 0.2, -0.05, -0.6));
    } else if (era === 5) { // Tschako
      g.add(at(M(new THREE.CylinderGeometry(0.11, 0.1, 0.2, 14), mat('#1a1a22', 0.6)), 0, 0.1, 0));
      g.add(at(M(new THREE.BoxGeometry(0.16, 0.015, 0.08), mat('#0a0a0a', 0.3)), 0, 0.01, 0.1, -0.2));
      g.add(at(M(new THREE.SphereGeometry(0.025, 8, 6), cloth(team)), 0, 0.22, 0.06));
      g.add(at(M(new THREE.CircleGeometry(0.03, 10), gold()), 0, 0.12, 0.105));
    } else { // Stahlhelm
      g.add(at(M(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('#4f5836', 0.7)), 0, 0.02, 0));
      g.add(at(M(new THREE.TorusGeometry(0.128, 0.012, 6, 20), mat('#4f5836', 0.7)), 0, -0.005, 0, Math.PI / 2));
    }
  }
  return g;
}

// ---------- Waffen ----------
function sword(len = 0.85) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.024, 0); s.lineTo(0.024, 0); s.lineTo(0.018, len * 0.85); s.lineTo(0, len); s.lineTo(-0.018, len * 0.85); s.lineTo(-0.024, 0);
  const bl = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); bl.translate(0, 0.08, -0.004);
  g.add(M(bl, steel()));
  g.add(at(M(new THREE.BoxGeometry(0.2, 0.025, 0.03), gold()), 0, 0.07, 0));
  g.add(at(M(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 6), darkLeather()), 0, 0, 0));
  g.add(at(M(new THREE.SphereGeometry(0.026, 8, 6), gold()), 0, -0.075, 0));
  return g;
}
function spear(len = 2.2, pike = false) {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(0.016, 0.019, len, 6), wood()), 0, len * 0.35, 0));
  const tip = new THREE.Shape(); tip.moveTo(0, 0); tip.quadraticCurveTo(0.045, 0.08, 0, 0.26); tip.quadraticCurveTo(-0.045, 0.08, 0, 0);
  const tg = new THREE.ExtrudeGeometry(tip, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  g.add(at(M(tg, steel()), 0, len * 0.85 - 0.02, -0.005));
  if (!pike) g.add(at(M(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6), darkPlate()), 0, len * 0.84, 0));
  return g;
}
function bow() {
  const g = new THREE.Group();
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16 - 0.5; pts.push(V(0, t * 1.3, -Math.cos(t * Math.PI) * 0.22 + Math.pow(Math.abs(t) * 2, 4) * 0.06)); }
  g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 6), mat('#4a2e18', 0.6)));
  g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pts[0], V(0, 0, 0.05), pts[16]]), 4, 0.004, 3), mat('#e8e0c8', 0.9)));
  return g;
}
function musket(len = 1.25, modern = false) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.3, 0.03); s.lineTo(len, 0.035); s.lineTo(len, 0.06); s.lineTo(0.28, 0.07); s.lineTo(0.05, 0.13); s.lineTo(-0.02, 0.1);
  const st = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 }); st.translate(0, 0, -0.02);
  g.add(M(st, modern ? mat('#3b3326', 0.6) : mat('#6a4424', 0.55)));
  g.add(at(M(new THREE.CylinderGeometry(0.013, 0.013, len * 0.75, 8), mat('#2a2a2c', 0.3, 0.9)), len * 0.62, 0.075, 0, 0, 0, Math.PI / 2));
  if (modern) g.add(at(M(new THREE.BoxGeometry(0.06, 0.12, 0.03), mat('#1e1e1e', 0.4, 0.6)), 0.38, 0.0, 0));
  return g;
}
function shield(team, era, emblem) {
  const g = new THREE.Group();
  if (era >= 4) { // Spätes Mittelalter: Dreiecksschild mit Wappen
    const s = new THREE.Shape(); s.moveTo(-0.24, 0.32); s.quadraticCurveTo(0, 0.4, 0.24, 0.32); s.quadraticCurveTo(0.26, -0.1, 0, -0.42); s.quadraticCurveTo(-0.26, -0.1, -0.24, 0.32);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.27) / 0.54, (p.getY(i) + 0.45) / 0.88);
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.pow(p.getX(i) / 0.27, 2) * 0.05);
    geo.computeVertexNormals();
    g.add(M(geo, heraldry(team, emblem)));
  } else if (era === 2) { // Eisenzeit: hoher ovaler Schild
    const s = new THREE.Shape(); s.absellipse(0, 0, 0.27, 0.52, 0, Math.PI * 2, false, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
    const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.28) / 0.56, (p.getY(i) + 0.53) / 1.06);
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.pow(p.getX(i) / 0.28, 2) * 0.09);
    geo.computeVertexNormals();
    g.add(M(geo, heraldry(team, emblem)));
    g.add(at(M(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkPlate()), 0, 0, 0.04, Math.PI / 2));
    g.add(at(M(new THREE.BoxGeometry(0.03, 0.9, 0.02), darkPlate()), 0, 0, 0.035));
  } else { // Bronzezeit / Frühes Mittelalter: Rundschild
    const early = era === 3;
    g.add(at(M(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), heraldry(team, early ? 'stripes' : 'chevron')), 0, 0, 0, Math.PI / 2));
    g.add(at(M(new THREE.TorusGeometry(0.32, 0.018, 6, 28), early ? darkPlate() : bronze()), 0, 0, 0.01));
    g.add(at(M(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), early ? darkPlate() : bronze()), 0, 0, 0.03, Math.PI / 2));
  }
  return g;
}

// ---------- Soldat ----------
// pose: idle | walk | attack | aim | charge | ride
export function soldier({ color = '#c33', era = 3, weapon = 'sword', seed = 1, pose = 'idle', shield: hasShield = false, helmet = true, carry = null, cape = false, emblem } = {}) {
  const r = rng(seed * 7 + 3), g = new THREE.Group();
  emblem = emblem || emblemFor(color);
  const armored = era === 3 || (era === 4 && weapon !== 'musket' && weapon !== 'bow');
  const tunic = era >= 6 ? mat('#56603e', 0.9) : era === 5 ? cloth(color) : cloth(color);
  const trouserM = era >= 6 ? mat('#4f5838', 0.9) : era === 5 ? mat('#e8e4d8', 0.9) : mat(['#4a3d33', '#3c3630', '#56483a'][Math.floor(r() * 3)], 0.95);
  const bootM = darkLeather();
  const sc = 1 + (r() - 0.5) * 0.06; // leichte Größenvariation

  // Beinstellung
  const walk = pose === 'walk' ? 0.35 : pose === 'charge' ? 0.5 : 0;
  const ride = pose === 'ride';
  const hipY = 0.9;
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = V(s * 0.09, hipY, 0);
    let knee, ankle;
    if (ride) { knee = V(s * 0.24, hipY - 0.05, 0.3); ankle = V(s * 0.27, hipY - 0.45, 0.25); }
    else {
      const a = s * walk;
      knee = V(s * 0.1, hipY - 0.44 * Math.cos(a), 0.44 * Math.sin(a));
      ankle = V(s * 0.1, knee.y - 0.42 * Math.cos(a * 0.6), knee.z + 0.42 * Math.sin(-a * 0.2));
    }
    const legM = armored && era === 3 ? chainmail() : trouserM;
    legs.push(limb(hip, knee, 0.085, 0.066, legM), joint(knee, 0.064, legM), limb(knee, ankle, 0.063, 0.048, era >= 5 ? trouserM : bootM));
    if (armored) legs.push(limb(knee.clone().add(V(0, -0.02, 0.02)), ankle.clone().add(V(0, 0.08, 0.02)), 0.064, 0.052, darkPlate()));
    const boot = M(new THREE.BoxGeometry(0.09, 0.075, 0.2), bootM); boot.position.copy(ankle).add(V(0, -0.02, 0.045)); boot.rotation.x = ride ? 0.4 : 0;
    legs.push(boot);
  }
  legs.forEach(l => g.add(l));
  // Becken & Rumpf
  g.add(at(M(new THREE.SphereGeometry(0.16, 14, 10), trouserM), 0, hipY, 0, 0, 0, 0, [1, 0.6, 0.78]));
  const torso = lathe([[0.001, 0], [0.155, 0.02], [0.15, 0.17], [0.178, 0.36], [0.19, 0.48], [0.165, 0.57], [0.07, 0.63], [0.001, 0.64]]);
  const body = new THREE.Group(); body.position.y = hipY; g.add(body);
  const torsoM = armored ? (era === 3 ? chainmail() : plate()) : era === 2 && weapon !== 'bow' ? bronze() : tunic;
  body.add(at(M(torso, torsoM), 0, 0, 0, 0, 0, 0, [1, 1, 0.74]));
  // Wappenrock / Uniform
  if (era === 3 || (era <= 2 && torsoM !== tunic)) {
    const coat = lathe([[0.155, -0.32], [0.16, 0], [0.152, 0.15], [0.178, 0.33], [0.19, 0.43], [0.13, 0.5]], 16);
    const cm = M(coat, cloth(color)); cm.scale.set(1.03, 1, 0.78); body.add(cm);
    body.add(at(M(new THREE.TorusGeometry(0.16, 0.012, 4, 24), gold()), 0, -0.31, 0, Math.PI / 2, 0, 0, [1.03, 0.78, 1]));
    if (era === 3) for (const z of [1, -1]) body.add(at(M(new THREE.PlaneGeometry(0.2, 0.24), emblemOnly(emblem)), 0, 0.2, z * 0.138, 0, z > 0 ? 0 : Math.PI, 0));
    // offene Seiten (Schlitze) durch dunkle Linien
  }
  if (era === 0) body.add(at(M(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), mat('#7a5a3a', 1)), 0, 0.42, 0, 0, 0, 0, [1.15, 0.9, 0.9])); // Fellumhang
  if (era <= 2 || era === 4) { // Rock / Pteryges
    const skirt = new THREE.CylinderGeometry(0.17, 0.22, 0.3, 16, 1, true);
    const sp = skirt.attributes.position; for (let i = 0; i < sp.count; i++) if (sp.getY(i) < 0) sp.setY(i, sp.getY(i) + Math.sin(Math.atan2(sp.getZ(i), sp.getX(i)) * 8) * 0.02);
    skirt.computeVertexNormals();
    body.add(at(M(skirt, era === 2 ? leather() : tunic), 0, -0.07, 0, 0, 0, 0, [1, 1, 0.8]));
  }
  if (era >= 5) { // Kreuzgurte
    for (const s of [-1, 1]) { const b = M(new THREE.BoxGeometry(0.04, 0.55, 0.012), mat(era === 5 ? '#f2eee4' : '#3a3424', 0.8)); at(b, 0, 0.27, 0.13, 0, 0, s * 0.55); body.add(b); const b2 = b.clone(); b2.position.z = -0.13; body.add(b2); }
    body.add(at(M(new THREE.BoxGeometry(0.33, 0.25, 0.25), tunic), 0, -0.08, 0));
  }
  body.add(at(M(new THREE.TorusGeometry(0.155, 0.022, 6, 20), darkLeather()), 0, 0.02, 0, Math.PI / 2, 0, 0, [1, 0.76, 1]));
  body.add(at(M(new THREE.BoxGeometry(0.05, 0.045, 0.02), gold()), 0, 0.02, 0.12));
  // Kopf
  body.add(at(M(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), mat(SKINS[0], 0.7)), 0, 0.65, 0));
  const hd = head(r, era, helmet, color, { greatHelm: weapon === 'sword' && hasShield && r() < 0.5 });
  hd.position.set(0, 0.78, 0.005); hd.rotation.y = (r() - 0.5) * 0.4; body.add(hd);
  // Schultern
  for (const s of [-1, 1]) {
    if (armored) body.add(at(M(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), plate()), s * 0.2, 0.54, 0, 0, 0, s * -0.5, [1.1, 0.9, 1.1]));
    else if (era === 5) body.add(at(M(new THREE.BoxGeometry(0.1, 0.02, 0.1), gold()), s * 0.18, 0.52, 0));
  }
  // Arme (Schulter -> Ellbogen -> Hand)
  const sh = s => V(s * 0.21, hipY + 0.53, 0);
  let rE, rH, lE, lH;
  if (pose === 'attack') { rE = V(0.29, 1.62, -0.05); rH = V(0.22, 1.8, 0.12); }
  else if (pose === 'aim' && (weapon === 'bow')) { rE = V(0.22, 1.42, -0.12); rH = V(0.1, 1.48, -0.05); }
  else if (pose === 'aim') { rE = V(0.2, 1.25, 0.15); rH = V(0.06, 1.38, 0.18); }
  else if (pose === 'charge' || ride) { rE = V(0.28, 1.2, 0.12); rH = V(0.25, 1.18, 0.35); }
  else { rE = V(0.26, 1.15, 0.03); rH = V(0.25, 0.92, 0.12); }
  if (pose === 'aim' && weapon === 'bow') { lE = V(-0.33, 1.44, 0.2); lH = V(-0.3, 1.48, 0.5); }
  else if (pose === 'aim') { lE = V(-0.15, 1.2, 0.3); lH = V(-0.02, 1.33, 0.45); }
  else if (hasShield) { lE = V(-0.3, 1.13, 0.12); lH = V(-0.24, 1.15, 0.3); }
  else { lE = V(-0.26, 1.15, 0.02); lH = V(-0.25, 0.92, 0.08); }
  const armM = armored ? (era === 3 ? chainmail() : plate()) : era === 2 ? mat(SKINS[1], 0.7) : tunic;
  const skinM = mat(SKINS[1], 0.7), gloveM = armored ? darkPlate() : leather();
  for (const [s, E, Hd] of [[1, rE, rH], [-1, lE, lH]]) {
    g.add(limb(sh(s), E, 0.066, 0.054, armM)); g.add(joint(E, 0.054, armM));
    g.add(limb(E, Hd, 0.052, 0.043, armored ? darkPlate() : era <= 2 ? skinM : armM));
    g.add(joint(Hd, 0.042, gloveM));
  }
  // Waffe in der rechten Hand
  const hand = new THREE.Group(); hand.position.copy(rH); g.add(hand);
  if (weapon === 'sword') { const w = sword(); w.rotation.x = pose === 'attack' ? -0.6 : pose === 'charge' || ride ? 1.2 : 0.3; hand.add(w); g.add(at(M(new THREE.CylinderGeometry(0.03, 0.025, 0.75, 8), darkLeather()), -0.17, 0.82, -0.05, 0.25, 0, 0.15)); }
  if (weapon === 'axe') { const a = new THREE.Group(); a.add(at(M(new THREE.CylinderGeometry(0.018, 0.02, 0.85, 6), wood()), 0, 0.3, 0)); const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.quadraticCurveTo(0.14, 0.02, 0.17, 0.12); hs.quadraticCurveTo(0.12, 0.07, 0.16, -0.12); hs.quadraticCurveTo(0.14, -0.02, 0, -0.05); a.add(at(M(new THREE.ExtrudeGeometry(hs, { depth: 0.012, bevelEnabled: false }), steel()), 0.01, 0.68, -0.006)); a.rotation.x = pose === 'attack' ? -0.5 : 0.3; hand.add(a); }
  if (weapon === 'club') { const c = M(new THREE.CylinderGeometry(0.06, 0.025, 0.65, 7), wood()); c.position.y = 0.28; const cl = new THREE.Group(); cl.add(c); cl.rotation.x = pose === 'attack' ? -0.5 : 0.3; hand.add(cl); }
  if (weapon === 'spear' || weapon === 'pike') { const sp = spear(weapon === 'pike' ? 3.6 : 2.3, weapon === 'pike'); sp.rotation.x = pose === 'attack' || pose === 'charge' || ride ? 1.35 : 0.08; hand.add(sp); }
  if (weapon === 'tool') { const t = new THREE.Group(); t.add(at(M(new THREE.CylinderGeometry(0.016, 0.018, 0.8, 6), wood()), 0, 0.3, 0)); t.add(at(M(new THREE.BoxGeometry(0.03, 0.06, 0.22), darkPlate()), 0, 0.68, 0.06)); t.rotation.x = pose === 'attack' ? -0.6 : 0.3; hand.add(t); }
  if (weapon === 'musket' || weapon === 'rifle') { const mu = musket(weapon === 'rifle' ? 1.05 : 1.3, weapon === 'rifle'); if (pose === 'aim') { mu.rotation.y = -Math.PI / 2; mu.position.set(0.04, -0.06, -0.25); } else { mu.rotation.set(0, -Math.PI / 2, Math.PI / 2 - 0.15); mu.position.set(0, -0.15, 0); } hand.add(mu); }
  if (weapon === 'bow') {
    const b = bow(); b.position.copy(lH); b.rotation.set(0, pose === 'aim' ? 0 : 0.2, pose === 'aim' ? 0.15 : 0.1); if (pose !== 'aim') b.position.add(V(0, 0.15, 0)); g.add(b);
    const q = new THREE.Group(); q.add(M(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 10, 1, true), leather())); for (let k = 0; k < 7; k++) { q.add(at(M(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 3), wood()), (k % 3 - 1) * 0.02, 0.35, (Math.floor(k / 3) - 1) * 0.02)); q.add(at(M(new THREE.BoxGeometry(0.004, 0.06, 0.03), mat('#e8e0d0')), (k % 3 - 1) * 0.02, 0.48, (Math.floor(k / 3) - 1) * 0.02)); }
    at(q, 0.1, hipY + 0.32, -0.15, 0.3, 0, -0.25); g.add(q);
  }
  if (hasShield) { const s = shield(color, era, emblem); s.position.copy(lH).add(V(-0.05, 0, 0.03)); s.rotation.y = -0.25; g.add(s); }
  if (cape || (era === 3 && ride)) {
    const cg = new THREE.PlaneGeometry(0.42, 0.95, 4, 8); const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (0.475 - p.getY(i)) / 0.95; p.setZ(i, -t * t * 0.22 + Math.sin(p.getX(i) * 20) * 0.015 * t); p.setX(i, p.getX(i) * (1 + t * 0.35)); }
    cg.computeVertexNormals(); g.add(at(M(cg, cloth(color)), 0, hipY + 0.05, -0.17, -0.08));
  }
  if (carry) {
    const c = { wood: () => at(M(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), wood()), 0, 1.38, -0.2, 0, 0, Math.PI / 2), food: () => at(M(new THREE.SphereGeometry(0.15, 10, 8), mat('#c9a35a', 1)), 0, 1.3, -0.22), gold: () => at(M(new THREE.DodecahedronGeometry(0.12), gold()), 0, 1.3, -0.22), stone: () => at(M(new THREE.DodecahedronGeometry(0.14), mat('#9a958e')), 0, 1.3, -0.22) }[carry];
    g.add(c());
  }
  g.scale.setScalar(sc);
  return g;
}

// ---------- Pferd ----------
const COATS = ['#5a3a24', '#3a2618', '#7a5536', '#d6cfc4', '#2a201a', '#8a6a48'];
export function horse(seed = 1, coat) {
  const r = rng(seed * 13 + 1), g = new THREE.Group();
  const c = mat(coat || COATS[Math.floor(r() * COATS.length)], 0.55);
  const dark = mat('#1a120c', 0.8);
  g.add(at(M(new THREE.SphereGeometry(1, 20, 14), c), 0, 1.3, 0, 0, 0, 0, [0.3, 0.34, 0.68]));      // Rumpf
  g.add(at(M(new THREE.SphereGeometry(1, 16, 12), c), 0, 1.36, 0.45, 0, 0, 0, [0.29, 0.34, 0.33]));  // Brust
  g.add(at(M(new THREE.SphereGeometry(1, 16, 12), c), 0, 1.38, -0.48, 0, 0, 0, [0.3, 0.32, 0.34])); // Kruppe
  g.add(limb(V(0, 1.45, 0.55), V(0, 1.95, 0.88), 0.17, 0.11, c, 12));                                 // Hals
  const hd = new THREE.Group(); hd.position.set(0, 1.98, 0.92); hd.rotation.x = 0.95; g.add(hd);
  hd.add(at(M(new THREE.CylinderGeometry(0.07, 0.1, 0.44, 12), c), 0, 0.18, 0, 0, 0, 0, [0.8, 1, 1]));
  hd.add(at(M(new THREE.SphereGeometry(0.075, 10, 8), c), 0, 0.4, 0.01, 0, 0, 0, [0.85, 0.9, 1]));
  for (const s of [-1, 1]) { hd.add(at(M(new THREE.ConeGeometry(0.03, 0.11, 6), c), s * 0.05, -0.05, -0.05, -0.5)); hd.add(at(M(new THREE.SphereGeometry(0.014, 6, 4), mat('#0a0a0a', 0.2)), s * 0.07, 0.06, 0.05)); }
  // Mähne
  for (let k = 0; k < 8; k++) { const t = k / 7; g.add(at(M(new THREE.BoxGeometry(0.035, 0.14, 0.07), dark), 0, 1.55 + t * 0.42, 0.5 + t * 0.35, -0.6 - t * 0.2)); }
  // Beine mit Gelenken
  for (const [x, z, front] of [[-0.14, 0.45, true], [0.14, 0.45, true], [-0.14, -0.5, false], [0.14, -0.5, false]]) {
    const ph = r() * 0.3 - 0.15;
    const top = V(x, 1.15, z), knee = V(x, 0.62, z + (front ? 0.02 : -0.1) + ph), fet = V(x, 0.18, z + (front ? 0 : 0.02) + ph * 1.5);
    g.add(limb(top, knee, front ? 0.1 : 0.12, 0.06, c, 10)); g.add(joint(knee, 0.055, c)); g.add(limb(knee, fet, 0.045, 0.04, c, 8));
    g.add(at(M(new THREE.CylinderGeometry(0.05, 0.062, 0.12, 10), dark), fet.x, 0.06, fet.z));
  }
  // Schweif
  g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 1.45, -0.8), V(0, 1.3, -0.98), V(0, 0.9, -1.02), V(0, 0.65, -0.95)]), 10, 0.05, 6), dark));
  return g;
}
export function cavalry({ color, era = 3, seed = 1, weapon, emblem }) {
  const g = new THREE.Group(), r = rng(seed);
  emblem = emblem || emblemFor(color);
  g.add(horse(seed));
  // Sattel + Schabracke mit Wappen
  g.add(at(M(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkLeather()), 0, 1.6, -0.05, 0, 0, 0, [0.9, 0.35, 1.2]));
  if (era >= 2 && era <= 4) {
    const cp = new THREE.CylinderGeometry(0.35, 0.42, 1.25, 20, 6, true, -Math.PI / 2 - 1.3, Math.PI + 2.6);
    const p = cp.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < 0) p.setY(i, p.getY(i) + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 9) * 0.03); }
    cp.rotateX(Math.PI / 2); cp.computeVertexNormals();
    g.add(at(M(cp, heraldry(color, emblem)), 0, 1.35, -0.02, 0, 0, Math.PI, [1, 1.1, 0.82]));
    if (era === 3) g.add(at(M(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), plate()), 0, 2.02, 0.97, 0.95, 0, 0, [0.7, 1.4, 0.9]));
  }
  // Zügel
  g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.07, 1.82, 1.15), V(-0.1, 1.75, 0.6), V(-0.05, 1.85, 0.25)]), 6, 0.008, 3), darkLeather()));
  g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.07, 1.82, 1.15), V(0.1, 1.75, 0.6), V(0.05, 1.85, 0.25)]), 6, 0.008, 3), darkLeather()));
  const rider = soldier({ color, era, weapon: weapon || (era === 3 ? 'spear' : 'sword'), seed: seed + 50, pose: 'ride', shield: era >= 2 && era <= 3, emblem });
  rider.position.set(0, 0.72, -0.08); g.add(rider);
  if (era === 3 && r() < 0.3) { const ban = new THREE.Group(); ban.add(at(M(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 5), wood()), 0, 0.7, 0)); ban.add(at(M(new THREE.PlaneGeometry(0.3, 0.6), heraldry(color, emblem)), 0.16, 1.15, 0)); at(ban, 0.3, 2.4, -0.2); g.add(ban); }
  return g;
}
export function standardBearer(color, era = 3, seed = 1) {
  const g = soldier({ color, era, weapon: 'none', seed, pose: 'idle' });
  const pole = new THREE.Group();
  pole.add(at(M(new THREE.CylinderGeometry(0.02, 0.022, 3.2, 6), wood()), 0, 1.6, 0));
  pole.add(at(M(new THREE.ConeGeometry(0.04, 0.14, 6), gold()), 0, 3.25, 0));
  pole.add(at(M(new THREE.BoxGeometry(0.7, 0.03, 0.03), gold()), 0, 3.05, 0.03));
  const pg = new THREE.PlaneGeometry(0.66, 1.0, 6, 6); const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 4 + p.getX(i) * 3) * 0.04);
  pg.computeVertexNormals();
  pole.add(at(M(pg, heraldry(color, emblemFor(color))), 0, 2.53, 0.04));
  pole.position.set(0.25, 0.3, 0.12); g.add(pole);
  return g;
}
export { heraldry, EMBLEMS, sword, spear, bow, musket, shield, emblemFor, chainmail, plate, darkPlate, gold, steel, leather, darkLeather, wood, cloth, mat, canvasTex, std };
