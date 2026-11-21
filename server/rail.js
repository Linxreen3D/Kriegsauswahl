// Eisenbahn: Gleisnetz, Truppenzüge, Güterzüge, Sabotage und Eroberung von Bahnhöfen.
import { BUILDINGS, RAIL, RES } from '../shared/rules.js';

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function installRail(World) {
  const W = World.prototype;

  W.initRail = function () {
    this.railAt = new Uint8Array(this.W * this.H);
    for (const b of this.buildings) if (!b.dead && b.built) this.railMark(b, 1);
    this.railVer = (this.railVer || 0) + 1;
  };
  // Gleise, Bahnhöfe und eiserne Brücken (ab 1. IR) bilden das Netz
  W.railCarries = function (b) { return b.type === 'rail' || b.type === 'station' || (b.type === 'bridge' && b.era >= 5); };
  W.railMark = function (b, v) {
    if (!this.railCarries(b)) return;
    for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) this.railAt[this.idx(xx, yy)] = v;
    this.railVer++;
  };
  W.stationTiles = function (b) { const out = []; for (let yy = b.y; yy < b.y + b.size; yy++) for (let xx = b.x; xx < b.x + b.size; xx++) out.push(this.idx(xx, yy)); return out; };

  // Weg über das Gleisnetz von Bahnhof A zu Bahnhof B (Liste von Kachel-Indizes) oder null
  W.railPath = function (a, b) {
    const W2 = this.W, goal = new Set(this.stationTiles(b)), prev = new Int32Array(this.W * this.H).fill(-2);
    const q = [];
    for (const i of this.stationTiles(a)) { prev[i] = -1; q.push(i); }
    let found = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (goal.has(i)) { found = i; break; }
      const x = i % W2, y = (i - x) / W2;
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const j = ny * W2 + nx;
        if (prev[j] !== -2 || !this.railAt[j]) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (found < 0) return null;
    const path = []; for (let i = found; i >= 0; i = prev[i]) path.push(i);
    return path.reverse();
  };
  // alle Bahnhöfe, die vom Bahnhof s aus erreichbar sind (eigene oder verbündete)
  W.reachableStations = function (s, pid) {
    return this.buildings.filter(b => !b.dead && b.built && b.type === 'station' && b !== s && this.allied(b.owner, pid) && this.railPath(s, b));
  };
  W.isHomeStation = function (s) {
    return this.buildings.some(b => !b.dead && b.built && b.type === 'town' && b.owner === s.owner && Math.hypot(b.cx - s.cx, b.cy - s.cy) <= RAIL.homeRange);
  };

  // ---------- Befehl: Truppen per Bahn zu Bahnhof „to“ ----------
  W.railCommand = function (pid, units, to) {
    if (!to || to.dead || to.type !== 'station' || !to.built || !this.allied(to.owner, pid)) return;
    const sources = this.buildings.filter(b => !b.dead && b.built && b.type === 'station' && b !== to && this.allied(b.owner, pid) && this.railPath(b, to));
    for (const u of units) {
      if (u.cls === 'trn') continue;
      let best = null, bd = Infinity;
      for (const s of sources) { const d = Math.hypot(s.cx - u.x, s.cy - u.y); if (d < bd) { bd = d; best = s; } }
      // zu Fuß, wenn kein Bahnhof erreichbar oder das Ziel näher ist als der Einstiegsbahnhof
      if (!best || Math.hypot(to.cx - u.x, to.cy - u.y) < bd * 1.5) { this.groupMove([u], to.cx, to.cy + to.size, false); continue; }
      u.order = { t: 'board', station: best.id, to: to.id }; u.buildQ = [];
    }
    if (!sources.length) this.notice(pid, 'Kein angeschlossener Bahnhof – die Truppen marschieren.');
  };
  W.doBoard = function (u, dt) {
    const o = u.order, s = this.ents.get(o.station), to = this.ents.get(o.to);
    if (!s || s.dead || !to || to.dead) { u.order = { t: 'idle' }; return; }
    const r = this.approach(u, s, 0.8, dt);
    if (r === true) return;
    if (r === 'fail') { u.order = { t: 'idle' }; return; }
    // einsteigen: Einheit verschwindet von der Karte und wartet im Bahnhof
    u.aboard = s.id; u.order = { t: 'wait', to: to.id };
    (s.waiting || (s.waiting = [])).push({ id: u.id, to: to.id, since: this.time });
  };

  // ---------- jede Spielsekunde ----------
  W.updateRail = function (dt) {
    for (const s of this.buildings) {
      if (s.dead || s.type !== 'station' || !s.built) continue;
      // Truppenzüge abfahren lassen
      if (s.waiting && s.waiting.length) {
        s.waiting = s.waiting.filter(w => { const u = this.ents.get(w.id); return u && !u.dead && u.aboard === s.id; });
        const byDest = new Map();
        for (const w of s.waiting) { if (!byDest.has(w.to)) byDest.set(w.to, []); byDest.get(w.to).push(w); }
        for (const [dest, list] of byDest) {
          const to = this.ents.get(dest);
          if (!to || to.dead) { for (const w of list) this.unboard(this.ents.get(w.id), s); s.waiting = s.waiting.filter(w => !list.includes(w)); continue; }
          const pop = list.reduce((a, w) => a + this.ents.get(w.id).st.pop, 0);
          if (pop < RAIL.capacity && this.time - list[0].since < RAIL.waitDepart) continue;
          const path = this.railPath(s, to);
          if (!path) { for (const w of list) this.unboard(this.ents.get(w.id), s); s.waiting = s.waiting.filter(w => !list.includes(w)); this.notice(s.owner, 'Strecke unterbrochen – die Truppen steigen wieder aus.'); continue; }
          const pass = []; let p = 0;
          for (const w of list) { const u = this.ents.get(w.id); if (p + u.st.pop > RAIL.capacity && pass.length) break; pass.push(u.id); p += u.st.pop; }
          s.waiting = s.waiting.filter(w => !pass.includes(w.id));
          this.spawnTrain(s, to, path, { pass });
        }
      }
      // Güterzüge: Vorrat ferner Bahnhöfe nach Hause bringen
      if (s.stock && !this.isHomeStation(s) && this.time - (s.lastFreight || 0) >= RAIL.freightEvery) {
        const tot = RES.reduce((a, k) => a + (s.stock[k] || 0), 0);
        if (tot >= RAIL.freightMin) {
          const home = this.buildings.find(b => !b.dead && b.built && b.type === 'station' && b.owner === s.owner && this.isHomeStation(b) && this.railPath(s, b));
          s.lastFreight = this.time;
          if (home) { this.spawnTrain(s, home, this.railPath(s, home), { res: s.stock }); s.stock = {}; }
          else if (!s.warnedNoHome) { s.warnedNoHome = true; this.notice(s.owner, 'Ein Bahnhof sammelt Rohstoffe, ist aber mit keinem Bahnhof nahe deinem Haupthaus verbunden.'); }
        }
      }
    }
  };
  W.spawnTrain = function (from, to, path, cargo) {
    const p = this.idx(Math.floor(from.cx), Math.floor(from.cy));
    const tr = this.addUnit(from.owner, 'train', null, (p % this.W) + 0.5, Math.floor(p / this.W) + 0.5);
    tr.order = { t: 'ride', path, i: 0, to: to.id, pass: cargo.pass || [], res: cargo.res || null };
    for (const id of tr.order.pass) { const u = this.ents.get(id); if (u) u.aboard = 'T' + tr.id; }
    this.cells[this.cellOf(tr.x, tr.y)].push(tr);
    return tr;
  };
  // Schienenfahrzeuge (Panzerzug, Eisenbahngeschütz): Weg über eigene oder verbündete Gleise zum Punkt nahe dem Ziel
  W.railMoveCommand = function (u, x, y, amove) {
    const start = this.idx(Math.floor(u.x), Math.floor(u.y));
    if (!this.railAt[start]) { this.notice(u.owner, `${u.st.name} steht nicht auf Gleisen.`); return; }
    const W2 = this.W, prev = new Int32Array(this.W * this.H).fill(-2), q = [start];
    prev[start] = -1;
    let best = start, bd = Math.hypot(x - u.x, y - u.y);
    for (let h = 0; h < q.length && h < 40000; h++) {
      const i = q[h], cx = i % W2, cy = (i - cx) / W2;
      const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y); if (d < bd) { bd = d; best = i; }
      for (const [dx, dy] of N8) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const j = ny * W2 + nx;
        if (prev[j] !== -2 || !this.railAt[j] || !this.railUsable(j, u.owner)) continue;
        prev[j] = i; q.push(j);
      }
    }
    const path = []; for (let i = best; i >= 0; i = prev[i]) path.push(i);
    path.reverse();
    u.order = path.length > 1 ? { t: 'railMove', path, i: 1, amove: !!amove } : { t: 'idle' };
  };
  // Gleis gehört dem Spieler oder einem Verbündeten
  W.railUsable = function (i, pid) { const b = this.ents.get(this.occ[i]); return !b || this.allied(b.owner, pid); };
  W.doRailMove = function (u, dt) {
    const o = u.order;
    if (o.amove) {
      u.scan -= dt;
      if (u.scan <= 0) { u.scan = 0.4; const t = this.findTarget(u.owner, u.x, u.y, this.rangeOf(u) + 0.5, true, u.st.atkCls || u.cls); if (t) { u.order = { t: 'attack', target: t.id, resume: o }; return; } }
    }
    let step = this.speedOf(u) * dt;
    while (step > 0 && o.i < o.path.length) {
      const i = o.path[o.i], tx = (i % this.W) + 0.5, ty = Math.floor(i / this.W) + 0.5;
      if (!this.railAt[i]) { u.order = { t: 'idle' }; this.notice(u.owner, `${u.st.name}: Gleis unterbrochen.`); return; }
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
      if (d <= step) { u.x = tx; u.y = ty; step -= d; o.i++; }
      else { u.x += dx / d * step; u.y += dy / d * step; step = 0; }
      u.dir = Math.atan2(dy, dx); u.state = 1;
    }
    if (o.i >= o.path.length) u.order = { t: 'idle' };
  };
  W.doRide = function (u, dt) {
    const o = u.order;
    let step = u.st.speed * (this.P[u.owner].mods.railSpeed || 1) * dt;
    while (step > 0 && o.i < o.path.length) {
      const i = o.path[o.i], tx = (i % this.W) + 0.5, ty = Math.floor(i / this.W) + 0.5;
      if (!this.railAt[i]) { this.trainHalt(u, 'Gleis unterbrochen – der Zug hält, die Truppen steigen aus.'); return; }
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
      if (d <= step) { u.x = tx; u.y = ty; step -= d; o.i++; } else { u.x += dx / d * step; u.y += dy / d * step; u.dir = Math.atan2(dy, dx); step = 0; }
    }
    u.state = 1;
    if (o.i >= o.path.length) this.trainArrive(u);
  };
  W.trainArrive = function (tr) {
    const o = tr.order, to = this.ents.get(o.to);
    const at = to && !to.dead ? to : null;
    for (const id of o.pass) this.unboard(this.ents.get(id), at, tr);
    if (o.res && at) {
      const pl = this.P[at.owner]; const got = [];
      for (const k in o.res) { const v = Math.round(o.res[k] * RAIL.freightBonus); pl.res[k] += v; pl.stats.gathered += v; if (v) got.push(v + ' ' + ({ food: 'Nahrung', wood: 'Holz', stone: 'Stein', gold: 'Gold' })[k]); }
      if (got.length) { this.notice(at.owner, `🚂 Güterzug angekommen: ${got.join(', ')} (+10 %).`); this.achieve(at.owner, 'FREIGHT'); }
    }
    this.removeTrain(tr);
  };
  W.trainHalt = function (tr, why) {
    for (const id of tr.order.pass) this.unboard(this.ents.get(id), null, tr);
    this.notice(tr.owner, why);
    this.removeTrain(tr);
  };
  W.removeTrain = function (tr) { tr.dead = true; tr.hp = 0; this.ents.delete(tr.id); };
  // Zug zerstört: Insassen steigen verletzt aus, Fracht geht verloren
  W.trainDestroyed = function (tr) {
    for (const id of tr.order.pass || []) { const u = this.ents.get(id); if (u) { this.unboard(u, null, tr); u.hp = Math.max(1, u.hp * 0.5); } }
    tr.order.pass = [];
    this.notice(tr.owner, '💥 Ein Zug wurde zerstört!');
  };
  W.unboard = function (u, station, tr) {
    if (!u || u.dead) return;
    const at = station ? this.spawnPoint(station) : this.nearestFree(tr ? tr.x : u.x, tr ? tr.y : u.y, 8);
    if (at) { u.x = at[0]; u.y = at[1]; }
    u.aboard = null; u.order = { t: 'idle' };
    this.cells[this.cellOf(u.x, u.y)].push(u);
  };

  // Abgabe am Bahnhof: nahe dem Haupthaus direkt, sonst in den Vorrat für den Güterzug
  W.deliverAt = function (drop, pl, res, amt) {
    if (drop.type === 'station' && !this.isHomeStation(drop)) { (drop.stock || (drop.stock = {}))[res] = (drop.stock[res] || 0) + amt; return; }
    pl.res[res] += amt; pl.stats.gathered += amt;
  };
}
