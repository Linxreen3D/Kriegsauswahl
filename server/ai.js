// KI-Gegner: spielt über dieselbe Befehlsschnittstelle wie Menschen.
import { ERAS, WONDER, CULTURES, BUILDINGS, LINES, RESOURCE_TYPES, LATE_STAGE, isProducer, unitStats, buildingStats, trainable, eraCost, LEADER, leaderOptions } from '../shared/rules.js';

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

    this.handleProposals(pl);
    this.conference();
    this.invasionStep();
    if (pl.choice === 'culture') this.cmd({ c: 'choose', kind: 'culture', value: pick(Object.keys(CULTURES)) });
    else if (pl.choice === 'nation') this.cmd({ c: 'choose', kind: 'nation', value: pick(CULTURES[pl.culture].nations) });
    else if (pl.choice === 'leader') { const era = w.leaderEraDue(pl); const opts = leaderOptions(pl.nation, era, w.settings.ahLeader === false); const calm = opts.filter(l => l.b.repSet == null); this.cmd({ c: 'choose', kind: 'leader', value: pick(calm.length ? calm : opts).id }); }
    // Führer-Fähigkeit: Kampf-Effekte, wenn eigene Truppen kämpfen; Wirtschaft sonst jederzeit
    if (pl.leader && !(pl.leaderCd > w.time)) {
      const L = LEADER[pl.leader], a = L.a;
      const fighting = w.units.some(u => u.owner === this.pid && !u.dead && u.state === 2);
      const econ = (a.buffs || []).every(b => ['gather', 'build', 'train'].includes(b.k)) && (a.buffs || []).length;
      const ok = a.special ? ['freeInf', 'grant', 'refit', 'eraFast', 'rebuild', 'empire'].includes(a.special) : econ || fighting;
      if (ok && !(a.once && pl.leaderUsed && pl.leaderUsed[pl.leaderEra])) this.cmd({ c: 'leader' });
    }

    const units = w.units.filter(u => u.owner === this.pid && !u.dead);
    const blds = w.buildings.filter(b => b.owner === this.pid && !b.dead);
    const towns = blds.filter(b => b.type === 'town' && b.built);
    this.base = towns[0] || blds[0] || units[0];
    if (!this.base) return;
    this.bx = this.base.cx || this.base.x; this.by = this.base.cy || this.base.y;
    const workers = units.filter(u => u.cls === 'wrk' && !u.naval);
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
    // Werft, Flugplatz, Flugabwehr, Raketenabwehr und Atomwaffen
    const enemies = w.P.filter(q => q.alive && q.id !== this.pid && w.enemy(this.pid, q.id));
    if (pl.era >= (w.settings.mapType === 'islands' ? 2 : 4) && workers.length > (w.settings.mapType === 'islands' ? 14 : 28) && count('dock') === 0 && !building.some(b => b.type === 'dock') && (this.noDockUntil || 0) < w.time) {
      if (!this.build('dock', workers, 2, 4, 26)) {
        const cost = buildingStats('dock', pl.era, pl.mods).cost;
        if (w.settings.mapType === 'islands' && !w.canAfford(pl, cost)) this.saveFor(cost, 90); // auf Inseln unverzichtbar
        else this.noDockUntil = w.time + 300; // keine Küste in der Nähe
      }
    }
    if (pl.era >= 6 && workers.length > 20 && count('airfield') < (pl.era >= 7 ? 2 : 1) && !building.some(b => b.type === 'airfield')) {
      if (!this.build('airfield', workers, 2, 6, 20)) this.saveFor(buildingStats('airfield', pl.era, pl.mods).cost, 120);
    }
    const enemyAir = w.units.some(u => !u.dead && u.air && enemies.some(q => q.id === u.owner) && Math.hypot(u.x - this.bx, u.y - this.by) < 40);
    if (pl.era >= 6 && (enemyAir || pl.era >= 7) && count('flakpos') < (enemyAir ? 3 : 1) && pl.res.stone > 200) this.build('flakpos', workers, 1, 3, 10);
    if (pl.era >= 7) {
      const nuclearFoe = enemies.some(q => w.nuclearPower(q));
      if (nuclearFoe && count('abm') < 1 && pl.res.gold > 1200) this.build('abm', workers, 2, 2, 8);
      if (w.nuclearPower(pl) && this.prof.aggression >= 0.8 && (pl.nukesUsed || 0) < 3) {
        if (count('nukelab') === 0 && !building.some(b => b.type === 'nukelab') && pl.res.gold > 3500) this.build('nukelab', workers, 3, 6, 14);
        else if (blds.some(b => b.type === 'nukelab' && b.built) && count('silo') === 0 && pl.res.gold > 1500) this.build('silo', workers, 2, 6, 14);
        const silo = blds.find(b => b.type === 'silo' && b.built);
        if (silo && !pl.nukeReady && !silo.queue.length && !(pl.nukePauseUntil > w.time) && w.canAfford(pl, w.nukeCost(pl))) this.cmd({ c: 'nukeBuild', id: silo.id });
        // Einsatz gegen das Haupthaus des stärksten Gegners
        if (pl.nukeReady) {
          const foe = enemies.sort((x, y) => w.score(y) - w.score(x))[0];
          const ft = foe && w.buildings.find(b => !b.dead && b.owner === foe.id && (b.wonder || b.type === 'town') && w.visibleTo(this.pid, b));
          if (ft) this.cmd({ c: 'nuke', x: ft.cx, y: ft.cy });
        }
      }
    }
    // Eisenbahn: Heimatbahnhof, Bahnhof an fernem Gold/Stein, Gleis dazwischen (Güterzüge, Panzerzug)
    if (pl.era >= 5 && workers.length > 26 && !this.defensive) this.railPlan(pl, blds, workers);
    // Weltwunder in der letzten Epoche
    if (pl.era === ERAS.length - 1 && !pl.wonderBuilding && towns.length && !blds.some(b => b.wonder) && this.prof.aggression >= 0.8) {
      const wc = WONDER.cost; if (w.canAfford(pl, wc)) this.cmd({ c: 'wonder', id: towns[towns.length - 1].id });
    }
    if (pl.era >= 3 && towns.length < 2 && workers.length > 40 && pl.res.wood > 500 && pl.res.stone > 300) this.build('town', workers, 3, 14, 22);

    // Baustellen ohne Bauarbeiter besetzen
    for (const b of building) {
      if (BUILDINGS[b.type].line) continue; // Gleise/Straßen bauen die beauftragten Arbeiter der Reihe nach
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
      const opts = trainable(b.type, pl.era, pl.culture, pl.nation, pl.late);
      if (!opts.length) continue;
      // Kampfeinheiten bevorzugen; Spezialisten nur gezielt
      const skip = ['scout', 'fishboat', 'transport', 'para', 'worker', 'envoy', 'spy', 'med'];
      if (!enemyAir) skip.push('flak');
      if (army.filter(u => u.line === 'armtrain').length >= 2) skip.push('armtrain');
      const pool = opts.filter(x => !skip.includes(x.line));
      if (!pool.length) continue;
      const nat = pool.filter(x => x.unique);
      const o = nat.length && Math.random() < 0.4 ? nat[Math.floor(Math.random() * nat.length)] : pool[Math.floor(Math.random() * pool.length)];
      const st = unitStats(o.line, Math.max(pl.era, LINES[o.line].minEra), o.unique, pl.mods);
      const nextEra = ERAS[pl.era + 1];
      // für den Epochenaufstieg sparen, wenn knapp
      let ok = true;
      // für ein Schlüsselgebäude sparen
      if (this.saving && this.saving.until > w.time) for (const k in st.cost) if (pl.res[k] - st.cost[k] < (this.saving.cost[k] || 0)) ok = false;
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
        const ids = army.filter(u => (u.order.t === 'idle' || u.order.t === 'move') && !u.naval && !u.air && u.line !== 'fishboat' && u.st.atk > 0 && !u.st.railOnly).map(u => u.id);
        if (ids.length >= threshold * this.prof.aggression) {
          if (this.reachable(tgt)) this.cmd({ c: 'move', ids, x: tgt.x, y: tgt.y, amove: true });
          else this.invasion(tgt, ids, blds, pl);
        }
        // Flugzeuge greifen direkt an
        const air = army.filter(u => u.air && u.order.t === 'idle' && u.st.atk > 0 && u.ammo > 0).map(u => u.id);
        if (air.length >= 3) this.cmd({ c: 'move', ids: air, x: tgt.x, y: tgt.y, amove: true });
      }
    }
  }

  // Vertragsangebote bewerten: Rohstoffwert, Provinzen, Truppen; Pakte/Bündnisse je nach Stärke
  // Friedenskonferenz: annehmen, wenn unterlegen; am Tisch Frieden anbieten oder Reparationen verlangen
  conference() {
    const w = this.w, pl = w.P[this.pid];
    if (!pl || !pl.alive) return;
    const strength = p => w.score(p);
    const inv = w.confInvite;
    if (inv && inv.to === this.pid) w.diplomacy(this.pid, { op: 'confRespond', accept: strength(pl) < strength(w.P[inv.from]) * 1.15 });
    const c = w.conf;
    // Klar unterlegen gegen einen Menschen: selbst eine Konferenz beantragen (höchstens alle 20 min)
    if (!c && !w.confInvite && !this.defensive && w.time > 1200 && !(pl.confCd > w.time) && Math.random() < 0.05) {
      const foe = w.P.find(q => q.alive && !q.isBot && q.id !== this.pid && w.enemy(this.pid, q.id) && w.hasContact(this.pid, q.id) && strength(pl) < strength(q) * 0.5);
      if (foe) w.confRequest(pl, foe);
    }
    if (!c || c.phase !== 'open' || (c.a !== this.pid && c.b !== this.pid)) return;
    const foe = w.P[c.a === this.pid ? c.b : c.a], weaker = strength(pl) < strength(foe);
    // Beitritte zulassen, Vermittler der Gegenseite akzeptieren
    for (const j of c.joins || []) if (!j.ok.includes(this.pid)) w.diplomacy(this.pid, { op: 'confJoinOk', id: j.id });
    const fv = c.medVotes && c.medVotes[foe.id];
    if (fv != null && fv >= 0 && c.medVotes[this.pid] !== fv) w.diplomacy(this.pid, { op: 'confMediator', id: fv });
    if (!c.offer && (this.confAt == null || w.time - this.confAt > 15 || c.paused)) {
      this.confAt = w.time;
      if (this.confTried) return;
      this.confTried = c.id;
      const off = weaker ? { peace: 'peace', give: { res: { gold: Math.min(300, Math.floor(pl.res.gold / 3)) } }, get: {} }
        : { peace: 'peace', give: {}, get: { tribute: { res: 'gold', perMin: 60, min: 10 } } };
      w.diplomacy(this.pid, { op: 'confOffer', offer: off });
      return;
    }
    if (c.offer && !c.signed.includes(this.pid)) {
      const o = c.offer, mine = c.a === this.pid ? o.a : o.b, theirs = c.a === this.pid ? o.b : o.a;
      const val = s => Object.values(s.res).reduce((x, y) => x + y, 0) + s.prov.length * 600 + (s.tribute ? s.tribute.perMin * s.tribute.min : 0);
      const ok = weaker ? val(mine) <= Math.max(1500, val(theirs) + 1500) : val(theirs) >= val(mine) + 300 || (o.by === this.pid);
      const afford = Object.entries(mine.res).every(([k, v]) => (pl.res[k] || 0) >= v) && mine.prov.every(p => w.provOwner[p] === this.pid);
      if (ok && afford) w.diplomacy(this.pid, { op: 'confSign', ver: c.ver });
    }
  }
  handleProposals(pl) {
    const w = this.w;
    for (const p of w.proposals.filter(x => x.to === this.pid)) {
      const o = p.offer, from = w.P[p.from];
      const val = s => Object.values(s.res).reduce((a, b) => a + b, 0) + s.prov.length * 600 + (s.tribute ? s.tribute.perMin * s.tribute.min : 0)
        + s.units.reduce((a, id) => { const u = w.ents.get(id); return a + (u && u.st ? Object.values(u.st.cost).reduce((x, y) => x + y, 0) : 0); }, 0);
      let score = val(o.give) - val(o.get);
      const strength = q => q.military * (1 + q.era) + 1, ratio = strength(from) / strength(pl);
      if (o.pact) score += ratio > 0.8 ? 300 : -100;
      if (o.alliance) score += ratio > 0.6 && from.rep >= 35 ? 400 : -400;
      if (from.rep < 35) score -= 300;
      this.cmd2({ op: 'respond', id: p.id, accept: score >= 0 });
    }
  }
  cmd2(m) { this.w.diplomacy(this.pid, m); }
  // Ist das Ziel zu Fuß erreichbar? (Karte der Wegkosten vom eigenen Haupthaus, alle 2 min neu)
  reachable(t) {
    const w = this.w;
    if (!this.reach || w.time - this.reach.t > 120 || this.reach.bx !== Math.floor(this.bx)) {
      this.reach = { t: w.time, bx: Math.floor(this.bx), dist: w.dijkstra(w.pointSources(Math.floor(this.bx), Math.floor(this.by))) };
    }
    const d = this.reach.dist;
    // irgendeine Kachel rund ums Ziel erreichbar?
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = Math.floor(t.x) + dx, y = Math.floor(t.y) + dy;
      if (w.inBounds(x, y) && d[w.idx(x, y)] < 65535) return true;
    }
    return false;
  }
  // Landung mit Transportschiffen: Werft -> Transporter -> einsteigen -> übersetzen -> ausladen
  invasion(tgt, ids, blds, pl) {
    const w = this.w;
    const dock = blds.find(b => b.type === 'dock' && b.built);
    if (!dock) { this.saveFor(buildingStats('dock', pl.era, pl.mods).cost, 90); return; }
    const ships = w.units.filter(u => u.owner === this.pid && !u.dead && u.line === 'transport');
    if (ships.length < 2 && !dock.queue.some(q => q.line === 'transport')) {
      const st = unitStats('transport', Math.max(pl.era, LINES.transport.minEra), null, pl.mods);
      if (w.canAfford(pl, st.cost) && pl.pop + st.pop <= pl.popCap) this.cmd({ c: 'train', ids: [dock.id], line: 'transport', n: 1 });
    }
    const inv = this.inv;
    if (inv && w.time - inv.at > 240) this.inv = null; // abgebrochen
    if (this.inv) return;
    const ship = ships.find(s => !(s.cargo && s.cargo.length) && s.order.t === 'idle');
    if (!ship) return;
    let pop = 0; const take = [];
    for (const id of ids) { const u = w.ents.get(id); if (pop + u.st.pop > ship.st.capacity) break; pop += u.st.pop; take.push(id); }
    if (take.length < 3) return;
    this.cmd({ c: 'board', ids: take, ship: ship.id });
    this.inv = { ship: ship.id, ids: take, tgt, at: w.time };
  }
  // laufende Landung weiterführen: sobald alle an Bord (oder nach 60 s), zum Ziel fahren und ausladen
  invasionStep() {
    const w = this.w, inv = this.inv; if (!inv) return;
    const ship = w.ents.get(inv.ship);
    if (!ship || ship.dead) { this.inv = null; return; }
    if (inv.sailing) { if (!(ship.cargo && ship.cargo.length) && ship.order.t === 'idle') this.inv = null; return; }
    const aboard = (ship.cargo || []).length, alive = inv.ids.filter(id => { const u = w.ents.get(id); return u && !u.dead; }).length;
    if (aboard && (aboard >= alive || w.time - inv.at > 60)) {
      this.cmd({ c: 'unload', ids: [ship.id], x: inv.tgt.x, y: inv.tgt.y });
      inv.sailing = true;
    }
  }
  pickTarget() {
    const w = this.w;
    // aufgedeckte Atomanlagen haben Vorrang
    for (const r of w.reveals || []) {
      if (r.pid !== this.pid || !r.site || r.until < w.time) continue;
      const b = w.ents.get(r.site);
      if (b && !b.dead && w.enemy(this.pid, b.owner)) return { x: b.cx, y: b.cy };
    }
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
          target = w.findResourceNear('berry', this.bx, this.by, 18, this.pid) || w.findResourceNear('farm', this.bx, this.by, 30, this.pid);
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

  railPlan(pl, blds, workers) {
    const w = this.w, rp = this.rail || (this.rail = { phase: 0, next: 0 });
    if (w.time < rp.next) return;
    rp.next = w.time + 20;
    const stations = blds.filter(b => b.type === 'station');
    // Heimatbahnhof: höchstens 10 Felder vom Haupthaus (nur dort kommen Güterzüge an)
    const home = stations.find(b => Math.hypot(b.cx - this.bx, b.cy - this.by) <= 9.5);
    if (!home) {
      if (blds.some(b => b.type === 'station' && !b.built && Math.hypot(b.cx - this.bx, b.cy - this.by) <= 9.5)) return;
      const st = buildingStats('station', pl.era, pl.mods);
      if (!w.canAfford(pl, st.cost)) { this.saveFor(st.cost, 60); return; }
      let spot = null;
      for (let k = 0; k < 6 && !spot; k++) { const sp = this.findSpot('station', this.bx, this.by, 4, 7); if (sp && Math.hypot(sp[0] + 1 - this.bx, sp[1] + 1 - this.by) <= 9.5) spot = sp; }
      const ws = workers.filter(u => u.order.t !== 'build').slice(0, 2);
      if (spot && ws.length) this.cmd({ c: 'build', ids: ws.map(u => u.id), type: 'station', pos: [spot] });
      return;
    }
    if (!home.built) return;
    if (rp.linked && w.ents.get(rp.linked) && !w.ents.get(rp.linked).dead) { // eine Strecke genügt – Arbeiter zum fernen Bahnhof schicken
      const far = w.ents.get(rp.linked);
      const there = workers.filter(u => u.order.t === 'gather' && Math.hypot(u.x - far.cx, u.y - far.cy) < 10).length;
      if (there < 5) {
        let res = null, bd = 12;
        for (const r of w.resources.values()) { if (r.depleted || r.res === 'food') continue; const d = Math.hypot(r.cx - far.cx, r.cy - far.cy); if (d < bd) { bd = d; res = r; } }
        const free = workers.filter(u => u.order.t === 'gather' && Math.hypot(u.x - far.cx, u.y - far.cy) >= 10).slice(0, 5 - there);
        if (res && free.length) this.cmd({ c: 'gather', ids: free.map(u => u.id), target: res.id });
      }
      return;
    }
    const linked = stations.find(b => b !== home && b.built && w.railPath(home, b));
    if (linked) { rp.linked = linked.id; return; }
    let far = stations.find(b => b !== home && Math.hypot(b.cx - home.cx, b.cy - home.cy) >= 14 && Math.hypot(b.cx - home.cx, b.cy - home.cy) <= 45);
    if (!far && stations.some(b => b !== home && Math.hypot(b.cx - home.cx, b.cy - home.cy) < 14)) return; // zweiter Bahnhof noch zu nah oder im Bau
    if (!far) {
      // fernes Gold- oder Steinvorkommen, zu Fuß erreichbar
      let best = null, bd = Infinity;
      for (const r of w.resources.values()) {
        if (r.depleted || (r.res !== 'gold' && r.res !== 'stone')) continue;
        const d = Math.hypot(r.cx - this.bx, r.cy - this.by);
        if (d < 18 || d > 40 || !this.reachable({ x: r.cx, y: r.cy })) continue;
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) { rp.next = w.time + 300; return; }
      const spot = this.findSpot('station', best.cx, best.cy, 2, 6);
      const st = buildingStats('station', pl.era, pl.mods);
      if (!spot || !w.canAfford(pl, st.cost)) { if (spot) this.saveFor(st.cost, 60); return; }
      const ws = workers.filter(u => u.order.t !== 'build').slice(0, 2);
      if (ws.length) this.cmd({ c: 'build', ids: ws.map(u => u.id), type: 'station', pos: [spot] });
      return;
    }
    if (!far.built) return;
    if (blds.some(b => b.type === 'rail' && !b.built)) return; // Gleisbau läuft noch
    // Weg für das Gleis: Breitensuche über bebaubare Kacheln und vorhandene Gleise
    const W = w.W, prev = new Int32Array(W * w.H).fill(-2), q = [], goal = new Set(w.stationTiles(far));
    for (const i of w.stationTiles(home)) { prev[i] = -1; q.push(i); }
    let f = -1;
    for (let h = 0; h < q.length && f < 0 && h < 60000; h++) {
      const i = q[h], x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!w.inBounds(nx, ny)) continue;
        const j = ny * W + nx; if (prev[j] !== -2) continue;
        if (goal.has(j)) { prev[j] = i; f = j; break; }
        if (!w.railAt[j] && !w.canPlace('rail', nx, ny)) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (f < 0) { rp.next = w.time + 300; return; }
    const pos = [];
    for (let i = prev[f]; i >= 0 && prev[i] !== -1; i = prev[i]) if (!w.railAt[i]) pos.push([i % W, Math.floor(i / W)]);
    const cost = buildingStats('rail', pl.era, pl.mods).cost, n = pos.length;
    const total = Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * n]));
    if (!w.canAfford(pl, total)) { this.saveFor(total, 90); return; }
    const ws = workers.filter(u => u.order.t !== 'build').sort((a, b) => Math.hypot(a.x - home.cx, a.y - home.cy) - Math.hypot(b.x - home.cx, b.y - home.cy)).slice(0, 4);
    if (!ws.length) return;
    for (let k = 0; k < pos.length; k += 60) this.cmd({ c: 'build', ids: ws.map(u => u.id), type: 'rail', pos: pos.slice(k, k + 60), queue: k > 0 });
  }
  saveFor(cost, s) { if (!this.saving || this.saving.until < this.w.time) this.saving = { cost, until: this.w.time + s }; }
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
        if (!w.pass[i] && type !== 'storage' && !BUILDINGS[type].coastal) { ok = false; break; }
      }
      if (ok) return [x, y];
    }
    return null;
  }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
