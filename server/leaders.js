// Staatsführer: Wahl in Epoche VII und VIII, Dauerboni (über playerMods) und aktive Fähigkeiten.
import { LEADER, LEADER_CD, leaderOptions, inGroup, ERAS, LINES, unitStats, unitKey, TYPE_INDEX } from '../shared/rules.js';
import { T_WATER } from './mapgen.js';

export function installLeaders(World) {
  const W = World.prototype;

  // Welche Führer-Epoche ist offen? (VIII ersetzt VII)
  W.leaderEraDue = function (pl) {
    if (!pl.nation) return null;
    const era = pl.era >= 7 ? 7 : pl.era >= 6 ? 6 : null;
    if (era == null || (pl.leaderEra ?? -1) >= era || !leaderOptions(pl.nation, era).length) return null;
    return era;
  };
  W.checkLeaderChoice = function (pl) {
    if (!pl.choice && this.leaderEraDue(pl) != null) pl.choice = 'leader';
  };
  W.chooseLeader = function (pl, id) {
    const era = this.leaderEraDue(pl), L = LEADER[id];
    if (era == null || !L || L.nation !== pl.nation || L.era !== era) return;
    pl.leader = id; pl.leaderEra = era; pl.choice = null; pl.leaderCd = 0; pl.leaderUsed = {};
    this.updateMods(pl);
    this.achieve(pl.id, 'LEADER');
    if (L.b.repSet != null) this.repChange(pl.id, Math.min(0, L.b.repSet - pl.rep), `${L.name} übernimmt die Führung`);
    if (L.b.repAdd) this.repChange(pl.id, L.b.repAdd);
    this.event({ k: 'choice', p: pl.id, what: 'leader', v: id });
    this.chronicle(`${pl.name}: ${L.name} übernimmt die Führung (${ERAS[era].name}).`, 'era');
  };

  // Fähigkeit auslösen
  W.leaderAbility = function (pl, c) {
    const L = LEADER[pl.leader]; if (!L) return;
    const a = L.a;
    if (a.once && pl.leaderUsed && pl.leaderUsed[pl.leaderEra]) { this.notice(pl.id, `${a.name} ist in dieser Epoche schon eingesetzt.`); return; }
    if ((pl.leaderCd || 0) > this.time) { this.notice(pl.id, `${a.name} wieder bereit in ${Math.ceil(pl.leaderCd - this.time)} s.`); return; }
    if (!this.leaderSpecial(pl, a, c)) return;
    for (const b of a.buffs || []) {
      const targets = a.allies ? this.P.filter(q => q.alive && (q.id === pl.id || this.allied(q.id, pl.id))) : [pl];
      for (const q of targets) (q.buffs || (q.buffs = [])).push({ k: b.k, v: b.v, g: b.g || null, own: !!b.own, res: b.res || null, until: this.time + b.s });
    }
    if (a.rep) this.repChange(pl.id, a.rep);
    pl.leaderCd = this.time + (a.cd || LEADER_CD);
    if (a.once) (pl.leaderUsed || (pl.leaderUsed = {}))[pl.leaderEra] = true;
    this.notice(pl.id, `★ ${L.name}: ${a.name}`);
    this.event({ k: 'leaderAbility', p: pl.id, name: a.name, by: L.name });
  };
  // Sonderfähigkeiten; false = abgebrochen (keine Abklingzeit)
  W.leaderSpecial = function (pl, a, c) {
    switch (a.special) {
      case undefined: return true;
      case 'congress': case 'secretCongress': {
        if (!this.startConference) { this.notice(pl.id, 'Friedenskonferenzen sind noch nicht verfügbar.'); return false; }
        const foe = this.P[c.target | 0];
        if (!foe || !foe.alive || foe.id === pl.id || !this.enemy(pl.id, foe.id)) { this.notice(pl.id, 'Wähle einen Kriegsgegner für die Konferenz.'); return false; }
        return this.startConference(pl, foe, { forced: a.special === 'congress', secret: a.special === 'secretCongress' });
      }
      case 'eraFast': pl.eraFast = 0.7; return true;
      case 'noWarning': pl.nukeNoWarning = true; return true;
      case 'freeLeave': pl.freeLeave = true; this.notice(pl.id, 'Das nächste gekündigte Bündnis kostet kein Ansehen.'); return true;
      case 'zoneSlow': pl.zoneSlow = { v: a.v, until: this.time + a.s, noGather: !!a.noGather }; return true;
      case 'stealth': pl.stealthUntil = this.time + a.s; return true;
      case 'immobilize': {
        let n = 0;
        for (const u of this.units) if (!u.dead && !u.aboard && this.enemy(pl.id, u.owner) && this.ownProvince(pl.id, u.x, u.y)) { u.stunUntil = this.time + a.s; u.order = { t: 'idle' }; n++; }
        this.notice(pl.id, `${n} fremde Einheiten in deinen Provinzen stehen still.`);
        return true;
      }
      case 'blockade': {
        const v = this.vis.get(pl.team); let n = 0;
        for (const u of this.units) if (!u.dead && u.naval && this.enemy(pl.id, u.owner) && v && v[this.idx(Math.floor(u.x), Math.floor(u.y))]) { u.stunUntil = this.time + a.s; u.order = { t: 'idle' }; n++; }
        this.notice(pl.id, `Seeblockade: ${n} feindliche Schiffe liegen fest.`);
        return true;
      }
      case 'freeInf': {
        const town = this.buildings.find(b => !b.dead && b.built && b.type === 'town' && b.owner === pl.id);
        if (!town) { this.notice(pl.id, 'Dafür brauchst du ein Haupthaus.'); return false; }
        for (let k = 0; k < a.n; k++) { const p = this.spawnPoint(town) || this.nearestFree(town.cx, town.cy + town.size, 8); if (!p) break; const u = this.addUnit(pl.id, 'inf', null, p[0] + (k % 5) * 0.3, p[1] + Math.floor(k / 5) * 0.3); this.cells[this.cellOf(u.x, u.y)].push(u); }
        return true;
      }
      case 'refit': {
        for (const u of this.units) if (!u.dead && u.owner === pl.id && u.era < pl.era && !u.unique) this.refitUnit(u, pl.era);
        return true;
      }
      case 'rebuild': { for (const b of this.buildings) if (!b.dead && b.owner === pl.id && b.built) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.3); return true; }
      case 'grant': { for (const k in a.res) pl.res[k] += a.res[k]; return true; }
      case 'empire': {
        const coastSet = new Set();
        for (let y = 1; y < this.H - 1; y++) for (let x = 1; x < this.W - 1; x++) {
          const i = this.idx(x, y); if (this.terrain[i] !== T_WATER) continue;
          for (const j of [i - 1, i + 1, i - this.W, i + this.W]) { const p = this.prov[j]; if (p !== 65535 && this.provOwner[p] === pl.id && this.terrain[j] !== T_WATER) coastSet.add(p); }
        }
        const coast = coastSet.size;
        const v = 1 + Math.min(0.4, 0.1 * Math.max(1, coast));
        (pl.buffs || (pl.buffs = [])).push({ k: 'gather', v, until: this.time + a.s });
        return true;
      }
      default: return true;
    }
  };
  // Einheit auf eine neuere Epoche bringen (Leben anteilig)
  W.refitUnit = function (u, era) {
    era = Math.max(era, LINES[u.line].minEra);
    const st = unitStats(u.line, era, u.unique, this.P[u.owner].mods);
    const r = u.hp / u.maxHp;
    u.era = era; u.st = st; u.maxHp = st.hp; u.hp = st.hp * r; u.cls = st.cls; u.typeIdx = TYPE_INDEX[unitKey(u.line, era, u.unique)];
  };

  // Faktor der Führer- und Ereigniseffekte für eine einzelne Einheit
  W.unitBuff = function (u, k) {
    const pl = this.P[u.owner]; let m = 1;
    for (const b of pl.buffs || []) {
      if (b.k !== k || (!b.g && !b.own)) continue;
      if (b.g && !inGroup(b.g, u.st)) continue;
      if (b.own && !this.ownProvince(u.owner, u.x, u.y)) continue;
      m *= b.v;
    }
    return m;
  };
  // Gegner in einer „verbrannten Erde“/Salzmarsch-Zone?
  W.zoneFactor = function (u) {
    const p = this.prov[this.idx(Math.floor(u.x), Math.floor(u.y))];
    if (p === 65535) return null;
    const o = this.provOwner[p]; if (o < 0 || o === u.owner) return null;
    const z = this.P[o] && this.P[o].zoneSlow;
    return z && z.until > this.time && this.enemy(o, u.owner) ? z : null;
  };
}
