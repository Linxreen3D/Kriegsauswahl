// Autoritative RTS-Simulation: Einheiten, Gebäude, Rohstoffe, Kampf, Sicht, Netzwerk-Diffs.
import {
  TICK_MS, RES, ERAS, CULTURES, NATIONS, LINES, UNIQUE, UNIQUE_MIN_ERA, BUILDINGS, RESOURCE_TYPES, RESOURCE_KINDS,
  FARM_RATE, CARRY, MAX_POP, DMG, TYPE_INDEX, unitStats, buildingStats, playerMods, unitKey, trainable, sumCost,
  WONDER, WONDER_ERA, wonderHold, LATE_STAGE, eraCost, scaleCost, NATION_UNIT, EVENTS, inGroup, isProducer, DEPOSIT_LAYERS, hasLayers,
  VET_RANKS, VET_BONUS, FORMATIONS, FORMATION_KEYS, SUPPLY_RANGE, SUPPLY_GRACE,
  seasonAt, PROVINCE_BONUS, PROVINCE_WEIGHT, RAIL,
} from '../shared/rules.js';
import { installDiplomacy } from './diplomacy.js';
import { installRail } from './rail.js';
import { installNaval } from './naval.js';
import { installAir } from './air.js';
import { installCelo } from './celo.js';
import { installLeaders } from './leaders.js';
import { installNukes } from './nukes.js';
import { installConference } from './conference.js';
import { generateMap, blockedTerrain, waterTerrain, T_HILL, T_SNOW, T_DESERT, T_SWAMP, T_FORD, T_GRASS, T_DIRT } from './mapgen.js';

const CAMO = { inf: 1, spr: 1, rng: 1, sup: 1 }; // im Wald getarnt
const isVehicle = u => (u.cls === 'cav' && u.era >= 6) || u.cls === 'art' || u.cls === 'sie';

const RADIUS = { wrk: 0.3, inf: 0.3, spr: 0.3, rng: 0.3, cav: 0.42, sie: 0.48, art: 0.48, sup: 0.3, env: 0.3, spy: 0.3, trn: 0.5, shp: 0.7, sub: 0.6, air: 0.5, bmb: 0.6, hel: 0.6, aa: 0.45 };
const MILITARY = cls => cls !== 'wrk' && cls !== 'sup' && cls !== 'env' && cls !== 'spy';
const AIRCLS = { air: 1, bmb: 1, hel: 1 }; // kämpft selbstständig
const START_RES = { low: { food: 150, wood: 150, stone: 50, gold: 50 }, normal: { food: 250, wood: 250, stone: 150, gold: 100 }, high: { food: 600, wood: 600, stone: 400, gold: 400 } };
const ST = { idle: 0, move: 1, attack: 2, gather: 3, build: 4, carry: 5 };
const DIRS = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
const CELL = 4;

// vorberechnete Kreis-Offsets für Sichtweiten
const CIRCLES = [];
for (let r = 0; r <= 14; r++) {
  const o = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) o.push(dx, dy);
  CIRCLES.push(o);
}

export class World {
  constructor(room, players, settings, seed) {
    this.room = room;
    this.settings = settings;
    this.time = 0;
    this.tickNo = 0;
    this.nextId = 1;
    const map = generateMap({ players: players.length, seed, size: settings.mapSize, type: settings.mapType, resources: settings.resources });
    this.mapInfo = { type: map.mapType, name: map.mapName };
    this.W = map.w; this.H = map.h;
    this.terrain = map.terrain;
    this.prov = map.prov; this.provinces = map.provinces;
    this.provOwner = new Int16Array(map.provinces.length).fill(-1); this.provDirty = true;
    const N = this.W * this.H;
    this.road = new Uint8Array(N);
    this.pass = new Uint8Array(N);
    this.occ = new Int32Array(N); // Entity-ID auf der Kachel (Gebäude/Rohstoff)
    for (let i = 0; i < N; i++) this.pass[i] = blockedTerrain(this.terrain[i]) ? 0 : 1;
    this.blockVer = 1;
    this.fields = new Map();
    this.fieldBudget = 0;
    this.units = [];
    this.buildings = [];
    this.resources = new Map();
    this.ents = new Map();
    this.events = [];
    this.resChanged = new Set();
    this.resRemoved = [];
    this.meteors = [];
    this.cellsW = Math.ceil(this.W / CELL); this.cellsH = Math.ceil(this.H / CELL);
    this.cells = Array.from({ length: this.cellsW * this.cellsH }, () => []);
    this.bcells = Array.from({ length: this.cellsW * this.cellsH }, () => []);

    // Spielerzustände
    const teams = settings.mode === 'teams';
    this.P = players.map((p, i) => ({
      id: p.id, name: p.name, color: p.color, isBot: p.isBot, team: teams ? (p.team || 1) : 100 + p.id,
      res: { ...(START_RES[settings.resources] || START_RES.normal) }, era: settings.startEra || 0, culture: null, nation: null,
      mods: playerMods(null, null), pop: 0, popCap: 0, alive: true, advancing: null, choice: null, late: false, lateResearch: null,
      stats: { gathered: 0, kills: 0, lost: 0, trained: 0, built: 0, razed: 0 }, history: [], defeatedAt: null, start: map.starts[i],
    }));
    { const byId = []; for (const pl of this.P) byId[pl.id] = pl; this.P = byId; }
    for (const pl of this.P) if (pl.era >= 1) pl.choice = 'culture';
    for (const r of map.resources) this.addResource(r.type, r.x, r.y, r.mul);
    this.computeTreeDensity();
    this.initDiplomacy();
    this.initRail();
    this.buildWPass();
    // Startbasis
    for (const pl of this.P) {
      const s = pl.start;
      const tc = this.addBuilding(pl.id, 'town', s.x - 1, s.y - 1, true);
      if (!tc) continue;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.6;
        this.addUnit(pl.id, 'worker', null, s.x + 0.5 + Math.cos(a) * 2.6, s.y + 0.5 + Math.sin(a) * 2.6);
      }
      if (pl.era >= 1) this.addUnit(pl.id, 'inf', null, s.x + 3.5, s.y + 0.5);
    }
    this.recount();
  }

  // ---------------- Grundlagen ----------------
  idx(x, y) { return y * this.W + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  passableAt(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return this.inBounds(tx, ty) && this.pass[ty * this.W + tx] === 1; }

  addResource(type, x, y, mul = 1) {
    const d = RESOURCE_TYPES[type];
    const r = { id: this.nextId++, kind: 'r', rtype: type, res: d.res, amount: Math.round(d.amount * mul), base: Math.round(d.amount * mul), layer: 0, depleted: false, x, y, size: d.size, cx: x + d.size / 2, cy: y + d.size / 2 };
    for (let yy = y; yy < y + d.size; yy++) for (let xx = x; xx < x + d.size; xx++) { const i = this.idx(xx, yy); this.pass[i] = 0; this.occ[i] = r.id; this.updateWTile(i); }
    this.resources.set(r.id, r); this.ents.set(r.id, r);
    return r;
  }
  // Anzahl Bäume im 3×3-Umfeld je Kachel (Wald: Tarnung für Infanterie, bremst Fahrzeuge)
  computeTreeDensity() {
    this.treeD = new Uint8Array(this.W * this.H);
    for (const r of this.resources.values()) if (r.rtype === 'tree') this.treeAdd(r, 1);
  }
  treeAdd(r, d) {
    for (let yy = r.y - 1; yy <= r.y + 1; yy++) for (let xx = r.x - 1; xx <= r.x + 1; xx++) if (this.inBounds(xx, yy)) this.treeD[this.idx(xx, yy)] += d;
  }
  inForest(u) { return this.treeD[this.idx(Math.floor(u.x), Math.floor(u.y))] >= 3; }
  tileAt(u) { return this.terrain[this.idx(Math.min(this.W - 1, Math.max(0, Math.floor(u.x))), Math.min(this.H - 1, Math.max(0, Math.floor(u.y))))]; }
  season() { return seasonAt(this.time); }
  ownProvince(pid, x, y) { const p = this.prov[this.idx(Math.floor(x), Math.floor(y))]; return p !== 65535 && this.provOwner[p] === pid; }
  removeResource(r) {
    if (r.rtype === 'tree' && this.treeD) this.treeAdd(r, -1);
    for (let yy = r.y; yy < r.y + r.size; yy++) for (let xx = r.x; xx < r.x + r.size; xx++) {
      const i = this.idx(xx, yy); this.occ[i] = 0; if (!blockedTerrain(this.terrain[i])) this.pass[i] = 1; this.updateWTile(i);
    }
    this.resources.delete(r.id); this.ents.delete(r.id);
    this.resRemoved.push(r.id);
    this.resChanged.delete(r.id);
  }

  canPlace(type, x, y) {
    const sz = BUILDINGS[type].size, water = BUILDINGS[type].onWater;
    for (let yy = y; yy < y + sz; yy++) for (let xx = x; xx < x + sz; xx++) {
      if (!this.inBounds(xx, yy)) return false;
      const i = this.idx(xx, yy), t = this.terrain[i];
      if (this.occ[i]) return false;
      if (water ? !waterTerrain(t) : (blockedTerrain(t) || t === T_FORD)) return false;
    }
    if (BUILDINGS[type].coastal && !this.coastal(x, y, sz)) return false;
    return true;
  }
  addBuilding(owner, type, x, y, built = false) {
    if (!this.canPlace(type, x, y)) return null;
    const pl = this.P[owner];
    const st = buildingStats(type, pl.era, pl.mods);
    const b = {
      id: this.nextId++, kind: 'b', owner, type, typeIdx: TYPE_INDEX[type], x, y, size: st.size, cx: x + st.size / 2, cy: y + st.size / 2,
      st, maxHp: st.hp, hp: built ? st.hp : 1, built, progress: built ? 1 : 0, queue: [], qProg: 0, rally: null, cd: 0, worker: 0, era: pl.era,
    };
    for (let yy = y; yy < y + b.size; yy++) for (let xx = x; xx < x + b.size; xx++) {
      const i = this.idx(xx, yy);
      this.occ[i] = b.id;
      if (!st.walkable) this.pass[i] = 0;
      this.updateWTile(i);
    }
    if (!st.walkable) { this.blockVer++; this.evictUnits(b); }
    this.buildings.push(b); this.ents.set(b.id, b);
    this.bcells[this.cellOf(b.cx, b.cy)].push(b);
    return b;
  }
  evictUnits(b) {
    for (const u of this.units) {
      if (u.x >= b.x - 0.2 && u.x <= b.x + b.size + 0.2 && u.y >= b.y - 0.2 && u.y <= b.y + b.size + 0.2 && !this.passableAt(u.x, u.y)) {
        const p = this.nearestFree(u.x, u.y);
        if (p) { u.x = p[0]; u.y = p[1]; }
      }
    }
  }
  nearestFree(x, y, maxR = 12) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (!this.inBounds(nx, ny) || !this.pass[this.idx(nx, ny)]) continue;
        const d = (nx + 0.5 - x) ** 2 + (ny + 0.5 - y) ** 2;
        if (d < bd) { bd = d; best = [nx + 0.5, ny + 0.5]; }
      }
      if (best) return best;
    }
    return null;
  }
  removeBuilding(b) {
    if (b.built && this.railAt) this.railMark(b, 0);
    if (b.type === 'station' && b.waiting) { for (const w of b.waiting) this.unboard(this.ents.get(w.id), null, b); b.waiting = []; }
    for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) {
      const i = this.idx(xx, yy);
      if (this.occ[i] === b.id) { this.occ[i] = 0; this.pass[i] = blockedTerrain(this.terrain[i]) ? 0 : 1; this.road[i] = 0; this.updateWTile(i); }
    }
    this.blockVer++;
    if (b.type === 'bridge' && b.built && this.units) {
      // Einsturz: Infanterie stürzt ins Wasser und schwimmt ans Ufer, Fahrzeuge gehen verloren
      for (const u of this.units) {
        if (u.dead || Math.floor(u.x) !== b.x || Math.floor(u.y) !== b.y) continue;
        if (isVehicle(u) || u.cls === 'cav') { this.kill(u, -1); continue; }
        const p = this.nearestFree(u.x, u.y, 8); if (p) { u.x = p[0]; u.y = p[1]; }
        this.damage(u, u.maxHp * 0.5, -1);
      }
    }
    const c = this.bcells[this.cellOf(b.cx, b.cy)];
    const k = c.indexOf(b); if (k >= 0) c.splice(k, 1);
    this.ents.delete(b.id);
    b.dead = true;
    this.fields.delete('e' + b.id);
  }

  addUnit(owner, line, unique, x, y) {
    const pl = this.P[owner];
    const era = Math.max(pl.era, LINES[line].minEra);
    const st = unitStats(line, era, unique, pl.mods);
    const u = {
      id: this.nextId++, kind: 'u', owner, line, unique, era, cls: st.cls, typeIdx: TYPE_INDEX[unitKey(line, era, unique)], st,
      x, y, hp: st.hp, maxHp: st.hp, r: RADIUS[st.cls], order: { t: 'idle' }, state: ST.idle, cd: 0, carry: null,
      scan: Math.random() * 0.5, stuck: 0, lastProg: 0, buildQ: [],
      xp: 0, rank: 0, morale: 100, unsup: 0, form: 'none', naval: !!st.naval, air: !!st.air,
    };
    if (u.air) { u.fuel = st.fuel; u.ammo = st.ammo; }
    this.units.push(u); this.ents.set(u.id, u);
    return u;
  }
  cellOf(x, y) { return Math.min(this.cellsH - 1, Math.max(0, Math.floor(y / CELL))) * this.cellsW + Math.min(this.cellsW - 1, Math.max(0, Math.floor(x / CELL))); }

  // ---------------- Wegfindung (Flow-Fields mit Cache) ----------------
  field(key, sourcesFn) {
    if (this.pass === this.wpass) key = 'w' + key;
    let f = this.fields.get(key);
    if (f && f.ver === this.blockVer) { f.used = this.tickNo; return f.dist; }
    if (this.fieldBudget > 0) {
      this.fieldBudget--;
      const src = sourcesFn();
      const dist = this.dijkstra(src);
      f = { dist, ver: this.blockVer, used: this.tickNo };
      this.fields.set(key, f);
      if (this.fields.size > 260) {
        let oldK = null, oldU = Infinity;
        for (const [k, v] of this.fields) if (v.used < oldU) { oldU = v.used; oldK = k; }
        this.fields.delete(oldK);
      }
      return dist;
    }
    if (f) { f.used = this.tickNo; return f.dist; } // veraltet, aber besser als nichts
    return null;
  }
  dijkstra(sources) {
    const W = this.W, H = this.H, N = W * H, pass = this.pass;
    const dist = new Uint16Array(N).fill(65535);
    const heap = this.heap || (this.heap = new Float64Array(N * 4));
    let hn = 0;
    const push = v => {
      let i = hn++; heap[i] = v;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
    };
    const pop = () => {
      const top = heap[0]; heap[0] = heap[--hn];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < hn && heap[l] < heap[m]) m = l;
        if (r < hn && heap[r] < heap[m]) m = r;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
      return top;
    };
    for (const s of sources) { if (s >= 0 && s < N && dist[s] !== 0) { dist[s] = 0; push(s); } }
    while (hn > 0) {
      if (hn > heap.length - 16) break;
      const v = pop();
      const d = Math.floor(v / 65536), i = v - d * 65536;
      if (d > dist[i]) continue;
      const x = i % W, y = (i - x) / W;
      for (let k = 0; k < 8; k++) {
        const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!pass[j]) continue;
        if (k >= 4 && (!pass[y * W + nx] || !pass[ny * W + x])) continue;
        const nd = d + DIRS[k][2];
        if (nd < dist[j] && nd < 65000) { dist[j] = nd; push(nd * 65536 + j); }
      }
    }
    return dist;
  }
  pointSources(tx, ty) {
    // Ziel-Kachel; falls blockiert, nächste freie
    if (this.inBounds(tx, ty) && this.pass[this.idx(tx, ty)]) return [this.idx(tx, ty)];
    const p = this.nearestFree(tx + 0.5, ty + 0.5, 20);
    return p ? [this.idx(Math.floor(p[0]), Math.floor(p[1]))] : [];
  }
  rectSources(e) {
    const out = [];
    const sz = e.size || 1;
    for (let yy = e.y; yy < e.y + sz; yy++) for (let xx = e.x; xx < e.x + sz; xx++) if (this.inBounds(xx, yy)) out.push(this.idx(xx, yy));
    return out;
  }
  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.4);
    for (let k = 1; k < n; k++) if (!this.passableAt(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return false;
    return true;
  }

  // Bewegt Einheit u Richtung Ziel; liefert true, solange unterwegs.
  steer(u, tx, ty, fieldKey, srcFn, dt) {
    let gx = tx, gy = ty;
    const dxg = tx - u.x, dyg = ty - u.y, dg = Math.hypot(dxg, dyg);
    if (dg > 1.5 && !(dg < 14 && this.lineClear(u.x, u.y, tx, ty))) {
      const dist = this.field(fieldKey, srcFn);
      if (!dist) { u.state = ST.move; return true; } // warten auf Feld
      const cx = Math.floor(u.x), cy = Math.floor(u.y);
      const ci = this.idx(cx, cy);
      let best = -1, bd = dist[ci];
      // Vorausschau: weiteste direkt erreichbare Kachel entlang des Feldes (bis 4 Schritte)
      let px = cx, py = cy;
      for (let step = 0; step < 4; step++) {
        let nb = -1, nbd = step === 0 ? bd : dist[py * this.W + px];
        for (let k = 0; k < 8; k++) {
          const nx = px + DIRS[k][0], ny = py + DIRS[k][1];
          if (!this.inBounds(nx, ny)) continue;
          const j = ny * this.W + nx;
          if (!this.pass[j]) continue;
          if (k >= 4 && (!this.pass[py * this.W + nx] || !this.pass[ny * this.W + px])) continue;
          if (dist[j] < nbd) { nbd = dist[j]; nb = j; }
        }
        if (nb < 0) break;
        const nx = nb % this.W, ny = (nb - nx) / this.W;
        if (step > 0 && !this.lineClear(u.x, u.y, nx + 0.5, ny + 0.5)) break;
        best = nb; px = nx; py = ny;
        if (nbd === 0) break;
      }
      if (best >= 0) { gx = (best % this.W) + 0.5; gy = Math.floor(best / this.W) + 0.5; }
      else if (bd >= 65535) { return false; } // unerreichbar
    }
    const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
    if (d < 0.02) return true;
    const sp = Math.min(d, this.speedOf(u) * dt);
    let nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
    if (u.st.railOnly && !this.railAt[this.idx(Math.floor(nx), Math.floor(ny))]) { u.state = ST.idle; return false; }
    if (this.passableAt(nx, ny)) { u.x = nx; u.y = ny; } else if (this.passableAt(nx, u.y)) u.x = nx; else if (this.passableAt(u.x, ny)) u.y = ny;
    u.dir = Math.atan2(dy, dx);
    u.state = u.carry && u.carry.amt > 0 && u.order.t === 'gather' ? ST.carry : ST.move;
    return true;
  }
  // Abstand Einheit -> Entity (Rechteck oder Kreis)
  distTo(u, e) {
    if (e.kind === 'u') return Math.max(0, Math.hypot(e.x - u.x, e.y - u.y) - e.r);
    const sz = e.size || 1;
    const qx = Math.max(e.x, Math.min(e.x + sz, u.x)), qy = Math.max(e.y, Math.min(e.y + sz, u.y));
    return Math.hypot(qx - u.x, qy - u.y);
  }
  // Bewegung zu Entity, bis Abstand <= range
  approach(u, e, range, dt) {
    if (this.distTo(u, e) <= range + u.r) return false;
    let key, src;
    if (e.kind === 'u') {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      key = 'p' + tx + ',' + ty; src = () => this.pointSources(tx, ty);
    } else { key = 'e' + e.id; src = () => this.rectSources(e); }
    const tx = e.kind === 'u' ? e.x : e.cx, ty = e.kind === 'u' ? e.y : e.cy;
    const moving = this.steer(u, tx, ty, key, src, dt);
    if (!moving) return 'fail';
    return true;
  }

  // ---------------- Befehle ----------------
  command(pid, c) {
    const pl = this.P[pid];
    if (!pl || !pl.alive) return;
    if (this.conf && this.conf.paused) return; // Konferenzpause
    const own = ids => (Array.isArray(ids) ? ids : []).slice(0, 300).map(id => this.ents.get(id)).filter(e => e && e.owner === pid && !e.dead && !e.aboard && e.line !== 'train');
    switch (c.c) {
      case 'move': {
        const us = own(c.ids).filter(e => e.kind === 'u');
        const sea = us.filter(u => u.naval), air = us.filter(u => u.air);
        this.groupMove(us.filter(u => !u.naval && !u.air), +c.x, +c.y, !!c.amove);
        air.forEach((u, k) => { u.order = { t: c.amove ? 'amove' : 'move', x: +c.x + (k % 4) * 0.8, y: +c.y + Math.floor(k / 4) * 0.8 }; });
        if (sea.length) this.withWater(() => this.groupMove(sea, +c.x, +c.y, !!c.amove));
        break;
      }
      case 'attack': {
        const t = this.ents.get(c.target);
        if (!t || t.dead || t.kind === 'r') return;
        for (const u of own(c.ids)) if (u.kind === 'u' && u.cls !== 'env') { u.order = { t: 'attack', target: t.id, forced: true }; u.buildQ = []; }
        break;
      }
      case 'gather': {
        const t = this.ents.get(c.target);
        if (!t) return;
        if (t.kind === 'r' && t.depleted && !this.canDeepen(t, pid)) {
          const nx = DEPOSIT_LAYERS[t.layer + 1];
          this.notice(pid, `Erschöpft. Die nächste Schicht (${nx.name}) lässt sich ab der Epoche „${ERAS[nx.era].name}“ abbauen.`);
          return;
        }
        for (const u of own(c.ids)) if (u.kind === 'u' && u.cls === 'wrk' && (u.naval === (t.rtype === 'fish'))) this.orderGather(u, t);
        break;
      }
      case 'repair': {
        const t = this.ents.get(c.target);
        if (!t || t.kind !== 'b' || !this.allied(t.owner, pid)) return;
        for (const u of own(c.ids)) if (u.kind === 'u' && u.cls === 'wrk') { u.order = { t: 'build', target: t.id }; u.buildQ = []; }
        break;
      }
      case 'build': {
        const type = c.type;
        const bd = BUILDINGS[type];
        if (!bd || pl.era < bd.minEra) return;
        { const why = this.buildBlocked(pl, type); if (why) { this.notice(pid, why); return; } }
        const workers = own(c.ids).filter(e => e.kind === 'u' && e.cls === 'wrk');
        const pos = (Array.isArray(c.pos) ? c.pos : []).slice(0, 60);
        const placed = [];
        for (const [x, y] of pos) {
          const st = buildingStats(type, pl.era, pl.mods);
          if (!this.canAfford(pl, st.cost)) { this.notice(pid, 'Nicht genug Rohstoffe.'); break; }
          if (!this.canPlace(type, x | 0, y | 0)) continue;
          this.pay(pl, st.cost);
          const b = this.addBuilding(pid, type, x | 0, y | 0, false);
          if (b && type === 'nukelab') this.event({ k: 'notice', to: -1, text: '☢ Jemand baut ein Atomforschungszentrum.' });
          if (b) placed.push(b.id);
        }
        if (placed.length && workers.length) {
          for (const u of workers) {
            if (c.queue && u.order.t === 'build') u.buildQ.push(...placed);
            else { u.order = { t: 'build', target: placed[0] }; u.buildQ = placed.slice(1); }
          }
        }
        break;
      }
      case 'train': {
        const bs = own(c.ids).filter(e => e.kind === 'b' && e.built);
        const n = Math.min(10, Math.max(1, c.n | 0));
        for (let k = 0; k < n; k++) {
          // auf Gebäude mit kürzester Warteschlange verteilen
          bs.sort((a, b) => a.queue.length - b.queue.length);
          const b = bs.find(x => trainable(x.type, pl.era, pl.culture, pl.nation, pl.late).some(t => t.line === c.line && (t.unique || null) === (c.unique || null)));
          if (!b || b.queue.length >= 15) break;
          const st = unitStats(c.line, Math.max(pl.era, LINES[c.line].minEra), c.unique || null, pl.mods);
          if (!this.canAfford(pl, st.cost)) { this.notice(pid, 'Nicht genug Rohstoffe.'); break; }
          if (st.sig && pl.armsLimitUntil > this.time) { this.notice(pid, 'Rüstungsbeschränkung: vorerst keine Signatur-Einheiten.'); break; }
          if (st.sig && this.countUnique(pid, c.unique) >= st.max) { this.notice(pid, `${st.name}: höchstens ${st.max} gleichzeitig.`); break; }
          this.pay(pl, st.cost);
          b.queue.push({ line: c.line, unique: c.unique || null, cost: st.cost, time: st.time });
          if (st.sig && NATION_UNIT[c.unique] && NATION_UNIT[c.unique].costMul >= 3) this.event({ k: 'notice', to: -1, text: `⚠ ${pl.name} baut eine Superwaffe: ${st.name}!` });
        }
        break;
      }
      case 'era': {
        const b = own([c.id])[0];
        if (!b || b.type !== 'town' || !b.built || pl.advancing || pl.era >= ERAS.length - 1 || pl.choice) return;
        if (pl.lateResearch) { this.notice(pid, 'Erst die laufende Forschung abschließen.'); return; }
        const next = ERAS[pl.era + 1], cost = pl.eraDiscount ? scaleCost(eraCost(pl.era + 1, this.leaderEra()), 1 - pl.eraDiscount) : eraCost(pl.era + 1, this.leaderEra());
        if (!this.canAfford(pl, cost)) { this.notice(pid, 'Nicht genug Rohstoffe für die nächste Epoche.'); return; }
        this.pay(pl, cost);
        b.queue.unshift({ era: pl.era + 1, cost, time: next.time / (pl.mods.eraSpeed || 1) * (pl.eraFast || 1) });
        pl.eraFast = null;
        pl.eraDiscount = 0;
        b.qProg = 0;
        pl.advancing = b.id;
        break;
      }
      case 'late': {
        const b = own([c.id])[0];
        if (!b || b.type !== 'town' || !b.built || pl.era !== LATE_STAGE.era || pl.late || pl.lateResearch || pl.advancing) return;
        if (!this.canAfford(pl, LATE_STAGE.cost)) { this.notice(pid, `Nicht genug Rohstoffe für „${LATE_STAGE.name}“.`); return; }
        this.pay(pl, LATE_STAGE.cost);
        b.queue.unshift({ late: true, cost: LATE_STAGE.cost, time: LATE_STAGE.time });
        b.qProg = 0;
        pl.lateResearch = b.id;
        break;
      }
      case 'wonder': {
        const b = own([c.id])[0];
        if (!b || b.type !== 'town' || !b.built || b.wonder || pl.era < ERAS.length - 1 || pl.wonderBuilding) return;
        if (this.buildings.some(x => !x.dead && x.owner === pid && x.wonder)) { this.notice(pid, 'Du besitzt bereits ein Weltwunder.'); return; }
        if (!this.canAfford(pl, WONDER.cost)) { this.notice(pid, 'Nicht genug Rohstoffe für das Weltwunder.'); return; }
        this.pay(pl, WONDER.cost);
        b.queue.unshift({ wonder: true, cost: WONDER.cost, time: WONDER.time });
        b.qProg = 0;
        pl.wonderBuilding = b.id;
        this.event({ k: 'wonder', p: pid, what: 'start' });
        break;
      }
      case 'cancel': {
        const b = own([c.id])[0];
        if (!b || b.kind !== 'b') return;
        const k = c.index | 0;
        const q = b.queue[k];
        if (!q) return;
        b.queue.splice(k, 1);
        if (k === 0) b.qProg = 0;
        this.refund(pl, q.cost);
        if (q.era) pl.advancing = null;
        if (q.late) pl.lateResearch = null;
        if (q.wonder) { pl.wonderBuilding = null; this.event({ k: 'wonder', p: pid, what: 'cancel' }); }
        break;
      }
      case 'rally': {
        for (const b of own(c.ids)) if (b.kind === 'b') b.rally = { x: +c.x, y: +c.y, target: c.target || 0 };
        break;
      }
      case 'spy': {
        for (const u of own(c.ids)) if (u.kind === 'u') this.spyCommand(pid, u, c.mission, c.target);
        break;
      }
      case 'board': {
        this.boardCommand(pid, own(c.ids).filter(e => e.kind === 'u'), this.ents.get(c.ship));
        break;
      }
      case 'unload': {
        for (const s of own(c.ids)) if (s.kind === 'u' && s.st.capacity) this.unloadCommand(s, +c.x, +c.y);
        break;
      }
      case 'guard': {
        const t = this.ents.get(c.target);
        for (const u of own(c.ids)) if (u.st.celo && t && !t.dead && this.allied(t.owner, pid) && t !== u) {
          if (u.guarding) { const old = this.ents.get(u.guarding); if (old && old.guardedBy === u.id) old.guardedBy = null; }
          u.guarding = t.id; t.guardedBy = u.id; u.order = { t: 'idle' };
          this.notice(pid, `🛡 Celo schützt jetzt: ${t.kind === 'u' ? t.st.name : BUILDINGS[t.type].name}.`);
        }
        break;
      }
      case 'protect': {
        for (const u of own(c.ids)) if (u.st.celo) {
          if (u.protectCd > this.time) { this.notice(pid, `Personenschutz wieder bereit in ${Math.ceil(u.protectCd - this.time)} s.`); continue; }
          const t = this.ents.get(u.guarding);
          if (!t || t.dead) { this.notice(pid, 'Celo braucht zuerst ein Schutzziel (Rechtsklick auf eine eigene Einheit oder ein Gebäude).'); continue; }
          t.invulnUntil = this.time + 8; u.protectCd = this.time + 180;
          this.notice(pid, '🛡 Personenschutz: 8 Sekunden lang ist das Schutzziel unverwundbar.');
        }
        break;
      }
      case 'leader': this.leaderAbility(pl, c); break;
      case 'nukeBuild': this.nukeBuildCommand(pl, own([c.id])[0]); break;
      case 'nuke': this.nukeLaunchCommand(pl, +c.x, +c.y); break;
      case 'paradrop': {
        this.paradropCommand(pid, own(c.ids).filter(e => e.kind === 'u'), +c.x, +c.y);
        break;
      }
      case 'rail': {
        this.railCommand(pid, own(c.ids).filter(e => e.kind === 'u'), this.ents.get(c.to));
        break;
      }
      case 'formation': {
        const f = FORMATIONS[c.f];
        if (!f || (f.minEra && pl.era < f.minEra)) return;
        const us = own(c.ids).filter(e => e.kind === 'u' && e.cls !== 'wrk');
        for (const u of us) u.form = c.f;
        // laufende Bewegung in der neuen Aufstellung neu ordnen
        const moving = us.filter(u => (u.order.t === 'move' || u.order.t === 'amove') && u.order.gx != null);
        if (moving.length) this.groupMove(moving, moving[0].order.gx, moving[0].order.gy, moving[0].order.t === 'amove');
        break;
      }
      case 'stop':
        for (const u of own(c.ids)) if (u.kind === 'u') { u.order = { t: 'idle' }; u.buildQ = []; }
        break;
      case 'delete':
        for (const e of own(c.ids)) {
          if (e.kind === 'b' && e.st.decor) continue;
          if (e.kind === 'b' && !e.built) this.refund(pl, e.st.cost);
          this.kill(e, -1);
        }
        break;
      case 'choose': {
        if (c.kind === 'culture' && pl.choice === 'culture' && CULTURES[c.value]) {
          pl.culture = c.value; pl.choice = pl.era >= 3 ? 'nation' : null;
          this.updateMods(pl);
          this.event({ k: 'choice', p: pid, what: 'culture', v: c.value });
        } else if (c.kind === 'nation' && pl.choice === 'nation' && pl.culture && CULTURES[pl.culture].nations.includes(c.value)) {
          pl.nation = c.value; pl.choice = null;
          this.updateMods(pl);
          this.event({ k: 'choice', p: pid, what: 'nation', v: c.value });
          this.checkLeaderChoice(pl);
        } else if (c.kind === 'leader' && pl.choice === 'leader') this.chooseLeader(pl, c.value);
        break;
      }
      default:
    }
  }
  canAfford(pl, cost) { for (const k in cost) if ((pl.res[k] || 0) < cost[k]) return false; return true; }
  pay(pl, cost) { for (const k in cost) pl.res[k] -= cost[k]; }
  refund(pl, cost) { for (const k in cost) pl.res[k] += cost[k]; }
  updateMods(pl) {
    pl.mods = playerMods(pl.culture, pl.nation, pl.late, pl.leader);
  }
  countUnique(pid, uq) { let n = 0; for (const u of this.units) if (!u.dead && u.owner === pid && u.unique === uq) n++; for (const b of this.buildings) if (b.owner === pid) for (const q of b.queue) if (q.unique === uq) n++; return n; }
  leaderEra() { let m = 0; for (const p of this.P) if (p.alive && p.era > m) m = p.era; return m; }
  // Steam-Errungenschaft für menschliche Spieler (einmal je Partie und Spieler)
  achieve(pid, id) {
    const pl = this.P[pid]; if (!pl || pl.isBot) return;
    const k = pid + ':' + id; this.achSent = this.achSent || {}; if (this.achSent[k]) return; this.achSent[k] = true;
    this.events.push({ k: 'ach', to: pid, id });
  }
  notice(pid, text) { this.events.push({ k: 'notice', to: pid, text }); }
  event(e) { this.events.push(e); }

  groupMove(us, x, y, amove) {
    const rail = us.filter(u => u.st.railOnly);
    if (rail.length) { for (const u of rail) this.railMoveCommand(u, x, y, amove); us = us.filter(u => !u.st.railOnly); }
    if (!us.length) return;
    x = Math.max(0.5, Math.min(this.W - 0.5, x)); y = Math.max(0.5, Math.min(this.H - 0.5, y));
    let cx = 0, cy = 0;
    for (const u of us) { cx += u.x; cy += u.y; }
    cx /= us.length; cy /= us.length;
    const tx = Math.floor(x), ty = Math.floor(y);
    const key = 'p' + tx + ',' + ty;
    const form = us.every(u => u.form === us[0].form) ? us[0].form : 'none';
    const slots = form !== 'none' && us.length > 1 ? this.formationSlots(form, us.length, x - cx, y - cy) : null;
    let order = us;
    if (slots) {
      // Einheiten den Plätzen zuordnen: nach Lage quer zur Marschrichtung, damit sich niemand kreuzt
      const dl = Math.hypot(x - cx, y - cy) || 1, px = -(y - cy) / dl, py = (x - cx) / dl;
      order = us.slice().sort((a, b) => (a.x * px + a.y * py) - (b.x * px + b.y * py));
      const idx = slots.map((sl, i) => i).sort((a, b) => slots[a].side - slots[b].side);
      const assigned = new Array(order.length);
      idx.forEach((si, k) => { assigned[k] = slots[si]; });
      order.forEach((u, k) => { u._slot = assigned[k]; });
    }
    // ohne Formation: relative Positionen beibehalten, aber verdichten
    const spread = Math.sqrt(us.length) * 0.75;
    let maxOff = 0;
    for (const u of us) maxOff = Math.max(maxOff, Math.hypot(u.x - cx, u.y - cy));
    const f = maxOff > spread ? spread / maxOff : 1;
    for (const u of order) {
      let ox, oy;
      if (slots) { ox = x + u._slot.dx; oy = y + u._slot.dy; delete u._slot; } else { ox = x + (u.x - cx) * f; oy = y + (u.y - cy) * f; }
      if (!this.passableAt(ox, oy) || !this.lineClear(x, y, ox, oy)) { ox = x; oy = y; }
      u.order = { t: amove ? 'amove' : 'move', x: ox, y: oy, key, tx, ty, gx: x, gy: y };
      u.buildQ = [];
      u.stuck = 0;
    }
  }
  // Platzierung der Aufstellung relativ zum Ziel; (fx, fy) = Marschrichtung
  formationSlots(form, n, fx, fy) {
    const dl = Math.hypot(fx, fy) || 1, dx = fx / dl, dy = fy / dl, px = -dy, py = dx;
    const out = [];
    const at = (side, back) => out.push({ dx: px * side - dx * back, dy: py * side - dy * back, side });
    if (form === 'wedge') {
      for (let row = 0, k = 0; k < n; row++) for (let c = 0; c <= row * 2 && k < n; c++, k++) at((c - row) * 0.8, row * 0.8);
    } else {
      const sp = form === 'loose' ? 1.6 : form === 'square' ? 0.65 : 0.8;
      const cols = form === 'column' ? Math.min(3, n) : form === 'square' ? Math.ceil(Math.sqrt(n)) : Math.min(n, Math.max(4, Math.ceil(Math.sqrt(n) * 2.2)));
      for (let k = 0; k < n; k++) { const r = Math.floor(k / cols), c = k % cols, inRow = Math.min(cols, n - r * cols); at((c - (inRow - 1) / 2) * sp, r * sp); }
    }
    return out;
  }
  speedOf(u) {
    const f = FORMATIONS[u.form];
    const z = this.zoneFactor(u);
    return u.st.speed * (f ? f.speed : 1) * (u.morale < 30 ? 0.85 : 1) * this.terrainSpeed(u) * this.unitBuff(u, 'speed') * (z ? z.v : 1)
      * (u.cls === 'env' ? this.P[u.owner].mods.envoySpeed || 1 : 1);
  }
  // Gelände × Jahreszeit; Straßen heben Nachteile auf
  terrainSpeed(u) {
    const i = this.idx(Math.min(this.W - 1, Math.max(0, Math.floor(u.x))), Math.min(this.H - 1, Math.max(0, Math.floor(u.y))));
    if (this.road[i]) return this.P[u.owner].mods.roadSpeed || 1.25;
    const t = this.terrain[i], veh = isVehicle(u), sea = this.season();
    const winterFree = this.P[u.owner].mods.winter && this.ownProvince(u.owner, u.x, u.y);
    let m = 1;
    if (t === T_HILL) m *= u.st.noHillSlow ? 1 : 0.85;
    else if (t === T_SNOW) m *= winterFree || u.st.noHillSlow ? 1 : sea === 3 ? 0.7 : 0.85;
    else if (t === T_SWAMP) m *= veh ? 0.5 : 0.65;
    else if (t === T_FORD) m *= 0.6;
    else if (t === T_DESERT) m *= 0.9;
    if (veh && this.treeD[i] >= 3) m *= 0.7;
    if (veh && (sea === 0 || sea === 2) && (t === T_GRASS || t === T_DIRT)) m *= 0.6; // Schlammperiode
    if (sea === 3 && !winterFree && t !== T_SNOW && t !== T_DESERT) m *= 0.92;
    return m;
  }
  onHill(u) { return this.tileAt(u) === T_HILL; }
  sightOf(u) { return u.st.sight + (this.onHill(u) ? 2 : 0); }
  rangeOf(u) { return u.st.range + (u.st.range > 1.2 && this.onHill(u) ? 1 : 0); }
  orderGather(u, t) {
    u.buildQ = [];
    if (t.kind === 'r') u.order = { t: 'gather', target: t.id, rtype: t.rtype };
    else if (t.kind === 'b' && isProducer(t.type) && this.allied(t.owner, u.owner)) {
      if (!t.built) u.order = { t: 'build', target: t.id };
      else u.order = { t: 'gather', target: t.id, rtype: t.type };
    } else if (t.kind === 'b' && t.owner === u.owner && !t.built) u.order = { t: 'build', target: t.id };
  }

  // ---------------- Simulation ----------------
  tick() {
    const dt = (TICK_MS / 1000) * this.settings.speed;
    this.time += dt;
    this.tickNo++;
    this.fieldBudget = 6;
    // Raster für Nachbarschaftsabfragen
    for (const c of this.cells) c.length = 0;
    for (const u of this.units) if (!u.aboard) this.cells[this.cellOf(u.x, u.y)].push(u);

    for (const u of this.units) if (!u.dead && !u.aboard) { if (u.air) this.updateAir(u, dt); else if (u.naval) this.withWater(() => this.updateUnit(u, dt)); else this.updateUnit(u, dt); }
    for (const b of this.buildings) if (!b.dead) this.updateBuilding(b, dt);
    this.separate(dt);
    this.updateMeteors(dt);

    if (this.units.some(u => u.dead)) this.units = this.units.filter(u => !u.dead);
    if (this.buildings.some(b => b.dead)) this.buildings = this.buildings.filter(b => !b.dead);

    if (this.tickNo % 10 === 0) { this.updateSupply(1 * this.settings.speed); this.updateDiplomacy(1 * this.settings.speed); this.updateRail(1 * this.settings.speed); this.updateParadrops(); this.updateCelo(1 * this.settings.speed); this.updateConference(1 * this.settings.speed); }
    this.updateNukes();
    if (this.tickNo % 50 === 0) this.updateProvinces();
    if (this.tickNo % 5 === 0) this.recount();
    if (this.tickNo % 10 === 0) this.checkDefeat();
    if (Math.floor(this.time / 10) !== Math.floor((this.time - dt) / 10)) this.recordStats();
  }

  // Provinzbesitz: wer dort die meisten Gebäudepunkte hat (Haupthaus 10, Außenposten 6, Turm 3, sonst 1)
  updateProvinces() {
    const score = new Map();
    for (const b of this.buildings) {
      if (b.dead || !b.built || b.type === 'wall' || b.type === 'road' || b.type === 'bridge') continue;
      const p = this.prov[this.idx(Math.floor(b.cx), Math.floor(b.cy))];
      if (p === 65535) continue;
      const k = p * 64 + b.owner;
      score.set(k, (score.get(k) || 0) + (PROVINCE_WEIGHT[b.type] || 1));
    }
    const best = new Map();
    for (const [k, v] of score) { const p = Math.floor(k / 64), o = k % 64, cur = best.get(p); if (!cur || v > cur[1]) best.set(p, [o, v]); }
    for (let p = 0; p < this.provOwner.length; p++) {
      const o = best.has(p) ? best.get(p)[0] : -1;
      if (this.provOwner[p] !== o) {
        const prev = this.provOwner[p]; this.provOwner[p] = o; this.provDirty = true;
        const name = this.provinces[p].name;
        if (o >= 0) this.notice(o, `🏳 Provinz ${name} gehört jetzt dir.`);
        if (prev >= 0) this.notice(prev, `Provinz ${name} ist verloren.`);
      }
    }
  }
  // Nachschub und Moral (einmal pro Spielsekunde): Versorgung im Umkreis von Haupthaus, Lager und Türmen
  updateSupply(dt) {
    const src = new Map();
    for (const b of this.buildings) if (!b.dead && b.built && (b.st.drop || b.type === 'tower' || b.type === 'outpost')) {
      const team = this.P[b.owner].team; if (!src.has(team)) src.set(team, []); src.get(team).push(b);
    }
    const R2 = SUPPLY_RANGE * SUPPLY_RANGE;
    for (const u of this.units) {
      if (u.dead || u.cls === 'wrk' || u.aboard || u.cls === 'trn' || u.naval || u.air) continue;
      const list = src.get(this.P[u.owner].team) || [];
      let ok = false;
      for (const b of list) if ((b.cx - u.x) ** 2 + (b.cy - u.y) ** 2 <= R2) { ok = true; break; }
      u.supplied = ok;
      if (ok) { u.unsup = 0; u.morale = Math.min(100, u.morale + 5 * dt); }
      else {
        const sea = this.season(), winterFree = this.P[u.owner].mods.winter && this.ownProvince(u.owner, u.x, u.y);
        u.unsup += dt; u.morale = Math.max(0, u.morale - 0.5 * dt * (sea === 3 && !winterFree ? 2 : 1));
        const heat = sea === 1 && this.tileAt(u) === T_DESERT ? 2 : 1;
        if (u.unsup > SUPPLY_GRACE) this.damage(u, u.maxHp * 0.001 * dt * heat, -1); // 1 % Leben je 10 s, Wüste im Sommer doppelt
      }
      // Sanitäter heilen bis zu drei verwundete Verbündete in der Nähe
      if (u.st.heal) {
        let n = 0;
        this.nearbyUnits(u.x, u.y, 4, o => {
          if (n >= 3 || o.dead || o === u || !this.allied(o.owner, u.owner) || o.hp >= o.maxHp || Math.hypot(o.x - u.x, o.y - u.y) > 4) return;
          o.hp = Math.min(o.maxHp, o.hp + u.st.heal * dt); n++;
        });
        if (n) u.state = ST.build;
      }
    }
  }
  recount() {
    for (const pl of this.P) { pl.pop = 0; pl.popCap = 0; pl.military = 0; pl.nUnits = 0; pl.nBuildings = 0; }
    for (const u of this.units) { const pl = this.P[u.owner]; pl.pop += u.st.pop; pl.nUnits++; if (u.cls !== 'wrk') pl.military++; }
    for (const b of this.buildings) {
      const pl = this.P[b.owner]; if (!b.st.decor) pl.nBuildings++;
      if (b.built && b.st.pop) pl.popCap += b.st.pop;
      for (const q of b.queue) if (!q.era) pl.pop += 0; // Warteschlange zählt nicht
    }
    for (const pl of this.P) pl.popCap = Math.min(MAX_POP, pl.popCap);
  }

  nearbyUnits(x, y, r, fn) {
    const c0x = Math.max(0, Math.floor((x - r) / CELL)), c1x = Math.min(this.cellsW - 1, Math.floor((x + r) / CELL));
    const c0y = Math.max(0, Math.floor((y - r) / CELL)), c1y = Math.min(this.cellsH - 1, Math.floor((y + r) / CELL));
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) for (const u of this.cells[cy * this.cellsW + cx]) fn(u);
  }
  nearbyBuildings(x, y, r, fn) {
    const rr = r + 2;
    const c0x = Math.max(0, Math.floor((x - rr) / CELL)), c1x = Math.min(this.cellsW - 1, Math.floor((x + rr) / CELL));
    const c0y = Math.max(0, Math.floor((y - rr) / CELL)), c1y = Math.min(this.cellsH - 1, Math.floor((y + rr) / CELL));
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) for (const b of this.bcells[cy * this.cellsW + cx]) fn(b);
  }
  findTarget(owner, x, y, r, preferUnits = true, cls = null) {
    let best = null, bd = Infinity;
    const row = cls && DMG[cls];
    this.nearbyUnits(x, y, r, o => {
      if (o.dead || o.cls === 'env' || !this.enemy(owner, o.owner)) return;
      if (row && row[o.cls] === 0) return;
      if ((o.cls === 'spy' || o.cls === 'sub' || CAMO[o.cls]) && !this.visibleTo(owner, o)) return;
      const d = Math.hypot(o.x - x, o.y - y) - (o.cls === 'wrk' ? -0.5 : 0);
      if (d < r && d < bd) { bd = d; best = o; }
    });
    if (best && preferUnits) return best;
    this.nearbyBuildings(x, y, r, b => {
      if (b.dead || b.st.decor || !this.enemy(owner, b.owner) || b.type === 'wall' && best || (row && row.bld === 0)) return;
      const d = Math.hypot(b.cx - x, b.cy - y) - b.size / 2 + 3; // Gebäude nachrangig
      if (d < r && d < bd) { bd = d; best = b; }
    });
    return best;
  }

  updateUnit(u, dt) {
    if (u.stunUntil && u.stunUntil > this.time) { u.state = ST.idle; return; }
    if (u.cd > 0) u.cd -= dt;
    const pl = this.P[u.owner];
    if (pl.mods.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + pl.mods.regen * dt);
    const o = u.order;
    u.state = ST.idle;
    switch (o.t) {
      case 'idle': {
        if (MILITARY(u.cls) && u.st.atk > 0) {
          u.scan -= dt;
          if (u.scan <= 0) {
            u.scan = 0.5;
            const t = this.findTarget(u.owner, u.x, u.y, u.st.railOnly ? this.rangeOf(u) + 0.5 : this.sightOf(u), true, u.st.atkCls || u.cls);
            if (t) u.order = { t: 'attack', target: t.id, guard: u.st.railOnly ? null : { x: u.x, y: u.y } };
          }
        } else if (u.buildQ.length) {
          u.order = { t: 'build', target: u.buildQ.shift() };
        }
        break;
      }
      case 'move':
      case 'amove': {
        if (o.t === 'amove') {
          u.scan -= dt;
          if (u.scan <= 0) {
            u.scan = 0.4;
            const t = this.findTarget(u.owner, u.x, u.y, this.sightOf(u), true, u.st.atkCls || u.cls);
            if (t) { u.order = { t: 'attack', target: t.id, resume: o }; break; }
          }
        }
        const d = Math.hypot(o.x - u.x, o.y - u.y);
        if (d < 0.25) { u.order = { t: 'idle' }; break; }
        const tx = o.tx, ty = o.ty;
        const ok = this.steer(u, o.x, o.y, o.key, () => this.pointSources(tx, ty), dt);
        if (!ok) { u.order = { t: 'idle' }; break; }
        // Stillstand erkennen (Ziel blockiert/gedrängt)
        if (this.progressCheck(u, d, dt)) u.order = { t: 'idle' };
        break;
      }
      case 'attack': this.doAttack(u, dt); break;
      case 'gather': this.doGather(u, dt, pl); break;
      case 'build': this.doBuild(u, dt, pl); break;
      case 'spy': this.doSpy(u, dt); break;
      case 'board': this.doBoard(u, dt); break;
      case 'boardShip': this.doBoardShip(u, dt); break;
      case 'railMove': this.doRailMove(u, dt); break;
      case 'unload': this.doUnload(u, dt); break;
      case 'ride': this.doRide(u, dt); break;
      case 'wait': break;
      default: u.order = { t: 'idle' };
    }
  }
  progressCheck(u, d, dt) {
    if (u.lastD == null || d < u.lastD - 0.05) { u.lastD = d; u.stuck = 0; return false; }
    u.stuck += dt;
    if (u.stuck > (d < 2.5 ? 1.5 : 4)) { u.stuck = 0; u.lastD = null; return true; }
    return false;
  }

  doAttack(u, dt) {
    const o = u.order;
    const t = this.ents.get(o.target);
    const done = () => {
      if (o.resume) u.order = o.resume;
      else if (o.guard && u.cls !== 'wrk') {
        const nt = this.findTarget(u.owner, u.x, u.y, this.sightOf(u), true, u.st.atkCls || u.cls);
        u.order = nt ? { t: 'attack', target: nt.id, guard: o.guard } : { t: 'move', x: o.guard.x, y: o.guard.y, key: 'p' + Math.floor(o.guard.x) + ',' + Math.floor(o.guard.y), tx: Math.floor(o.guard.x), ty: Math.floor(o.guard.y) };
      } else u.order = { t: 'idle' };
    };
    if (!t || t.dead || t.kind === 'r' || !this.enemy(u.owner, t.owner) && !o.forced) return done();
    if (t.owner === u.owner) return done();
    // Wache: nicht zu weit verfolgen
    if (o.guard && Math.hypot(u.x - o.guard.x, u.y - o.guard.y) > u.st.sight + 6) { u.order = { t: 'move', x: o.guard.x, y: o.guard.y, key: 'p' + Math.floor(o.guard.x) + ',' + Math.floor(o.guard.y), tx: Math.floor(o.guard.x), ty: Math.floor(o.guard.y) }; return; }
    // nicht sichtbares Ziel nicht ewig jagen
    if (!this.visibleTo(u.owner, t)) return done();
    const range = this.rangeOf(u);
    const d = this.distTo(u, t);
    if (d > range + u.r) {
      if (u.st.railOnly) { u.order = o.resume || { t: 'idle' }; return; } // Schienenfahrzeuge verfolgen nicht
      // Fernkämpfer im Angriffsbewegung: neues, näheres Ziel?
      const r = this.approach(u, t, range, dt);
      if (r === 'fail') return done();
      if (this.progressCheck(u, d, dt) && !o.forced) return done();
      return;
    }
    u.lastD = null;
    if (u.st.minRange && d < u.st.minRange && u.st.railOnly) { u.order = { t: 'idle' }; return; }
    if (u.st.minRange && d < u.st.minRange) {
      // zu nah: zurückweichen
      const ax = u.x - (t.kind === 'u' ? t.x : t.cx), ay = u.y - (t.kind === 'u' ? t.y : t.cy), al = Math.hypot(ax, ay) || 1;
      const nx = u.x + ax / al * u.st.speed * dt, ny = u.y + ay / al * u.st.speed * dt;
      if (this.passableAt(nx, ny)) { u.x = nx; u.y = ny; }
      u.state = ST.move;
      return;
    }
    u.state = ST.attack;
    u.dir = Math.atan2((t.kind === 'u' ? t.y : t.cy) - u.y, (t.kind === 'u' ? t.x : t.cx) - u.x);
    if (u.cd <= 0) {
      u.cd = u.st.cd;
      this.hit(u, t, u.st.atk * this.dealMul(u, range), u.st.atkCls || u.cls, u.st.splash);
      if (range > 1.2) this.event({ k: 'shot', x: u.x, y: u.y, tx: t.kind === 'u' ? t.x : t.cx, ty: t.kind === 'u' ? t.y : t.cy, c: u.cls === 'sie' ? 1 : (u.era >= 4 ? 2 : 0) });
    }
  }
  // Schadensfaktor des Angreifers: Veteranenrang, Moral, Formation
  dealMul(u, range) {
    const mods = this.P[u.owner].mods;
    let m = (1 + u.rank * VET_BONUS) * this.buffMul(this.P[u.owner], 'dmg') * this.unitBuff(u, 'dmg') * (u.letterBuff ? 1.1 : 1);
    if (mods.homeDmg) for (const g in mods.homeDmg) if (inGroup(g, u.st) && this.ownProvince(u.owner, u.x, u.y)) m *= mods.homeDmg[g];
    if (mods.forestDmg && u.cls === 'inf' && this.inForest(u)) m *= mods.forestDmg;
    if (u.morale < 50) m *= 0.8;
    const hd = this.P[u.owner].mods.hillDmg; if (hd && hd !== 1 && (u.cls === 'inf' || u.cls === 'spr' || u.cls === 'rng') && this.onHill(u)) m *= hd;
    const f = FORMATIONS[u.form];
    if (f) {
      if (f.dealRanged && range > 1.2) m *= f.dealRanged;
      if (f.dealCls && f.dealCls[u.cls]) m *= f.dealCls[u.cls];
      if (f.dealMelee && range <= 1.2) m *= f.dealMelee;
    }
    return m;
  }
  // Schadensfaktor beim Ziel: Formation
  takeMul(t, cls, splash) {
    const f = t.kind === 'u' && FORMATIONS[t.form];
    if (!f) return 1;
    let m = f.takeAll || 1;
    if (f.takeFrom && f.takeFrom[cls]) m *= f.takeFrom[cls];
    if (splash && f.splashTaken) m *= f.splashTaken;
    return m;
  }
  hit(src, t, atk, cls, splash) {
    if (t.owner !== src.owner && !this.enemy(src.owner, t.owner)) this.checkBreach(src.owner, t.owner);
    const dcls = t.kind === 'u' ? t.cls : 'bld';
    let dmg = atk * (DMG[cls][dcls] ?? 1) * this.takeMul(t, cls, false) * ((src.st && src.st.dmgVs && src.st.dmgVs[dcls]) || 1);
    if (t.kind === 'b' && !t.built) dmg *= 1.5;
    if (t.kind === 'b' && t.type === 'station' && t.built && (src.cls === 'inf' || src.cls === 'spr') && this.enemy(src.owner, t.owner) && t.hp - dmg < t.maxHp * RAIL.captureHp) {
      const prev = t.owner;
      if (t.waiting) { for (const w of t.waiting) this.unboard(this.ents.get(w.id), null, t); t.waiting = []; }
      if (t.stock) { for (const k in t.stock) this.P[src.owner].res[k] += t.stock[k]; t.stock = {}; }
      t.owner = src.owner; t.hp = t.maxHp * 0.4; t.queue = [];
      this.notice(src.owner, '🚉 Bahnhof erobert! Du kannst jetzt das Gleisnetz des Gegners nutzen.');
      this.notice(prev, '🚉 Einer deiner Bahnhöfe wurde erobert!');
      return;
    }
    this.damage(t, dmg, src.owner, src);
    if (splash) {
      const tx = t.kind === 'u' ? t.x : t.cx, ty = t.kind === 'u' ? t.y : t.cy;
      this.nearbyUnits(tx, ty, splash, o => {
        if (o === t || o.dead || !this.enemy(src.owner, o.owner)) return;
        if (Math.hypot(o.x - tx, o.y - ty) <= splash) this.damage(o, atk * 0.5 * (DMG[cls][o.cls] ?? 1) * this.takeMul(o, cls, true), src.owner, src);
      });
    }
    // Vergeltung
    if (t.kind === 'u' && !t.dead && MILITARY(t.cls) && (t.order.t === 'idle' || (t.order.t === 'move' && t.order.x == null))) {
      t.order = { t: 'attack', target: src.id, guard: { x: t.x, y: t.y } };
    }
    if (t.kind === 'u' && !t.dead && t.cls === 'wrk' && t.order.t === 'idle') {
      // Arbeiter fliehen nicht, rufen aber Hilfe: Militär in der Nähe greift an
      this.callHelp(t, src);
    }
    if (t.kind === 'b') this.callHelp(t, src);
  }
  callHelp(victim, attacker) {
    if (attacker.kind !== 'u') return;
    const x = victim.kind === 'u' ? victim.x : victim.cx, y = victim.kind === 'u' ? victim.y : victim.cy;
    this.nearbyUnits(x, y, 8, o => {
      if (o.owner === victim.owner && MILITARY(o.cls) && o.order.t === 'idle') o.order = { t: 'attack', target: attacker.id, guard: { x: o.x, y: o.y } };
    });
    if (!victim.alertCd || this.time > victim.alertCd) {
      victim.alertCd = this.time + 15;
      this.events.push({ k: 'alert', to: victim.owner, x, y });
    }
  }
  damage(t, dmg, by, src) {
    if (t.kind === 'b' && t.st.decor) return;
    if (t.invulnUntil && t.invulnUntil > this.time) return;
    if (t.kind === 'u') {
      dmg /= this.unitBuff(t, 'hp');
      const hs = this.P[t.owner].mods.homeShield; if (hs && this.ownProvince(t.owner, t.x, t.y)) dmg *= hs;
    } else dmg /= this.buffMul(this.P[t.owner], 'bldHp');
    if (t.guardedBy) {
      const g = this.ents.get(t.guardedBy);
      if (g && !g.dead && g !== t && Math.hypot(g.x - (t.cx ?? t.x), g.y - (t.cy ?? t.y)) <= 3.5) {
        if (t.cls === 'env') return; // Ehrengeleit: Botschafter in Celos Begleitung bleiben unversehrt
        g.hp -= dmg * 0.5; dmg *= 0.5; if (g.hp <= 0 && !g.dead) this.kill(g, by, src);
      }
    }
    t.hp -= dmg;
    if (t.hp <= 0 && !t.dead) this.kill(t, by, src);
  }
  kill(e, by, src) {
    if (e.dead) return;
    if (e.kind === 'u' && e.line === 'train') this.trainDestroyed(e);
    if (e.kind === 'u' && e.st && e.st.celo) this.celoFallen(e);
    if (e.kind === 'u' && e.cargo && e.cargo.length) this.shipSunk(e);
    if (e.kind === 'b' && e.type === 'station' && e.stock && by >= 0) for (const k in e.stock) this.P[by].res[k] += Math.round(e.stock[k] * 0.5);
    if (e.kind === 'u' && e.cls === 'env') this.envoyKilled(e, by);
    // Erfahrung und Moral für den Sieger
    if (src && src.kind === 'u' && !src.dead && e.kind === 'u' && src.cls !== 'wrk') {
      src.xp += sumCost(e.st.cost) / Math.max(1, sumCost(src.st.cost));
      src.morale = Math.min(100, src.morale + 5);
      const rank = VET_RANKS.filter(t => src.xp >= t).length;
      if (rank > src.rank) {
        const ratio = src.hp / src.maxHp;
        src.rank = rank; if (rank >= 3) this.achieve(src.owner, 'VETERAN');
        src.maxHp = Math.round(src.st.hp * (1 + rank * VET_BONUS)); src.hp = src.maxHp * ratio;
        if (rank === VET_RANKS.length) this.notice(src.owner, `★★★ ${src.st.name} ist jetzt ein Elite-Veteran!`);
      }
    }
    e.dead = true;
    e.hp = 0;
    this.ents.delete(e.id);
    const pl = this.P[e.owner];
    if (e.kind === 'u') {
      pl.stats.lost++;
      if (by >= 0) this.P[by].stats.kills++;
      this.event({ k: 'death', id: e.id, x: e.x, y: e.y, c: e.cls, o: e.owner });
    } else if (e.kind === 'b') {
      // Plündern (Kosaken, Narentaner): ein Teil der Baukosten geht an den Angreifer
      if (src && src.st && src.st.plunder && by >= 0) {
        const loot = {}; for (const k in e.st.cost || {}) { loot[k] = Math.round(e.st.cost[k] * 0.3); this.P[by].res[k] += loot[k]; }
        const txt = Object.entries(loot).filter(([, v]) => v > 0).map(([k, v]) => v + ' ' + ({ food: 'Nahrung', wood: 'Holz', stone: 'Stein', gold: 'Gold' })[k]).join(', ');
        if (txt) this.notice(by, `💰 Geplündert: ${txt}.`);
      }
      this.removeBuilding(e);
      if (by >= 0) this.P[by].stats.razed++;
      if (pl.advancing === e.id) pl.advancing = null;
      if (pl.lateResearch === e.id) pl.lateResearch = null;
      if (pl.wonderBuilding === e.id) pl.wonderBuilding = null;
      if (e.wonder) this.event({ k: 'wonder', p: e.owner, what: 'lost', by: by });
      this.event({ k: 'destroy', id: e.id, x: e.cx, y: e.cy, s: e.size, o: e.owner });
      if (e.type === 'farm' && e.worker) { /* Arbeiter wird idle */ }
    }
  }

  dropoffFor(u) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.dead || b.owner !== u.owner || !b.built || !b.st.drop || (u.naval && b.type !== 'dock')) continue;
      const d = Math.hypot(b.cx - u.x, b.cy - u.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  findResourceNear(rtype, x, y, r, owner) {
    if (isProducer(rtype)) {
      let best = null, bd = Infinity;
      for (const b of this.buildings) if (!b.dead && b.type === rtype && b.owner === owner && b.built && !b.worker) {
        const d = Math.hypot(b.cx - x, b.cy - y); if (d < r && d < bd) { bd = d; best = b; }
      }
      return best;
    }
    let best = null, bd = Infinity;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(this.W - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(this.H - 1, Math.floor(y + r));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const id = this.occ[ty * this.W + tx];
      if (!id) continue;
      const e = this.ents.get(id);
      if (!e || e.kind !== 'r' || e.rtype !== rtype) continue;
      if (e.x !== tx || e.y !== ty) continue; // nur einmal pro Mine
      const d = (e.cx - x) ** 2 + (e.cy - y) ** 2;
      if (d >= bd || !this.accessible(e)) continue;
      if (e.depleted && !this.canDeepen(e, owner)) continue;
      if (owner != null && e.bad && e.bad[owner] > this.time - 180) continue; // kürzlich unerreichbar
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // Kann der Spieler die nächste Schicht eines erschöpften Vorkommens erschließen?
  canDeepen(r, owner) {
    const next = DEPOSIT_LAYERS[r.layer + 1];
    return !!next && owner != null && owner >= 0 && this.P[owner].era >= next.era;
  }
  deepen(r, owner) {
    r.layer++; r.depleted = false;
    r.amount = Math.round(r.base * DEPOSIT_LAYERS[r.layer].mul);
    this.resChanged.add(r.id);
    this.notice(owner, `⛏ ${DEPOSIT_LAYERS[r.layer].name}: Ein erschöpftes ${r.rtype === 'gold' ? 'Gold' : 'Stein'}vorkommen liefert wieder.`);
  }

  // Hat der Rohstoff mindestens eine begehbare Nachbarkachel?
  accessible(e) {
    const sz = e.size || 1;
    for (let yy = e.y - 1; yy <= e.y + sz; yy++) for (let xx = e.x - 1; xx <= e.x + sz; xx++) {
      if (xx >= e.x && xx < e.x + sz && yy >= e.y && yy < e.y + sz) continue;
      if (this.inBounds(xx, yy) && this.pass[this.idx(xx, yy)]) return true;
    }
    return false;
  }
  doGather(u, dt, pl) {
    const o = u.order;
    let t = this.ents.get(o.target);
    const isFarm = isProducer(o.rtype); // Feld, Bergwerk, Steinbruch: unerschöpflich, ein Arbeiter pro Gebäude
    const resKind = isFarm ? BUILDINGS[o.rtype].yields : RESOURCE_TYPES[o.rtype].res;
    if (u.carry && u.carry.res !== resKind) u.carry = null;
    // abliefern
    if (o.returning || (u.carry && u.carry.amt >= CARRY)) {
      o.returning = true;
      const drop = this.dropoffFor(u);
      if (!drop) { u.state = ST.idle; return; }
      const r = this.approach(u, drop, 0.6, dt);
      if (r === true) { u.state = ST.carry; return; }
      if (u.carry) {
        this.deliverAt(drop, pl, u.carry.res, u.carry.amt);
        u.carry = null;
      }
      o.returning = false;
      return;
    }
    if (!t || t.dead || (isFarm && (t.kind !== 'b' || !t.built))) {
      const n = this.findResourceNear(o.rtype, u.x, u.y, isFarm ? 12 : 10, u.owner);
      if (n) { o.target = n.id; t = n; } else {
        if (u.carry && u.carry.amt > 0) { o.returning = true; return; }
        u.order = { t: 'idle' }; return;
      }
    }
    if (!isFarm && t.depleted) {
      if (this.canDeepen(t, u.owner)) this.deepen(t, u.owner);
      else {
        const n = this.findResourceNear(o.rtype, u.x, u.y, 14, u.owner);
        if (n) { o.target = n.id; return; }
        if (u.carry && u.carry.amt > 0) { o.returning = true; return; }
        u.order = { t: 'idle' }; return;
      }
    }
    if (isFarm) {
      if (t.worker && t.worker !== u.id && this.ents.get(t.worker) && this.ents.get(t.worker).order.target === t.id) {
        const n = this.findResourceNear(o.rtype, u.x, u.y, 12, u.owner);
        if (n && n !== t) { o.target = n.id; return; }
        u.order = { t: 'idle' }; return;
      }
      t.worker = u.id;
      const d = Math.hypot(t.cx - u.x, t.cy - u.y);
      if (d > 0.6) {
        if (!this.steer(u, t.cx, t.cy, 'e' + t.id, () => this.rectSources(t), dt)) u.order = { t: 'idle' };
        return;
      }
    } else {
      const r = this.approach(u, t, 0.45, dt);
      if (r === true) {
        if (this.progressCheck(u, this.distTo(u, t), dt)) {
          // anderes Ziel derselben Art suchen
          const n = this.findResourceNear(o.rtype, u.x, u.y, 8, u.owner);
          if (n && n.id !== t.id) o.target = n.id;
        }
        return;
      }
      if (r === 'fail') { (t.bad || (t.bad = {}))[u.owner] = this.time; u.order = { t: 'idle' }; return; }
    }
    u.lastD = null;
    u.state = ST.gather;
    u.dir = Math.atan2(t.cy - u.y, t.cx - u.x);
    const rate = (isFarm ? BUILDINGS[o.rtype].rate : RESOURCE_TYPES[o.rtype].rate) * pl.mods.gather[resKind] * (1 + pl.era * 0.06)
      * (this.ownProvince(u.owner, t.cx, t.cy) ? 1 + PROVINCE_BONUS : 1) * (o.rtype === 'farm' && this.season() === 3 ? 0.7 : 1)
      * this.buffMul(pl, 'gather', resKind) * (o.rtype === 'farm' ? this.buffMul(pl, 'farm') : 1) * (this.zoneFactor(u)?.noGather || this.inRadiation(t.cx, t.cy) ? 0 : 1);
    let amt = rate * dt;
    if (!u.carry) u.carry = { res: resKind, amt: 0 };
    if (!isFarm) {
      amt = Math.min(amt, t.amount);
      t.amount -= amt;
      this.resChanged.add(t.id);
      if (t.amount <= 0.01) {
        // Gold/Stein: Vorkommen bleibt erschöpft stehen, bis bessere Technik die nächste Schicht erschließt
        if (hasLayers(t.rtype) && DEPOSIT_LAYERS[t.layer + 1]) { t.amount = 0; t.depleted = true; this.resChanged.add(t.id); }
        else this.removeResource(t);
      }
    }
    u.carry.amt += amt;
  }

  doBuild(u, dt, pl) {
    const o = u.order;
    const b = this.ents.get(o.target);
    if (!b || b.dead || b.kind !== 'b' || (b.built && b.hp >= b.maxHp) || !this.allied(b.owner, u.owner)) {
      if (b && !b.dead && isProducer(b.type) && b.built && b.owner === u.owner && !b.worker) { u.order = { t: 'gather', target: b.id, rtype: b.type }; return; }
      if (u.buildQ.length) { u.order = { t: 'build', target: u.buildQ.shift() }; return; }
      // nächste Baustelle in der Nähe
      const near = this.buildings.find(x => !x.dead && x.owner === u.owner && !x.built && Math.hypot(x.cx - u.x, x.cy - u.y) < 8);
      u.order = near ? { t: 'build', target: near.id } : { t: 'idle' };
      return;
    }
    const r = this.approach(u, b, 0.6, dt);
    if (r === true) { if (this.progressCheck(u, this.distTo(u, b), dt)) u.order = { t: 'idle' }; return; }
    if (r === 'fail') { u.order = { t: 'idle' }; return; }
    u.lastD = null;
    u.state = ST.build;
    u.dir = Math.atan2(b.cy - u.y, b.cx - u.x);
    if (!b.built) {
      const inc = dt / b.st.time * this.buffMul(this.P[u.owner], 'build');
      b.progress = Math.min(1, b.progress + inc);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * inc);
      if (b.progress >= 1) {
        b.built = true;
        if (b.type === 'bridge') { this.pass[this.idx(b.x, b.y)] = 1; this.blockVer++; this.P[b.owner].stats.bridges = (this.P[b.owner].stats.bridges || 0) + 1; }
        if (b.type === 'road') this.road[this.idx(b.x, b.y)] = 1;
        this.railMark(b, 1);
        this.P[b.owner].stats.built++;
        this.event({ k: 'built', to: b.owner, id: b.id, type: b.type });
        if (isProducer(b.type) && b.owner === u.owner) { b.worker = u.id; u.order = { t: 'gather', target: b.id, rtype: b.type }; }
        else if (b.type === 'storage' || b.type === 'town') {
          // nach Lagerbau: in der Nähe weitersammeln
          const res = this.findResourceNear('tree', b.cx, b.cy, 8) || this.findResourceNear('gold', b.cx, b.cy, 8, b.owner) || this.findResourceNear('stone', b.cx, b.cy, 8, b.owner);
          if (res && !u.buildQ.length) u.order = { t: 'gather', target: res.id, rtype: res.rtype };
        }
        this.recount();
      }
    } else {
      // Reparatur (kostenlos, langsamer)
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * dt / (b.st.time * 3));
    }
  }

  updateBuilding(b, dt) {
    if (!b.built) return;
    if (b.sabotaged && b.sabotaged > this.time) return; // sabotiert: keine Ausbildung, kein Beschuss
    const pl = this.P[b.owner];
    // Angriff (Haupthaus, Turm)
    if (b.st.atk) {
      b.cd -= dt;
      if (b.cd <= 0) {
        const t = this.findTarget(b.owner, b.cx, b.cy, b.st.range * this.buffMul(pl, 'towerRange') + b.size / 2, true, b.st.dmgRow || 'bld');
        if (t && t.kind === 'u' && !this.inDmz(b.owner, b.cx, b.cy)) {
          b.cd = b.st.cd;
          this.damage(t, this.bldDamage(b, t) * this.buffMul(pl, 'tower'), b.owner);
          this.event({ k: 'shot', x: b.cx, y: b.cy - 0.5, tx: t.x, ty: t.y, c: pl.era >= 4 ? 2 : 0 });
        } else b.cd = 0.4;
      }
    }
    if (isProducer(b.type) && b.worker) {
      const w = this.ents.get(b.worker);
      if (!w || w.order.target !== b.id) b.worker = 0;
    }
    // Ausbildung / Epochenaufstieg
    const q = b.queue[0];
    if (!q) { b.qProg = 0; return; }
    if (q.wonder) {
      b.qProg += dt;
      if (b.qProg >= q.time) {
        b.queue.shift(); b.qProg = 0; pl.wonderBuilding = null;
        b.wonder = true; b.wonderAt = this.time; b.era = WONDER_ERA; this.achieve(b.owner, 'WONDER');
        const ratio = b.hp / b.maxHp; b.maxHp = Math.round(b.st.hp * WONDER.hpMul); b.hp = b.maxHp * ratio;
        this.event({ k: 'wonder', p: pl.id, what: 'done', hold: wonderHold(this.W) });
        this.chronicle(`🏛 ${pl.name} vollendet ein Weltwunder.`, 'wonder');
      }
      return;
    }
    if (q.late) {
      b.qProg += dt;
      if (b.qProg >= q.time) {
        b.queue.shift(); b.qProg = 0;
        pl.lateResearch = null; pl.late = true;
        this.updateMods(pl);
        this.event({ k: 'late', p: pl.id });
      }
      return;
    }
    if (q.nuke) { this.nukeQueueStep(b, q, dt, pl); return; }
    if (q.era != null) {
      b.qProg += dt;
      if (b.qProg >= q.time) {
        b.queue.shift(); b.qProg = 0;
        pl.era = q.era; pl.advancing = null;
        if (pl.era >= 3) this.achieve(pl.id, 'ERA_MEDIEVAL'); if (pl.era >= 5) this.achieve(pl.id, 'ERA_INDUSTRY'); if (pl.era >= 7) this.achieve(pl.id, 'ERA_COLD_WAR');
        if (pl.era === 1 && !pl.culture) pl.choice = 'culture';
        else if (pl.era === 3 && !pl.nation) pl.choice = pl.culture ? 'nation' : 'culture';
        else this.checkLeaderChoice(pl);
        this.event({ k: 'era', p: pl.id, era: pl.era });
        this.chronicle(`${pl.name} erreicht die Epoche „${ERAS[pl.era].name}“.`, 'era');
        // Gebäude werden mit der Epoche robuster
        for (const x of this.buildings) if (x.owner === pl.id && !x.dead) {
          const st = buildingStats(x.type, pl.era, pl.mods);
          const ratio = x.hp / x.maxHp;
          x.st = st; x.maxHp = Math.round(st.hp * (x.wonder ? WONDER.hpMul : 1)); x.hp = x.maxHp * ratio;
          if (!x.wonder) x.era = pl.era; // Gebäude wechseln zum Baustil der neuen Epoche
        }
        this.initRail(); // eiserne Brücken tragen ab der 1. IR Gleise
      }
      return;
    }
    const st = unitStats(q.line, Math.max(pl.era, LINES[q.line].minEra), q.unique, pl.mods);
    if (b.qProg < q.time) b.qProg += dt * this.buffMul(pl, 'train');
    if (b.qProg >= q.time) {
      if (pl.pop + st.pop > pl.popCap) { b.blocked = true; return; }
      b.blocked = false;
      const spawn = LINES[q.line].naval ? this.withWater(() => this.spawnPoint(b)) : st.railOnly ? [b.cx, b.cy] : this.spawnPoint(b);
      if (!spawn) return;
      b.queue.shift(); b.qProg = 0;
      const u = this.addUnit(b.owner, q.line, q.unique, spawn[0], spawn[1]);
      this.nameShip(u, pl);
      if (u.st.celo) this.achieve(pl.id, 'CELO');
      pl.pop += st.pop;
      pl.stats.trained++;
      this.cells[this.cellOf(u.x, u.y)].push(u);
      if (b.rally) {
        const rt = b.rally.target ? this.ents.get(b.rally.target) : null;
        if (rt && u.cls === 'wrk' && (rt.kind === 'r' || isProducer(rt.type))) this.orderGather(u, rt);
        else if (u.naval) this.withWater(() => this.groupMove([u], b.rally.x, b.rally.y, u.cls !== 'wrk')); else this.groupMove([u], b.rally.x, b.rally.y, u.cls !== 'wrk');
      }
    }
  }
  spawnPoint(b) {
    const tx = b.rally ? b.rally.x : b.cx, ty = b.rally ? b.rally.y + 1 : b.cy + b.size;
    let best = null, bd = Infinity;
    for (let y = b.y - 1; y <= b.y + b.size; y++) for (let x = b.x - 1; x <= b.x + b.size; x++) {
      if (x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size) continue;
      if (!this.inBounds(x, y) || !this.pass[this.idx(x, y)]) continue;
      const d = (x + 0.5 - tx) ** 2 + (y + 0.5 - ty) ** 2;
      if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
    }
    return best || this.nearestFree(b.cx, b.cy + b.size, 6);
  }

  separate(dt) {
    for (const c of this.cells) {
      for (let i = 0; i < c.length; i++) {
        const a = c[i]; if (a.dead || a.cls === 'trn' || a.air) continue;
        // Nachbarzellen rechts/unten einbeziehen
        const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
        for (let oy = 0; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (oy === 0 && ox < 0) continue;
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= this.cellsW || ny >= this.cellsH) continue;
          const arr = this.cells[ny * this.cellsW + nx];
          const start = arr === c ? i + 1 : 0;
          for (let j = start; j < arr.length; j++) {
            const b = arr[j]; if (b.dead || b.cls === 'trn' || b.air || b.naval !== a.naval) continue;
            const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            let d = Math.sqrt(d2);
            let ux, uy;
            if (d < 1e-4) { const ang = (a.id * 7.3 + b.id) % 6.28; ux = Math.cos(ang); uy = Math.sin(ang); d = 0; } else { ux = dx / d; uy = dy / d; }
            const push = Math.min(0.08, (min - d) * 0.5);
            // Einheiten, die arbeiten/kämpfen, werden weniger geschoben
            const wa = a.state === ST.idle ? 1 : a.state === ST.move || a.state === ST.carry ? 0.7 : 0.25;
            const wb = b.state === ST.idle ? 1 : b.state === ST.move || b.state === ST.carry ? 0.7 : 0.25;
            const s = wa + wb || 1;
            const ax = a.x - ux * push * 2 * wa / s, ay = a.y - uy * push * 2 * wa / s;
            const bx = b.x + ux * push * 2 * wb / s, by = b.y + uy * push * 2 * wb / s;
            if (this.passFor(a, ax, ay)) { a.x = ax; a.y = ay; }
            if (this.passFor(b, bx, by)) { b.x = bx; b.y = by; }
          }
        }
      }
    }
    for (const u of this.units) {
      u.x = Math.max(0.3, Math.min(this.W - 0.3, u.x));
      u.y = Math.max(0.3, Math.min(this.H - 0.3, u.y));
    }
  }

  // ---------------- Sicht ----------------
  computeVision() {
    // Sichtfeld pro Team
    const N = this.W * this.H;
    if (!this.vis) this.vis = new Map();
    const teams = new Set(this.P.map(p => p.team));
    for (const t of teams) {
      let v = this.vis.get(t);
      if (!v) { v = new Uint8Array(N); this.vis.set(t, v); } else v.fill(0);
    }
    const stamp = (v, x, y, r, val = 1) => {
      const c = CIRCLES[Math.min(14, Math.round(r))];
      const tx = Math.floor(x), ty = Math.floor(y);
      for (let k = 0; k < c.length; k += 2) {
        const nx = tx + c[k], ny = ty + c[k + 1];
        if (nx >= 0 && ny >= 0 && nx < this.W && ny < this.H && v[ny * this.W + nx] < val) v[ny * this.W + nx] = val;
      }
    };
    for (const u of this.units) if (!u.dead && !u.aboard) { const v = this.vis.get(this.P[u.owner].team); stamp(v, u.x, u.y, this.sightOf(u)); stamp(v, u.x, u.y, u.st.celo ? 10 : u.st.detects ? 6 : 3, 2); }
    for (const b of this.buildings) if (!b.dead) stamp(this.vis.get(this.P[b.owner].team), b.cx, b.cy, b.st.sight + b.size / 2);
    for (const r of this.reveals || []) stamp(this.vis.get(this.P[r.pid].team), r.x, r.y, 12);
  }
  visibleTo(pid, e) {
    if (this.allied(pid, e.owner)) return true;
    const v = this.vis && this.vis.get(this.P[pid].team);
    if (!v) return true;
    if (e.kind === 'u') {
      const s = v[this.idx(Math.floor(e.x), Math.floor(e.y))];
      // Infanterie im Wald und Spione sind erst aus der Nähe (3 Kacheln) zu sehen; Wachgebäude enttarnen Spione
      const hide = e.cls === 'inf' && this.P[e.owner].stealthUntil > this.time && this.inForest(e);
      const seen = v2 => (hide ? false : e.st && e.st.camo && e.state !== ST.attack ? v2 === 2 : e.cls === 'sub' ? v2 === 2 : e.cls === 'spy' ? v2 === 2 || this.detectedSpy(e) : CAMO[e.cls] && this.inForest(e) ? v2 === 2 : v2 >= 1);
      if (seen(s)) return true;
      for (const q of this.P) if (q.team !== this.P[pid].team && this.sharesVision(pid, q.id)) { const v2 = this.vis.get(q.team); if (v2 && seen(v2[this.idx(Math.floor(e.x), Math.floor(e.y))])) return true; }
      return false;
    }
    for (let yy = e.y; yy < e.y + e.size; yy++) for (let xx = e.x; xx < e.x + e.size; xx++) if (v[this.idx(xx, yy)]) return true;
    for (const q of this.P) if (q.team !== this.P[pid].team && this.sharesVision(pid, q.id)) { const v2 = this.vis.get(q.team); if (v2 && v2[this.idx(Math.floor(e.cx), Math.floor(e.cy))]) return true; }
    return false;
  }

  // ---------------- Armageddon ----------------
  updateMeteors(dt) {
    if (this.settings.mode !== 'armageddon') return;
    const start = this.settings.armageddonMin * 60;
    if (this.time < start) return;
    const interval = Math.max(6, 20 - (this.time - start) / 60);
    if (!this.nextMeteor || this.time >= this.nextMeteor) {
      this.nextMeteor = this.time + interval;
      if (this.time - dt < start + 0.2) this.event({ k: 'notice', to: -1, text: '☄ Armageddon beginnt! Meteore treffen die schwächsten Nationen.' });
      const alive = this.P.filter(p => p.alive);
      if (alive.length > 1) {
        const score = p => p.nBuildings * 4 + p.pop + p.era * 10;
        alive.sort((a, b) => score(a) - score(b));
        const victim = alive[0];
        const targets = this.buildings.filter(b => b.owner === victim.id && !b.dead);
        const tg = targets.length ? targets[Math.floor(Math.random() * targets.length)] : this.units.find(u => u.owner === victim.id && !u.dead);
        if (tg) {
          const x = (tg.cx || tg.x) + (Math.random() - 0.5) * 3, y = (tg.cy || tg.y) + (Math.random() - 0.5) * 3;
          this.meteors.push({ x, y, at: this.time + 3, p: victim.id });
          this.event({ k: 'meteor', x, y, t: 3, p: victim.id });
        }
      }
    }
    for (const m of this.meteors) {
      if (m.at > this.time || m.done) continue;
      m.done = true;
      const R = 3.2, dmg = 450;
      this.nearbyUnits(m.x, m.y, R, u => { if (!u.dead && Math.hypot(u.x - m.x, u.y - m.y) < R) this.damage(u, dmg, -1); });
      this.nearbyBuildings(m.x, m.y, R, b => { if (!b.dead && Math.hypot(b.cx - m.x, b.cy - m.y) < R + b.size / 2) this.damage(b, dmg * 1.4, -1); });
      this.event({ k: 'impact', x: m.x, y: m.y });
    }
    this.meteors = this.meteors.filter(m => !m.done);
  }

  // ---------------- Spielende ----------------
  checkDefeat() {
    for (const pl of this.P) {
      if (!pl.alive) continue;
      if (pl.nUnits === 0 && pl.nBuildings === 0) this.defeat(pl);
      else if (pl.nBuildings === 0 && !this.units.some(u => u.owner === pl.id && !u.dead && u.cls === 'wrk') && pl.military === 0) this.defeat(pl);
    }
  }
  defeat(pl, surrendered = false) {
    if (!pl.alive) return;
    pl.alive = false;
    pl.defeatedAt = this.time;
    if (surrendered) {
      for (const u of this.units) if (u.owner === pl.id) this.kill(u, -1);
      for (const b of this.buildings) if (b.owner === pl.id) this.kill(b, -1);
    }
    this.event({ k: 'defeat', p: pl.id, s: surrendered });
    this.chronicle(`☠ ${pl.name} ist ${surrendered ? 'ausgeschieden (aufgegeben)' : 'besiegt'}.`, 'defeat');
  }
  winners() {
    for (const b of this.buildings) if (b.wonder && !b.dead && this.time - b.wonderAt >= wonderHold(this.W)) {
      this.winReason = 'Weltwunder';
      return this.P.filter(p => this.allied(p.id, b.owner));
    }
    const alive = this.P.filter(p => p.alive);
    if (!alive.length) return [];
    // gemeinsamer Sieg, wenn alle Überlebenden miteinander verbündet sind
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) if (!this.allied(alive[i].id, alive[j].id)) return null;
    return this.P.filter(p => this.allied(p.id, alive[0].id));
  }
  recordStats() {
    for (const pl of this.P) pl.history.push([Math.round(this.time), pl.pop, pl.military, pl.era, pl.stats.gathered]);
  }
  score(pl) { return Math.round(pl.stats.gathered / 10 + pl.stats.kills * 5 + pl.stats.razed * 20 + pl.era * 100 + pl.stats.built * 5); }

  // ---------------- Speichern / Laden ----------------
  // Kompletter Spielzustand als JSON-fähiges Objekt (Wegfindung, Sicht und Raster werden beim Laden neu aufgebaut).
  serialize() {
    return {
      v: 1, settings: this.settings, W: this.W, H: this.H, terrain: Buffer.from(this.terrain).toString('base64'),
      time: this.time, tickNo: this.tickNo, nextId: this.nextId, mapInfo: this.mapInfo, meteors: this.meteors, nextMeteor: this.nextMeteor || 0, nukes: this.nukes || [], radiation: this.radiation || [], dmz: this.dmz || [],
      P: this.P.map(({ mods, ...rest }) => rest),
      units: this.units.filter(u => !u.dead),
      buildings: this.buildings.filter(b => !b.dead),
      resources: [...this.resources.values()],
      prov: Buffer.from(this.prov.buffer, this.prov.byteOffset, this.prov.byteLength).toString('base64'), provinces: this.provinces, provOwner: Array.from(this.provOwner),
      rel: this.rel, proposals: this.proposals, dchat: this.dchat, tributes: this.tributes, chron: this.chron, nextPropId: this.nextPropId,
    };
  }
  static restore(room, d) {
    const w = Object.create(World.prototype);
    w.room = room; w.settings = d.settings;
    w.time = d.time; w.tickNo = d.tickNo; w.nextId = d.nextId; w.mapInfo = d.mapInfo;
    w.W = d.W; w.H = d.H;
    w.terrain = new Uint8Array(Buffer.from(d.terrain, 'base64'));
    const N = w.W * w.H;
    w.pass = new Uint8Array(N); w.occ = new Int32Array(N);
    for (let i = 0; i < N; i++) w.pass[i] = blockedTerrain(w.terrain[i]) ? 0 : 1;
    w.blockVer = 1; w.fields = new Map(); w.fieldBudget = 0;
    w.road = new Uint8Array(N);
    w.prov = d.prov ? new Uint16Array(new Uint8Array(Buffer.from(d.prov, 'base64')).buffer) : new Uint16Array(N).fill(65535);
    w.provinces = d.provinces || []; w.provOwner = Int16Array.from(d.provOwner || w.provinces.map(() => -1)); w.provDirty = true;
    w.events = []; w.resChanged = new Set(); w.resRemoved = [];
    w.meteors = d.meteors || []; w.nextMeteor = d.nextMeteor || 0; w.nukes = d.nukes || []; w.radiation = d.radiation || []; w.dmz = d.dmz || [];
    w.cellsW = Math.ceil(w.W / CELL); w.cellsH = Math.ceil(w.H / CELL);
    w.cells = Array.from({ length: w.cellsW * w.cellsH }, () => []);
    w.bcells = Array.from({ length: w.cellsW * w.cellsH }, () => []);
    w.resources = new Map(); w.ents = new Map();
    for (const r of d.resources) {
      if (r.layer == null) { r.layer = 0; r.base = r.amount; r.depleted = false; }
      for (let yy = r.y; yy < r.y + r.size; yy++) for (let xx = r.x; xx < r.x + r.size; xx++) { const i = w.idx(xx, yy); w.pass[i] = 0; w.occ[i] = r.id; }
      w.resources.set(r.id, r); w.ents.set(r.id, r);
    }
    w.buildings = d.buildings;
    for (const b of w.buildings) {
      for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) { const i = w.idx(xx, yy); w.occ[i] = b.id; if (!b.st.walkable) w.pass[i] = 0; if (b.type === 'bridge' && b.built) w.pass[i] = 1; if (b.type === 'road' && b.built) w.road[i] = 1; }
      w.bcells[w.cellOf(b.cx, b.cy)].push(b); w.ents.set(b.id, b);
    }
    w.units = d.units;
    for (const u of w.units) {
      u.typeIdx = TYPE_INDEX[unitKey(u.line, u.era, u.unique)];
      if (u.morale == null) Object.assign(u, { xp: 0, rank: 0, morale: 100, unsup: 0, form: 'none' });
      if (!u.r) u.r = RADIUS[u.cls];
      w.ents.set(u.id, u);
    }
    for (const b of w.buildings) b.typeIdx = TYPE_INDEX[b.type];
    w.computeTreeDensity();
    w.P = [];
    for (const pl of d.P) { pl.mods = playerMods(pl.culture, pl.nation, pl.late, pl.leader); w.P[pl.id] = pl; }
    Object.assign(w, { rel: d.rel || {}, proposals: d.proposals || [], dchat: d.dchat || {}, tributes: d.tributes || [], chron: d.chron || [], nextPropId: d.nextPropId || 1 });
    w.initDiplomacy();
    w.initRail();
    w.buildWPass();
    w.recount();
    return w;
  }

  // ---------------- Netzwerk ----------------
  initPayload(pid) {
    const res = [];
    for (const r of this.resources.values()) res.push(r.id, RESOURCE_KINDS.indexOf(r.rtype), r.x, r.y, Math.round(r.amount), r.layer || 0);
    return {
      t: 'start', w: this.W, h: this.H, terrain: Buffer.from(this.terrain).toString('base64'), res, you: pid,
      map: this.mapInfo, wonderHold: wonderHold(this.W), players: this.playersPublic(), settings: this.settings, time: this.time,
      prov: Buffer.from(this.prov.buffer, this.prov.byteOffset, this.prov.byteLength).toString('base64'), provinces: this.provinces, provOwner: Array.from(this.provOwner),
      start: this.P[pid] ? this.P[pid].start : this.P[0].start, dip: this.diploInit(pid),
    };
  }
  playersPublic() {
    const won = {};
    for (const b of this.buildings) if (b.wonder && !b.dead) won[b.owner] = Math.max(0, Math.ceil(wonderHold(this.W) - (this.time - b.wonderAt)));
    return this.P.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, alive: p.alive, era: p.era, pop: p.pop, culture: p.culture, nation: p.nation, leader: p.leader || null, score: this.score(p), isBot: p.isBot, wonder: won[p.id] ?? null, ...this.diploPublic(p) }));
  }
  privateState(pl) {
    const qs = [];
    for (const b of this.buildings) if (b.owner === pl.id && b.queue.length) qs.push([b.id, b.queue.map(q => q.nuke ? 'nuke' : q.wonder ? 'wonder' : q.late ? 'late' : q.era != null ? 'era' : unitKey(q.line, Math.max(pl.era, LINES[q.line].minEra), q.unique)), +b.qProg.toFixed(1), +b.queue[0].time.toFixed(1), b.blocked ? 1 : 0]);
    return {
      t: 'me', res: Object.fromEntries(RES.map(k => [k, Math.floor(pl.res[k])])), pop: pl.pop, cap: pl.popCap, era: pl.era,
      culture: pl.culture, nation: pl.nation, leader: pl.leader || null, leaderCd: pl.leaderCd > this.time ? Math.ceil(pl.leaderCd - this.time) : 0, leaderUsed: !!(pl.leaderUsed && pl.leaderUsed[pl.leaderEra]), nuke: this.nuclearPower(pl) ? [pl.nukeReady ? 1 : 0, pl.nukesUsed || 0, Math.max(0, Math.ceil((pl.nukePauseUntil || 0) - this.time))] : null, choice: pl.choice, adv: pl.advancing, wonderB: pl.wonderBuilding, q: qs, alive: pl.alive,
      late: pl.late, lateR: pl.lateResearch, dip: this.diploPrivate(pl),
      st: this.buildings.filter(b => !b.dead && b.owner === pl.id && b.type === 'station' && b.built).map(b => [b.id, (b.waiting || []).length, Math.round(Object.values(b.stock || {}).reduce((x, y) => x + y, 0)), this.isHomeStation(b) ? 1 : 0, this.reachableStations(b, pl.id).length]),
    };
  }
  entTuple(e, pid) {
    if (e.kind === 'u') {
      const carry = e.owner === pid && e.carry && e.carry.amt > 0 ? RES.indexOf(e.carry.res) + 1 : 0;
      return [e.id, e.typeIdx, e.owner, Math.round(e.x * 20), Math.round(e.y * 20), Math.ceil(e.hp), e.maxHp, e.state, carry, Math.round(((e.dir || 0) + Math.PI) * 10),
        e.rank || 0, e.owner === pid ? Math.round((e.morale ?? 100) / 10) : 0, e.owner === pid && e.supplied === false ? 0 : 1, FORMATION_KEYS.indexOf(e.form || 'none'),
        e.air && e.owner === pid ? Math.round(e.fuel / e.st.fuel * 10) : -1, e.air && e.owner === pid ? Math.ceil(e.ammo) : -1, e.title || 0];
    }
    return [e.id, e.typeIdx, e.owner, e.x, e.y, Math.ceil(e.hp), e.maxHp, e.built ? 100 : Math.floor(e.progress * 100), e.queue.length ? 1 : 0, e.era];
  }
  // Diff-Nachricht für einen Client (Spieler oder Zuschauer = -1)
  snapshot(client) {
    const pid = client.pid;
    const pl = pid >= 0 ? this.P[pid] : null;
    const seeAll = !pl || !pl.alive;
    const sent = client.sent || (client.sent = new Map());
    const full = [], mv = [], gone = [], hidden = [];
    const seen = client.seenNow || (client.seenNow = new Set());
    seen.clear();
    const consider = e => {
      if (e.dead) return;
      if (!seeAll && !this.visibleTo(pid, e)) return;
      seen.add(e.id);
      const t = this.entTuple(e, pid);
      const prev = sent.get(e.id);
      if (!prev) { full.push(t); sent.set(e.id, t); return; }
      let posOnly = true, same = true;
      for (let k = 0; k < t.length; k++) if (t[k] !== prev[k]) { same = false; if (k !== 3 && k !== 4 && k !== 9) posOnly = false; }
      if (same) return;
      if (posOnly && e.kind === 'u') mv.push(e.id, t[3], t[4], t[9]); else full.push(t);
      sent.set(e.id, t);
    };
    for (const u of this.units) if (!u.aboard) consider(u);
    for (const b of this.buildings) consider(b);
    for (const id of sent.keys()) {
      if (seen.has(id)) continue;
      const e = this.ents.get(id);
      if (!e || e.dead) gone.push(id); else hidden.push(id);
      sent.delete(id);
    }
    const msg = { t: 'd', time: +this.time.toFixed(2) };
    if (full.length) msg.f = full;
    if (mv.length) msg.m = mv;
    if (gone.length) msg.g = gone;
    if (hidden.length) msg.h = hidden;
    return msg;
  }
  resourceDelta() {
    const ch = [];
    for (const id of this.resChanged) { const r = this.resources.get(id); if (r) ch.push(id, Math.round(r.amount), r.layer || 0); }
    this.resChanged.clear();
    const rm = this.resRemoved; this.resRemoved = [];
    return { ch, rm };
  }
  eventsFor(pid, evs) {
    const out = [];
    const pl = pid >= 0 ? this.P[pid] : null;
    const v = pl && pl.alive && this.vis ? this.vis.get(pl.team) : null;
    const see = (x, y) => !v || v[this.idx(Math.max(0, Math.min(this.W - 1, Math.floor(x))), Math.max(0, Math.min(this.H - 1, Math.floor(y))))];
    for (const e of evs) {
      if (e.to != null && e.to !== -1) { if (e.to === pid) out.push(e); continue; }
      if (e.k === 'shot') { if (see(e.x, e.y) || see(e.tx, e.ty)) out.push(e); continue; }
      if (e.k === 'death' || e.k === 'destroy' || e.k === 'impact') { if (see(e.x, e.y)) out.push(e); continue; }
      out.push(e);
    }
    return out;
  }
}

installDiplomacy(World);
installRail(World);
installNaval(World);
installAir(World);
installCelo(World);
installLeaders(World);
installNukes(World);
installConference(World);
