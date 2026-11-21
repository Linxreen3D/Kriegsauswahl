// Friedenskonferenz: Verhandlungsrunde zweier Kriegsparteien mitten im Krieg (Kapitel 12.4).
// Mit Pause für alle (Standard), ohne Pause (dann Waffenruhe zwischen beiden) oder aus. Zuschauer können
// Seiten unterstützen (Rohstoffe, werden in jedem Fall übergeben) und Garantien geben (bei Scheitern Bündnis mit der Seite).
import { RES } from '../shared/rules.js';

const COUNTDOWN = 10, REQUEST_CD = 1200, PAUSE_BUDGET = 900, INVITE_TTL = 60;

export function installConference(World) {
  const W = World.prototype;

  W.confMode = function () { return this.settings.conferences || 'pause'; };
  W.inTalks = function (a, b) { const c = this.conf; return !!(c && c.phase === 'open' && !c.paused && ((c.a === a && c.b === b) || (c.a === b && c.b === a))); };

  // Antrag stellen (Fähigkeiten Kongress/Sixtus-Brief rufen startConference direkt)
  W.confRequest = function (pl, foe) {
    if (this.confMode() === 'off') { this.notice(pl.id, 'Friedenskonferenzen sind in dieser Partie abgeschaltet.'); return; }
    if (!foe || !foe.alive || foe.id === pl.id || !this.enemy(pl.id, foe.id)) { this.notice(pl.id, 'Eine Konferenz ist nur mit einem Kriegsgegner möglich.'); return; }
    if (!this.hasContact(pl.id, foe.id)) { this.notice(pl.id, 'Ohne Kontakt (Botschafter) keine Konferenz.'); return; }
    if (this.conf) { this.notice(pl.id, 'Es läuft bereits eine Konferenz.'); return; }
    if ((pl.confCd || 0) > this.time) { this.notice(pl.id, `Nächster Konferenzantrag in ${Math.ceil((pl.confCd - this.time) / 60)} min.`); return; }
    pl.confCd = this.time + REQUEST_CD;
    this.confInvite = { from: pl.id, to: foe.id, until: this.time + INVITE_TTL };
    this.event({ k: 'confInvite', to: foe.id, from: pl.id });
    this.notice(pl.id, `Konferenzantrag an ${foe.name} gesendet.`);
  };
  W.confRespond = function (pl, accept) {
    const inv = this.confInvite;
    if (!inv || inv.to !== pl.id) return;
    this.confInvite = null;
    if (!accept) { this.notice(inv.from, `${pl.name} lehnt die Konferenz ab.`); return; }
    this.startConference(this.P[inv.from], pl, {});
  };

  W.startConference = function (a, b, opts = {}) {
    if (this.confMode() === 'off') { this.notice(a.id, 'Friedenskonferenzen sind in dieser Partie abgeschaltet.'); return false; }
    if (this.conf) { this.notice(a.id, 'Es läuft bereits eine Konferenz.'); return false; }
    const limit = (this.settings.confMin || 5) * 60;
    this.conf = { id: this.nextId++, a: a.id, b: b.id, secret: !!opts.secret, forced: !!opts.forced, phase: 'countdown', startAt: this.time + COUNTDOWN, left: limit,
      paused: false, offer: null, ver: 0, signed: [], support: [], guarantees: [], chat: [], mediator: null, medVotes: {}, sanctions: [], joins: [] };
    const txt = opts.secret ? `Geheime Verhandlung mit ${b.name} beginnt in ${COUNTDOWN} Sekunden (ohne Pause, Waffenruhe zwischen euch).`
      : `🕊 Friedenskonferenz zwischen ${a.name} und ${b.name} in ${COUNTDOWN} Sekunden${opts.forced ? ' (erzwungen)' : ''}.`;
    if (opts.secret) { this.notice(a.id, txt); this.notice(b.id, txt.replace(b.name, a.name)); } else this.event({ k: 'notice', to: -1, text: txt });
    this.chronicle(opts.secret ? `Geheime Verhandlung zwischen ${a.name} und ${b.name}.` : `🕊 Friedenskonferenz zwischen ${a.name} und ${b.name}.`, 'treaty');
    this.confBroadcast();
    return true;
  };
  W.pauseBudgetLeft = function () { return PAUSE_BUDGET * (1 + Math.floor(this.time / 3600)) - (this.confPausedTotal || 0); };

  // Spielzeit-Schritt (läuft im normalen Tick: Countdown und Konferenzen ohne Pause)
  W.updateConference = function (dt) {
    this.updateDmz();
    if (this.confInvite && this.confInvite.until < this.time) { this.notice(this.confInvite.from, 'Keine Antwort auf den Konferenzantrag.'); this.confInvite = null; }
    const c = this.conf; if (!c) return;
    if (!this.P[c.a].alive || !this.P[c.b].alive) return this.endConference(false, 'Eine Partei ist ausgeschieden.');
    if (c.phase === 'countdown') {
      if (this.time >= c.startAt) {
        c.phase = 'open';
        c.paused = this.confMode() === 'pause' && !c.secret && this.pauseBudgetLeft() > 30;
        this.confBroadcast();
      }
      return;
    }
    if (!c.paused) this.confClock(dt);
  };
  // Echtzeit-Schritt während der Pause (aus dem Raum aufgerufen)
  W.confStep = function (realDt) {
    const c = this.conf; if (!c) return;
    this.confPausedTotal = (this.confPausedTotal || 0) + realDt;
    if (this.pauseBudgetLeft() <= 0) { c.paused = false; this.event({ k: 'notice', to: -1, text: 'Pausenzeit für Konferenzen aufgebraucht – die Verhandlung läuft ohne Pause weiter (Waffenruhe zwischen beiden).' }); }
    this.confClock(realDt);
  };
  W.confClock = function (dt) {
    const c = this.conf;
    const before = Math.ceil(c.left); c.left -= dt;
    if (c.left <= 0) return this.endConference(false, 'Die Zeit ist abgelaufen.');
    if (Math.ceil(c.left) !== before && Math.ceil(c.left) % 5 === 0) this.confBroadcast();
  };

  // Operationen am Tisch und auf der Galerie
  W.confOp = function (pl, m) {
    const c = this.conf; if (!c) return;
    const party = pl.id === c.a || pl.id === c.b;
    if (c.secret && !party) return;
    switch (m.op) {
      case 'confOffer': {
        const mediator = c.mediator === pl.id;
        if ((!party && !mediator) || c.phase !== 'open') return;
        const o = this.cleanOffer(m.offer) || { give: { res: {}, prov: [], units: [], tribute: null }, get: { res: {}, prov: [], units: [], tribute: null }, alliance: false, pact: 0 };
        o.alliance = false; o.pact = 0; o.give.units = []; o.get.units = [];
        const peace = m.offer && m.offer.peace === 'peace' ? 'peace' : m.offer && m.offer.peace === 'ceasefire' ? 'ceasefire' : null;
        const arms = { give: !!(m.offer && m.offer.armsGive), get: !!(m.offer && m.offer.armsGet) };
        const dis = { give: !!(m.offer && m.offer.disarmGive), get: !!(m.offer && m.offer.disarmGet) };
        const dmz = m.offer && Array.isArray(m.offer.dmz) ? [...new Set(m.offer.dmz.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < this.provinces.length && [c.a, c.b].includes(this.provOwner[n])))].slice(0, 10) : [];
        // einheitlich aus Sicht von A speichern
        const swap = pl.id === c.b;
        c.offer = { peace, a: swap ? o.get : o.give, b: swap ? o.give : o.get, armsA: swap ? arms.get : arms.give, armsB: swap ? arms.give : arms.get,
          disarmA: swap ? dis.get : dis.give, disarmB: swap ? dis.give : dis.get, dmz, by: pl.id };
        c.ver++; c.signed = [];
        this.confBroadcast();
        return;
      }
      case 'confSign': {
        if (!party || !c.offer || c.phase !== 'open' || (m.ver | 0) !== c.ver) return;
        if (!c.signed.includes(pl.id)) c.signed.push(pl.id);
        if (c.signed.includes(c.a) && c.signed.includes(c.b)) return this.confExecute();
        this.confBroadcast();
        return;
      }
      case 'confLeave': if (party) this.endConference(false, `${pl.name} verlässt den Verhandlungstisch.`); return;
      case 'confChat': {
        const text = String(m.text || '').slice(0, 300).trim(); if (!text) return;
        c.chat.push({ from: pl.id, text, gallery: !party }); if (c.chat.length > 80) c.chat.shift();
        this.confBroadcast();
        return;
      }
      case 'confSupport': {
        if (party || c.phase === 'done') return;
        const side = +m.side; if (side !== c.a && side !== c.b) return;
        const res = {}; for (const k of RES) { const v = Math.floor(+((m.res || {})[k]) || 0); if (v > 0) res[k] = Math.min(v, pl.res[k] | 0); }
        if (!Object.keys(res).length) return;
        for (const k in res) pl.res[k] -= res[k];
        c.support.push({ from: pl.id, side, res });
        this.confBroadcast();
        return;
      }
      case 'confMediator': { // beide Parteien müssen denselben Zuschauer wählen
        if (!party || c.phase === 'done') return;
        const id = +m.id;
        if (id >= 0 && (!this.P[id] || !this.P[id].alive || id === c.a || id === c.b)) return;
        c.medVotes[pl.id] = id;
        if (id >= 0 && c.medVotes[c.a] === id && c.medVotes[c.b] === id) { c.mediator = id; this.notice(id, '⚖ Du wurdest als Vermittler an den Tisch gebeten. Du kannst Vorschläge auf den Tisch legen.'); }
        else if (c.mediator != null && c.medVotes[pl.id] !== c.mediator) c.mediator = null;
        this.confBroadcast();
        return;
      }
      case 'confSanction': { // Drohung: wer am Ende nicht unterschrieben hat, bekommt 20 min keine Angebote von diesem Zuschauer
        if (party || c.phase === 'done') return;
        const side = +m.side; if (side !== c.a && side !== c.b) return;
        if (c.sanctions.some(x => x.from === pl.id && x.side === side)) return;
        c.sanctions.push({ from: pl.id, side });
        this.confBroadcast();
        return;
      }
      case 'confJoin': { // Zuschauer will Vertragspartei auf einer Seite werden
        if (party || c.phase === 'done' || c.joins.some(j => j.id === pl.id)) return;
        const side = +m.side; if (side !== c.a && side !== c.b) return;
        c.joins.push({ id: pl.id, side, ok: [] });
        this.confBroadcast();
        return;
      }
      case 'confJoinOk': {
        if (!party) return;
        const j = c.joins.find(x => x.id === +m.id); if (!j || j.ok.includes(pl.id)) return;
        j.ok.push(pl.id);
        this.confBroadcast();
        return;
      }
      case 'confGuarantee': {
        if (party || c.phase === 'done') return;
        const side = +m.side; if (side !== c.a && side !== c.b) return;
        if (c.guarantees.some(g => g.from === pl.id)) return;
        c.guarantees.push({ from: pl.id, side });
        this.confBroadcast();
        return;
      }
    }
  };
  W.confExecute = function () {
    const c = this.conf, o = c.offer;
    const offer = { give: o.a, get: o.b, alliance: false, pact: o.peace === 'peace' ? 20 : o.peace === 'ceasefire' ? 10 : 0 };
    const A = this.P[c.a], B = this.P[c.b];
    const before = A.stats.treaties;
    this.executeOffer({ id: 'conf' + c.id, from: c.a, to: c.b, offer });
    if (A.stats.treaties === before) return this.endConference(false, 'Der Vertrag konnte nicht erfüllt werden.');
    if (o.disarmA) this.disarm(A);
    if (o.disarmB) this.disarm(B);
    if (o.dmz && o.dmz.length) {
      const parties = [c.a, c.b, ...c.joins.filter(j => j.ok.length >= 2).map(j => j.id)];
      (this.dmz || (this.dmz = [])).push({ prov: o.dmz, parties, until: this.time + 1200 });
      this.event({ k: 'notice', to: -1, text: `🚫 Entmilitarisierte Zone für 20 min: ${o.dmz.map(p => this.provinces[p].name).join(', ')}.` });
    }
    if (offer.pact) for (const j of c.joins.filter(x => x.ok.length >= 2)) {
      const other = j.side === c.a ? c.b : c.a, rj = this.relOf(j.id, other);
      rj.pactUntil = Math.max(rj.pactUntil, this.time + offer.pact * 60);
      if (o.peace === 'peace') rj.peaceTreaty = this.time + 1200;
      this.notice(j.id, `Du trittst dem Vertrag bei: ${offer.pact} min Waffenruhe mit ${this.P[other].name}.`);
    }
    if (c.mediator != null && this.P[c.mediator]) {
      const M = this.P[c.mediator], val = s => Object.values(s.res).reduce((x, y) => x + y, 0) + (s.tribute ? s.tribute.perMin * s.tribute.min : 0);
      const fee = Math.round((val(o.a) + val(o.b)) * 0.05);
      if (fee) M.res.gold += fee;
      this.repChange(M.id, 10); this.achieve(M.id, 'MEDIATOR');
      this.notice(M.id, `⚖ Vermittlung erfolgreich: +Ansehen${fee ? ` und ${fee} Gold Provision` : ''}.`);
    }
    if (o.armsA) A.armsLimitUntil = this.time + 900;
    if (o.armsB) B.armsLimitUntil = this.time + 900;
    const r = this.relOf(c.a, c.b);
    if (o.peace === 'peace') { r.peaceTreaty = this.time + 1200; r.guarantors = c.guarantees.map(g => g.from); this.achieve(c.a, 'PEACE'); this.achieve(c.b, 'PEACE'); }
    this.endConference(true, o.peace === 'peace' ? 'Frieden geschlossen.' : o.peace === 'ceasefire' ? 'Waffenstillstand vereinbart.' : 'Vertrag unterschrieben.');
  };
  W.endConference = function (ok, why) {
    const c = this.conf; if (!c) return;
    c.phase = 'done';
    const A = this.P[c.a], B = this.P[c.b];
    // Zusagen der Zuschauer werden in jedem Fall übergeben
    for (const s of c.support) for (const k in s.res) this.P[s.side].res[k] += s.res[k];
    // Sanktionen treffen, wer den letzten Vorschlag nicht unterschrieben hat
    if (!ok) for (const sn of c.sanctions) {
      if (c.offer && c.signed.includes(sn.side)) continue;
      const r = this.relOf(sn.from, sn.side); r.sanction = { by: sn.from, until: this.time + 1200 };
      this.event({ k: 'notice', to: -1, text: `⛔ ${this.P[sn.from].name} verhängt 20 min Sanktionen gegen ${this.P[sn.side].name}.` });
    }
    // Garantien greifen bei Scheitern: Bündnis mit der Seite, Bruch mit der Gegenseite
    if (!ok) for (const g of c.guarantees) {
      const other = g.side === c.a ? c.b : c.a;
      const rs = this.relOf(g.from, g.side); rs.alliance = true; rs.cancelAt = 0;
      const ro = this.relOf(g.from, other); ro.alliance = false; ro.pactUntil = 0;
      this.event({ k: 'notice', to: -1, text: `⚔ ${this.P[g.from].name} tritt auf Seite von ${this.P[g.side].name} in den Krieg ein (Garantie).` });
    }
    const txt = `${ok ? '🕊' : '✖'} Konferenz ${A.name} – ${B.name}: ${why}`;
    if (c.secret) { this.notice(c.a, txt); this.notice(c.b, txt); } else this.event({ k: 'notice', to: -1, text: txt });
    this.chronicle(txt, 'treaty');
    this.confBroadcast();
    this.conf = null;
  };

  // Abrüstung: ein Viertel der Truppen wird entlassen, die Hälfte ihrer Kosten kommt zurück
  W.disarm = function (pl) {
    const mil = this.units.filter(u => !u.dead && u.owner === pl.id && u.cls !== 'wrk' && !u.aboard && !u.st.sig && u.line !== 'train' && u.cls !== 'env' && u.cls !== 'spy');
    const n = Math.floor(mil.length * 0.25); let back = {};
    mil.sort((x, y) => x.era - y.era);
    for (const u of mil.slice(0, n)) { for (const k in u.st.cost) back[k] = (back[k] || 0) + Math.round(u.st.cost[k] * 0.5); this.kill(u, -1); }
    for (const k in back) pl.res[k] += back[k];
    this.notice(pl.id, `Abrüstung: ${n} Einheiten entlassen, die Hälfte ihrer Kosten wurde erstattet.`);
  };
  W.inDmz = function (pid, x, y) {
    if (!this.dmz || !this.dmz.length) return false;
    const p = this.prov[this.idx(Math.floor(x), Math.floor(y))];
    return this.dmz.some(z => z.until > this.time && z.parties.includes(pid) && z.prov.includes(p));
  };
  // jede Sekunde: Militär der Vertragsparteien in der Zone nimmt Schaden (Rückzug erzwingen)
  W.updateDmz = function () {
    if (!this.dmz || !this.dmz.length) return;
    this.dmz = this.dmz.filter(z => z.until > this.time);
    for (const u of this.units) {
      if (u.dead || u.aboard || u.cls === 'wrk' || u.cls === 'env' || u.air || !this.inDmz(u.owner, u.x, u.y)) continue;
      this.damage(u, u.maxHp * 0.03, -1);
      if (!u.dmzWarn || u.dmzWarn < this.time) { u.dmzWarn = this.time + 30; this.notice(u.owner, '🚫 Deine Truppen stehen in einer entmilitarisierten Zone und verlieren Leben – zurückziehen!'); }
    }
  };
  // Zustand für die Clients
  W.confPublic = function () {
    const c = this.conf; if (!c) return null;
    return { id: c.id, a: c.a, b: c.b, secret: c.secret, phase: c.phase, left: Math.max(0, Math.ceil(c.left)), countdown: Math.max(0, Math.ceil(c.startAt - this.time)),
      paused: c.paused, offer: c.offer, ver: c.ver, signed: c.signed, support: c.support, guarantees: c.guarantees, chat: c.chat.slice(-40),
      mediator: c.mediator, medVotes: c.medVotes, sanctions: c.sanctions, joins: c.joins };
  };
  W.confBroadcast = function () {
    const s = this.confPublic() || { phase: 'done' };
    if (this.conf && this.conf.secret) { this.event({ k: 'conf', to: this.conf.a, s }); this.event({ k: 'conf', to: this.conf.b, s }); }
    else this.event({ k: 'conf', s });
  };
}
