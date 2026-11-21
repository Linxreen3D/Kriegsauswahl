// Atomwaffen (Kalter Krieg): stark, aber mit Gegenspiel – Aufklärung, Sabotage, Abwehr, Bunker, Zweitschlag.
import { NUKE, NUCLEAR_NATIONS, BUILDINGS, scaleCost } from '../shared/rules.js';

const isVehicle = u => (u.cls === 'cav' && u.era >= 6) || u.cls === 'art' || u.cls === 'sie';

export function installNukes(World) {
  const W = World.prototype;

  W.nuclearPower = function (pl) { return this.settings.nukes !== false && NUCLEAR_NATIONS.includes(pl.nation); };
  // Darf dieser Spieler das Gebäude bauen? (Text = Grund, wenn nicht)
  W.buildBlocked = function (pl, type) {
    const bd = BUILDINGS[type];
    if (bd.nuclear && !this.nuclearPower(pl)) return this.settings.nukes === false ? 'Atomwaffen sind in dieser Partie abgeschaltet.' : 'Nur Atommächte (USA, Russland, Großbritannien, Frankreich, China) können das bauen.';
    if (bd.needs && !this.buildings.some(b => !b.dead && b.built && b.owner === pl.id && b.type === bd.needs)) return `Zuerst ${BUILDINGS[bd.needs].name} fertigstellen.`;
    return null;
  };
  W.nukeCost = function (pl) { return scaleCost(NUKE.cost, pl.mods.nukeCost || 1); };

  // Raketenbau im Silo starten
  W.nukeBuildCommand = function (pl, silo) {
    if (!silo || silo.dead || !silo.built || silo.type !== 'silo' || silo.owner !== pl.id) return;
    if (!this.nuclearPower(pl)) return;
    if (pl.armsLimitUntil > this.time) { this.notice(pl.id, 'Rüstungsbeschränkung: vorerst keine Atomraketen.'); return; }
    if ((pl.nukesUsed || 0) >= NUKE.maxPerGame) { this.notice(pl.id, `Höchstens ${NUKE.maxPerGame} Atomraketen pro Partie.`); return; }
    if (pl.nukeReady || this.buildings.some(b => !b.dead && b.owner === pl.id && b.queue.some(q => q.nuke))) { this.notice(pl.id, 'Es kann nur eine Atomrakete gleichzeitig geben.'); return; }
    if ((pl.nukePauseUntil || 0) > this.time) { this.notice(pl.id, `Nächste Rakete möglich in ${Math.ceil((pl.nukePauseUntil - this.time) / 60)} min.`); return; }
    const cost = this.nukeCost(pl);
    if (!this.canAfford(pl, cost)) { this.notice(pl.id, 'Nicht genug Rohstoffe für eine Atomrakete.'); return; }
    this.pay(pl, cost);
    silo.queue.push({ nuke: true, cost, time: NUKE.time * (pl.mods.nukeTime || 1) });
    this.event({ k: 'notice', to: -1, text: '☢ Eine Atommacht rüstet auf.' });
  };
  // Fortschritt im Silo (aus updateBuilding); stoppt, solange das Silo beschädigt ist
  W.nukeQueueStep = function (b, q, dt, pl) {
    if (b.hp < b.maxHp * 0.98) { b.blocked = true; return; }
    b.blocked = false;
    b.qProg += dt;
    if (b.qProg >= q.time) {
      b.queue.shift(); b.qProg = 0;
      pl.nukeReady = true;
      this.notice(pl.id, '☢ Die Atomrakete ist einsatzbereit. Silo wählen und Ziel angeben.');
    }
  };

  // Start: jede eigene Stellung kann eine fertige Rakete abfeuern (Zweitschlag auch ohne Silo)
  W.nukeLaunchCommand = function (pl, x, y) {
    if (!pl.nukeReady) { this.notice(pl.id, 'Keine einsatzbereite Atomrakete.'); return; }
    if (!this.inBounds(x | 0, y | 0)) return;
    pl.nukeReady = false; pl.nukesUsed = (pl.nukesUsed || 0) + 1; pl.nukePauseUntil = this.time + NUKE.pause;
    const n = { id: this.nextId++, by: pl.id, x, y, at: this.time + NUKE.flight };
    (this.nukes || (this.nukes = [])).push(n);
    const warn = !pl.nukeNoWarning; pl.nukeNoWarning = false;
    // nur die Getroffenen sehen das Ziel 10 s vorher
    const hit = new Set();
    this.nearbyUnits(x, y, NUKE.radius, u => { if (!u.dead && u.owner !== pl.id) hit.add(u.owner); });
    this.nearbyBuildings(x, y, NUKE.radius + 2, b => { if (!b.dead && b.owner !== pl.id) hit.add(b.owner); });
    if (warn) for (const pid of hit) this.event({ k: 'nukeWarn', to: pid, x, y, t: NUKE.flight });
    this.event({ k: 'notice', to: -1, text: `☢ ${pl.name} hat eine Atomrakete gestartet!` });
    this.chronicle(`☢ ${pl.name} startet eine Atomrakete.`, 'war');
    for (const pid of hit) this.checkBreach && this.checkBreach(pl.id, pid);
  };

  // Aufklärer, Botschafter und Spione in der Nähe decken Atomanlagen auf (5 min Sicht, Meldung)
  W.scanNuclearSites = function () {
    const sites = this.buildings.filter(b => !b.dead && (b.type === 'nukelab' || b.type === 'silo'));
    if (!sites.length) return;
    for (const u of this.units) {
      if (u.dead || u.aboard || !(u.line === 'scout' || u.cls === 'env' || u.cls === 'spy')) continue;
      for (const b of sites) {
        if (b.owner === u.owner || this.allied(b.owner, u.owner) || Math.hypot(b.cx - u.x, b.cy - u.y) > 12) continue;
        const key = 'n' + b.id + ':' + u.owner;
        (this.nukeSpotted || (this.nukeSpotted = {}));
        if ((this.nukeSpotted[key] || 0) > this.time) continue;
        this.nukeSpotted[key] = this.time + 300;
        this.reveals.push({ pid: u.owner, x: b.cx, y: b.cy, until: this.time + 300, site: b.id });
        this.notice(u.owner, `☢ Entdeckt: ${BUILDINGS[b.type].name} von ${this.P[b.owner].name}! Standort ist 5 Minuten sichtbar.`);
        this.event({ k: 'ping', to: u.owner, x: b.cx, y: b.cy });
        // Der Betreiber erfährt, dass er aufgeflogen ist
        this.notice(b.owner, `Fremde Aufklärung hat dein${b.type === 'silo' ? ' Raketensilo' : ' Atomforschungszentrum'} entdeckt.`);
      }
    }
  };
  W.updateNukes = function () {
    if (this.tickNo % 10 === 5) this.scanNuclearSites();
    if (!this.nukes || !this.nukes.length) { this.updateRadiation(); return; }
    for (const n of this.nukes) {
      if (n.done || n.at > this.time) continue;
      n.done = true;
      // Abfangen durch feindliche Raketenabwehr in Reichweite
      const abms = this.buildings.filter(b => !b.dead && b.built && b.type === 'abm' && b.owner !== n.by && !this.allied(b.owner, n.by)
        && (b.reloadAt || 0) <= this.time && Math.hypot(b.cx - n.x, b.cy - n.y) <= NUKE.abmRange);
      if (abms.length) {
        const owner = this.P[abms[0].owner];
        const bonus = (owner.mods.abm || 0) + abms.reduce((m, b) => Math.max(m, this.buffMulAdd(this.P[b.owner], 'abm')), 0);
        const cap = Math.min(0.75, NUKE.abmCap + bonus);
        const chance = Math.min(cap, NUKE.abmBase + NUKE.abmStep * (abms.length - 1) + bonus);
        for (const b of abms) b.reloadAt = this.time + NUKE.abmReload * (this.nuclearPower(this.P[b.owner]) ? 1 : 0.5);
        if (Math.random() < chance) {
          this.event({ k: 'nukeIntercept', x: n.x, y: n.y });
          for (const b of abms) this.achieve(b.owner, 'INTERCEPT');
          this.event({ k: 'notice', to: -1, text: `🛡 Raketenabwehr von ${owner.name} hat die Atomrakete abgefangen (Chance ${Math.round(chance * 100)} %).` });
          this.chronicle(`🛡 ${owner.name} fängt eine Atomrakete von ${this.P[n.by].name} ab.`, 'war');
          continue;
        }
      }
      this.nukeImpact(n);
    }
    this.nukes = this.nukes.filter(n => !n.done);
    this.updateRadiation();
  };
  W.buffMulAdd = function (pl, k) { let s = 0; for (const b of pl.buffs || []) if (b.k === k && b.until > this.time) s += b.v; return s; };

  W.nukeImpact = function (n) {
    const R = NUKE.radius, inner = NUKE.inner;
    // Bunker schützen bis zu 12 eigene Einheiten im Umkreis von 2 Feldern
    const safe = new Set();
    this.nearbyBuildings(n.x, n.y, R + 2, b => {
      if (b.dead || !b.built || b.type !== 'bunker') return;
      let k = 0;
      this.nearbyUnits(b.cx, b.cy, 2.2, u => { if (!u.dead && u.owner === b.owner && k < NUKE.bunkerCap && Math.hypot(u.x - b.cx, u.y - b.cy) <= 2.2) { safe.add(u.id); k++; } });
    });
    const list = [];
    this.nearbyUnits(n.x, n.y, R, u => { if (!u.dead && !u.aboard && Math.hypot(u.x - n.x, u.y - n.y) <= R && !safe.has(u.id)) list.push(u); });
    for (const u of list) {
      const d = Math.hypot(u.x - n.x, u.y - n.y), core = d <= inner;
      const hard = isVehicle(u) || u.naval || u.cls === 'trn';
      let dmg = hard ? u.maxHp * 0.8 : u.maxHp * 1.01;
      if (!core) dmg *= 0.5;
      if (u.air) dmg = u.maxHp * (core ? 1.01 : 0.5);
      this.damage(u, dmg, n.by);
    }
    const blds = [];
    this.nearbyBuildings(n.x, n.y, R + 2, b => { if (!b.dead && Math.hypot(b.cx - n.x, b.cy - n.y) <= R + b.size / 2) blds.push(b); });
    for (const b of blds) {
      if (b.st.decor) continue;
      const d = Math.hypot(b.cx - n.x, b.cy - n.y) - b.size / 2, core = d <= inner;
      let f = b.type === 'town' || b.wonder ? 0.4 : 0.75;
      if (!core && !(b.type === 'town' || b.wonder)) f *= 0.5;
      if (b.type === 'bunker') f = 0.15;
      if (b.wonder) { b.wonderAt = Math.min(this.time, b.wonderAt + NUKE.wonderSetback); this.event({ k: 'notice', to: -1, text: `☢ Das Weltwunder von ${this.P[b.owner].name} wurde getroffen – die Haltezeit springt 10 Minuten zurück.` }); }
      if (b.type === 'silo' && b.queue.length) b.qProg = 0;
      this.damage(b, b.maxHp * f, n.by);
    }
    (this.radiation || (this.radiation = [])).push({ x: n.x, y: n.y, r: R * 0.8, until: this.time + NUKE.radiation });
    this.event({ k: 'nukeImpact', x: n.x, y: n.y, r: R });
    this.chronicle(`☢ Atomschlag von ${this.P[n.by].name}.`, 'war');
  };
  // Verstrahlung: Einheiten verlieren langsam Leben, Arbeiter können dort nicht sammeln (siehe inRadiation)
  W.updateRadiation = function () {
    if (!this.radiation || !this.radiation.length) return;
    this.radiation = this.radiation.filter(z => z.until > this.time);
    if (this.tickNo % 10) return;
    for (const z of this.radiation) this.nearbyUnits(z.x, z.y, z.r, u => { if (!u.dead && !u.aboard && !u.air && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) this.damage(u, u.maxHp * 0.01, -1); });
  };
  W.inRadiation = function (x, y) { for (const z of this.radiation || []) if (Math.hypot(x - z.x, y - z.y) <= z.r) return true; return false; };
}
