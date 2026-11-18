// Autoritative RTS-Simulation: Einheiten, Gebäude, Rohstoffe, Kampf, Sicht, Netzwerk-Diffs.
import {
  TICK_MS, RES, ERAS, CULTURES, NATIONS, LINES, UNIQUE, UNIQUE_MIN_ERA, BUILDINGS, RESOURCE_TYPES, RESOURCE_KINDS,
  FARM_RATE, CARRY, MAX_POP, DMG, TYPE_INDEX, unitStats, buildingStats, playerMods, unitKey, trainable, sumCost,
  WONDER, WONDER_ERA, wonderHold, LATE_STAGE, eraCost, isProducer, DEPOSIT_LAYERS, hasLayers,
} from '../shared/rules.js';
import { generateMap, blockedTerrain } from './mapgen.js';

const RADIUS = { wrk: 0.3, inf: 0.3, rng: 0.3, cav: 0.42, sie: 0.48 };
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
    const N = this.W * this.H;
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
  allied(a, b) { return a === b || (a >= 0 && b >= 0 && this.P[a].team === this.P[b].team); }
  enemy(a, b) { return a >= 0 && b >= 0 && !this.allied(a, b); }

  addResource(type, x, y, mul = 1) {
    const d = RESOURCE_TYPES[type];
    const r = { id: this.nextId++, kind: 'r', rtype: type, res: d.res, amount: Math.round(d.amount * mul), base: Math.round(d.amount * mul), layer: 0, depleted: false, x, y, size: d.size, cx: x + d.size / 2, cy: y + d.size / 2 };
    for (let yy = y; yy < y + d.size; yy++) for (let xx = x; xx < x + d.size; xx++) { const i = this.idx(xx, yy); this.pass[i] = 0; this.occ[i] = r.id; }
    this.resources.set(r.id, r); this.ents.set(r.id, r);
    return r;
  }
  removeResource(r) {
    for (let yy = r.y; yy < r.y + r.size; yy++) for (let xx = r.x; xx < r.x + r.size; xx++) {
      const i = this.idx(xx, yy); this.occ[i] = 0; if (!blockedTerrain(this.terrain[i])) this.pass[i] = 1;
    }
    this.resources.delete(r.id); this.ents.delete(r.id);
    this.resRemoved.push(r.id);
    this.resChanged.delete(r.id);
  }

  canPlace(type, x, y) {
    const sz = BUILDINGS[type].size;
    for (let yy = y; yy < y + sz; yy++) for (let xx = x; xx < x + sz; xx++) {
      if (!this.inBounds(xx, yy)) return false;
      const i = this.idx(xx, yy);
      if (blockedTerrain(this.terrain[i]) || this.occ[i]) return false;
    }
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
    for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) {
      const i = this.idx(xx, yy);
      if (this.occ[i] === b.id) { this.occ[i] = 0; if (!blockedTerrain(this.terrain[i])) this.pass[i] = 1; }
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
    };
    this.units.push(u); this.ents.set(u.id, u);
    return u;
  }
  cellOf(x, y) { return Math.min(this.cellsH - 1, Math.max(0, Math.floor(y / CELL))) * this.cellsW + Math.min(this.cellsW - 1, Math.max(0, Math.floor(x / CELL))); }

  // ---------------- Wegfindung (Flow-Fields mit Cache) ----------------
  field(key, sourcesFn) {
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
    const sp = Math.min(d, u.st.speed * dt);
    let nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
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
    const own = ids => (Array.isArray(ids) ? ids : []).slice(0, 300).map(id => this.ents.get(id)).filter(e => e && e.owner === pid && !e.dead);
    switch (c.c) {
      case 'move': {
        const us = own(c.ids).filter(e => e.kind === 'u');
        this.groupMove(us, +c.x, +c.y, !!c.amove);
        break;
      }
      case 'attack': {
        const t = this.ents.get(c.target);
        if (!t || t.dead || t.kind === 'r') return;
        for (const u of own(c.ids)) if (u.kind === 'u') { u.order = { t: 'attack', target: t.id, forced: true }; u.buildQ = []; }
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
        for (const u of own(c.ids)) if (u.kind === 'u' && u.cls === 'wrk') this.orderGather(u, t);
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
        const workers = own(c.ids).filter(e => e.kind === 'u' && e.cls === 'wrk');
        const pos = (Array.isArray(c.pos) ? c.pos : []).slice(0, 60);
        const placed = [];
        for (const [x, y] of pos) {
          const st = buildingStats(type, pl.era, pl.mods);
          if (!this.canAfford(pl, st.cost)) { this.notice(pid, 'Nicht genug Rohstoffe.'); break; }
          if (!this.canPlace(type, x | 0, y | 0)) continue;
          this.pay(pl, st.cost);
          const b = this.addBuilding(pid, type, x | 0, y | 0, false);
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
          const b = bs.find(x => trainable(x.type, pl.era, pl.culture).some(t => t.line === c.line && (t.unique || null) === (c.unique || null)));
          if (!b || b.queue.length >= 15) break;
          const st = unitStats(c.line, Math.max(pl.era, LINES[c.line].minEra), c.unique || null, pl.mods);
          if (!this.canAfford(pl, st.cost)) { this.notice(pid, 'Nicht genug Rohstoffe.'); break; }
          this.pay(pl, st.cost);
          b.queue.push({ line: c.line, unique: c.unique || null, cost: st.cost, time: st.time });
        }
        break;
      }
      case 'era': {
        const b = own([c.id])[0];
        if (!b || b.type !== 'town' || !b.built || pl.advancing || pl.era >= ERAS.length - 1 || pl.choice) return;
        if (pl.lateResearch) { this.notice(pid, 'Erst die laufende Forschung abschließen.'); return; }
        const next = ERAS[pl.era + 1], cost = eraCost(pl.era + 1, this.leaderEra());
        if (!this.canAfford(pl, cost)) { this.notice(pid, 'Nicht genug Rohstoffe für die nächste Epoche.'); return; }
        this.pay(pl, cost);
        b.queue.unshift({ era: pl.era + 1, cost, time: next.time });
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
      case 'stop':
        for (const u of own(c.ids)) if (u.kind === 'u') { u.order = { t: 'idle' }; u.buildQ = []; }
        break;
      case 'delete':
        for (const e of own(c.ids)) {
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
        }
        break;
      }
      default:
    }
  }
  canAfford(pl, cost) { for (const k in cost) if ((pl.res[k] || 0) < cost[k]) return false; return true; }
  pay(pl, cost) { for (const k in cost) pl.res[k] -= cost[k]; }
  refund(pl, cost) { for (const k in cost) pl.res[k] += cost[k]; }
  updateMods(pl) {
    pl.mods = playerMods(pl.culture, pl.nation, pl.late);
  }
  leaderEra() { let m = 0; for (const p of this.P) if (p.alive && p.era > m) m = p.era; return m; }
  notice(pid, text) { this.events.push({ k: 'notice', to: pid, text }); }
  event(e) { this.events.push(e); }

  groupMove(us, x, y, amove) {
    if (!us.length) return;
    x = Math.max(0.5, Math.min(this.W - 0.5, x)); y = Math.max(0.5, Math.min(this.H - 0.5, y));
    let cx = 0, cy = 0;
    for (const u of us) { cx += u.x; cy += u.y; }
    cx /= us.length; cy /= us.length;
    const tx = Math.floor(x), ty = Math.floor(y);
    const key = 'p' + tx + ',' + ty;
    // Formation: relative Positionen beibehalten, aber verdichten
    const spread = Math.sqrt(us.length) * 0.75;
    let maxOff = 0;
    for (const u of us) maxOff = Math.max(maxOff, Math.hypot(u.x - cx, u.y - cy));
    const f = maxOff > spread ? spread / maxOff : 1;
    for (const u of us) {
      let ox = x + (u.x - cx) * f, oy = y + (u.y - cy) * f;
      if (!this.passableAt(ox, oy) || !this.lineClear(x, y, ox, oy)) { ox = x; oy = y; }
      u.order = { t: amove ? 'amove' : 'move', x: ox, y: oy, key, tx, ty };
      u.buildQ = [];
      u.stuck = 0;
    }
  }
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
    for (const u of this.units) this.cells[this.cellOf(u.x, u.y)].push(u);

    for (const u of this.units) if (!u.dead) this.updateUnit(u, dt);
    for (const b of this.buildings) if (!b.dead) this.updateBuilding(b, dt);
    this.separate(dt);
    this.updateMeteors(dt);

    if (this.units.some(u => u.dead)) this.units = this.units.filter(u => !u.dead);
    if (this.buildings.some(b => b.dead)) this.buildings = this.buildings.filter(b => !b.dead);

    if (this.tickNo % 5 === 0) this.recount();
    if (this.tickNo % 10 === 0) this.checkDefeat();
    if (Math.floor(this.time / 10) !== Math.floor((this.time - dt) / 10)) this.recordStats();
  }

  recount() {
    for (const pl of this.P) { pl.pop = 0; pl.popCap = 0; pl.military = 0; pl.nUnits = 0; pl.nBuildings = 0; }
    for (const u of this.units) { const pl = this.P[u.owner]; pl.pop += u.st.pop; pl.nUnits++; if (u.cls !== 'wrk') pl.military++; }
    for (const b of this.buildings) {
      const pl = this.P[b.owner]; pl.nBuildings++;
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
  findTarget(owner, x, y, r, preferUnits = true) {
    let best = null, bd = Infinity;
    this.nearbyUnits(x, y, r, o => {
      if (o.dead || !this.enemy(owner, o.owner)) return;
      const d = Math.hypot(o.x - x, o.y - y) - (o.cls === 'wrk' ? -0.5 : 0);
      if (d < r && d < bd) { bd = d; best = o; }
    });
    if (best && preferUnits) return best;
    this.nearbyBuildings(x, y, r, b => {
      if (b.dead || !this.enemy(owner, b.owner) || b.type === 'wall' && best) return;
      const d = Math.hypot(b.cx - x, b.cy - y) - b.size / 2 + 3; // Gebäude nachrangig
      if (d < r && d < bd) { bd = d; best = b; }
    });
    return best;
  }

  updateUnit(u, dt) {
    if (u.cd > 0) u.cd -= dt;
    const pl = this.P[u.owner];
    if (pl.mods.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + pl.mods.regen * dt);
    const o = u.order;
    u.state = ST.idle;
    switch (o.t) {
      case 'idle': {
        if (u.cls !== 'wrk') {
          u.scan -= dt;
          if (u.scan <= 0) {
            u.scan = 0.5;
            const t = this.findTarget(u.owner, u.x, u.y, u.st.sight);
            if (t) u.order = { t: 'attack', target: t.id, guard: { x: u.x, y: u.y } };
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
            const t = this.findTarget(u.owner, u.x, u.y, u.st.sight);
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
        const nt = this.findTarget(u.owner, u.x, u.y, u.st.sight);
        u.order = nt ? { t: 'attack', target: nt.id, guard: o.guard } : { t: 'move', x: o.guard.x, y: o.guard.y, key: 'p' + Math.floor(o.guard.x) + ',' + Math.floor(o.guard.y), tx: Math.floor(o.guard.x), ty: Math.floor(o.guard.y) };
      } else u.order = { t: 'idle' };
    };
    if (!t || t.dead || t.kind === 'r' || !this.enemy(u.owner, t.owner) && !o.forced) return done();
    if (t.owner === u.owner) return done();
    // Wache: nicht zu weit verfolgen
    if (o.guard && Math.hypot(u.x - o.guard.x, u.y - o.guard.y) > u.st.sight + 6) { u.order = { t: 'move', x: o.guard.x, y: o.guard.y, key: 'p' + Math.floor(o.guard.x) + ',' + Math.floor(o.guard.y), tx: Math.floor(o.guard.x), ty: Math.floor(o.guard.y) }; return; }
    // nicht sichtbares Ziel nicht ewig jagen
    if (!this.visibleTo(u.owner, t)) return done();
    const range = u.st.range;
    const d = this.distTo(u, t);
    if (d > range + u.r) {
      // Fernkämpfer im Angriffsbewegung: neues, näheres Ziel?
      const r = this.approach(u, t, range, dt);
      if (r === 'fail') return done();
      if (this.progressCheck(u, d, dt) && !o.forced) return done();
      return;
    }
    u.lastD = null;
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
      this.hit(u, t, u.st.atk, u.cls, u.st.splash);
      if (range > 1.2) this.event({ k: 'shot', x: u.x, y: u.y, tx: t.kind === 'u' ? t.x : t.cx, ty: t.kind === 'u' ? t.y : t.cy, c: u.cls === 'sie' ? 1 : (u.era >= 4 ? 2 : 0) });
    }
  }
  hit(src, t, atk, cls, splash) {
    const dcls = t.kind === 'u' ? t.cls : 'bld';
    let dmg = atk * (DMG[cls][dcls] || 1);
    if (t.kind === 'b' && !t.built) dmg *= 1.5;
    this.damage(t, dmg, src.owner);
    if (splash) {
      const tx = t.kind === 'u' ? t.x : t.cx, ty = t.kind === 'u' ? t.y : t.cy;
      this.nearbyUnits(tx, ty, splash, o => {
        if (o === t || o.dead || !this.enemy(src.owner, o.owner)) return;
        if (Math.hypot(o.x - tx, o.y - ty) <= splash) this.damage(o, atk * 0.5 * (DMG[cls][o.cls] || 1), src.owner);
      });
    }
    // Vergeltung
    if (t.kind === 'u' && !t.dead && t.cls !== 'wrk' && (t.order.t === 'idle' || (t.order.t === 'move' && t.order.x == null))) {
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
      if (o.owner === victim.owner && o.cls !== 'wrk' && o.order.t === 'idle') o.order = { t: 'attack', target: attacker.id, guard: { x: o.x, y: o.y } };
    });
    if (!victim.alertCd || this.time > victim.alertCd) {
      victim.alertCd = this.time + 15;
      this.events.push({ k: 'alert', to: victim.owner, x, y });
    }
  }
  damage(t, dmg, by) {
    t.hp -= dmg;
    if (t.hp <= 0 && !t.dead) this.kill(t, by);
  }
  kill(e, by) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    this.ents.delete(e.id);
    const pl = this.P[e.owner];
    if (e.kind === 'u') {
      pl.stats.lost++;
      if (by >= 0) this.P[by].stats.kills++;
      this.event({ k: 'death', id: e.id, x: e.x, y: e.y, c: e.cls, o: e.owner });
    } else if (e.kind === 'b') {
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
      if (b.dead || b.owner !== u.owner || !b.built || !b.st.drop) continue;
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
        pl.res[u.carry.res] += u.carry.amt;
        pl.stats.gathered += u.carry.amt;
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
      if (r === 'fail') { u.order = { t: 'idle' }; return; }
    }
    u.lastD = null;
    u.state = ST.gather;
    u.dir = Math.atan2(t.cy - u.y, t.cx - u.x);
    const rate = (isFarm ? BUILDINGS[o.rtype].rate : RESOURCE_TYPES[o.rtype].rate) * pl.mods.gather[resKind] * (1 + pl.era * 0.06);
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
      const inc = dt / b.st.time;
      b.progress = Math.min(1, b.progress + inc);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * inc);
      if (b.progress >= 1) {
        b.built = true;
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
    const pl = this.P[b.owner];
    // Angriff (Haupthaus, Turm)
    if (b.st.atk) {
      b.cd -= dt;
      if (b.cd <= 0) {
        const t = this.findTarget(b.owner, b.cx, b.cy, b.st.range + b.size / 2, true);
        if (t && t.kind === 'u') {
          b.cd = b.st.cd;
          this.damage(t, b.st.atk * (DMG.bld[t.cls] || 1), b.owner);
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
        b.wonder = true; b.wonderAt = this.time; b.era = WONDER_ERA;
        const ratio = b.hp / b.maxHp; b.maxHp = Math.round(b.st.hp * WONDER.hpMul); b.hp = b.maxHp * ratio;
        this.event({ k: 'wonder', p: pl.id, what: 'done', hold: wonderHold(this.W) });
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
    if (q.era != null) {
      b.qProg += dt;
      if (b.qProg >= q.time) {
        b.queue.shift(); b.qProg = 0;
        pl.era = q.era; pl.advancing = null;
        if (pl.era === 1 && !pl.culture) pl.choice = 'culture';
        else if (pl.era === 3 && !pl.nation) pl.choice = pl.culture ? 'nation' : 'culture';
        this.event({ k: 'era', p: pl.id, era: pl.era });
        // Gebäude werden mit der Epoche robuster
        for (const x of this.buildings) if (x.owner === pl.id && !x.dead) {
          const st = buildingStats(x.type, pl.era, pl.mods);
          const ratio = x.hp / x.maxHp;
          x.st = st; x.maxHp = Math.round(st.hp * (x.wonder ? WONDER.hpMul : 1)); x.hp = x.maxHp * ratio;
          if (!x.wonder) x.era = pl.era; // Gebäude wechseln zum Baustil der neuen Epoche
        }
      }
      return;
    }
    const st = unitStats(q.line, Math.max(pl.era, LINES[q.line].minEra), q.unique, pl.mods);
    if (b.qProg < q.time) b.qProg += dt;
    if (b.qProg >= q.time) {
      if (pl.pop + st.pop > pl.popCap) { b.blocked = true; return; }
      b.blocked = false;
      const spawn = this.spawnPoint(b);
      if (!spawn) return;
      b.queue.shift(); b.qProg = 0;
      const u = this.addUnit(b.owner, q.line, q.unique, spawn[0], spawn[1]);
      pl.pop += st.pop;
      pl.stats.trained++;
      this.cells[this.cellOf(u.x, u.y)].push(u);
      if (b.rally) {
        const rt = b.rally.target ? this.ents.get(b.rally.target) : null;
        if (rt && u.cls === 'wrk' && (rt.kind === 'r' || isProducer(rt.type))) this.orderGather(u, rt);
        else this.groupMove([u], b.rally.x, b.rally.y, u.cls !== 'wrk');
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
        const a = c[i]; if (a.dead) continue;
        // Nachbarzellen rechts/unten einbeziehen
        const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
        for (let oy = 0; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (oy === 0 && ox < 0) continue;
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= this.cellsW || ny >= this.cellsH) continue;
          const arr = this.cells[ny * this.cellsW + nx];
          const start = arr === c ? i + 1 : 0;
          for (let j = start; j < arr.length; j++) {
            const b = arr[j]; if (b.dead) continue;
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
            if (this.passableAt(ax, ay)) { a.x = ax; a.y = ay; }
            if (this.passableAt(bx, by)) { b.x = bx; b.y = by; }
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
    const stamp = (v, x, y, r) => {
      const c = CIRCLES[Math.min(14, Math.round(r))];
      const tx = Math.floor(x), ty = Math.floor(y);
      for (let k = 0; k < c.length; k += 2) {
        const nx = tx + c[k], ny = ty + c[k + 1];
        if (nx >= 0 && ny >= 0 && nx < this.W && ny < this.H) v[ny * this.W + nx] = 1;
      }
    };
    for (const u of this.units) if (!u.dead) stamp(this.vis.get(this.P[u.owner].team), u.x, u.y, u.st.sight);
    for (const b of this.buildings) if (!b.dead) stamp(this.vis.get(this.P[b.owner].team), b.cx, b.cy, b.st.sight + b.size / 2);
  }
  visibleTo(pid, e) {
    if (this.allied(pid, e.owner)) return true;
    const v = this.vis && this.vis.get(this.P[pid].team);
    if (!v) return true;
    if (e.kind === 'u') return v[this.idx(Math.floor(e.x), Math.floor(e.y))] === 1;
    for (let yy = e.y; yy < e.y + e.size; yy++) for (let xx = e.x; xx < e.x + e.size; xx++) if (v[this.idx(xx, yy)]) return true;
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
  }
  winners() {
    for (const b of this.buildings) if (b.wonder && !b.dead && this.time - b.wonderAt >= wonderHold(this.W)) {
      this.winReason = 'Weltwunder';
      return this.P.filter(p => p.team === this.P[b.owner].team);
    }
    const alive = this.P.filter(p => p.alive);
    if (!alive.length) return [];
    const teams = new Set(alive.map(p => p.team));
    if (teams.size <= 1) return this.P.filter(p => p.team === alive[0].team);
    return null;
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
      time: this.time, tickNo: this.tickNo, nextId: this.nextId, mapInfo: this.mapInfo, meteors: this.meteors, nextMeteor: this.nextMeteor || 0,
      P: this.P.map(({ mods, ...rest }) => rest),
      units: this.units.filter(u => !u.dead),
      buildings: this.buildings.filter(b => !b.dead),
      resources: [...this.resources.values()],
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
    w.events = []; w.resChanged = new Set(); w.resRemoved = [];
    w.meteors = d.meteors || []; w.nextMeteor = d.nextMeteor || 0;
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
      for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) { const i = w.idx(xx, yy); w.occ[i] = b.id; if (!b.st.walkable) w.pass[i] = 0; }
      w.bcells[w.cellOf(b.cx, b.cy)].push(b); w.ents.set(b.id, b);
    }
    w.units = d.units;
    for (const u of w.units) w.ents.set(u.id, u);
    w.P = [];
    for (const pl of d.P) { pl.mods = playerMods(pl.culture, pl.nation, pl.late); w.P[pl.id] = pl; }
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
      start: this.P[pid] ? this.P[pid].start : this.P[0].start,
    };
  }
  playersPublic() {
    const won = {};
    for (const b of this.buildings) if (b.wonder && !b.dead) won[b.owner] = Math.max(0, Math.ceil(wonderHold(this.W) - (this.time - b.wonderAt)));
    return this.P.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, alive: p.alive, era: p.era, pop: p.pop, culture: p.culture, nation: p.nation, score: this.score(p), isBot: p.isBot, wonder: won[p.id] ?? null }));
  }
  privateState(pl) {
    const qs = [];
    for (const b of this.buildings) if (b.owner === pl.id && b.queue.length) qs.push([b.id, b.queue.map(q => q.wonder ? 'wonder' : q.late ? 'late' : q.era != null ? 'era' : unitKey(q.line, Math.max(pl.era, LINES[q.line].minEra), q.unique)), +b.qProg.toFixed(1), +b.queue[0].time.toFixed(1), b.blocked ? 1 : 0]);
    return {
      t: 'me', res: Object.fromEntries(RES.map(k => [k, Math.floor(pl.res[k])])), pop: pl.pop, cap: pl.popCap, era: pl.era,
      culture: pl.culture, nation: pl.nation, choice: pl.choice, adv: pl.advancing, wonderB: pl.wonderBuilding, q: qs, alive: pl.alive,
      late: pl.late, lateR: pl.lateResearch,
    };
  }
  entTuple(e, pid) {
    if (e.kind === 'u') {
      const carry = e.owner === pid && e.carry && e.carry.amt > 0 ? RES.indexOf(e.carry.res) + 1 : 0;
      return [e.id, e.typeIdx, e.owner, Math.round(e.x * 20), Math.round(e.y * 20), Math.ceil(e.hp), e.maxHp, e.state, carry, Math.round(((e.dir || 0) + Math.PI) * 10)];
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
    for (const u of this.units) consider(u);
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
