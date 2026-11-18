// Prozedurale, kachelbare Texturen (Farbe + Normal) – keine externen Dateien nötig.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// kachelbares Wertrauschen
function tileNoise(seed, period) {
  const r = rng(seed), v = new Float32Array(period * period);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y % period + period) % period) * period + ((x % period + period) % period)];
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}
function fbm(seed, N, base, oct = 5) {
  const ns = []; for (let o = 0; o < oct; o++) ns.push(tileNoise(seed + o * 17, base << o));
  return (x, y) => { let t = 0, a = 1, m = 0; for (let o = 0; o < oct; o++) { const f = (base << o) / N; t += ns[o](x * f, y * f) * a; m += a; a *= 0.5; } return t / m; };
}
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function makeCanvas(N) { const c = document.createElement('canvas'); c.width = c.height = N; return c; }
function normalFromHeight(h, N, strength = 2) {
  const c = makeCanvas(N), g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const hl = h[y * N + (x - 1 + N) % N], hr = h[y * N + (x + 1) % N], hu = h[((y - 1 + N) % N) * N + x], hd = h[((y + 1) % N) * N + x];
    let nx = (hl - hr) * strength, ny = (hu - hd) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// generischer Generator: pixel(x,y) -> [r,g,b,height]
function build(N, pixel, nStrength = 2) {
  const c = makeCanvas(N), g = c.getContext('2d'), img = g.createImageData(N, N), h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const p = pixel(x, y), i = (y * N + x) * 4;
    img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255;
    h[y * N + x] = p[3];
  }
  g.putImageData(img, 0, 0);
  return { map: toTex(c), normalMap: toTex(normalFromHeight(h, N, nStrength), false), canvas: c, height: h };
}
// Striche auf einen bestehenden Canvas (für Gras/Stroh)
function strokes(tex, N, count, seed, colorFn, lenFn, angleFn, width = 1) {
  const g = tex.canvas.getContext('2d'), r = rng(seed);
  for (let k = 0; k < count; k++) {
    const x = r() * N, y = r() * N, len = lenFn(r), a = angleFn(r);
    g.strokeStyle = colorFn(r); g.lineWidth = width * (0.6 + r() * 0.8);
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  tex.map.needsUpdate = true;
}

export function grassTex(N = 512) {
  const f = fbm(1, N, 4, 5), f2 = fbm(2, N, 16, 3);
  const dark = hex('#5a7030'), light = hex('#8fa24a'), dry = hex('#b4a65a');
  const t = build(N, (x, y) => {
    const v = f(x, y), w = f2(x, y);
    let c = mix(dark, light, v);
    c = mix(c, dry, Math.max(0, (w - 0.55) * 1.6));
    const n = (Math.random() - 0.5) * 18;
    return [c[0] + n, c[1] + n, c[2] + n * 0.5, v * 0.6 + Math.random() * 0.4];
  }, 1.5);
  strokes(t, N, 9000, 3, r => `rgba(${60 + r() * 60},${100 + r() * 70},${30 + r() * 30},0.55)`, r => 3 + r() * 6, r => -Math.PI / 2 + (r() - 0.5) * 1.2, 1);
  return t;
}
export function dirtTex(N = 512) {
  const f = fbm(5, N, 6, 5), r = rng(6);
  const a = hex('#6e5233'), b = hex('#9a7a52');
  const t = build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); const n = (Math.random() - 0.5) * 22; return [c[0] + n, c[1] + n, c[2] + n, v]; }, 3);
  const g = t.canvas.getContext('2d');
  for (let k = 0; k < 900; k++) { // Kiesel
    const x = r() * N, y = r() * N, s = 1 + r() * 3.5;
    g.fillStyle = `rgba(${120 + r() * 70},${100 + r() * 60},${80 + r() * 50},0.9)`;
    g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 0.8, y + 0.8, s, s * 0.6, 0, 0, Math.PI); g.fill();
  }
  t.map.needsUpdate = true;
  return t;
}
export function rockTex(N = 512) {
  const f = fbm(9, N, 4, 6), cr = fbm(10, N, 12, 3);
  const a = hex('#6b6660'), b = hex('#a39d94');
  return build(N, (x, y) => { const v = f(x, y), c2 = Math.abs(cr(x, y) - 0.5); let c = mix(a, b, v); if (c2 < 0.02) c = mix(c, [40, 38, 35], 0.6); return [c[0], c[1], c[2], v - (c2 < 0.02 ? 0.3 : 0)]; }, 4);
}
export function sandTex(N = 256) {
  const f = fbm(12, N, 8, 4), a = hex('#c7b07a'), b = hex('#e3d2a2');
  return build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); const n = (Math.random() - 0.5) * 16; return [c[0] + n, c[1] + n, c[2] + n, v + Math.random() * 0.2]; }, 1.5);
}
export function stoneWallTex(N = 512, tint = '#a59d90') {
  const r = rng(20), f = fbm(21, N, 16, 4), base = hex(tint);
  const rows = 8, rh = N / rows;
  const seams = []; for (let k = 0; k < rows; k++) { const s = [0]; let x = 0; while (x < N) { x += N / 5 * (0.6 + r() * 0.8); s.push(Math.min(N, x)); } s[s.length - 1] = N; seams.push(s); }
  const shade = []; for (let k = 0; k < 200; k++) shade.push(0.8 + r() * 0.35);
  return build(N, (x, y) => {
    const row = Math.floor(y / rh), yy = y - row * rh, s = seams[row];
    let j = 1; while (s[j] < x) j++;
    const x0 = s[j - 1], x1 = s[j], edge = Math.min(x - x0, x1 - x, yy, rh - yy);
    const mortar = edge < 3;
    const sh = shade[(row * 13 + j) % 200], v = f(x, y);
    const c = mortar ? [70, 66, 60] : base.map(ch => ch * sh * (0.85 + v * 0.3));
    const hgt = mortar ? 0 : Math.min(1, edge / 8) * (0.7 + v * 0.3);
    return [c[0], c[1], c[2], hgt];
  }, 5);
}
export function roofTileTex(N = 512, tint = '#a8452f') {
  const r = rng(30), f = fbm(31, N, 8, 3), base = hex(tint);
  const rows = 10, cols = 8, rh = N / rows, cw = N / cols;
  const sh = []; for (let k = 0; k < rows * cols; k++) sh.push(0.75 + r() * 0.45);
  return build(N, (x, y) => {
    const row = Math.floor(y / rh), off = row % 2 ? cw / 2 : 0, col = Math.floor(((x + off) % N) / cw);
    const u = (((x + off) % N) - col * cw) / cw, v = (y - row * rh) / rh;
    const curve = Math.sin(u * Math.PI);
    const k = sh[row * cols + col] * (0.75 + curve * 0.35) * (0.9 + f(x, y) * 0.2) * (v > 0.85 ? 0.55 : 1);
    return [base[0] * k, base[1] * k, base[2] * k, curve * 0.8 + v * 0.4];
  }, 4);
}
export function thatchTex(N = 512) {
  const f = fbm(40, N, 8, 3), a = hex('#8a6a34'), b = hex('#c9a35a');
  const t = build(N, (x, y) => { const v = f(x, y), band = (y % 64) / 64; const c = mix(a, b, v * 0.7 + band * 0.3); return [c[0], c[1], c[2], band]; }, 3);
  strokes(t, N, 14000, 41, r => `rgba(${170 + r() * 60},${130 + r() * 50},${60 + r() * 30},0.6)`, r => 10 + r() * 18, r => Math.PI / 2 + (r() - 0.5) * 0.3, 1.2);
  strokes(t, N, 4000, 42, r => `rgba(${70 + r() * 30},${50 + r() * 20},${20},0.5)`, r => 8 + r() * 12, r => Math.PI / 2 + (r() - 0.5) * 0.3, 1);
  return t;
}
export function plankTex(N = 512, tint = '#7a5634') {
  const r = rng(50), f = fbm(51, N, 4, 4), base = hex(tint), boards = 6, bw = N / boards;
  const sh = []; for (let k = 0; k < boards; k++) sh.push(0.8 + r() * 0.35);
  return build(N, (x, y) => {
    const b = Math.floor(x / bw), u = x - b * bw, gap = u < 2 || u > bw - 2;
    const grain = Math.sin((x * 0.3 + f(x * 0.3, y) * 40)) * 0.5 + 0.5;
    const k = gap ? 0.35 : sh[b] * (0.8 + grain * 0.2) * (0.9 + f(x, y) * 0.2);
    return [base[0] * k, base[1] * k, base[2] * k, gap ? 0 : 0.5 + grain * 0.2];
  }, 3);
}
export function plasterTex(N = 256) {
  const f = fbm(60, N, 6, 5), a = hex('#d9cdb3'), b = hex('#efe6d2');
  return build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); const n = (Math.random() - 0.5) * 8; return [c[0] + n, c[1] + n, c[2] + n, v * 0.5]; }, 1.5);
}
export function barkTex(N = 256) {
  const f = fbm(70, N, 8, 4), a = hex('#3e2d1e'), b = hex('#6e5338');
  return build(N, (x, y) => { const v = f(x * 3 % N, y * 0.4); const c = mix(a, b, v); return [c[0], c[1], c[2], v]; }, 4);
}
// Blätterbüschel mit Alpha
export function leafTex(seed = 80, palette = ['#2f5a22', '#3f7a2c', '#5a9a3a', '#7aa844'], N = 256) {
  const c = makeCanvas(N), g = c.getContext('2d'), r = rng(seed);
  for (let k = 0; k < 520; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * N * 0.44;
    const x = N / 2 + Math.cos(a) * d, y = N / 2 + Math.sin(a) * d, s = 5 + r() * 8;
    g.fillStyle = palette[Math.floor(r() * palette.length)];
    g.globalAlpha = 0.95;
    g.beginPath(); g.ellipse(x, y, s, s * 0.45, r() * Math.PI, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(x + 1, y + 1.5, s * 0.8, s * 0.3, r() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  const t = toTex(c, true, false);
  return t;
}
export function needleTex(seed = 90, N = 256) {
  const c = makeCanvas(N), g = c.getContext('2d'), r = rng(seed);
  // gezackte Grundform
  g.fillStyle = '#244a26'; g.beginPath(); g.moveTo(N / 2, 0);
  for (let k = 0; k <= 16; k++) { const y = k / 16 * N * 0.97, w = (y / N) * N * 0.46 + (k % 2) * 8; g.lineTo(N / 2 + w, y); }
  for (let k = 16; k >= 0; k--) { const y = k / 16 * N * 0.97, w = (y / N) * N * 0.46 + (k % 2) * 8; g.lineTo(N / 2 - w, y); }
  g.fill();
  for (let k = 0; k < 2600; k++) {
    const x = N * 0.1 + r() * N * 0.8, y = r() * N * 0.95;
    const w = (y / N) * N * 0.45;
    if (Math.abs(x - N / 2) > w) continue;
    g.strokeStyle = ['#1f4524', '#2a5a2e', '#376a34'][Math.floor(r() * 3)];
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < N / 2 ? -6 : 6), y + 5); g.stroke();
  }
  return toTex(c, true, false);
}
export function grassCardTex(N = 128) {
  const c = makeCanvas(N), g = c.getContext('2d'), r = rng(95);
  for (let k = 0; k < 70; k++) {
    const x = 6 + r() * (N - 12), h = N * (0.4 + r() * 0.6);
    const grd = g.createLinearGradient(0, N, 0, N - h);
    grd.addColorStop(0, '#3a4f1e'); grd.addColorStop(1, ['#8aa445', '#a8ac52', '#7a9a3e'][k % 3]);
    g.fillStyle = grd;
    const bend = (r() - 0.5) * 18;
    g.beginPath(); g.moveTo(x - 2, N); g.quadraticCurveTo(x + bend * 0.4, N - h * 0.5, x + bend, N - h); g.quadraticCurveTo(x + bend * 0.4 + 1, N - h * 0.5, x + 2, N); g.fill();
  }
  return toTex(c, true, false);
}
export function clothTex(N = 128) {
  const f = fbm(99, N, 8, 3);
  return build(N, (x, y) => { const v = 200 + f(x, y) * 55 + ((x + y) % 4 < 2 ? 6 : -6); return [v, v, v, f(x, y)]; }, 1);
}
export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', N = 128) {
  const c = makeCanvas(N), g = c.getContext('2d');
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  return toTex(c, true, false);
}
export function waterNormals(N = 256) {
  const f = fbm(111, N, 8, 5), h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = f(x, y);
  const t = toTex(normalFromHeight(h, N, 6), false);
  return t;
}

export function cobbleTex(N = 512) {
  const r = rng(140), pts = [];
  for (let k = 0; k < 260; k++) pts.push([r() * N, r() * N, 0.75 + r() * 0.35]);
  const f = fbm(141, N, 16, 3);
  return build(N, (x, y) => {
    let d1 = 1e9, d2 = 1e9, sh = 1;
    for (const [px, py, s] of pts) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const d = (x - px - ox) ** 2 + (y - py - oy) ** 2;
      if (d < d1) { d2 = d1; d1 = d; sh = s; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    const gap = edge < 3;
    const v = f(x, y);
    const base = gap ? [62, 56, 48] : [128 * sh + v * 30, 120 * sh + v * 26, 108 * sh + v * 22];
    return [base[0], base[1], base[2], gap ? 0 : Math.min(1, edge / 10)];
  }, 5);
}

// ---------- Epochen-Materialien ----------
export function brickTex(N = 512, tint = '#9a4a32', mortar = '#b8ad98') {
  const r = rng(300 + tint.length), f = fbm(301, N, 16, 4), base = hex(tint), mo = hex(mortar);
  const rows = 16, rh = N / rows, bw = N / 6;
  const sh = []; for (let k = 0; k < 400; k++) sh.push(0.78 + r() * 0.32);
  return build(N, (x, y) => {
    const row = Math.floor(y / rh), off = row % 2 ? bw / 2 : 0, col = Math.floor(((x + off) % N) / bw);
    const u = ((x + off) % N) - col * bw, v = y - row * rh;
    const m2 = u < 2.5 || v < 2.5;
    if (m2) return [mo[0] * 0.9, mo[1] * 0.9, mo[2] * 0.9, 0];
    const k = sh[(row * 7 + col) % 400] * (0.88 + f(x, y) * 0.24);
    return [base[0] * k, base[1] * k, base[2] * k, 0.8 + f(x, y) * 0.2];
  }, 4);
}
export function adobeTex(N = 512) {
  const f = fbm(310, N, 6, 5), r = rng(311), a = hex('#b58a5a'), b = hex('#d6b083');
  const t = build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); const n = (Math.random() - 0.5) * 14; return [c[0] + n, c[1] + n, c[2] + n, v]; }, 2.5);
  const g = t.canvas.getContext('2d');
  for (let k = 0; k < 120; k++) { g.strokeStyle = `rgba(90,60,30,${0.15 + r() * 0.2})`; g.lineWidth = 1; g.beginPath(); const x = r() * N, y = r() * N; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 40, y + r() * 25); g.stroke(); }
  t.map.needsUpdate = true; return t;
}
export function hideTex(N = 256) {
  const f = fbm(320, N, 4, 4), a = hex('#7a5a3a'), b = hex('#b08a5c');
  const t = build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); return [c[0], c[1], c[2], v]; }, 2);
  const g = t.canvas.getContext('2d'); g.strokeStyle = 'rgba(50,30,15,0.5)'; g.lineWidth = 2;
  for (let y = 40; y < N; y += 64) { g.beginPath(); for (let x = 0; x <= N; x += 8) g.lineTo(x, y + Math.sin(x * 0.1) * 3); g.stroke(); for (let x = 0; x < N; x += 12) { g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y + 4); g.stroke(); } }
  t.map.needsUpdate = true; return t;
}
export function wattleTex(N = 256) {
  const f = fbm(330, N, 8, 3), a = hex('#8a6a44'), b = hex('#c2a578');
  return build(N, (x, y) => {
    const band = Math.floor(y / 16), w = Math.sin((x / N) * Math.PI * 12 + band * Math.PI) * 0.5 + 0.5;
    const v = f(x, y); const c = mix(a, b, v * 0.6 + w * 0.4);
    return [c[0], c[1], c[2], w * 0.7 + v * 0.3];
  }, 3);
}
export function metalTex(N = 256, tint = '#6e7378') {
  const f = fbm(340, N, 8, 3), base = hex(tint), r = rng(341);
  const t = build(N, (x, y) => { const w = Math.sin(x / N * Math.PI * 24) * 0.5 + 0.5, v = f(x, y); const k = 0.75 + w * 0.3 + (v - 0.5) * 0.2; return [base[0] * k, base[1] * k, base[2] * k, w]; }, 3);
  const g = t.canvas.getContext('2d'); for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${120 + r() * 60},${60 + r() * 30},20,0.25)`; g.beginPath(); g.ellipse(r() * N, r() * N, 3 + r() * 14, 2 + r() * 6, 0, 0, 7); g.fill(); }
  t.map.needsUpdate = true; return t;
}
export function concreteTex(N = 256) {
  const f = fbm(350, N, 8, 5), a = hex('#8f8c86'), b = hex('#b5b2aa');
  return build(N, (x, y) => { const v = f(x, y); const c = mix(a, b, v); const seam = (y % 64) < 2 ? 0.75 : 1; const n = (Math.random() - 0.5) * 10; return [c[0] * seam + n, c[1] * seam + n, c[2] * seam + n, seam < 1 ? 0 : v]; }, 2);
}
export function shingleTex(N = 512) { // Holzschindeln
  const r = rng(360), f = fbm(361, N, 8, 3), base = hex('#6e5236'), rows = 14, rh = N / rows, cw = N / 10;
  const sh = []; for (let k = 0; k < 200; k++) sh.push(0.7 + r() * 0.45);
  return build(N, (x, y) => { const row = Math.floor(y / rh), off = row % 2 ? cw / 2 : 0, col = Math.floor(((x + off) % N) / cw), v = (y - row * rh) / rh, u = (((x + off) % N) - col * cw) / cw;
    const k = sh[(row * 11 + col) % 200] * (0.85 + f(x, y) * 0.3) * (v > 0.85 || u < 0.05 ? 0.5 : 1);
    return [base[0] * k, base[1] * k, base[2] * k, v]; }, 3);
}
