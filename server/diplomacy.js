// Diplomatie, Spionage, Ereignisse und Chronik – als Erweiterung der World-Klasse.
import {
  RES, BUILDINGS, LINES, ERAS, NATIONS, sumCost, REP_START, REP_LOW, REP_LOSS, CONTACT_RANGE, ALLIANCE_NOTICE, PACT_MINUTES,
  SPY_MISSIONS, SPY_DETECT, EVENTS, EVENT_FIRST, EVENT_GAP, EVENT_TIMEOUT, repLabel,
} from '../shared/rules.js';

const pair = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
const clampRep = v => Math.max(0, Math.min(100, Math.round(v)));

export function installDiplomacy(World) {
  const W = World.prototype;

  // ---------- Grundzustand ----------
  W.initDiplomacy = function () {
    this.rel = this.rel || {};          // 'a-b' -> { alliance, pactUntil, cancelAt }
    this.proposals = this.proposals || []; // offene Vertragsangebote
    this.dchat = this.dchat || {};      // 'a-b' -> [{from, text, t}]
    this.tributes = this.tributes || [];
    this.chron = this.chron || [];
    this.nextPropId = this.nextPropId || 1;
    this.reveals = this.reveals || [];  // Aufklärung durch Spione: {pid, x, y, until}
    for (const pl of this.P) {
      if (pl.rep == null) pl.rep = REP_START;
      if (!pl.contacts) pl.contacts = [];
      if (!pl.buffs) pl.buffs = [];
      if (pl.nextEvent == null) pl.nextEvent = EVENT_FIRST + Math.random() * 300;
      if (!pl.stats.breaches) Object.assign(pl.stats, { breaches: 0, treaties: 0, bridges: 0, spied: 0 });
    }
  };
  W.relOf = function (a, b) { const k = pair(a, b); return this.rel[k] || (this.rel[k] = { alliance: false, pactUntil: 0, cancelAt: 0 }); };
  W.sameTeam = function (a, b) { return a === b || (a >= 0 && b >= 0 && this.P[a].team === this.P[b].team); };
  W.allied = function (a, b) {
    if (a === b) return true;
    if (a < 0 || b < 0) return false;
    if (this.P[a].team === this.P[b].team) return true;
    const r = this.rel && this.rel[pair(a, b)];
    return !!(r && r.alliance);
  };
  W.atPeace = function (a, b) { const r = this.rel && this.rel[pair(a, b)]; return !!(r && r.pactUntil > this.time); };
  W.enemy = function (a, b) { return a >= 0 && b >= 0 && !this.allied(a, b) && !this.atPeace(a, b); };
  W.hasContact = function (a, b) { return this.allied(a, b) || this.P[a].contacts.includes(b); };
  // gemeinsame Sicht nur bei echtem Bündnis und ausreichendem Ansehen
  W.sharesVision = function (a, b) { return this.sameTeam(a, b) || (this.allied(a, b) && this.P[a].rep >= REP_LOW && this.P[b].rep >= REP_LOW); };
  W.chronicle = function (text, k = 'dip') { const e = { t: Math.round(this.time), text, k }; this.chron.push(e); if (this.chron.length > 400) this.chron.shift(); this.event({ k: 'chron', e }); };
  W.repChange = function (pid, d, why) {
    const pl = this.P[pid]; const before = pl.rep; pl.rep = clampRep(pl.rep + d);
    if (d < 0 && why) this.event({ k: 'notice', to: -1, text: `⚖ ${pl.name}: ${why} – Ansehen ${repLabel(before)} → ${repLabel(pl.rep)}` });
  };

  // ---------- jede Spielsekunde ----------
  W.updateDiplomacy = function (dt) {
    const t = this.time;
    // Kontakt durch Botschafter in der Nähe fremder Gebäude
    for (const u of this.units) {
      if (u.dead || u.cls !== 'env' || u.aboard) continue;
      this.nearbyBuildings(u.x, u.y, CONTACT_RANGE, b => {
        if (b.dead || b.owner === u.owner || this.P[u.owner].contacts.includes(b.owner) || !this.P[b.owner].alive) return;
        if (Math.hypot(b.cx - u.x, b.cy - u.y) > CONTACT_RANGE + b.size / 2) return;
        this.makeContact(u.owner, b.owner);
      });
    }
    // Pakte laufen aus, Bündnis-Kündigungen werden wirksam
    for (const [k, r] of Object.entries(this.rel)) {
      const [a, b] = k.split('-').map(Number);
      if (r.pactUntil && r.pactUntil <= t) { r.pactUntil = 0; this.notice(a, `Der Nichtangriffspakt mit ${this.P[b].name} ist ausgelaufen.`); this.notice(b, `Der Nichtangriffspakt mit ${this.P[a].name} ist ausgelaufen.`); }
      if (r.cancelAt && r.cancelAt <= t) { r.cancelAt = 0; r.alliance = false; this.chronicle(`Das Bündnis zwischen ${this.P[a].name} und ${this.P[b].name} ist beendet.`); }
    }
    // Tribute
    for (const tr of this.tributes) {
      if (tr.until <= t) { tr.done = true; continue; }
      const from = this.P[tr.from], to = this.P[tr.to], amt = tr.perMin / 60 * dt;
      if (!from.alive || !to.alive) { tr.done = true; continue; }
      const pay = Math.min(amt, from.res[tr.res]);
      from.res[tr.res] -= pay; to.res[tr.res] += pay;
    }
    this.tributes = this.tributes.filter(x => !x.done);
    this.reveals = this.reveals.filter(r => r.until > t);
    // Ereignisse
    for (const pl of this.P) {
      if (!pl.alive) continue;
      pl.buffs = pl.buffs.filter(b => b.until > t);
      if (pl.event && t >= pl.event.until) this.chooseEvent(pl, 0);
      if (!pl.event && t >= pl.nextEvent) this.startEvent(pl);
    }
  };
  W.makeContact = function (a, b) {
    if (!this.P[a].contacts.includes(b)) this.P[a].contacts.push(b);
    if (!this.P[b].contacts.includes(a)) this.P[b].contacts.push(a);
    this.notice(a, `🕊 Dein Botschafter hat ${this.P[b].name} erreicht – ihr könnt jetzt verhandeln.`);
    this.notice(b, `🕊 Ein Botschafter von ${this.P[a].name} ist eingetroffen – ihr könnt jetzt verhandeln.`);
    this.chronicle(`Erster Kontakt: ${this.P[a].name} und ${this.P[b].name}.`);
    this.event({ k: 'contact', a, b });
  };
  // Angriff auf Verbündete oder Paktpartner = Vertragsbruch
  W.checkBreach = function (attacker, victim) {
    if (attacker < 0 || victim < 0 || attacker === victim || this.sameTeam(attacker, victim)) return;
    const r = this.rel[pair(attacker, victim)];
    if (!r || !(r.alliance || r.pactUntil > this.time)) return;
    const what = r.alliance ? 'Bündnis' : 'Nichtangriffspakt';
    r.alliance = false; r.pactUntil = 0; r.cancelAt = 0;
    this.P[attacker].stats.breaches++;
    this.repChange(attacker, -REP_LOSS.breach, `bricht den ${what} mit ${this.P[victim].name}`);
    this.chronicle(`⚔ Verrat: ${this.P[attacker].name} bricht den ${what} mit ${this.P[victim].name}.`, 'breach');
  };
  W.envoyKilled = function (envoy, by) {
    if (by < 0 || by === envoy.owner || this.sameTeam(by, envoy.owner)) return;
    this.repChange(by, -REP_LOSS.envoy, `tötet einen Botschafter von ${this.P[envoy.owner].name}`);
    this.chronicle(`☠ ${this.P[by].name} hat einen Botschafter von ${this.P[envoy.owner].name} getötet.`, 'breach');
  };

  // ---------- Befehle (vom Raum weitergereicht) ----------
  W.diplomacy = function (pid, m) {
    const pl = this.P[pid];
    if (!pl || !pl.alive) return null;
    const other = Number.isInteger(m.to) ? this.P[m.to] : null;
    switch (m.op) {
      case 'chat': {
        if (!other || other.id === pid || !this.hasContact(pid, other.id)) return null;
        const text = String(m.text || '').slice(0, 300).trim();
        if (!text) return null;
        const k = pair(pid, other.id), entry = { from: pid, text, t: Math.round(this.time) };
        (this.dchat[k] || (this.dchat[k] = [])).push(entry);
        if (this.dchat[k].length > 120) this.dchat[k].shift();
        return { to: [pid, other.id], msg: { t: 'dchat', with: pid === entry.from ? other.id : pid, from: pid, text, time: entry.t } };
      }
      case 'propose': {
        if (!other || other.id === pid || !other.alive || !this.hasContact(pid, other.id)) return null;
        const offer = this.cleanOffer(m.offer);
        if (!offer) return null;
        // ältere Angebote zwischen beiden ersetzen
        this.proposals = this.proposals.filter(p => pair(p.from, p.to) !== pair(pid, other.id));
        const prop = { id: this.nextPropId++, from: pid, to: other.id, offer, at: Math.round(this.time) };
        this.proposals.push(prop);
        this.event({ k: 'proposal', to: other.id, prop });
        this.event({ k: 'proposal', to: pid, prop });
        return null;
      }
      case 'respond': {
        const i = this.proposals.findIndex(p => p.id === m.id && (p.to === pid || (p.from === pid && !m.accept)));
        if (i < 0) return null;
        const prop = this.proposals[i];
        this.proposals.splice(i, 1);
        if (m.accept && prop.to === pid) this.executeOffer(prop);
        else { this.notice(prop.from, `${this.P[prop.to].name} hat dein Angebot abgelehnt.`); this.event({ k: 'proposalEnd', to: prop.from, id: prop.id }); this.event({ k: 'proposalEnd', to: prop.to, id: prop.id }); }
        return null;
      }
      case 'cancel': {
        if (!other) return null;
        const r = this.relOf(pid, other.id);
        if (!r.alliance || r.cancelAt) return null;
        r.cancelAt = this.time + ALLIANCE_NOTICE;
        this.notice(other.id, `${pl.name} kündigt euer Bündnis. Es endet in ${ALLIANCE_NOTICE / 60} Minuten.`);
        this.notice(pid, `Bündnis gekündigt – es endet in ${ALLIANCE_NOTICE / 60} Minuten (kein Vertragsbruch).`);
        return null;
      }
      case 'event': return this.chooseEvent(pl, m.choice | 0), null;
      default: return null;
    }
  };
  W.cleanOffer = function (o) {
    if (!o || typeof o !== 'object') return null;
    const side = s => {
      s = s || {};
      const res = {}; for (const k of RES) { const v = Math.floor(+((s.res || {})[k]) || 0); if (v > 0) res[k] = Math.min(v, 1e6); }
      const prov = Array.isArray(s.prov) ? [...new Set(s.prov.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < this.provinces.length))].slice(0, 40) : [];
      const units = Array.isArray(s.units) ? s.units.map(Number).filter(Number.isInteger).slice(0, 200) : [];
      let tribute = null;
      if (s.tribute && RES.includes(s.tribute.res)) {
        const perMin = Math.min(5000, Math.floor(+s.tribute.perMin || 0)), min = Math.min(60, Math.floor(+s.tribute.min || 0));
        if (perMin > 0 && min > 0) tribute = { res: s.tribute.res, perMin, min };
      }
      return { res, prov, units, tribute };
    };
    const out = { give: side(o.give), get: side(o.get), alliance: !!o.alliance, pact: PACT_MINUTES.includes(+o.pact) ? +o.pact : 0 };
    const empty = s => !Object.keys(s.res).length && !s.prov.length && !s.units.length && !s.tribute;
    if (empty(out.give) && empty(out.get) && !out.alliance && !out.pact) return null;
    return out;
  };
  // Prüft und führt einen Vertrag in einem Schritt aus (alles oder nichts)
  W.executeOffer = function (prop) {
    const A = this.P[prop.from], B = this.P[prop.to], o = prop.offer;
    const fail = why => { this.notice(A.id, `Vertrag mit ${B.name} geplatzt: ${why}`); this.notice(B.id, `Vertrag mit ${A.name} geplatzt: ${why}`); };
    const check = (pl, s) => {
      for (const k in s.res) if (pl.res[k] < s.res[k]) return `${pl.name} hat nicht genug Rohstoffe.`;
      for (const p of s.prov) if (this.provOwner[p] !== pl.id) return `${pl.name} besitzt die Provinz ${this.provinces[p].name} nicht mehr.`;
      for (const id of s.units) { const u = this.ents.get(id); if (!u || u.dead || u.kind !== 'u' || u.owner !== pl.id) return `Truppen von ${pl.name} sind nicht mehr verfügbar.`; }
      return null;
    };
    if (!A.alive || !B.alive) return fail('ein Vertragspartner ist ausgeschieden.');
    const err = check(A, o.give) || check(B, o.get);
    if (err) return fail(err);
    const transfer = (from, to, s) => {
      for (const k in s.res) { from.res[k] -= s.res[k]; to.res[k] += s.res[k]; }
      for (const p of s.prov) this.transferProvince(p, from.id, to.id);
      for (const id of s.units) { const u = this.ents.get(id); u.owner = to.id; u.order = { t: 'idle' }; u.buildQ = []; }
      if (s.tribute) this.tributes.push({ from: from.id, to: to.id, res: s.tribute.res, perMin: s.tribute.perMin, until: this.time + s.tribute.min * 60 });
    };
    transfer(A, B, o.give); transfer(B, A, o.get);
    const r = this.relOf(A.id, B.id), parts = [];
    if (o.alliance) { r.alliance = true; r.cancelAt = 0; parts.push('Bündnis'); }
    if (o.pact) { r.pactUntil = Math.max(r.pactUntil, this.time + o.pact * 60); parts.push(`Nichtangriffspakt (${o.pact} min)`); }
    if (o.give.prov.length || o.get.prov.length) parts.push('Gebietstausch');
    if (Object.keys(o.give.res).length || Object.keys(o.get.res).length || o.give.tribute || o.get.tribute) parts.push('Rohstoffe');
    if (o.give.units.length || o.get.units.length) parts.push('Truppen');
    A.stats.treaties++; B.stats.treaties++;
    this.repChange(A.id, 1); this.repChange(B.id, 1);
    this.chronicle(`📜 Vertrag zwischen ${A.name} und ${B.name}: ${parts.join(', ')}.`, 'treaty');
    this.event({ k: 'proposalEnd', to: A.id, id: prop.id, ok: true }); this.event({ k: 'proposalEnd', to: B.id, id: prop.id, ok: true });
    this.recount(); this.updateProvinces();
  };
  // Alle Gebäude des Gebers in der Provinz wechseln den Besitzer
  W.transferProvince = function (p, from, to) {
    for (const b of this.buildings) {
      if (b.dead || b.owner !== from || this.prov[this.idx(Math.floor(b.cx), Math.floor(b.cy))] !== p) continue;
      if (this.P[from].advancing === b.id) this.P[from].advancing = null;
      if (this.P[from].lateResearch === b.id) this.P[from].lateResearch = null;
      if (this.P[from].wonderBuilding === b.id) this.P[from].wonderBuilding = null;
      b.owner = to; b.queue = []; b.qProg = 0; b.rally = null;
    }
    // Truppen des Gebers verlassen die Provinz
    for (const u of this.units) if (!u.dead && u.owner === from && this.prov[this.idx(Math.floor(u.x), Math.floor(u.y))] === p) {
      const s = this.P[from].start; this.groupMove([u], s.x + 0.5, s.y + 2.5, false);
    }
  };

  // ---------- Spionage ----------
  W.spyCommand = function (pid, u, mission, target, x, y) {
    const M = SPY_MISSIONS[mission];
    if (!M || u.cls !== 'spy') return;
    if (u.spyCd && u.spyCd > this.time) { this.notice(pid, `Der Spion braucht noch ${Math.ceil(u.spyCd - this.time)} s.`); return; }
    if (mission === 'scout') { u.order = { t: 'spy', mission, x: u.x, y: u.y }; return; }
    const t = this.ents.get(target);
    if (!t || t.kind !== 'b' || t.owner === pid || this.sameTeam(pid, t.owner)) return;
    if (mission === 'steal' && t.type !== 'town') { this.notice(pid, 'Pläne lassen sich nur aus einem Haupthaus stehlen.'); return; }
    u.order = { t: 'spy', mission, target: t.id }; u.buildQ = [];
  };
  W.doSpy = function (u, dt) {
    const o = u.order, M = SPY_MISSIONS[o.mission];
    const done = () => { u.order = { t: 'idle' }; u.spyCd = this.time + M.cd; this.P[u.owner].stats.spied++; };
    if (o.mission === 'scout') {
      this.reveals.push({ pid: u.owner, x: u.x, y: u.y, until: this.time + 180 });
      this.notice(u.owner, '🕵 Aufklärung: Das Gebiet ist für 3 Minuten aufgedeckt.');
      return done();
    }
    const t = this.ents.get(o.target);
    if (!t || t.dead) { u.order = { t: 'idle' }; return; }
    const r = this.approach(u, t, M.range, dt);
    if (r === true) return;
    if (r === 'fail') { u.order = { t: 'idle' }; return; }
    const victim = this.P[t.owner], me = this.P[u.owner];
    if (o.mission === 'sabotage' && (t.type === 'rail' || t.type === 'bridge' || t.type === 'road')) {
      this.kill(t, u.owner);
      this.notice(u.owner, `🕵 Sabotage gelungen: ${BUILDINGS[t.type].name} von ${victim.name} gesprengt.`);
      this.notice(t.owner, `💥 Sabotage! Ein Abschnitt (${BUILDINGS[t.type].name}) wurde gesprengt.`);
    } else if (o.mission === 'sabotage') {
      t.sabotaged = this.time + 120;
      this.notice(u.owner, `🕵 Sabotage gelungen: ${BUILDINGS[t.type].name} von ${victim.name} steht 2 Minuten still.`);
      this.notice(t.owner, `💥 Sabotage! Dein Gebäude (${BUILDINGS[t.type].name}) steht 2 Minuten still.`);
    } else if (o.mission === 'steal') {
      me.eraDiscount = Math.max(me.eraDiscount || 0, 0.25);
      this.notice(u.owner, `🕵 Pläne von ${victim.name} gestohlen: Dein nächster Aufstieg kostet 25 % weniger.`);
      this.notice(t.owner, '🕵 Jemand hat Pläne aus deinem Haupthaus gestohlen.');
    }
    // Entdeckungsgefahr: in der Nähe eines Wachgebäudes wird der Spion enttarnt und gemeldet
    if (this.detectedSpy(u, t.owner)) {
      this.repChange(u.owner, -REP_LOSS.spy, `Spion bei ${victim.name} erwischt`);
      this.chronicle(`🕵 Ein Spion von ${me.name} wurde bei ${victim.name} enttarnt.`, 'spy');
    }
    done();
  };
  // Haupthaus, Türme und Außenposten enttarnen Spione in ihrem Umkreis
  W.detectedSpy = function (u, byOwner) {
    let found = false;
    this.nearbyBuildings(u.x, u.y, SPY_DETECT, b => {
      if (found || b.dead || !b.built || !(b.type === 'town' || b.type === 'tower' || b.type === 'outpost')) return;
      if (byOwner != null ? b.owner !== byOwner : !this.enemy(b.owner, u.owner)) return;
      if (Math.hypot(b.cx - u.x, b.cy - u.y) <= SPY_DETECT) found = true;
    });
    return found;
  };

  // ---------- Ereignisse ----------
  W.startEvent = function (pl) {
    const list = Object.entries(EVENTS).filter(([, e]) => pl.era >= (e.minEra || 0) && pl.era <= (e.maxEra ?? 99) && (!e.nation || e.nation === pl.nation) && !(pl.seenEvents || []).includes(e.title));
    pl.nextEvent = this.time + EVENT_GAP[0] + Math.random() * (EVENT_GAP[1] - EVENT_GAP[0]);
    if (!list.length) return;
    // nationale Ereignisse bevorzugen
    const nat = list.filter(([, e]) => e.nation);
    const [key] = nat.length && Math.random() < 0.6 ? nat[0] : list[Math.floor(Math.random() * list.length)];
    pl.event = { key, until: this.time + EVENT_TIMEOUT };
    if (EVENTS[key].nation) (pl.seenEvents || (pl.seenEvents = [])).push(EVENTS[key].title);
    if (pl.isBot || (this.room && this.room.subs && this.room.subs.has(pl.id))) this.chooseEvent(pl, Math.random() < 0.5 ? 0 : 1);
  };
  W.chooseEvent = function (pl, choice) {
    if (!pl.event) return;
    const ev = EVENTS[pl.event.key], opt = ev.options[choice] || ev.options[0], e = opt.e;
    pl.event = null;
    if (e.res) for (const k in e.res) pl.res[k] = Math.max(0, pl.res[k] + e.res[k]);
    if (e.buff) for (const b of [].concat(e.buff)) pl.buffs.push({ k: b.k, v: b.v, res: b.res || null, until: this.time + b.s });
    if (e.morale) for (const u of this.units) if (u.owner === pl.id && u.morale != null) u.morale = Math.max(0, Math.min(100, u.morale + e.morale));
    if (e.rep) this.repChange(pl.id, e.rep);
    if (e.eraDiscount) pl.eraDiscount = Math.max(pl.eraDiscount || 0, e.eraDiscount);
    if (e.workers && Math.random() < e.workers.chance) {
      const ws = this.units.filter(u => u.owner === pl.id && u.cls === 'wrk' && !u.dead).slice(0, e.workers.n);
      for (const u of ws) this.kill(u, -1);
      this.notice(pl.id, `☠ ${ws.length} Arbeiter sind der Seuche erlegen.`);
    }
    this.notice(pl.id, `${ev.title}: ${opt.label}`);
  };
  // Faktor aus laufenden Ereignis-Effekten
  W.buffMul = function (pl, k, res) {
    let m = 1;
    for (const b of pl.buffs || []) if (b.k === k && (!b.res || b.res === res)) m *= b.v;
    return m;
  };

  // ---------- Netzwerk ----------
  W.diploPublic = function (p) {
    const allies = [], pacts = [];
    for (const q of this.P) {
      if (q.id === p.id) continue;
      const r = this.rel[pair(p.id, q.id)];
      if (r && r.alliance) allies.push(q.id);
      if (r && r.pactUntil > this.time) pacts.push([q.id, Math.ceil(r.pactUntil - this.time)]);
    }
    return { rep: p.rep, allies, pacts, contacts: p.contacts };
  };
  W.diploPrivate = function (pl) {
    const ev = pl.event ? { key: pl.event.key, left: Math.max(0, Math.ceil(pl.event.until - this.time)) } : null;
    const cancels = [];
    for (const q of this.P) { const r = this.rel[pair(pl.id, q.id)]; if (r && r.cancelAt) cancels.push([q.id, Math.ceil(r.cancelAt - this.time)]); }
    return { ev, eraDiscount: pl.eraDiscount || 0, cancels, buffs: (pl.buffs || []).map(b => [b.k, b.v, b.res, Math.ceil(b.until - this.time)]) };
  };
  W.diploInit = function (pid) {
    const chats = {};
    for (const [k, list] of Object.entries(this.dchat)) {
      const [a, b] = k.split('-').map(Number);
      if (a === pid) chats[b] = list; else if (b === pid) chats[a] = list;
    }
    return { chron: this.chron, chats, proposals: this.proposals.filter(p => p.from === pid || p.to === pid) };
  };
}
