// Renderer: Gelände in gecachten Chunks, Entities pro Frame, weicher Nebel des Krieges, Minimap.
import { TYPES, BUILDINGS, LINES, RESOURCE_KINDS } from '/shared/rules.js';

export const TS = 32; // Pixel pro Kachel bei Zoom 1
const CH = 16; // Kacheln pro Chunk
const TERRAIN_RGB = [[92, 140, 58], [138, 116, 72], [214, 196, 138], [44, 92, 138], [112, 106, 100]];

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, z: 1 };
    this.projectiles = [];
    this.effects = [];
    this.resize();
  }
  setMap(G) {
    this.G = G;
    const { W, H, terrain } = G;
    // 1 Pixel pro Kachel – wird beim Hochskalieren weich überblendet
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const g = base.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = terrain[y * W + x], c = TERRAIN_RGB[t];
      const j = (hash(x, y) - 0.5) * (t === 3 ? 10 : 22);
      let r = c[0] + j, gg = c[1] + j, b = c[2] + j * 0.6;
      if (t === 3) { // Wasser: tiefer abseits der Küste
        let land = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && terrain[ny * W + nx] !== 3) land++; }
        const deep = 1 - Math.min(1, land / 6);
        r -= deep * 18; gg -= deep * 22; b -= deep * 6;
      }
      const i = (y * W + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.base = base;
    this.detail = this.makeDetail();
    this.chunks = new Map();
    this.dirtyChunks = new Set();
    this.mini = document.createElement('canvas'); this.mini.width = W; this.mini.height = H;
    this.mini.getContext('2d').drawImage(base, 0, 0);
    this.fogRaw = document.createElement('canvas'); this.fogRaw.width = W; this.fogRaw.height = H;
    this.fogCtx = this.fogRaw.getContext('2d');
    this.fogImg = this.fogCtx.createImageData(W, H);
    // weichgezeichnete Version (4 px pro Kachel)
    this.fog = document.createElement('canvas'); this.fog.width = W * 4; this.fog.height = H * 4;
    this.fogSoft = this.fog.getContext('2d');
  }
  makeDetail() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
      g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 60; i++) { // Grashalme
      const x = Math.random() * 128, y = Math.random() * 128;
      g.strokeStyle = 'rgba(30,60,20,0.18)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3); g.stroke();
    }
    return this.ctx.createPattern(c, 'repeat');
  }
  invalidateTile(tx, ty) {
    // Nachbar-Chunks mit einbeziehen (Bäume ragen über Kachelgrenzen)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor((tx + dx) / CH), cy = Math.floor((ty + dy) / CH);
      this.dirtyChunks.add(cx + ',' + cy);
    }
  }
  renderChunk(cx, cy) {
    const G = this.G;
    let c = this.chunks.get(cx + ',' + cy);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = CH * TS; this.chunks.set(cx + ',' + cy, c); }
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const x0 = cx * CH, y0 = cy * CH;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.base, x0 - 1, y0 - 1, CH + 2, CH + 2, -TS, -TS, (CH + 2) * TS, (CH + 2) * TS);
    g.fillStyle = this.detail; g.fillRect(0, 0, c.width, c.height);
    // Wasser-Glanz & Felsstruktur
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
      if (tx >= G.W || ty >= G.H) continue;
      const t = G.terrain[ty * G.W + tx], px = (tx - x0) * TS, py = (ty - y0) * TS;
      const h = hash(tx, ty);
      if (t === 3 && h < 0.3) {
        g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(px + 6 + h * 10, py + 14 + h * 8); g.quadraticCurveTo(px + 12 + h * 10, py + 10 + h * 8, px + 18 + h * 10, py + 14 + h * 8); g.stroke();
      } else if (t === 4) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath(); g.moveTo(px + 4, py + 26); g.lineTo(px + 14 + h * 6, py + 6 + h * 4); g.lineTo(px + 28, py + 24); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath(); g.moveTo(px + 14 + h * 6, py + 6 + h * 4); g.lineTo(px + 18 + h * 6, py + 14); g.lineTo(px + 10 + h * 6, py + 14); g.closePath(); g.fill();
      }
    }
    // Rohstoffe (inkl. 1 Kachel Rand)
    const list = [];
    for (let ty = y0 - 2; ty < y0 + CH + 2; ty++) for (let tx = x0 - 2; tx < x0 + CH + 2; tx++) {
      if (tx < 0 || ty < 0 || tx >= G.W || ty >= G.H) continue;
      const id = G.resAt[ty * G.W + tx];
      if (!id) continue;
      const r = G.res.get(id);
      if (r && r.x === tx && r.y === ty) list.push(r);
    }
    list.sort((a, b) => a.y - b.y);
    for (const r of list) this.drawResource(g, r, (r.x - x0) * TS, (r.y - y0) * TS);
  }
  drawResource(g, r, px, py) {
    const h = hash(r.x, r.y);
    if (r.kind === 'tree') {
      const cx = px + TS / 2 + (h - 0.5) * 6, cy = py + TS / 2 + (hash(r.y, r.x) - 0.5) * 6, rad = TS * (0.52 + h * 0.18);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(cx + 5, cy + 6, rad, rad * 0.8, 0, 0, Math.PI * 2); g.fill();
      const conifer = h > 0.6;
      if (conifer) {
        g.fillStyle = '#244d2a';
        g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const rr = k % 2 ? rad * 0.6 : rad; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
        g.fillStyle = '#2f6b37'; g.beginPath(); g.arc(cx - 2, cy - 2, rad * 0.45, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#2e5e25'; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3d7a2f'; g.beginPath(); g.arc(cx - rad * 0.25, cy - rad * 0.25, rad * 0.62, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(160,220,110,0.25)'; g.beginPath(); g.arc(cx - rad * 0.38, cy - rad * 0.4, rad * 0.28, 0, Math.PI * 2); g.fill();
      }
    } else if (r.kind === 'berry') {
      const cx = px + TS / 2, cy = py + TS / 2;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 3, cy + 4, 12, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f7a34'; g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d6324a';
      for (let k = 0; k < 6; k++) { const a = k * 1.1 + h * 6; g.beginPath(); g.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 2.6, 0, Math.PI * 2); g.fill(); }
    } else {
      const gold = r.kind === 'gold';
      const cx = px + TS, cy = py + TS;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 4, cy + 6, 26, 18, 0, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + h, d = k === 6 ? 0 : 12;
        const bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d * 0.8, rr = k === 6 ? 13 : 9;
        g.fillStyle = gold ? '#7d6a45' : '#7a7a7e';
        g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill();
        g.fillStyle = gold ? '#a89060' : '#9d9da3';
        g.beginPath(); g.arc(bx - 2, by - 2, rr * 0.6, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = gold ? '#ffd34d' : '#e2e2e8';
      for (let k = 0; k < 9; k++) { const a = k * 2.3 + h * 4, d = 4 + (k % 3) * 6; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 2.4, 0, Math.PI * 2); g.fill(); }
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * dpr); this.canvas.height = Math.round(this.vh * dpr);
  }
  clampCam() {
    const G = this.G; if (!G) return;
    const c = this.cam;
    c.z = Math.max(0.35, Math.min(2.2, c.z));
    const hw = this.vw / 2 / (c.z * TS), hh = this.vh / 2 / (c.z * TS);
    c.x = Math.max(Math.min(hw, G.W / 2), Math.min(G.W - Math.min(hw, G.W / 2), c.x));
    c.y = Math.max(Math.min(hh - 1.5, G.H / 2), Math.min(G.H - Math.min(hh - 3, G.H / 2), c.y));
  }
  // Kamera in Kachel-Koordinaten
  toWorld(sx, sy) { const c = this.cam, s = c.z * TS; return [(sx - this.vw / 2) / s + c.x, (sy - this.vh / 2) / s + c.y]; }
  toScreen(wx, wy) { const c = this.cam, s = c.z * TS; return [(wx - c.x) * s + this.vw / 2, (wy - c.y) * s + this.vh / 2]; }
  zoomAt(sx, sy, f) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z *= f; this.clampCam();
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny; this.clampCam();
  }

  updateFog() {
    const G = this.G, d = this.fogImg.data, N = G.W * G.H;
    for (let i = 0; i < N; i++) d[i * 4 + 3] = G.vis[i] ? 0 : G.explored[i] ? 140 : 255;
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    const f = this.fogSoft;
    f.clearRect(0, 0, this.fog.width, this.fog.height);
    f.filter = 'blur(3px)';
    f.imageSmoothingEnabled = true;
    f.drawImage(this.fogRaw, 0, 0, this.fog.width, this.fog.height);
    f.filter = 'none';
  }

  // ---------------- Frame ----------------
  frame(now, ui) {
    const G = this.G, ctx = this.ctx, d = this.dpr, c = this.cam, s = c.z * TS;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, this.vw, this.vh);
    const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.vw, this.vh);
    // Chunks
    let budget = 4;
    for (const key of this.dirtyChunks) { if (budget-- <= 0) break; const [a, b] = key.split(',').map(Number); if (this.chunks.has(key)) this.renderChunk(a, b); this.dirtyChunks.delete(key); }
    ctx.imageSmoothingEnabled = c.z < 1;
    const cx0 = Math.max(0, Math.floor(wx0 / CH)), cx1 = Math.min(Math.ceil(G.W / CH) - 1, Math.floor(wx1 / CH));
    const cy0 = Math.max(0, Math.floor(wy0 / CH)), cy1 = Math.min(Math.ceil(G.H / CH) - 1, Math.floor(wy1 / CH));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy;
      if (!this.chunks.has(key)) this.renderChunk(cx, cy);
      const [sx, sy] = this.toScreen(cx * CH, cy * CH);
      ctx.drawImage(this.chunks.get(key), Math.floor(sx), Math.floor(sy), Math.ceil(CH * s) + 1, Math.ceil(CH * s) + 1);
    }
    ctx.imageSmoothingEnabled = true;
    // Weltkoordinaten-Transform (1 Einheit = 1 Kachel)
    ctx.setTransform(s * d, 0, 0, s * d, (this.vw / 2 - c.x * s) * d, (this.vh / 2 - c.y * s) * d);

    // Entities sammeln & nach y sortieren
    const t = now;
    const list = [];
    for (const e of G.ents.values()) {
      const p = this.pos(e, t);
      const sz = e.def.kind === 'b' ? BUILDINGS[e.def.key].size : 1;
      if (p[0] + sz + 1 < wx0 || p[0] - 2 > wx1 || p[1] + sz + 1 < wy0 || p[1] - 2 > wy1) continue;
      list.push(e);
    }
    list.sort((a, b) => (a.def.kind === 'b' ? (a.y + BUILDINGS[a.def.key].size) : a.ry) - (b.def.kind === 'b' ? (b.y + BUILDINGS[b.def.key].size) : b.ry) || (a.def.kind === 'b' ? -1 : 1));
    // Felder zuerst (flach)
    for (const e of list) if (e.def.key === 'farm') this.drawBuilding(ctx, e, t, s);
    for (const e of list) {
      if (e.def.key === 'farm') continue;
      if (e.def.kind === 'b') this.drawBuilding(ctx, e, t, s); else this.drawUnit(ctx, e, t, s);
    }
    // Projektile
    this.projectiles = this.projectiles.filter(p => t < p.t0 + p.dur);
    for (const p of this.projectiles) {
      const k = Math.max(0, (t - p.t0) / p.dur);
      const x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * p.arc;
      if (p.c === 1) { ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(x, y, 0.16, 0, Math.PI * 2); ctx.fill(); }
      else if (p.c === 2) { ctx.strokeStyle = 'rgba(255,230,150,0.9)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (p.tx - p.x) * 0.08, y - (p.ty - p.y) * 0.08); ctx.stroke(); }
      else {
        const k2 = Math.min(1, k + 0.05);
        const x2 = p.x + (p.tx - p.x) * k2, y2 = p.y + (p.ty - p.y) * k2 - Math.sin(k2 * Math.PI) * p.arc;
        const a = Math.atan2(y2 - y, x2 - x);
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 0.3, y - Math.sin(a) * 0.3); ctx.lineTo(x, y); ctx.stroke();
      }
    }
    this.drawEffects(ctx, t);

    // Nebel
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, G.W, G.H);
    // Kartenrand
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.2; ctx.strokeRect(0, 0, G.W, G.H);

    // UI-Ebene in Welt: Platzierungsgeist, Sammelpunkt, Auswahlrahmen
    if (ui.ghost) this.drawGhost(ctx, ui.ghost);
    if (ui.rally) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.06; ctx.setLineDash([0.2, 0.2]);
      ctx.beginPath(); ctx.moveTo(ui.rally.fx, ui.rally.fy); ctx.lineTo(ui.rally.x, ui.rally.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(ui.rally.x, ui.rally.y); ctx.lineTo(ui.rally.x, ui.rally.y - 0.9); ctx.lineTo(ui.rally.x + 0.5, ui.rally.y - 0.7); ctx.lineTo(ui.rally.x, ui.rally.y - 0.5); ctx.fill();
    }
    for (const m of ui.markers) {
      const k = (t - m.t0) / 600; if (k > 1) continue;
      ctx.strokeStyle = m.color; ctx.lineWidth = 0.08; ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 0.6 * (1 - k * 0.5), 0.4 * (1 - k * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (ui.box) {
      const b = ui.box;
      ctx.fillStyle = 'rgba(120,220,140,0.12)'; ctx.strokeStyle = 'rgba(120,220,140,0.9)'; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      ctx.strokeRect(Math.min(b.x0, b.x1) + 0.5, Math.min(b.y0, b.y1) + 0.5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
  }

  pos(e, t) {
    if (e.def.kind === 'b') { e.rx = e.x; e.ry = e.y; return [e.x, e.y]; }
    const k = Math.min(1, (t - e.t0) / 110);
    e.rx = e.px + (e.x - e.px) * k; e.ry = e.py + (e.y - e.py) * k;
    return [e.rx, e.ry];
  }

  drawUnit(ctx, e, t, s) {
    const G = this.G, p = G.players[e.owner];
    const col = p ? p.color : '#ccc';
    const x = e.rx, y = e.ry, def = e.def, cls = def.cls, era = def.era;
    const r = cls === 'cav' ? 0.42 : cls === 'sie' ? 0.46 : 0.3;
    const sel = G.selected.has(e.id);
    if (sel) {
      ctx.strokeStyle = e.owner === G.you ? '#6dff8a' : G.allied(e.owner) ? '#8fd0ff' : '#ff6b5e'; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, r * 1.25, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x + 0.06, y + r * 0.6, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    const dir = e.dir;
    const swing = e.state === 2 ? Math.sin(t / 90) * 0.6 : 0;
    const walk = (e.state === 1 || e.state === 5) ? Math.sin(t / 80 + e.id) * 0.04 : 0;
    ctx.save();
    ctx.translate(x, y + walk);
    if (cls === 'cav' && era >= 6) {
      // Panzer
      ctx.rotate(dir);
      ctx.fillStyle = '#4d5236'; ctx.fillRect(-0.5, -0.36, 1.0, 0.72);
      ctx.fillStyle = '#2b2e20'; ctx.fillRect(-0.52, -0.42, 1.04, 0.12); ctx.fillRect(-0.52, 0.3, 1.04, 0.12);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-0.05, 0, 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b2e20'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(0.1, 0); ctx.lineTo(0.75, 0); ctx.stroke();
      ctx.restore(); this.unitBars(ctx, e, x, y, r, sel); return;
    }
    if (cls === 'sie') {
      ctx.rotate(dir);
      if (era <= 3) { // Katapult/Tribok: Holzgestell
        ctx.fillStyle = '#7a5530'; ctx.fillRect(-0.45, -0.32, 0.9, 0.64);
        ctx.fillStyle = '#4a321b'; ctx.fillRect(-0.48, -0.38, 0.2, 0.2); ctx.fillRect(-0.48, 0.18, 0.2, 0.2); ctx.fillRect(0.28, -0.38, 0.2, 0.2); ctx.fillRect(0.28, 0.18, 0.2, 0.2);
        ctx.strokeStyle = '#a07648'; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.lineTo(0.35 + swing * 0.2, 0); ctx.stroke();
      } else { // Kanone/Artillerie
        ctx.fillStyle = '#4a321b'; ctx.beginPath(); ctx.arc(-0.15, -0.3, 0.16, 0, Math.PI * 2); ctx.arc(-0.15, 0.3, 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = era >= 5 ? '#4d5236' : '#2d2d2d'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(-0.4, 0); ctx.lineTo(0.55, 0); ctx.stroke();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-0.42, 0, 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); this.unitBars(ctx, e, x, y, r, sel); return;
    }
    if (cls === 'cav') {
      // Pferd / Streitwagen
      ctx.save(); ctx.rotate(dir);
      ctx.fillStyle = era === 1 ? '#8a6a40' : '#6b4a2e';
      ctx.beginPath(); ctx.ellipse(0, 0, 0.45, 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.42, 0, 0.15, 0.1, 0, 0, Math.PI * 2); ctx.fill();
      if (era === 1) { ctx.fillStyle = '#5a4026'; ctx.fillRect(-0.62, -0.3, 0.26, 0.6); }
      ctx.restore();
    }
    // Körper
    const body = cls === 'cav' ? 0.22 : 0.27;
    ctx.fillStyle = shade(col, -0.35);
    ctx.beginPath(); ctx.arc(0, 0, body + 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, body, 0, Math.PI * 2); ctx.fill();
    // Kopf/Helm
    ctx.fillStyle = era >= 3 && cls !== 'wrk' ? '#9aa1a8' : '#e0b08a';
    ctx.beginPath(); ctx.arc(Math.cos(dir) * 0.04, Math.sin(dir) * 0.04, 0.12, 0, Math.PI * 2); ctx.fill();
    // Waffe
    ctx.rotate(dir);
    ctx.lineCap = 'round';
    if (cls === 'wrk') {
      ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 0.05;
      ctx.save(); ctx.rotate(e.state === 3 || e.state === 4 ? Math.sin(t / 110 + e.id) * 0.7 : 0);
      ctx.beginPath(); ctx.moveTo(0.1, 0.15); ctx.lineTo(0.42, 0.15); ctx.stroke();
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0.36, 0.08, 0.08, 0.15);
      ctx.restore();
      if (e.carry) { ctx.fillStyle = ['', '#d6324a', '#8a5a2b', '#a0a0a8', '#ffd34d'][e.carry]; ctx.fillRect(-0.32, -0.12, 0.16, 0.24); }
    } else if (cls === 'rng') {
      if (era >= 4) { ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(0.05, 0.12); ctx.lineTo(0.55, 0.12); ctx.stroke(); }
      else if (era === 0) { ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 0.04; ctx.save(); ctx.rotate(swing); ctx.beginPath(); ctx.moveTo(0.1, 0.12); ctx.lineTo(0.38, 0.2); ctx.stroke(); ctx.restore(); }
      else { ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0.12, 0, 0.32, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(0.26, -0.29); ctx.lineTo(0.26, 0.29); ctx.stroke(); }
    } else {
      // Nahkampf: Keule, Speer, Schwert, Pike, Gewehr
      ctx.save(); ctx.rotate(swing);
      if (era >= 5) { ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(0.05, 0.14); ctx.lineTo(0.55, 0.14); ctx.stroke(); }
      else if (era === 0) { ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0.1, 0.18); ctx.lineTo(0.44, 0.22); ctx.stroke(); }
      else if (era === 3) { ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(0.12, 0.18); ctx.lineTo(0.5, 0.18); ctx.stroke(); }
      else { ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.15, 0.17); ctx.lineTo(0.7, 0.17); ctx.stroke(); ctx.fillStyle = '#c9ced4'; ctx.beginPath(); ctx.moveTo(0.7, 0.12); ctx.lineTo(0.82, 0.17); ctx.lineTo(0.7, 0.22); ctx.fill(); }
      ctx.restore();
      if (era >= 2 && era <= 4 && cls === 'inf') { ctx.fillStyle = shade(col, -0.2); ctx.beginPath(); ctx.ellipse(0.05, -0.2, 0.1, 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    if (def.unique) { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(-0.18, -0.18, 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    this.unitBars(ctx, e, x, y, r, sel);
  }
  unitBars(ctx, e, x, y, r, sel) {
    if (!(sel || e.hp < e.maxHp)) return;
    const w = 0.7, h = 0.09, k = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y - r - 0.32, w, h);
    ctx.fillStyle = k > 0.6 ? '#5fd35f' : k > 0.3 ? '#e8c03a' : '#e8453a';
    ctx.fillRect(x - w / 2, y - r - 0.32, w * k, h);
  }

  drawBuilding(ctx, e, t, s) {
    const G = this.G, p = G.players[e.owner];
    const col = p ? p.color : '#ccc';
    const key = e.def.key, sz = BUILDINGS[key].size;
    const x = e.x, y = e.y;
    const era = e.era || 0;
    const done = e.prog >= 100;
    const sel = G.selected.has(e.id);
    ctx.save();
    if (e.ghost) ctx.globalAlpha = 0.55;
    if (sel) {
      ctx.strokeStyle = e.owner === G.you ? '#6dff8a' : G.allied(e.owner) ? '#8fd0ff' : '#ff6b5e'; ctx.lineWidth = 0.07;
      ctx.strokeRect(x - 0.08, y - 0.08, sz + 0.16, sz + 0.16);
    }
    if (key === 'farm') {
      ctx.fillStyle = '#7a5a34'; ctx.fillRect(x + 0.06, y + 0.06, sz - 0.12, sz - 0.12);
      ctx.strokeStyle = done ? '#7fae3c' : '#5f4226'; ctx.lineWidth = 0.1;
      for (let k = 0; k < 5; k++) { const yy = y + 0.3 + k * 0.36; ctx.beginPath(); ctx.moveTo(x + 0.2, yy); ctx.lineTo(x + sz - 0.2, yy); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.lineWidth = 0.06; ctx.strokeRect(x + 0.06, y + 0.06, sz - 0.12, sz - 0.12);
      if (!done) this.progressBar(ctx, x, y - 0.3, sz, e.prog / 100, '#ffd34d');
      ctx.restore(); return;
    }
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 0.25, y + 0.3, sz - 0.1, sz - 0.1);
    if (!done) {
      // Baugerüst
      ctx.fillStyle = 'rgba(160,120,70,0.35)'; ctx.fillRect(x + 0.1, y + 0.1, sz - 0.2, sz - 0.2);
      ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 0.06;
      for (let k = 0; k <= sz * 2; k++) { ctx.beginPath(); ctx.moveTo(x + 0.1 + k * 0.5, y + 0.1); ctx.lineTo(x + 0.1, y + 0.1 + k * 0.5); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.strokeRect(x + 0.1, y + 0.1, sz - 0.2, sz - 0.2);
      const h = (sz - 0.2) * e.prog / 100;
      ctx.fillStyle = 'rgba(200,170,120,0.55)'; ctx.fillRect(x + 0.1, y + sz - 0.1 - h, sz - 0.2, h);
      this.progressBar(ctx, x, y - 0.3, sz, e.prog / 100, '#ffd34d');
      ctx.restore(); return;
    }
    // Material je Epoche
    const wall = era <= 1 ? '#8a6a44' : era <= 3 ? '#a59a86' : era <= 4 ? '#b9ab8e' : '#8f9497';
    const roof = era <= 1 ? '#6b5233' : era <= 3 ? '#8f4a35' : era <= 4 ? '#5a6a7a' : '#4b5157';
    const m = 0.12;
    if (key === 'wall') {
      ctx.fillStyle = era >= 3 ? '#8c8478' : '#7a5530'; ctx.fillRect(x + 0.08, y + 0.08, 0.84, 0.84);
      ctx.fillStyle = era >= 3 ? '#a59c90' : '#946a40'; ctx.fillRect(x + 0.08, y + 0.08, 0.84, 0.3);
      ctx.fillStyle = col; ctx.fillRect(x + 0.08, y + 0.8, 0.84, 0.12);
    } else if (key === 'tower') {
      const cx = x + 1, cy = y + 1;
      ctx.fillStyle = shade(wall, -0.25); ctx.beginPath(); ctx.arc(cx, cy + 0.15, 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = wall; ctx.beginPath(); ctx.arc(cx, cy - 0.05, 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(wall, 0.15);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.fillRect(cx + Math.cos(a) * 0.62 - 0.1, cy - 0.05 + Math.sin(a) * 0.62 - 0.1, 0.2, 0.2); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy - 0.05, 0.3, 0, Math.PI * 2); ctx.fill();
    } else {
      // Grundkörper mit Dach
      ctx.fillStyle = shade(wall, -0.3); ctx.fillRect(x + m, y + m + 0.25, sz - 2 * m, sz - 2 * m - 0.25);
      ctx.fillStyle = wall; ctx.fillRect(x + m, y + sz * 0.45, sz - 2 * m, sz * 0.55 - m);
      // Dach (Satteldach von oben)
      const rx = x + m - 0.05, ry = y + m - 0.05, rw = sz - 2 * m + 0.1, rh = sz * 0.62;
      ctx.fillStyle = roof; ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = shade(roof, 0.18); ctx.fillRect(rx, ry, rw, rh / 2);
      ctx.strokeStyle = shade(roof, -0.3); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(rx, ry + rh / 2); ctx.lineTo(rx + rw, ry + rh / 2); ctx.stroke();
      // Spielerfarbe: Dachfirst-Banner
      ctx.fillStyle = col; ctx.fillRect(rx, ry + rh / 2 - 0.07, rw, 0.14);
      // Tür
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + sz / 2 - 0.18, y + sz - m - 0.42, 0.36, 0.42);
      // Symbol
      const icon = { town: '⌂', house: '', storage: '▦', barracks: '⚔', range: '◎', stable: '♞', workshop: '⚙' }[key];
      if (icon && s > 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold ${sz * 0.32}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icon, x + sz / 2, y + sz * 0.72);
      }
      if (key === 'town') {
        // Fahne
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(x + sz - 0.5, y + 0.4); ctx.lineTo(x + sz - 0.5, y - 0.6); ctx.stroke();
        const wv = Math.sin(t / 300) * 0.06;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + sz - 0.5, y - 0.6); ctx.lineTo(x + sz + 0.2, y - 0.45 + wv); ctx.lineTo(x + sz - 0.5, y - 0.25); ctx.fill();
      }
    }
    if (e.q && !e.ghost) { // Ausbildung läuft
      ctx.fillStyle = 'rgba(255,211,77,0.9)'; ctx.beginPath(); ctx.arc(x + 0.25, y + 0.25, 0.12 + Math.sin(t / 200) * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    if (sel || e.hp < e.maxHp) this.progressBar(ctx, x, y - 0.3, sz, e.hp / e.maxHp, null);
    ctx.restore();
  }
  progressBar(ctx, x, y, w, k, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 0.1, y, w - 0.2, 0.12);
    ctx.fillStyle = color || (k > 0.6 ? '#5fd35f' : k > 0.3 ? '#e8c03a' : '#e8453a');
    ctx.fillRect(x + 0.1, y, (w - 0.2) * Math.max(0, Math.min(1, k)), 0.12);
  }
  drawGhost(ctx, gh) {
    const sz = BUILDINGS[gh.type].size;
    for (const [x, y, ok] of gh.cells) {
      ctx.fillStyle = ok ? 'rgba(90,220,120,0.35)' : 'rgba(230,70,60,0.4)';
      ctx.fillRect(x, y, sz, sz);
      ctx.strokeStyle = ok ? 'rgba(120,255,150,0.9)' : 'rgba(255,90,80,0.9)'; ctx.lineWidth = 0.05;
      ctx.strokeRect(x, y, sz, sz);
    }
  }

  addShot(e, now) {
    const d = Math.hypot(e.tx - e.x, e.ty - e.y);
    this.projectiles.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, t0: now, dur: e.c === 2 ? 90 : Math.max(150, d * 55), arc: e.c === 2 ? 0 : d * 0.12, c: e.c });
  }
  addEffect(kind, x, y, extra = {}) { this.effects.push({ kind, x, y, t0: performance.now(), ...extra }); }
  drawEffects(ctx, t) {
    this.effects = this.effects.filter(e => t - e.t0 < (e.kind === 'meteor' ? e.dur + 800 : 900));
    for (const e of this.effects) {
      const k = (t - e.t0) / 900;
      if (e.kind === 'death') {
        ctx.fillStyle = `rgba(120,20,20,${0.5 * (1 - k)})`;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 0.1, 0.3 + k * 0.2, 0.18 + k * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'dust') {
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          ctx.fillStyle = `rgba(150,130,100,${0.5 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * k * e.s * 0.6, e.y + Math.sin(a) * k * e.s * 0.6, 0.4 + k * e.s * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.kind === 'meteor') {
        const kk = (t - e.t0) / e.dur;
        if (kk < 1) {
          ctx.strokeStyle = `rgba(255,80,40,${0.4 + kk * 0.4})`; ctx.lineWidth = 0.08;
          ctx.beginPath(); ctx.arc(e.x, e.y, 3.2, 0, Math.PI * 2); ctx.stroke();
          const mx = e.x - (1 - kk) * 12, my = e.y - (1 - kk) * 18;
          ctx.strokeStyle = 'rgba(255,170,60,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(mx - 3, my - 4.5); ctx.lineTo(mx, my); ctx.stroke();
          ctx.fillStyle = '#ffe1a0'; ctx.beginPath(); ctx.arc(mx, my, 0.6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.kind === 'boom') {
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 4);
        g.addColorStop(0, `rgba(255,240,180,${1 - k})`); g.addColorStop(0.4, `rgba(255,120,40,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 1 + 3.5 * k, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawMinimap(canvas, ui) {
    const G = this.G, g = canvas.getContext('2d');
    const sx = canvas.width / G.W, sy = canvas.height / G.H;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.mini, 0, 0, canvas.width, canvas.height);
    g.setTransform(sx, 0, 0, sy, 0, 0);
    // Rohstoffe grob
    for (const r of G.res.values()) {
      if (r.kind === 'tree') continue;
      if (!G.explored[r.y * G.W + r.x]) continue;
      g.fillStyle = r.kind === 'gold' ? '#ffd34d' : r.kind === 'stone' ? '#c8c8d0' : '#d6324a';
      g.fillRect(r.x, r.y, r.kind === 'berry' ? 1 : 2, r.kind === 'berry' ? 1 : 2);
    }
    for (const e of G.ents.values()) {
      const p = G.players[e.owner];
      g.fillStyle = p ? p.color : '#fff';
      if (e.def.kind === 'b') { const sz = BUILDINGS[e.def.key].size; g.fillRect(e.x - 0.5, e.y - 0.5, sz + 1, sz + 1); } else g.fillRect(e.x - 1, e.y - 1, 2, 2);
    }
    g.drawImage(this.fog, 0, 0, G.W, G.H);
    for (const a of ui.pings) {
      const k = (performance.now() - a.t0) / 3000;
      if (k > 1) continue;
      g.strokeStyle = `rgba(255,70,50,${1 - k})`; g.lineWidth = 1.5 / sx;
      g.beginPath(); g.arc(a.x, a.y, 3 + 10 * (k * 3 % 1), 0, Math.PI * 2); g.stroke();
    }
    const [x0, y0] = this.toWorld(0, 0), [x1, y1] = this.toWorld(this.vw, this.vh);
    g.strokeStyle = '#fff'; g.lineWidth = 1 / sx;
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
}
