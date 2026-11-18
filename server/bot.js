import { defenseMult, capacity, buildCost, ABILITIES } from '../shared/rules.js';

const PROFILES = {
  easy: { interval: 2.4, margin: 1.6, aggression: 0.35, build: 0.25, abilities: false },
  normal: { interval: 1.3, margin: 1.3, aggression: 0.6, build: 0.5, abilities: true },
  hard: { interval: 0.6, margin: 1.12, aggression: 0.85, build: 0.8, abilities: true },
};

export class Bot {
  constructor(room, player) {
    this.room = room;
    this.p = player;
    this.next = 0;
    this.prof = PROFILES[player.difficulty] || PROFILES.normal;
  }
  get map() { return this.room.map; }

  chooseStart() {
    const regions = this.map.regions;
    let best = -1, bestScore = -Infinity;
    const taken = [...this.room.picks.values()];
    const blocked = this.room.blockedStarts();
    for (let i = 0; i < regions.length; i++) {
      if (!this.room.canPick(i, blocked)) continue;
      const r = regions[i];
      if (r.adj.length < 2) continue;
      let minD = 800;
      for (const t of taken) minD = Math.min(minD, Math.hypot(r.cx - regions[t].cx, r.cy - regions[t].cy));
      const score = minD * 0.6 + r.value * 30 + r.adj.length * 10 + Math.random() * 150;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  onAllianceRequest(from) {
    // Bots nehmen Bündnisse an, wenn der Anfragende nicht viel stärker ist
    setTimeout(() => {
      if (this.room.phase !== 'play' || !this.p.alive) return;
      const pl = this.room.playersPublic();
      const me = pl[this.p.id], them = pl[from.id];
      const alive = pl.filter(x => x.alive).length;
      const ok = them && me && them.regions < me.regions * 1.8 && alive > 2 && this.p.allies.size < 2 && Math.random() < 0.7;
      this.room.diplomacy(this.p, from.id, ok ? 'accept' : 'decline');
    }, 1500 + Math.random() * 2500);
  }

  update(now) {
    if (now < this.next) return;
    this.next = now + this.prof.interval * (0.7 + Math.random() * 0.6);
    const room = this.room, me = this.p;
    const R = room.regions;
    const own = R.filter(r => r.owner === me.id);
    if (!own.length) return;
    const incoming = new Map(); // Ziel -> Truppen eigener Armeen unterwegs
    const threats = new Map(); // eigene Region -> feindliche Truppen unterwegs
    for (const a of room.armies.values()) {
      if (a.owner === me.id) incoming.set(a.to, (incoming.get(a.to) || 0) + a.count);
      else if (R[a.to].owner === me.id) threats.set(a.to, (threats.get(a.to) || 0) + a.count);
    }

    const isFriend = o => o === me.id || me.allies.has(o);
    const frontier = [], interior = [];
    for (const r of own) {
      const adj = this.map.regions[r.id].adj;
      if (adj.some(([o]) => !isFriend(R[o].owner))) frontier.push(r); else interior.push(r);
    }

    // 1) Angriffe
    const targets = [];
    for (const r of frontier) {
      for (const [o] of this.map.regions[r.id].adj) {
        const t = R[o];
        if (isFriend(t.owner)) continue;
        if (t.owner >= 0 && room.inPeace()) continue;
        const need = t.troops * defenseMult(t) * this.prof.margin + 2 - (incoming.get(o) || 0);
        const score = (t.value * 10 + (t.capital ? 25 : 0) + (t.owner === -1 ? 4 : 0)) / Math.max(4, need);
        targets.push({ from: r, to: t, need, score });
      }
    }
    targets.sort((a, b) => b.score - a.score);
    const used = new Set();
    let attacks = 0;
    const maxAttacks = 1 + Math.floor(this.prof.aggression * 4);
    for (const t of targets) {
      if (attacks >= maxAttacks) break;
      if (used.has(t.from.id) || (incoming.get(t.to.id) || 0) > t.to.troops * 2) continue;
      const reserve = Math.max(2, (threats.get(t.from.id) || 0) * 1.1);
      const available = t.from.troops - reserve;
      if (t.need <= 0) continue;
      if (available >= t.need) {
        const pct = Math.min(1, (t.need + 3) / t.from.troops);
        room.sendTroops(me, t.from.id, t.to.id, pct);
        used.add(t.from.id); attacks++;
        incoming.set(t.to.id, (incoming.get(t.to.id) || 0) + t.need);
      } else {
        // Sammelangriff aus mehreren Nachbarn
        const helpers = this.map.regions[t.to.id].adj.map(([o]) => R[o]).filter(x => x.owner === me.id && !used.has(x.id));
        const sum = helpers.reduce((s, h) => s + Math.max(0, h.troops - 2), 0);
        if (sum >= t.need && Math.random() < this.prof.aggression) {
          for (const h of helpers) { room.sendTroops(me, h.id, t.to.id, 0.9); used.add(h.id); }
          attacks++;
        }
      }
    }

    // 2) Nachschub: Hinterland -> Front
    for (const r of interior) {
      if (used.has(r.id) || r.troops < 12) continue;
      if (r.troops < capacity(r) * 0.5 && Math.random() < 0.6) continue;
      const step = this.stepToward(r.id, x => !isFriend(R[x].owner) || threats.has(x));
      if (step != null) { room.sendTroops(me, r.id, step, 0.85); used.add(r.id); }
    }
    // Front unter Druck verstärken
    for (const [rid, n] of threats) {
      const r = R[rid];
      if (r.troops * defenseMult(r) >= n) continue;
      for (const [o] of this.map.regions[rid].adj) {
        const h = R[o];
        if (h.owner === me.id && !used.has(o) && h.troops > 10 && !threats.has(o)) { room.sendTroops(me, o, rid, 0.6); used.add(o); }
      }
    }

    // 3) Bauen
    if (Math.random() < this.prof.build) this.doBuild(own, frontier, threats);

    // 4) Fähigkeiten
    if (this.prof.abilities) this.doAbilities(frontier, now);
  }

  stepToward(start, isGoal) {
    const prev = new Map([[start, -1]]);
    const q = [start];
    while (q.length) {
      const v = q.shift();
      if (v !== start && isGoal(v)) {
        let x = v, p = prev.get(x);
        while (p !== start) { x = p; p = prev.get(x); }
        return this.room.regions[x].owner === this.p.id || this.p.allies.has(this.room.regions[x].owner) ? x : null;
      }
      const r = this.room.regions[v];
      if (v !== start && r.owner !== this.p.id) continue;
      for (const [o] of this.map.regions[v].adj) if (!prev.has(o)) { prev.set(o, v); q.push(o); }
    }
    return null;
  }

  doBuild(own, frontier, threats) {
    const me = this.p;
    // Wirtschaft im Hinterland, Festungen an bedrohter Front, Kasernen in großen Regionen
    const opts = [];
    for (const r of own) {
      const front = frontier.includes(r);
      if (r.b[0] < 3) opts.push({ r, kind: 'factory', idx: 0, score: r.value * (front ? 0.6 : 1.2) });
      if (r.b[1] < 3) opts.push({ r, kind: 'barracks', idx: 1, score: r.value * (front ? 1.1 : 0.7) });
      if (r.b[2] < 3 && front) opts.push({ r, kind: 'fort', idx: 2, score: (threats.has(r.id) ? 3 : 0.5) + (r.capital ? 2 : 0) });
    }
    for (const o of opts) o.score /= buildCost(o.kind, o.r.b[o.idx]) / 100;
    opts.sort((a, b) => b.score - a.score);
    const o = opts[0];
    if (o && me.gold >= buildCost(o.kind, o.r.b[o.idx]) + 40) this.room.build(me, o.r.id, o.kind);
  }

  doAbilities(frontier, now) {
    const me = this.p, room = this.room;
    const ready = k => (me.cooldowns[k] || 0) <= now && me.gold >= ABILITIES[k].cost + 30;
    if (ready('mobilize') && frontier.length >= 4 && Math.random() < 0.3) return room.useAbility(me, 'mobilize', 0);
    if (ready('airstrike') && Math.random() < 0.4) {
      // stärkste feindliche Nachbarregion eines Spielers
      let best = null;
      for (const f of frontier) for (const [o] of this.map.regions[f.id].adj) {
        const t = room.regions[o];
        if (!room.inPeace() && t.owner >= 0 && t.owner !== me.id && !me.allies.has(t.owner) && (!best || t.troops > best.troops)) best = t;
      }
      if (best && best.troops > 40) return room.useAbility(me, 'airstrike', best.id);
    }
  }
}
