// Karten-Renderer: statischer Hintergrund (einmalig), Kartenebene (nur bei Änderungen neu)
// und eine leichte Overlay-Ebene pro Frame (Armeen, Beschriftungen, Effekte).

const NEUTRAL = '#4a5468';
const NEUTRAL_HIDDEN = '#2b3242';
const BG_SCALE = 1.5;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const m = v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

export class MapRenderer {
  constructor(canvas, map) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = map;
    this.W = map.width; this.H = map.height;
    this.cam = { x: this.W / 2, y: this.H / 2, z: 1 };
    this.dirty = true;
    this.effects = [];
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');
    this.paths = map.regions.map(r => {
      const p = new Path2D();
      for (const poly of r.polys) for (const ring of poly) {
        p.moveTo(ring[0], ring[1]);
        for (let i = 2; i < ring.length; i += 2) p.lineTo(ring[i], ring[i + 1]);
        p.closePath();
      }
      return p;
    });
    this.allLand = new Path2D();
    for (const p of this.paths) this.allLand.addPath(p);
    // Seewege (einmalig sammeln)
    this.seaLinks = [];
    for (const r of map.regions) for (const [o, t] of r.adj) if (o > r.id && t >= 2) this.seaLinks.push([r.id, o, t]);
    this.buildBackground();
    this.buildLandTexture();
    this.resize();
  }

  // ---------- Vorbereitung ----------
  buildBackground() {
    const c = document.createElement('canvas');
    c.width = Math.round(this.W * BG_SCALE); c.height = Math.round(this.H * BG_SCALE);
    const g = c.getContext('2d');
    g.scale(BG_SCALE, BG_SCALE);
    const grad = g.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#0a1630'); grad.addColorStop(0.5, '#0d2142'); grad.addColorStop(1, '#091428');
    g.fillStyle = grad; g.fillRect(0, 0, this.W, this.H);
    // feines Raster
    g.strokeStyle = 'rgba(120,160,220,0.06)'; g.lineWidth = 0.6;
    for (let x = 0; x <= this.W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.H); g.stroke(); }
    for (let y = 0; y <= this.H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(this.W, y); g.stroke(); }
    // Küstenleuchten / flaches Wasser
    g.save();
    g.shadowColor = 'rgba(80,170,255,0.55)'; g.shadowBlur = 16 * BG_SCALE;
    g.fillStyle = '#1b3a63'; g.fill(this.allLand, 'evenodd');
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(110,190,255,0.18)'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(this.allLand);
    g.strokeStyle = 'rgba(110,190,255,0.12)'; g.lineWidth = 10; g.stroke(this.allLand);
    g.restore();
    // Vignette
    const v = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.W * 0.65);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v; g.fillRect(0, 0, this.W, this.H);
    this.bg = c;
  }
  // Körnige Geländetextur + Lichtkante, einmalig vorberechnet und nur auf Land (transparent über Wasser)
  buildLandTexture() {
    const n = document.createElement('canvas'); n.width = n.height = 128;
    const ng = n.getContext('2d');
    const img = ng.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const dark = Math.random() < 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = dark ? 0 : 255; img.data[i + 3] = Math.random() * 34;
    }
    ng.putImageData(img, 0, 0);
    const c = document.createElement('canvas');
    c.width = Math.round(this.W * BG_SCALE); c.height = Math.round(this.H * BG_SCALE);
    const g = c.getContext('2d');
    g.scale(BG_SCALE, BG_SCALE);
    g.save();
    g.clip(this.allLand, 'evenodd');
    g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, this.W, this.H);
    // weiche Innenschatten an den Küsten für Plastizität
    g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 6 * BG_SCALE;
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.stroke(this.allLand);
    g.restore();
    // Nord-Süd-Licht
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, 0, 0, this.H);
    lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = lg; g.fillRect(0, 0, this.W, this.H);
    this.landTex = c;
  }

  // ---------- Kamera ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    for (const c of [this.canvas, this.layer]) { c.width = Math.round(this.vw * dpr); c.height = Math.round(this.vh * dpr); }
    this.minZ = Math.min(this.vw / this.W, this.vh / this.H) * 0.9;
    this.clampCam();
    this.dirty = true;
  }
  fitWorld() {
    this.cam.z = Math.min(this.vw / this.W, (this.vh - 60) / this.H) * 0.98;
    this.cam.x = this.W / 2; this.cam.y = this.H / 2 - 10 / this.cam.z;
    this.clampCam(); this.dirty = true;
  }
  clampCam() {
    const c = this.cam;
    c.z = Math.max(this.minZ, Math.min(14, c.z));
    const hw = this.vw / 2 / c.z, hh = this.vh / 2 / c.z;
    c.x = hw * 2 >= this.W ? this.W / 2 : Math.max(hw - 40, Math.min(this.W - hw + 40, c.x));
    c.y = hh * 2 >= this.H ? this.H / 2 : Math.max(hh - 40, Math.min(this.H - hh + 40, c.y));
  }
  pan(dx, dy) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clampCam(); this.dirty = true; }
  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.cam.z *= factor; this.clampCam();
    const [nx, ny] = this.screenToWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny; this.clampCam();
    this.dirty = true;
  }
  centerOn(id, z) {
    const r = this.map.regions[id];
    this.anim = { from: { ...this.cam }, to: { x: r.cx, y: r.cy, z: z || Math.max(this.cam.z, 2.2) }, t0: performance.now(), dur: 450 };
  }
  screenToWorld(sx, sy) { const c = this.cam; return [(sx - this.vw / 2) / c.z + c.x, (sy - this.vh / 2) / c.z + c.y]; }
  worldToScreen(wx, wy) { const c = this.cam; return [(wx - c.x) * c.z + this.vw / 2, (wy - c.y) * c.z + this.vh / 2]; }
  viewBounds() { const [x0, y0] = this.screenToWorld(0, 0), [x1, y1] = this.screenToWorld(this.vw, this.vh); return [x0, y0, x1, y1]; }
  setWorldTransform(ctx) { const c = this.cam, d = this.dpr; ctx.setTransform(c.z * d, 0, 0, c.z * d, (this.vw / 2 - c.x * c.z) * d, (this.vh / 2 - c.y * c.z) * d); }

  hitTest(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const ctx = this.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    let hit = -1;
    const regions = this.map.regions;
    for (let i = 0; i < regions.length; i++) {
      const b = regions[i].bbox;
      if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
      if (ctx.isPointInPath(this.paths[i], wx, wy, 'evenodd')) { hit = i; break; }
    }
    ctx.restore();
    if (hit >= 0) return hit;
    // kleine Inseln: nächste Beschriftung in 14 px Umkreis
    let best = -1, bd = 14;
    for (const r of regions) {
      const [x, y] = this.worldToScreen(r.cx, r.cy);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bd && r.area < 400) { bd = d; best = r.id; }
    }
    return best;
  }

  // ---------- Zeichnen ----------
  regionColor(id, G) {
    const st = G.regions[id];
    let owner = st ? st.owner : -1;
    if (G.phase === 'draft') {
      owner = -1;
      for (const [pid, rid] of G.picks) if (rid === id) owner = pid;
    }
    if (owner >= 0 && G.players[owner]) {
      return st && st.hidden ? shade(G.players[owner].color, -0.45) : G.players[owner].color;
    }
    return st && st.hidden ? NEUTRAL_HIDDEN : NEUTRAL;
  }

  drawLayer(G) {
    const ctx = this.lctx, d = this.dpr, z = this.cam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070e1c';
    ctx.fillRect(0, 0, this.layer.width, this.layer.height);
    this.setWorldTransform(ctx);
    ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    const [vx0, vy0, vx1, vy1] = this.viewBounds();
    const visible = [];
    for (const r of this.map.regions) {
      const b = r.bbox;
      if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      visible.push(r.id);
      ctx.fillStyle = this.regionColor(r.id, G);
      ctx.fill(this.paths[r.id], 'evenodd');
    }
    this.visible = visible;
    // Struktur / Licht
    ctx.globalAlpha = 0.45;
    ctx.drawImage(this.landTex, 0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
    // Grenzen
    // dünne Linien (< 1 px) sind beim Rastern deutlich günstiger als dicke
    ctx.lineJoin = 'bevel';
    ctx.strokeStyle = 'rgba(6,10,18,0.75)';
    ctx.lineWidth = 0.95 / z;
    for (const id of visible) ctx.stroke(this.paths[id]);
    // Seewege
    ctx.save();
    ctx.setLineDash([4 / z, 4 / z]);
    ctx.strokeStyle = 'rgba(170,210,255,0.22)';
    ctx.lineWidth = Math.max(0.4, 1 / z);
    const R = this.map.regions;
    for (const [a, b, t] of this.seaLinks) {
      const A = R[a], B = R[b];
      ctx.beginPath();
      if (t === 3) {
        const [l, r] = A.cx < B.cx ? [A, B] : [B, A];
        ctx.moveTo(l.cx, l.cy); ctx.lineTo(-20, l.cy - 10);
        ctx.moveTo(r.cx, r.cy); ctx.lineTo(this.W + 20, r.cy - 10);
      } else {
        const [cx, cy] = this.curveCtrl(A, B);
        ctx.moveTo(A.cx, A.cy); ctx.quadraticCurveTo(cx, cy, B.cx, B.cy);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.dirty = false;
  }
  curveCtrl(A, B) {
    const mx = (A.cx + B.cx) / 2, my = (A.cy + B.cy) / 2, dx = B.cx - A.cx, dy = B.cy - A.cy;
    return [mx - dy * 0.12, my + dx * 0.12];
  }

  armyPos(a, t) {
    const R = this.map.regions, A = R[a.from], B = R[a.to];
    let k = Math.min(1, Math.max(0, (t - a.start) / (a.arrive - a.start)));
    k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // weiches Beschleunigen
    if (a.type === 3) {
      // um die Welt herum
      const bx = A.cx < B.cx ? B.cx - this.W : B.cx + this.W;
      let x = A.cx + (bx - A.cx) * k;
      if (x < 0) x += this.W; else if (x > this.W) x -= this.W;
      return [x, A.cy + (B.cy - A.cy) * k];
    }
    if (a.type === 2 || a.type === 4) {
      let cx, cy;
      if (a.type === 4) { cx = (A.cx + B.cx) / 2; cy = Math.min(A.cy, B.cy) - Math.hypot(B.cx - A.cx, B.cy - A.cy) * 0.35; } else[cx, cy] = this.curveCtrl(A, B);
      const u = 1 - k;
      return [u * u * A.cx + 2 * u * k * cx + k * k * B.cx, u * u * A.cy + 2 * u * k * cy + k * k * B.cy];
    }
    return [A.cx + (B.cx - A.cx) * k, A.cy + (B.cy - A.cy) * k];
  }

  addEffect(kind, id, color) {
    const r = this.map.regions[id];
    if (!r) return;
    this.effects.push({ kind, x: r.cx, y: r.cy, color, t0: performance.now(), id });
  }

  frame(G, now) {
    if (this.anim) {
      const a = this.anim, k = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
      this.cam.x = a.from.x + (a.to.x - a.from.x) * e; this.cam.y = a.from.y + (a.to.y - a.from.y) * e; this.cam.z = a.from.z + (a.to.z - a.from.z) * e;
      this.clampCam(); this.dirty = true;
      if (k >= 1) this.anim = null;
    }
    if (this.dirty) this.drawLayer(G);
    const ctx = this.ctx, z = this.cam.z, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.layer, 0, 0);
    this.setWorldTransform(ctx);
    const R = this.map.regions;
    const me = G.you;

    // Auswahl / Hover / Ziele
    if (G.phase === 'draft') this.drawDraftHints(G, ctx, z);
    const sel = G.selected;
    if (sel.size) {
      const targets = new Set();
      for (const id of sel) for (const [o] of R[id].adj) if (!sel.has(o)) targets.add(o);
      ctx.save();
      for (const t of targets) {
        const st = G.regions[t];
        const friendly = st && (st.owner === me || (G.players[me] && G.players[me].allies.includes(st.owner)));
        ctx.fillStyle = friendly ? 'rgba(120,220,150,0.16)' : 'rgba(255,90,70,0.16)';
        ctx.fill(this.paths[t], 'evenodd');
      }
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      ctx.shadowColor = 'rgba(255,210,90,0.9)'; ctx.shadowBlur = 12 * d;
      ctx.strokeStyle = `rgba(255,214,102,${pulse})`; ctx.lineWidth = 2.2 / z;
      for (const id of sel) ctx.stroke(this.paths[id]);
      ctx.restore();
    }
    if (G.hover >= 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill(this.paths[G.hover], 'evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4 / z; ctx.stroke(this.paths[G.hover]);
      ctx.restore();
    }
    if (G.targeting && G.hover >= 0) {
      ctx.save(); ctx.strokeStyle = '#ff5a46'; ctx.lineWidth = 2.5 / z; ctx.setLineDash([5 / z, 3 / z]); ctx.stroke(this.paths[G.hover]); ctx.restore();
    }

    // Zieh-Pfeil
    if (G.drag && G.drag.to) this.drawArrow(ctx, G.drag.fromPts, G.drag.to, G.drag.valid, z, G);

    // Armeen
    const t = G.gameTime();
    const [vx0, vy0, vx1, vy1] = this.viewBounds();
    ctx.lineCap = 'round';
    for (const a of G.armies.values()) {
      const p = G.players[a.owner]; if (!p) continue;
      const [x, y] = this.armyPos(a, t);
      if (x < vx0 - 20 || x > vx1 + 20 || y < vy0 - 20 || y > vy1 + 20) continue;
      const A = R[a.from];
      if (a.type !== 3) {
        ctx.strokeStyle = rgba(p.color, 0.35); ctx.lineWidth = Math.max(0.8, 2.2 / z);
        ctx.setLineDash(a.type === 4 ? [2 / z, 3 / z] : []);
        ctx.beginPath(); ctx.moveTo(A.cx, A.cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.setLineDash([]);
      }
      const rad = (5 + Math.min(9, Math.log2(1 + a.count) * 1.4)) / Math.max(1, z * 0.75);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(x + rad * 0.15, y + rad * 0.25, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(0.5, 1.2 / z);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const fs = rad * 1.05;
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(a.type === 4 ? '🪂' : fmt(a.count), x, y + fs * 0.05);
    }

    if (G.phase !== 'menu') this.drawLabels(G, ctx, z);
    this.drawEffects(ctx, now, z);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawDraftHints(G, ctx, z) {
    const blocked = new Set();
    for (const [pid, rid] of G.picks) {
      if (pid === G.you) continue;
      blocked.add(rid);
      for (const [o] of this.map.regions[rid].adj) { blocked.add(o); for (const [o2] of this.map.regions[o].adj) blocked.add(o2); }
    }
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const id of blocked) if (![...G.picks.values()].includes(id)) ctx.fill(this.paths[id], 'evenodd');
    ctx.restore();
    // eigene Wahl hervorheben
    const mine = G.picks.get(G.you);
    if (mine != null) {
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 14 * this.dpr; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / z;
      ctx.stroke(this.paths[mine]); ctx.restore();
    }
  }

  drawArrow(ctx, fromPts, to, valid, z, G) {
    const col = valid ? (G.players[G.you] ? G.players[G.you].color : '#fff') : '#888';
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3 / z; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * this.dpr;
    for (const [fx, fy] of fromPts) {
      const dx = to[0] - fx, dy = to[1] - fy, len = Math.hypot(dx, dy);
      if (len < 2) continue;
      const ux = dx / len, uy = dy / len, hs = 9 / z;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(to[0] - ux * hs, to[1] - uy * hs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(to[0], to[1]);
      ctx.lineTo(to[0] - ux * hs - uy * hs * 0.6, to[1] - uy * hs + ux * hs * 0.6);
      ctx.lineTo(to[0] - ux * hs + uy * hs * 0.6, to[1] - uy * hs - ux * hs * 0.6);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawLabels(G, ctx, z) {
    const R = this.map.regions;
    const vis = this.visible || [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const showNames = z >= 2.4;
    for (const id of vis) {
      const r = R[id], st = G.regions[id];
      if (!st) continue;
      const s = r.lr * z;
      const mine = st.owner === G.you && G.you >= 0;
      const important = mine || G.selected.has(id) || G.hover === id || st.capital;
      if (s < 6.5 && !important && z < 3) continue;
      const scale = 1 / z;
      const fsPx = Math.max(10, Math.min(15, 9 + s * 0.12));
      const fs = fsPx * scale;
      const text = st.hidden ? '?' : fmt(st.troops);
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`;
      const tw = ctx.measureText(text).width;
      const capW = st.capital ? fs * 0.9 : 0;
      const w = tw + fs * 0.9 + capW, h = fs * 1.25;
      let x = r.cx, y = r.cy;
      if (showNames && s > 20) y += fs * 0.55;
      const owner = st.owner >= 0 ? G.players[st.owner] : null;
      // Pille
      ctx.fillStyle = 'rgba(8,12,22,0.78)';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = owner ? owner.color : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.3 * scale; ctx.stroke();
      ctx.fillStyle = '#fff';
      if (st.capital) {
        ctx.fillStyle = '#ffd36b';
        ctx.fillText('★', x - w / 2 + fs * 0.45 + capW * 0.4, y);
        ctx.fillStyle = '#fff';
      }
      ctx.fillText(text, x + capW / 2, y + fs * 0.06);
      // Gebäude
      if (!st.hidden && (st.b[0] || st.b[1] || st.b[2]) && s > 9) {
        const icons = [];
        if (st.b[0]) icons.push(['⚙', st.b[0]]);
        if (st.b[1]) icons.push(['⚔', st.b[1]]);
        if (st.b[2]) icons.push(['⛨', st.b[2]]);
        const ifs = fs * 0.72;
        ctx.font = `600 ${ifs}px Rajdhani, sans-serif`;
        const str = icons.map(([i, l]) => i + l).join(' ');
        const iw = ctx.measureText(str).width + ifs * 0.6;
        const iy = y + h / 2 + ifs * 0.7;
        ctx.fillStyle = 'rgba(8,12,22,0.7)'; roundRect(ctx, x - iw / 2, iy - ifs * 0.62, iw, ifs * 1.24, ifs * 0.4); ctx.fill();
        ctx.fillStyle = '#ffd36b'; ctx.fillText(str, x, iy + ifs * 0.05);
      }
      if (showNames && s > 20) {
        const nfs = Math.min(13, 6 + s * 0.08) * scale;
        ctx.font = `600 ${nfs}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2.5 * scale;
        ctx.strokeText(r.name, r.cx, y - h / 2 - nfs * 0.8);
        ctx.fillText(r.name, r.cx, y - h / 2 - nfs * 0.8);
      }
    }
  }

  drawEffects(ctx, now, z) {
    this.effects = this.effects.filter(e => now - e.t0 < 1200);
    for (const e of this.effects) {
      const k = (now - e.t0) / 1200;
      ctx.save();
      if (e.kind === 'capture') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = e.color; ctx.lineWidth = (3 * (1 - k) + 0.5) / z;
        ctx.beginPath(); ctx.arc(e.x, e.y, (6 + 40 * k) / Math.sqrt(z), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = e.color; ctx.fill(this.paths[e.id], 'evenodd');
      } else if (e.kind === 'strike') {
        ctx.globalAlpha = 1 - k;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 30 / Math.sqrt(z));
        g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.4, 'rgba(255,120,40,0.8)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, (10 + 30 * k) / Math.sqrt(z), 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'repel') {
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / z;
        ctx.beginPath(); ctx.arc(e.x, e.y, (4 + 14 * k) / Math.sqrt(z), 0, Math.PI * 2); ctx.stroke();
      } else if (e.kind === 'build') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd36b';
        ctx.font = `700 ${14 / z}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('▲', e.x, e.y - (12 + 20 * k) / z);
      }
      ctx.restore();
    }
  }

  // Minimap (selten neu gezeichnet)
  drawMinimap(canvas, G) {
    const g = canvas.getContext('2d');
    const s = canvas.width / this.W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bg, 0, 0, canvas.width, canvas.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    for (const r of this.map.regions) { g.fillStyle = this.regionColor(r.id, G); g.fill(this.paths[r.id], 'evenodd'); }
    const [x0, y0, x1, y1] = this.viewBounds();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5 / s;
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
}

export function fmt(n) {
  n = Math.floor(n);
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
