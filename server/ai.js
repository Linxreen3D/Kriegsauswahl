// KI-Gegner: spielt über dieselbe Befehlsschnittstelle wie Menschen.
import { ERAS, WONDER, CULTURES, BUILDINGS, LINES, RESOURCE_TYPES, LATE_STAGE, isProducer, unitStats, buildingStats, trainable, eraCost } from '../shared/rules.js';

const PROFILES = {
  easy: { think: 2.0, workers: 0.6, attackAt: 14, firstAttack: 540, aggression: 0.5, towers: 0 },
  normal: { think: 1.0, workers: 0.85, attackAt: 10, firstAttack: 330, aggression: 0.8, towers: 1 },
  hard: { think: 0.5, workers: 1.0, attackAt: 8, firstAttack: 240, aggression: 1, towers: 2 },
};

export class AI {
  // defensive: Bot-Vertretung für getrennte Spieler – baut weiter und verteidigt, greift aber nicht an.
  constructor(world, pid, difficulty, { defensive = false } = {}) {
    this.w = world; this.pid = pid; this.defensive = defensive;
    this.prof = PROFILES[difficulty] || PROFILES.normal;
    this.next = 1 + Math.random();
    this.lastStorage = -999;
    this.attacking = false;
    this.target = null;
  }
  get pl() { return this.w.P[this.pid]; }
  cmd(c) { this.w.command(this.pid, c); }

  update() {
    const w = this.w, pl = this.pl;
    if (!pl.alive || w.time < this.next) return;
    this.next = w.time + this.prof.think;

    if (pl.choice === 'culture') this.cmd({ c: 'choose', kind: 'culture', value: pick(Object.keys(CULTURES)) });
    else if (pl.choice === 'nation') this.cmd({ c: 'choose', kind: 'nation', value: pick(CULTURES[pl.culture].nations) });

    const units = w.units.filter(u => u.owner === this.pid && !u.dead);
    const blds = w.buildings.filter(b => b.owner === this.pid && !b.dead);
    const towns = blds.filter(b => b.type === 'town' && b.built);
    this.base = towns[0] || blds[0] || units[0];
    if (!this.base) return;
    this.bx = this.base.cx || this.base.x; this.by = this.base.cy || this.base.y;
    const workers = units.filter(u => u.cls === 'wrk');
    const army = units.filter(u => u.cls !== 'wrk');
    const count = t => blds.filter(b => b.type === t).length;
    const building = blds.filter(b => !b.built);

    // ---- Wirtschaft ----
    const targetWorkers = Math.round((18 + pl.era * 9) * this.prof.workers);
    for (const tc of towns) {
      if (!tc.queue.length && workers.length < Math.min(70, targetWorkers) && pl.pop < pl.popCap) this.cmd({ c: 'train', ids: [tc.id], line: 'worker', n: 1 });
    }
    // Epochenaufstieg
    if (!pl.advancing && !pl.choice && pl.era < ERAS.length - 1 && towns.length && workers.length >= targetWorkers * 0.6) {
      const cost = eraCost(pl.era + 1, w.leaderEra());
      if (w.canAfford(pl, cost)) this.cmd({ c: 'era', id: towns[0].id });
    }
    // Zweite Stufe der 2. Industriellen Revolution
    if (pl.era === LATE_STAGE.era && !pl.late && !pl.lateResearch && !pl.advancing && towns.length && w.canAfford(pl, LATE_STAGE.cost)) this.cmd({ c: 'late', id: towns[0].id });
    // Häuser
    const houseBuilding = building.some(b => b.type === 'house');
    if (pl.popCap < 200 && pl.popCap - pl.pop < 4 + pl.era * 2 && !houseBuilding) this.build('house', workers, 1);
    // Militärgebäude & Wirtschaft
    const wantBuilding = (type, cond) => { if (cond && count(type) === 0 && pl.era >= BUILDINGS[type].minEra) { this.build(type, workers, 2); return true; } return false; };
    wantBuilding('barracks', workers.length >= 7) ||
      wantBuilding('range', workers.length >= 11) ||
      wantBuilding('stable', workers.length >= 15) ||
      wantBuilding('workshop', workers.length >= 20);
    if (pl.era >= 2 && workers.length > 25 && count('barracks') < 2 && pl.res.wood > 400) this.build('barracks', workers, 1);
    const floating = pl.res.food + pl.res.gold;
    if (pl.era >= 2 && floating > 1500 && pl.res.wood > 250 && blds.filter(b => ['barracks', 'range', 'stable', 'workshop'].includes(b.type)).length < 4 + pl.era) {
      this.build(pick(['barracks', 'range', 'stable']), workers, 2);
    }
    if (pl.era >= 3 && workers.length > 35 && count('range') < 2 && pl.res.wood > 400) this.build('range', workers, 1);
    if (this.prof.towers && pl.era >= 1 && count('tower') < this.prof.towers * (1 + Math.floor(pl.era / 2)) && pl.res.stone > 250) this.build('tower', workers, 1, 6, 10);
    // Weltwunder in der letzten Epoche
    if (pl.era === ERAS.length - 1 && !pl.wonderBuilding && towns.length && !blds.some(b => b.wonder) && this.prof.aggression >= 0.8) {
      const wc = WONDER.cost; if (w.canAfford(pl, wc)) this.cmd({ c: 'wonder', id: towns[towns.length - 1].id });
    }
    if (pl.era >= 3 && towns.length < 2 && workers.length > 40 && pl.res.wood > 500 && pl.res.stone > 300) this.build('town', workers, 3, 14, 22);

    // Baustellen ohne Bauarbeiter besetzen
    for (const b of building) {
      const has = workers.some(u => u.order.t === 'build' && u.order.target === b.id);
      if (has) continue;
      const free = workers.filter(u => u.order.t !== 'build').sort((a, c) => Math.hypot(a.x - b.cx, a.y - b.cy) - Math.hypot(c.x - b.cx, c.y - b.cy))[0];
      if (free) this.cmd({ c: 'repair', ids: [free.id], target: b.id });
    }
    // Haupthaus verloren → neu bauen
    if (!towns.length && !building.some(b => b.type === 'town')) this.build('town', workers, 4, 2, 10);
    this.assignWorkers(workers, blds, pl);

    // ---- Militär ----
    const reserve = pl.advancing ? 0 : 1;
    const capArmy = pl.era === 0 ? 4 : 999;
    for (const b of blds) {
      if (!b.built || b.queue.length >= 2 || b.type === 'town') continue;
      if (army.length >= capArmy) break;
      const opts = trainable(b.type, pl.era, pl.culture);
      if (!opts.length) continue;
      const o = opts[opts.length - 1 - Math.floor(Math.random() * Math.min(2, opts.length))];
      const st = unitStats(o.line, Math.max(pl.era, LINES[o.line].minEra), o.unique, pl.mods);
      const nextEra = ERAS[pl.era + 1];
      // für den Epochenaufstieg sparen, wenn knapp
      let ok = true;
      // nur sparen, wenn der Aufstieg in Reichweite ist
      if (nextEra && !pl.advancing && workers.length >= targetWorkers * 0.6) {
        let have = 0, need = 0;
        for (const k in nextEra.cost) { need += nextEra.cost[k]; have += Math.min(pl.res[k], nextEra.cost[k]); }
        const desiredArmy = (6 + pl.era * 5) * (this.prof.workers + 0.3);
        if (have >= need * 0.6 || army.length >= desiredArmy) for (const k in st.cost) if (pl.res[k] - st.cost[k] < (nextEra.cost[k] || 0) * reserve) ok = false;
      }
      if (ok && pl.pop + st.pop <= pl.popCap && w.canAfford(pl, st.cost)) this.cmd({ c: 'train', ids: [b.id], line: o.line, unique: o.unique, n: 1 });
    }
    // Sammelpunkt
    for (const b of blds) if (b.built && !b.rally && b.type !== 'town' && b.type !== 'house' && !isProducer(b.type)) this.cmd({ c: 'rally', ids: [b.id], x: this.bx + 4, y: this.by + 4 });

    // Verteidigung
    let threat = null;
    for (const b of blds) {
      const t = w.findTarget(this.pid, b.cx, b.cy, 12, true);
      if (t && t.kind === 'u') { threat = t; break; }
    }
    if (threat) {
      const defenders = army.filter(u => u.order.t !== 'attack');
      if (defenders.length) this.cmd({ c: 'move', ids: defenders.map(u => u.id), x: threat.x, y: threat.y, amove: true });
      return;
    }
    // Angriff (nicht als Vertretung eines getrennten Spielers)
    if (this.defensive) return;
    const idle = army.filter(u => u.order.t === 'idle');
    const threshold = this.prof.attackAt + pl.era * 3;
    if (w.time > this.prof.firstAttack && (idle.length >= threshold || army.length >= Math.min(120, threshold * 2.5))) {
      const tgt = this.pickTarget();
      if (tgt) {
        const ids = army.filter(u => u.order.t === 'idle' || u.order.t === 'move').map(u => u.id);
        if (ids.length >= threshold * this.prof.aggression) this.cmd({ c: 'move', ids, x: tgt.x, y: tgt.y, amove: true });
      }
    }
  }

  pickTarget() {
    const w = this.w;
    let best = null, bd = Infinity;
    for (const b of w.buildings) {
      if (b.dead || !w.enemy(this.pid, b.owner)) continue;
      const d = Math.hypot(b.cx - this.bx, b.cy - this.by) * (b.type === 'town' ? 0.8 : 1) * (b.type === 'wall' ? 3 : 1);
      if (d < bd) { bd = d; best = { x: b.cx, y: b.cy }; }
    }
    if (!best) for (const u of w.units) {
      if (u.dead || !w.enemy(this.pid, u.owner)) continue;
      const d = Math.hypot(u.x - this.bx, u.y - this.by);
      if (d < bd) { bd = d; best = { x: u.x, y: u.y }; }
    }
    return best;
  }

  assignWorkers(workers, blds, pl) {
    const w = this.w;
    const counts = { food: 0, wood: 0, gold: 0, stone: 0 };
    const idle = [];
    for (const u of workers) {
      const o = u.order;
      if (o.t === 'gather') counts[isProducer(o.rtype) ? BUILDINGS[o.rtype].yields : RESOURCE_TYPES[o.rtype].res]++;
      else if (o.t === 'idle' && !u.buildQ.length) idle.push(u);
    }
    const e = pl.era;
    const ratio = e === 0 ? { food: 0.6, wood: 0.4, gold: 0, stone: 0 } : e < 3 ? { food: 0.45, wood: 0.3, gold: 0.18, stone: 0.07 } : { food: 0.38, wood: 0.22, gold: 0.28, stone: 0.12 };
    // Bedarf für die nächste Epoche einrechnen
    const next = ERAS[e + 1];
    if (next) {
      let tot = 0; const need = {};
      for (const k in ratio) { need[k] = Math.max(0, (next.cost[k] || 0) - pl.res[k]); tot += need[k]; }
      if (tot > 0) for (const k in ratio) ratio[k] = ratio[k] * 0.6 + 0.4 * need[k] / tot;
    }
    // Überschuss abbauen: alle 10 s einige Sammler umverteilen
    if (w.time - (this.lastRebalance || 0) > 10) {
      this.lastRebalance = w.time;
      const total = workers.length;
      let over = null, overV = 0, under = null, underV = 0;
      for (const k in ratio) {
        const diff = counts[k] - ratio[k] * total;
        const surplus = pl.res[k] > 500 ? diff + 2 : diff;
        if (surplus > overV) { overV = surplus; over = k; }
        if (-diff > underV) { underV = -diff; under = k; }
      }
      if (over && under && over !== under && overV >= 1.5 && underV >= 1.5) {
        const movers = workers.filter(u => u.order.t === 'gather' && (isProducer(u.order.rtype) ? BUILDINGS[u.order.rtype].yields : RESOURCE_TYPES[u.order.rtype].res) === over).slice(0, Math.min(3, Math.floor(underV)));
        for (const u of movers) { u.order = { t: 'idle' }; counts[over]--; idle.push(u); }
      }
    }
    if (!idle.length) return;
    for (const u of idle.slice(0, 12)) {
      const total = workers.length;
      const order = Object.keys(ratio).sort((a, b) => (ratio[b] * total - counts[b]) - (ratio[a] * total - counts[a]));
      let done = false;
      for (const best of order) {
        if (ratio[best] <= 0 && best !== 'wood') continue;
        let target = null;
        if (best === 'food') {
          target = w.findResourceNear('berry', this.bx, this.by, 18) || w.findResourceNear('farm', this.bx, this.by, 30, this.pid);
          if (!target) {
            const unbuilt = blds.find(b => b.type === 'farm' && !b.built);
            if (unbuilt) { this.cmd({ c: 'repair', ids: [u.id], target: unbuilt.id }); counts.food++; done = true; break; }
            const nFarms = blds.filter(b => b.type === 'farm').length;
            if (pl.res.wood >= 60 && this.build('farm', [u], 1, 3, 9 + nFarms * 0.6)) { counts.food++; done = true; break; }
            continue;
          }
        } else {
          const rt = best === 'wood' ? 'tree' : best;
          for (const r of [16, 30, 50, 80]) { target = w.findResourceNear(rt, u.x, u.y, r, this.pid); if (target) break; }
          if (!target) continue;
          // weit vom Lager? Lager bauen
          const drop = w.dropoffFor({ x: target.cx, y: target.cy, owner: this.pid });
          if ((!drop || Math.hypot(drop.cx - target.cx, drop.cy - target.cy) > 12) && w.time - this.lastStorage > 30 && pl.res.wood >= 100) {
            this.lastStorage = w.time;
            const spot = this.findSpot('storage', target.cx, target.cy, 2, 6);
            if (spot) { this.cmd({ c: 'build', ids: [u.id], type: 'storage', pos: [spot] }); counts[best]++; done = true; break; }
          }
        }
        this.cmd({ c: 'gather', ids: [u.id], target: target.id });
        counts[best]++; done = true; break;
      }
      if (!done) continue;
    }
  }

  build(type, workers, nWorkers = 1, dMin = 4, dMax = 14) {
    const pl = this.pl;
    const st = buildingStats(type, pl.era, pl.mods);
    if (!this.w.canAfford(pl, st.cost) || !workers.length) return false;
    const spot = this.findSpot(type, this.bx, this.by, dMin, dMax);
    if (!spot) return false;
    // nächstgelegene Arbeiter, die nicht bauen
    const ws = workers.filter(u => u.order.t !== 'build').sort((a, b) => Math.hypot(a.x - spot[0], a.y - spot[1]) - Math.hypot(b.x - spot[0], b.y - spot[1])).slice(0, nWorkers);
    if (!ws.length) return false;
    this.cmd({ c: 'build', ids: ws.map(u => u.id), type, pos: [spot] });
    return true;
  }
  findSpot(type, cx, cy, dMin, dMax) {
    const w = this.w, sz = BUILDINGS[type].size;
    for (let tries = 0; tries < 120; tries++) {
      const a = Math.random() * Math.PI * 2, d = dMin + Math.random() * (dMax - dMin) + tries * 0.15;
      const x = Math.round(cx + Math.cos(a) * d - sz / 2), y = Math.round(cy + Math.sin(a) * d - sz / 2);
      if (!w.canPlace(type, x, y)) continue;
      // Rand freihalten, damit Wege offen bleiben
      let ok = true;
      for (let yy = y - 1; yy <= y + sz && ok; yy++) for (let xx = x - 1; xx <= x + sz; xx++) {
        if (!w.inBounds(xx, yy)) { ok = false; break; }
        const i = w.idx(xx, yy);
        if (w.occ[i] && w.ents.get(w.occ[i]) && w.ents.get(w.occ[i]).kind === 'b') { ok = false; break; }
        if (!w.pass[i] && type !== 'storage') { ok = false; break; }
      }
      if (ok) return [x, y];
    }
    return null;
  }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
