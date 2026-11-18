import {
  TICK_MS, COLORS, DEFAULT_SETTINGS, BUILDINGS, BUILDING_KEYS, MAX_LEVEL, ABILITIES,
  production, capacity, income, defenseMult, buildCost, travelTime,
} from '../shared/rules.js';
import { Bot } from './bot.js';

const BOT_NAMES = ['General Ahorn', 'Admiral Kiesel', 'Marschall Eiche', 'Oberst Birke', 'Major Linde', 'Kommandant Fels',
  'General Sturm', 'Admiral Welle', 'Feldherrin Nova', 'Generalin Aster', 'Kapitän Riff', 'Oberst Flint'];

let tokenCounter = 0;
export const newToken = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + (tokenCounter++).toString(36);

export class Room {
  constructor(code, map, onEmpty) {
    this.code = code;
    this.map = map;
    this.onEmpty = onEmpty;
    this.players = []; // Index = Spieler-ID
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = 'lobby'; // lobby | draft | play | end
    this.hostId = null;
    this.clients = new Set();
    this.timer = null;
    this.chat = [];
    this.lastActivity = Date.now();
  }

  // ---------- Verbindung / Lobby ----------
  addHuman(ws, name) {
    if (this.phase !== 'lobby') return this.error(ws, 'Das Spiel läuft bereits.');
    if (this.players.filter(p => !p.left).length >= this.settings.maxPlayers) return this.error(ws, 'Der Raum ist voll.');
    const p = this.createPlayer(name, false);
    p.token = newToken();
    if (this.hostId === null) this.hostId = p.id;
    this.attach(ws, p);
    this.broadcastLobby();
    this.sysChat(`${p.name} ist beigetreten.`);
    return p;
  }
  createPlayer(name, isBot) {
    const used = new Set(this.players.filter(p => !p.left).map(p => p.color));
    const color = COLORS.find(c => !used.has(c)) || COLORS[this.players.length % COLORS.length];
    const p = {
      id: this.players.length, name: String(name || 'Spieler').slice(0, 20).trim() || 'Spieler', color, isBot,
      token: null, ws: null, connected: isBot, left: false,
      gold: 0, alive: true, capital: -1, mobilizeUntil: 0, cooldowns: {}, allies: new Set(), allyReq: new Set(),
      history: [], kills: 0, captured: 0, eliminatedAt: null, place: 0,
    };
    this.players.push(p);
    return p;
  }
  attach(ws, p) {
    if (p.ws && p.ws !== ws) { try { p.ws.close(4000, 'replaced'); } catch { /* egal */ } }
    p.ws = ws; p.connected = true;
    ws.player = p; ws.room = this;
    this.clients.add(ws);
    this.send(ws, { t: 'welcome', token: p.token, id: p.id, code: this.code });
    if (this.phase === 'lobby') this.sendLobby(ws);
    else this.sendFullState(ws);
    this.send(ws, { t: 'chatlog', list: this.chat.slice(-50) });
  }
  reconnect(ws, token) {
    const p = this.players.find(x => x.token === token && !x.left);
    if (!p) return false;
    this.attach(ws, p);
    if (this.phase !== 'lobby') this.sysChat(`${p.name} ist wieder da.`);
    else this.broadcastLobby();
    return true;
  }
  disconnect(ws) {
    this.clients.delete(ws);
    const p = ws.player;
    if (!p || p.ws !== ws) return;
    p.ws = null; p.connected = false;
    if (this.phase === 'lobby') {
      // In der Lobby: nach kurzer Zeit entfernen, falls nicht wieder verbunden
      setTimeout(() => { if (!p.connected && this.phase === 'lobby') this.removePlayer(p); }, 15000);
      this.broadcastLobby();
    } else {
      this.sysChat(`${p.name} hat die Verbindung verloren.`);
    }
    this.checkEmpty();
  }
  leave(ws) {
    const p = ws.player;
    this.clients.delete(ws);
    if (!p) return;
    p.ws = null; p.connected = false;
    if (this.phase === 'lobby') this.removePlayer(p);
    else { this.sysChat(`${p.name} hat das Spiel verlassen.`); p.left = true; }
    ws.player = null; ws.room = null;
    this.checkEmpty();
  }
  removePlayer(p) {
    p.left = true;
    this.players = this.players.filter(x => x !== p);
    this.players.forEach((x, i) => { x.id = i; });
    if (p.id === this.hostId || !this.players.some(x => x.id === this.hostId && !x.isBot)) {
      const h = this.players.find(x => !x.isBot);
      this.hostId = h ? h.id : null;
    }
    // IDs haben sich evtl. geändert → allen neu mitteilen
    for (const x of this.players) if (x.ws) this.send(x.ws, { t: 'welcome', token: x.token, id: x.id, code: this.code });
    this.broadcastLobby();
    this.checkEmpty();
  }
  checkEmpty() {
    const humans = this.players.filter(p => !p.isBot && p.connected);
    if (humans.length === 0) {
      clearTimeout(this.emptyTimer);
      this.emptyTimer = setTimeout(() => {
        if (!this.players.some(p => !p.isBot && p.connected)) this.destroy();
      }, this.phase === 'lobby' ? 20000 : 5 * 60000);
    }
  }
  destroy() {
    clearInterval(this.timer);
    this.timer = null;
    this.onEmpty(this);
  }

  lobbyState() {
    return {
      t: 'lobby', code: this.code, hostId: this.hostId, settings: this.settings,
      players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, connected: p.connected, difficulty: p.difficulty })),
    };
  }
  sendLobby(ws) { this.send(ws, this.lobbyState()); }
  broadcastLobby() { this.broadcast(this.lobbyState()); }

  // ---------- Nachrichten ----------
  handle(ws, msg) {
    const p = ws.player;
    if (!p) return;
    this.lastActivity = Date.now();
    const isHost = p.id === this.hostId;
    switch (msg.t) {
      case 'chat': {
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) return;
        const entry = { from: p.id, name: p.name, color: p.color, text, ts: Date.now() };
        if (msg.allies) entry.allies = true;
        this.chat.push(entry); if (this.chat.length > 200) this.chat.shift();
        if (msg.allies) {
          for (const x of this.players) if (x.ws && (x === p || p.allies.has(x.id))) this.send(x.ws, { t: 'chat', ...entry });
        } else this.broadcast({ t: 'chat', ...entry });
        return;
      }
      case 'rename':
        if (this.phase !== 'lobby') return;
        p.name = String(msg.name || '').slice(0, 20).trim() || p.name;
        return this.broadcastLobby();
      case 'color': {
        if (this.phase !== 'lobby' || !COLORS.includes(msg.color)) return;
        const target = msg.player != null && isHost ? this.players[msg.player] : p;
        if (!target || (target !== p && !target.isBot)) return;
        if (this.players.some(x => x !== target && x.color === msg.color)) return;
        target.color = msg.color;
        return this.broadcastLobby();
      }
      case 'settings':
        if (!isHost || this.phase !== 'lobby') return;
        this.applySettings(msg.settings || {});
        return this.broadcastLobby();
      case 'addBot': {
        if (!isHost || this.phase !== 'lobby') return;
        if (this.players.length >= this.settings.maxPlayers) return;
        const used = new Set(this.players.map(x => x.name));
        const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + this.players.length;
        const b = this.createPlayer(name, true);
        b.difficulty = ['easy', 'normal', 'hard'].includes(msg.difficulty) ? msg.difficulty : this.settings.botDifficulty;
        return this.broadcastLobby();
      }
      case 'kick': {
        if (!isHost || this.phase !== 'lobby') return;
        const target = this.players[msg.player];
        if (!target || target === p) return;
        if (target.ws) { this.send(target.ws, { t: 'kicked' }); target.ws.player = null; target.ws.room = null; this.clients.delete(target.ws); }
        return this.removePlayer(target);
      }
      case 'start':
        if (!isHost || this.phase !== 'lobby') return;
        if (this.players.length < 2) return this.error(ws, 'Mindestens 2 Teilnehmer (Spieler oder Bots) nötig.');
        return this.startDraft();
      case 'pick': return this.pick(p, msg.region | 0);
      case 'send': return this.sendTroops(p, msg.from, msg.to | 0, +msg.pct);
      case 'build': return this.build(p, msg.region | 0, msg.kind);
      case 'ability': return this.useAbility(p, msg.kind, msg.target | 0, msg.source);
      case 'ally': return this.diplomacy(p, msg.player | 0, msg.action);
      case 'surrender':
        if (this.phase !== 'play' || !p.alive) return;
        this.eliminate(p, null, true);
        return;
      case 'rematch':
        if (!isHost || this.phase !== 'end') return;
        return this.backToLobby();
      default:
    }
  }
  applySettings(s) {
    const st = this.settings;
    const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    if ('speed' in s) st.speed = num(s.speed, 0.5, 3, st.speed);
    if ('victory' in s) st.victory = Math.round(num(s.victory, 30, 100, st.victory));
    if ('timeLimit' in s) st.timeLimit = Math.round(num(s.timeLimit, 0, 180, st.timeLimit));
    if ('draftTime' in s) st.draftTime = Math.round(num(s.draftTime, 5, 90, st.draftTime));
    if ('startTroops' in s) st.startTroops = Math.round(num(s.startTroops, 10, 500, st.startTroops));
    if ('neutralStrength' in s) st.neutralStrength = num(s.neutralStrength, 0.2, 3, st.neutralStrength);
    if ('botDifficulty' in s && ['easy', 'normal', 'hard'].includes(s.botDifficulty)) {
      st.botDifficulty = s.botDifficulty;
      for (const p of this.players) if (p.isBot) p.difficulty = s.botDifficulty;
    }
    if ('fog' in s) st.fog = !!s.fog;
    if ('peace' in s) st.peace = Math.round(num(s.peace, 0, 300, st.peace));
  }

  // ---------- Spielablauf ----------
  startDraft() {
    const regions = this.map.regions;
    this.regions = regions.map(r => ({
      id: r.id, value: r.value, owner: -1, b: [0, 0, 0], capital: false,
      troops: Math.round((4 + r.value * 5 + Math.random() * 6) * this.settings.neutralStrength),
    }));
    this.armies = new Map();
    this.armyId = 1;
    this.newArmies = [];
    this.time = 0;
    this.phase = 'draft';
    this.draftEnd = Date.now() + this.settings.draftTime * 1000;
    this.picks = new Map();
    for (const p of this.players) {
      p.gold = 50; p.alive = true; p.capital = -1; p.cooldowns = {}; p.mobilizeUntil = 0; p.allies = new Set(); p.allyReq = new Set();
      p.history = []; p.kills = 0; p.captured = 0; p.eliminatedAt = null; p.place = 0;
      p.sent = { rev: 0 };
      if (p.isBot) p.bot = new Bot(this, p);
    }
    this.dirty = new Set();
    this.events = [];
    for (const ws of this.clients) this.sendFullState(ws);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }
  hopDistances(start, maxHops) {
    const dist = new Map([[start, 0]]);
    let frontier = [start];
    for (let h = 1; h <= maxHops && frontier.length; h++) {
      const next = [];
      for (const v of frontier) for (const [o] of this.map.regions[v].adj) if (!dist.has(o)) { dist.set(o, h); next.push(o); }
      frontier = next;
    }
    return dist;
  }
  blockedStarts() {
    // Startgebiete müssen mind. 3 Felder Abstand zueinander haben
    const blocked = new Set();
    for (const r of this.picks.values()) for (const id of this.hopDistances(r, 2).keys()) blocked.add(id);
    return blocked;
  }
  canPick(region, blocked = this.blockedStarts()) {
    return !!this.regions[region] && !blocked.has(region);
  }
  pick(p, region) {
    if (this.phase !== 'draft' || !p.alive) return;
    const own = this.picks.get(p.id);
    this.picks.delete(p.id); // eigene bisherige Wahl darf geändert werden
    if (!this.canPick(region)) {
      if (own != null) this.picks.set(p.id, own);
      return this.error(p.ws, 'Dieses Gebiet ist nicht verfügbar (zu nah an einem anderen Start).');
    }
    this.picks.set(p.id, region);
    this.broadcast({ t: 'picks', picks: [...this.picks.entries()] });
  }
  finishDraft() {
    // Bots und Unentschlossene wählen automatisch
    const regions = this.map.regions;
    for (const p of this.players) {
      if (this.picks.has(p.id)) continue;
      const taken = [...this.picks.values()];
      const blocked = this.blockedStarts();
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < regions.length; i++) {
        if (!this.canPick(i, blocked) || taken.includes(i)) continue;
        const r = regions[i];
        if (r.adj.length < 2) continue;
        let minD = Infinity;
        for (const t of taken) minD = Math.min(minD, Math.hypot(r.cx - regions[t].cx, r.cy - regions[t].cy));
        const score = Math.min(minD, 600) + r.value * 25 + r.adj.length * 8 + Math.random() * 120;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best >= 0) this.picks.set(p.id, best);
    }
    for (const [pid, rid] of this.picks) {
      const p = this.players[pid], r = this.regions[rid];
      r.owner = pid; r.troops = this.settings.startTroops; r.capital = true;
      p.capital = rid;
    }
    for (const p of this.players) if (!this.picks.has(p.id)) p.alive = false;
    this.phase = 'play';
    this.startTime = Date.now();
    this.time = 0;
    for (const ws of this.clients) this.sendFullState(ws);
    this.sysChat('Der Krieg beginnt!');
  }

  tick() {
    if (this.phase === 'draft') {
      if (Date.now() >= this.draftEnd) this.finishDraft();
      else this.broadcast({ t: 'draftTime', left: Math.ceil((this.draftEnd - Date.now()) / 1000) });
      if (this.phase === 'draft') {
        // Bots wählen schon während der Auswahl (nach einigen Sekunden)
        const elapsed = this.settings.draftTime * 1000 - (this.draftEnd - Date.now());
        for (const p of this.players) if (p.isBot && !this.picks.has(p.id) && elapsed > 2000 + p.id * 600) {
          const r = p.bot.chooseStart();
          if (r >= 0) this.pick(p, r);
        }
      }
      return;
    }
    if (this.phase !== 'play') return;
    const dt = (TICK_MS / 1000) * this.settings.speed;
    this.time += dt;
    const now = this.time;

    // Produktion
    for (const r of this.regions) {
      const before = Math.floor(r.troops);
      if (r.owner >= 0) {
        const p = this.players[r.owner];
        const cap = capacity(r);
        if (r.troops < cap) r.troops = Math.min(cap, r.troops + production(r, p.mobilizeUntil > now) * dt);
        else r.troops -= (r.troops - cap) * 0.03 * dt;
        p.gold += income(r) * dt;
      } else {
        const cap = (15 + r.value * 12) * this.settings.neutralStrength;
        if (r.troops < cap) r.troops = Math.min(cap, r.troops + 0.05 * r.value * dt);
      }
      if (Math.floor(r.troops) !== before) this.dirty.add(r.id);
    }
    for (const p of this.players) if (p.alive) p.gold += 0.6 * dt; // Grundeinkommen

    // Armeen
    for (const a of this.armies.values()) {
      if (a.arrive <= now) { this.armies.delete(a.id); this.arrive(a); }
    }

    // Bots
    for (const p of this.players) if (p.isBot && p.alive) p.bot.update(now);

    // Statistik alle 5 s
    if (Math.floor(now / 5) !== Math.floor((now - dt) / 5)) this.recordStats();

    this.checkVictory();
    this.flush();
  }

  arrive(a) {
    const r = this.regions[a.to];
    const attacker = this.players[a.owner];
    if (r.owner === a.owner) { r.troops += a.count; this.dirty.add(r.id); return; }
    if (r.owner >= 0 && attacker.allies.has(r.owner)) {
      // Unterstützung für Verbündete
      r.troops += a.count; this.dirty.add(r.id);
      this.event({ k: 'support', p: a.owner, q: r.owner, r: r.id, n: Math.round(a.count) });
      return;
    }
    const def = defenseMult(r);
    const luck = 0.92 + Math.random() * 0.16;
    const atk = a.count * luck;
    const defStrength = r.troops * def;
    const prevOwner = r.owner;
    if (atk > defStrength) {
      const remaining = Math.max(1, (atk - defStrength) / luck);
      attacker.kills += r.troops;
      r.troops = remaining;
      r.owner = a.owner;
      attacker.captured++;
      // Gebäude werden beschädigt (je eine Stufe weniger)
      r.b = r.b.map(l => Math.max(0, l - 1));
      if (r.capital) {
        r.capital = false;
        if (prevOwner >= 0) {
          const v = this.players[prevOwner];
          const loot = Math.floor(v.gold * 0.5);
          v.gold -= loot; attacker.gold += loot;
          v.capital = -1;
          this.event({ k: 'capital', p: a.owner, q: prevOwner, r: r.id, g: loot });
          // neue Hauptstadt: wertvollste verbleibende Region
          let best = null;
          for (const x of this.regions) if (x.owner === prevOwner && (!best || x.value > best.value)) best = x;
          if (best) { best.capital = true; v.capital = best.id; this.dirty.add(best.id); }
        }
      }
      this.event({ k: 'capture', p: a.owner, q: prevOwner, r: r.id });
      this.dirty.add(r.id);
      if (prevOwner >= 0) this.checkEliminated(this.players[prevOwner], attacker);
    } else {
      const lost = atk / def;
      attacker.kills += a.count;
      r.troops = Math.max(0, r.troops - lost);
      this.event({ k: 'repel', p: a.owner, q: prevOwner, r: r.id });
      this.dirty.add(r.id);
    }
  }
  checkEliminated(p, by) {
    if (!p.alive) return;
    if (this.regions.some(r => r.owner === p.id)) return;
    for (const a of this.armies.values()) if (a.owner === p.id) return;
    this.eliminate(p, by);
  }
  eliminate(p, by, surrendered = false) {
    p.alive = false;
    p.eliminatedAt = this.time;
    if (surrendered) {
      for (const r of this.regions) if (r.owner === p.id) { r.owner = -1; r.capital = false; this.dirty.add(r.id); }
      for (const a of [...this.armies.values()]) if (a.owner === p.id) this.armies.delete(a.id);
    }
    for (const o of this.players) { o.allies.delete(p.id); o.allyReq.delete(p.id); }
    p.allies.clear();
    if (by) by.gold += Math.floor(p.gold);
    p.gold = 0;
    this.event({ k: 'elim', p: p.id, by: by ? by.id : -1, s: surrendered });
    this.broadcastPlayers();
  }

  inPeace() { return this.time < this.settings.peace; }
  sendTroops(p, from, to, pct) {
    if (this.phase !== 'play' || !p.alive) return;
    const froms = Array.isArray(from) ? from.slice(0, 60) : [from];
    pct = Math.min(1, Math.max(0.05, pct || 0.5));
    for (const f of froms) {
      const src = this.regions[f | 0];
      if (!src || src.owner !== p.id || f === to) continue;
      const link = this.map.regions[f].adj.find(([o]) => o === to);
      if (!link) continue;
      if (this.inPeace() && this.regions[to].owner >= 0 && this.regions[to].owner !== p.id && !p.allies.has(this.regions[to].owner)) {
        return this.error(p.ws, 'Friedensphase: Andere Spieler können noch nicht angegriffen werden.');
      }
      const count = Math.floor(src.troops * pct);
      if (count < 1 || src.troops - count < 0) continue;
      src.troops -= count;
      this.dirty.add(src.id);
      this.launch(p.id, f, to, count, link[1]);
    }
  }
  launch(owner, from, to, count, type, flight = false) {
    const A = this.map.regions[from], B = this.map.regions[to];
    const dist = Math.hypot(A.cx - B.cx, A.cy - B.cy);
    const dur = flight ? Math.max(2, dist / 90) : travelTime(dist, type);
    const a = { id: this.armyId++, owner, from, to, count, start: this.time, arrive: this.time + dur, type: flight ? 4 : type };
    this.armies.set(a.id, a);
    this.newArmies.push(a);
    return a;
  }

  build(p, region, kind) {
    if (this.phase !== 'play' || !p.alive) return;
    const r = this.regions[region];
    const idx = ['factory', 'barracks', 'fort'].indexOf(kind);
    if (!r || r.owner !== p.id || idx < 0) return;
    const lvl = r.b[idx];
    if (lvl >= MAX_LEVEL) return;
    const cost = buildCost(kind, lvl);
    if (p.gold < cost) return this.error(p.ws, 'Nicht genug Gold.');
    p.gold -= cost;
    r.b[idx]++;
    this.dirty.add(r.id);
    this.event({ k: 'build', p: p.id, r: r.id, b: kind, l: r.b[idx] }, true);
  }

  useAbility(p, kind, target, source) {
    if (this.phase !== 'play' || !p.alive) return;
    const ab = ABILITIES[kind];
    if (!ab) return;
    if ((p.cooldowns[kind] || 0) > this.time) return this.error(p.ws, `${ab.name} lädt noch nach.`);
    if (p.gold < ab.cost) return this.error(p.ws, 'Nicht genug Gold.');
    const t = this.regions[target];
    const inRange = (range) => {
      for (const r of this.regions) if (r.owner === p.id) {
        const d = this.hopDistances(r.id, range);
        if (d.has(target)) return true;
      }
      return false;
    };
    switch (kind) {
      case 'airstrike':
      case 'sabotage': {
        if (this.inPeace() && t && t.owner >= 0) return this.error(p.ws, 'Friedensphase: noch keine Angriffe auf Spieler.');
        if (!t || t.owner === p.id || (t.owner >= 0 && p.allies.has(t.owner))) return this.error(p.ws, 'Ungültiges Ziel.');
        if (!inRange(ab.range)) return this.error(p.ws, 'Ziel außer Reichweite.');
        if (kind === 'airstrike') {
          t.troops *= 0.6;
        } else {
          const lv = t.b.map((l, i) => [l, i]).filter(([l]) => l > 0);
          if (!lv.length) return this.error(p.ws, 'Dort gibt es keine Gebäude.');
          lv.sort((a, b) => b[0] - a[0]);
          t.b[lv[0][1]]--;
        }
        this.dirty.add(t.id);
        break;
      }
      case 'mobilize':
        p.mobilizeUntil = this.time + ab.duration;
        break;
      case 'paradrop': {
        const s = this.regions[source | 0];
        if (!s || s.owner !== p.id || !t || t.id === s.id) return this.error(p.ws, 'Wähle zuerst eine eigene Region als Start.');
        if (!this.hopDistances(s.id, ab.range).has(t.id)) return this.error(p.ws, 'Ziel außer Reichweite (max. 4 Felder).');
        if (this.inPeace() && t.owner >= 0 && t.owner !== p.id && !p.allies.has(t.owner)) return this.error(p.ws, 'Friedensphase: noch keine Angriffe auf Spieler.');
        const count = Math.floor(s.troops * 0.5);
        if (count < 1) return;
        s.troops -= count; this.dirty.add(s.id);
        this.launch(p.id, s.id, t.id, count, 1, true);
        break;
      }
      default: return;
    }
    p.gold -= ab.cost;
    p.cooldowns[kind] = this.time + ab.cooldown;
    this.event({ k: 'ability', p: p.id, a: kind, r: t ? t.id : -1, q: t ? t.owner : -1 });
    this.sendPrivate(p);
  }

  diplomacy(p, otherId, action) {
    if (this.phase !== 'play' || !p.alive) return;
    const o = this.players[otherId];
    if (!o || o === p || !o.alive) return;
    if (action === 'propose') {
      if (p.allies.has(o.id)) return;
      if (p.allyReq.has(o.id)) return this.diplomacy(p, otherId, 'accept'); // gegenseitig
      o.allyReq.add(p.id);
      this.event({ k: 'allyReq', p: p.id, q: o.id }, true);
      if (o.isBot) o.bot.onAllianceRequest(p);
    } else if (action === 'accept') {
      if (!p.allyReq.has(o.id)) return;
      p.allyReq.delete(o.id);
      p.allies.add(o.id); o.allies.add(p.id);
      this.event({ k: 'ally', p: p.id, q: o.id });
    } else if (action === 'decline') {
      p.allyReq.delete(o.id);
      this.event({ k: 'allyDecline', p: p.id, q: o.id }, true);
    } else if (action === 'break') {
      if (!p.allies.has(o.id)) return;
      p.allies.delete(o.id); o.allies.delete(p.id);
      this.event({ k: 'betray', p: p.id, q: o.id });
    }
    this.broadcastPlayers();
  }

  recordStats() {
    const counts = new Array(this.players.length).fill(0), troops = new Array(this.players.length).fill(0);
    for (const r of this.regions) if (r.owner >= 0) { counts[r.owner]++; troops[r.owner] += r.troops; }
    for (const a of this.armies.values()) troops[a.owner] += a.count;
    for (const p of this.players) p.history.push([Math.round(this.time), counts[p.id], Math.round(troops[p.id])]);
  }

  checkVictory() {
    const alive = this.players.filter(p => p.alive);
    const total = this.regions.length;
    const counts = new Array(this.players.length).fill(0);
    for (const r of this.regions) if (r.owner >= 0) counts[r.owner]++;
    let winners = null, reason = '';
    if (alive.length <= 1) { winners = alive; reason = 'Letzter Überlebender'; }
    else if (alive.every(a => alive.every(b => a === b || a.allies.has(b.id)))) { winners = alive; reason = 'Allianzsieg'; }
    else {
      for (const p of alive) {
        let c = counts[p.id];
        for (const a of p.allies) c += counts[a];
        if (counts[p.id] / total * 100 >= this.settings.victory) { winners = [p]; reason = 'Weltherrschaft'; break; }
        if (c / total * 100 >= this.settings.victory && p.allies.size) { winners = [p, ...[...p.allies].map(i => this.players[i])]; reason = 'Allianz-Weltherrschaft'; break; }
      }
      if (!winners && this.settings.timeLimit > 0 && this.time >= this.settings.timeLimit * 60) {
        const best = Math.max(...alive.map(p => counts[p.id]));
        winners = alive.filter(p => counts[p.id] === best); reason = 'Zeitlimit';
      }
    }
    if (winners) this.endGame(winners, reason);
  }
  endGame(winners, reason) {
    this.recordStats();
    this.flush();
    this.phase = 'end';
    clearInterval(this.timer); this.timer = null;
    const counts = new Array(this.players.length).fill(0);
    for (const r of this.regions) if (r.owner >= 0) counts[r.owner]++;
    this.result = {
      t: 'end', reason, winners: winners.map(w => w.id), duration: Math.round(this.time),
      players: this.players.map(p => ({
        id: p.id, name: p.name, color: p.color, regions: counts[p.id], captured: p.captured, kills: Math.round(p.kills),
        alive: p.alive, eliminatedAt: p.eliminatedAt, history: p.history,
      })),
    };
    this.broadcast(this.result);
  }
  backToLobby() {
    this.phase = 'lobby';
    this.players = this.players.filter(p => p.isBot || p.connected);
    this.players.forEach((p, i) => { p.id = i; p.alive = true; });
    if (!this.players.some(p => p.id === this.hostId && !p.isBot)) { const h = this.players.find(p => !p.isBot); this.hostId = h ? h.id : null; }
    for (const p of this.players) if (p.ws) this.send(p.ws, { t: 'welcome', token: p.token, id: p.id, code: this.code });
    this.broadcastLobby();
  }

  // ---------- Netzwerk ----------
  event(e, privateToInvolved = false) {
    e.time = this.time;
    if (privateToInvolved) e.priv = true;
    this.events.push(e);
  }
  sysChat(text) {
    const entry = { from: -1, name: 'System', text, ts: Date.now() };
    this.chat.push(entry);
    this.broadcast({ t: 'chat', ...entry });
  }
  send(ws, obj) {
    if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.clients) this.send(ws, s);
  }
  error(ws, text) { this.send(ws, { t: 'error', text }); }

  visibleSet(p) {
    // Nebel des Krieges: eigene + verbündete Regionen und deren Nachbarn
    if (!this.settings.fog || !p || !p.alive) return null;
    const vis = new Set();
    for (const r of this.regions) {
      if (r.owner === p.id || p.allies.has(r.owner)) {
        vis.add(r.id);
        for (const [o] of this.map.regions[r.id].adj) vis.add(o);
      }
    }
    return vis;
  }
  regionTuple(r, vis) {
    const hidden = vis && !vis.has(r.id);
    return [r.id, r.owner, hidden ? -1 : Math.floor(r.troops), hidden ? -1 : r.b[0], hidden ? -1 : r.b[1], hidden ? -1 : r.b[2], r.capital ? 1 : 0];
  }
  armyTuple(a) { return [a.id, a.owner, a.from, a.to, Math.round(a.count), +a.start.toFixed(2), +a.arrive.toFixed(2), a.type]; }
  playersPublic() {
    const counts = new Array(this.players.length).fill(0), troops = new Array(this.players.length).fill(0);
    if (this.regions) for (const r of this.regions) if (r.owner >= 0) { counts[r.owner]++; troops[r.owner] += r.troops; }
    return this.players.map(p => ({
      id: p.id, name: p.name, color: p.color, isBot: p.isBot, connected: p.connected, alive: p.alive,
      regions: counts[p.id], troops: Math.round(troops[p.id]), allies: [...p.allies], capital: p.capital,
    }));
  }
  privateState(p) {
    return { t: 'me', gold: Math.floor(p.gold), cooldowns: p.cooldowns, mob: p.mobilizeUntil, allyReq: [...p.allyReq] };
  }
  sendPrivate(p) { if (p.ws) this.send(p.ws, this.privateState(p)); }
  broadcastPlayers() { this.broadcast({ t: 'players', list: this.playersPublic() }); }

  sendFullState(ws) {
    const p = ws.player;
    const base = { t: 'state', phase: this.phase, code: this.code, hostId: this.hostId, settings: this.settings, you: p ? p.id : -1, time: this.time };
    if (this.phase === 'lobby') return this.sendLobby(ws);
    const vis = this.visibleSet(p);
    base.regions = this.regions.map(r => this.regionTuple(r, vis));
    base.armies = [...this.armies.values()].filter(a => !vis || vis.has(a.from) || vis.has(a.to)).map(a => this.armyTuple(a));
    base.players = this.playersPublic();
    base.picks = this.picks ? [...this.picks.entries()] : [];
    base.draftLeft = this.phase === 'draft' ? Math.ceil((this.draftEnd - Date.now()) / 1000) : 0;
    this.send(ws, base);
    if (p) this.send(ws, this.privateState(p));
    if (this.phase === 'end' && this.result) this.send(ws, this.result);
  }

  flush() {
    const dirty = [...this.dirty];
    this.dirty.clear();
    const armies = this.newArmies || [];
    this.newArmies = [];
    const events = this.events;
    this.events = [];
    const sendPlayers = Math.floor(this.time * 2) !== Math.floor((this.time - 0.1 * this.settings.speed) * 2) || events.some(e => e.k === 'capture' || e.k === 'elim');
    const playersMsg = sendPlayers ? this.playersPublic() : null;
    const fog = this.settings.fog;
    const shared = !fog ? JSON.stringify({
      t: 'd', time: +this.time.toFixed(2),
      r: dirty.map(id => this.regionTuple(this.regions[id], null)),
      a: armies.map(a => this.armyTuple(a)),
      e: events.filter(e => !e.priv),
      p: playersMsg || undefined,
    }) : null;
    for (const ws of this.clients) {
      const p = ws.player;
      if (!fog) this.send(ws, shared);
      else {
        const vis = this.visibleSet(p);
        const prev = p ? p.sent.vis : null;
        const ids = new Set(dirty);
        // Regionen, deren Sichtbarkeit sich geändert hat, neu senden
        if (vis && prev) { for (const id of vis) if (!prev.has(id)) ids.add(id); for (const id of prev) if (!vis.has(id)) ids.add(id); }
        if (p) p.sent.vis = vis;
        this.send(ws, {
          t: 'd', time: +this.time.toFixed(2),
          r: [...ids].map(id => this.regionTuple(this.regions[id], vis)),
          a: armies.filter(a => !vis || vis.has(a.from) || vis.has(a.to) || a.owner === p.id).map(a => this.armyTuple(a)),
          e: events.filter(e => !e.priv),
          p: playersMsg || undefined,
        });
      }
      if (p) {
        const priv = events.filter(e => e.priv && (e.p === p.id || e.q === p.id));
        if (priv.length) this.send(ws, { t: 'ev', e: priv });
        if (sendPlayers) this.send(ws, this.privateState(p));
      }
    }
  }
}

export { BUILDINGS, BUILDING_KEYS };
