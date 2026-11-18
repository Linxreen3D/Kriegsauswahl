import { TICK_MS, COLORS, DEFAULT_SETTINGS } from '../shared/rules.js';
import { World } from './world.js';
import { AI } from './ai.js';

const BOT_NAMES = ['General Ahorn', 'Admiral Kiesel', 'Marschall Eiche', 'Oberst Birke', 'Major Linde', 'Kommandant Fels',
  'General Sturm', 'Admiral Welle', 'Feldherrin Nova', 'Generalin Aster', 'Kapitän Riff', 'Oberst Flint', 'Fürstin Mira',
  'König Odo', 'Khan Taro', 'Herzogin Ilse', 'Graf Bruno', 'Zarin Vera', 'Konsul Max', 'Sultanin Ada', 'Häuptling Rok', 'Lord Emil'];

let tokenCounter = 0;
const newToken = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + (tokenCounter++).toString(36);

export class Room {
  constructor(code, onEmpty) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.players = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = 'lobby';
    this.hostId = null;
    this.clients = new Set();
    this.chat = [];
  }

  // ---------- Lobby ----------
  addHuman(ws, name) {
    if (this.phase !== 'lobby') return this.error(ws, 'Das Spiel läuft bereits.', true);
    if (this.players.length >= this.settings.maxPlayers) return this.error(ws, 'Der Raum ist voll.', true);
    const p = this.createPlayer(name, false);
    p.token = newToken();
    if (this.hostId === null) this.hostId = p.id;
    this.attach(ws, p);
    this.broadcastLobby();
    this.sysChat(`${p.name} ist beigetreten.`);
  }
  createPlayer(name, isBot) {
    const used = new Set(this.players.map(p => p.color));
    const color = COLORS.find(c => !used.has(c)) || COLORS[this.players.length % COLORS.length];
    const p = { id: this.players.length, name: String(name || 'Spieler').slice(0, 20).trim() || 'Spieler', color, isBot, team: 1 + (this.players.length % 2), token: null, ws: null, connected: isBot };
    this.players.push(p);
    return p;
  }
  attach(ws, p) {
    if (p.ws && p.ws !== ws) { try { p.ws.close(4000, 'replaced'); } catch { /* egal */ } this.clients.delete(p.ws); }
    p.ws = ws; p.connected = true;
    ws.player = p; ws.room = this; ws.sent = null;
    this.clients.add(ws);
    this.send(ws, { t: 'welcome', token: p.token, id: p.id, code: this.code });
    if (this.phase === 'lobby') this.send(ws, this.lobbyState());
    else this.sendStart(ws);
    this.send(ws, { t: 'chatlog', list: this.chat.slice(-60) });
  }
  reconnect(ws, token) {
    const p = this.players.find(x => x.token === token);
    if (!p) return false;
    this.attach(ws, p);
    if (this.phase === 'lobby') this.broadcastLobby(); else this.sysChat(`${p.name} ist wieder da.`);
    return true;
  }
  disconnect(ws) {
    this.clients.delete(ws);
    const p = ws.player;
    if (!p || p.ws !== ws) return this.checkEmpty();
    p.ws = null; p.connected = false;
    if (this.phase === 'lobby') {
      setTimeout(() => { if (!p.connected && this.phase === 'lobby' && this.players.includes(p)) this.removePlayer(p); }, 15000);
      this.broadcastLobby();
    } else this.sysChat(`${p.name} hat die Verbindung verloren.`);
    this.checkEmpty();
  }
  leave(ws) {
    const p = ws.player;
    this.clients.delete(ws);
    ws.player = null; ws.room = null;
    if (!p) return;
    p.ws = null; p.connected = false;
    if (this.phase === 'lobby') this.removePlayer(p);
    else {
      this.sysChat(`${p.name} hat das Spiel verlassen.`);
      if (this.world && this.world.P[p.id] && this.world.P[p.id].alive) this.world.defeat(this.world.P[p.id], true);
    }
    this.checkEmpty();
  }
  removePlayer(p) {
    this.players = this.players.filter(x => x !== p);
    this.players.forEach((x, i) => { x.id = i; });
    if (!this.players.some(x => x.id === this.hostId && !x.isBot && x === this.players[this.hostId]) || p.id === this.hostId) {
      const h = this.players.find(x => !x.isBot);
      this.hostId = h ? h.id : null;
    }
    for (const x of this.players) if (x.ws) this.send(x.ws, { t: 'welcome', token: x.token, id: x.id, code: this.code });
    this.broadcastLobby();
    this.checkEmpty();
  }
  checkEmpty() {
    if (this.players.some(p => !p.isBot && p.connected)) return;
    clearTimeout(this.emptyTimer);
    this.emptyTimer = setTimeout(() => {
      if (!this.players.some(p => !p.isBot && p.connected)) { clearInterval(this.timer); this.onEmpty(this); }
    }, this.phase === 'lobby' ? 20000 : 5 * 60000);
  }
  lobbyState() {
    return {
      t: 'lobby', code: this.code, hostId: this.hostId, settings: this.settings,
      players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, isBot: p.isBot, connected: p.connected, difficulty: p.difficulty })),
    };
  }
  broadcastLobby() { this.broadcast(this.lobbyState()); }

  handle(ws, msg) {
    const p = ws.player;
    if (!p) return;
    const isHost = p.id === this.hostId;
    switch (msg.t) {
      case 'chat': {
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) return;
        const entry = { from: p.id, name: p.name, color: p.color, text, ts: Date.now(), team: !!msg.team };
        this.chat.push(entry); if (this.chat.length > 200) this.chat.shift();
        if (msg.team && this.world) {
          const myTeam = this.world.P[p.id].team;
          for (const ws2 of this.clients) if (ws2.player && this.world.P[ws2.player.id] && this.world.P[ws2.player.id].team === myTeam) this.send(ws2, { t: 'chat', ...entry });
        } else this.broadcast({ t: 'chat', ...entry });
        return;
      }
      case 'color': {
        if (this.phase !== 'lobby' || !COLORS.includes(msg.color)) return;
        const target = msg.player != null && isHost ? this.players[msg.player] : p;
        if (!target || (target !== p && !target.isBot)) return;
        if (this.players.some(x => x !== target && x.color === msg.color)) return;
        target.color = msg.color;
        return this.broadcastLobby();
      }
      case 'team': {
        if (this.phase !== 'lobby') return;
        const target = msg.player != null && isHost ? this.players[msg.player] : p;
        if (!target || (target !== p && !target.isBot)) return;
        target.team = Math.min(8, Math.max(1, msg.team | 0));
        return this.broadcastLobby();
      }
      case 'settings': {
        if (!isHost || this.phase !== 'lobby') return;
        const s = msg.settings || {}, st = this.settings;
        const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
        if (['ffa', 'teams', 'armageddon'].includes(s.mode)) st.mode = s.mode;
        if (['auto', 'small', 'medium', 'large', 'huge'].includes(s.mapSize)) st.mapSize = s.mapSize;
        if (['random', 'continent', 'lakes', 'highlands', 'forest'].includes(s.mapType)) st.mapType = s.mapType;
        if (['low', 'normal', 'high'].includes(s.resources)) st.resources = s.resources;
        if ('startEra' in s) st.startEra = Math.round(num(s.startEra, 0, 4, st.startEra));
        if ('speed' in s) st.speed = num(s.speed, 0.5, 3, st.speed);
        if ('armageddonMin' in s) st.armageddonMin = Math.round(num(s.armageddonMin, 1, 90, st.armageddonMin));
        if (['easy', 'normal', 'hard'].includes(s.botDifficulty)) { st.botDifficulty = s.botDifficulty; for (const x of this.players) if (x.isBot) x.difficulty = s.botDifficulty; }
        return this.broadcastLobby();
      }
      case 'addBot': {
        if (!isHost || this.phase !== 'lobby' || this.players.length >= this.settings.maxPlayers) return;
        const used = new Set(this.players.map(x => x.name));
        const b = this.createPlayer(BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + this.players.length, true);
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
        if (this.settings.mode === 'teams' && new Set(this.players.map(x => x.team)).size < 2) return this.error(ws, 'Im Teammodus braucht es mindestens 2 Teams.');
        return this.startGame();
      case 'cmd':
        if (this.phase === 'play' && this.world) this.world.command(p.id, msg);
        return;
      case 'surrender':
        if (this.phase === 'play' && this.world) this.world.defeat(this.world.P[p.id], true);
        return;
      case 'rematch':
        if (!isHost || this.phase !== 'end') return;
        return this.backToLobby();
      default:
    }
  }

  // ---------- Spiel ----------
  startGame() {
    // Reihenfolge der Startpositionen mischen, Teams nebeneinander
    this.phase = 'play';
    const seed = (Math.random() * 2 ** 31) | 0;
    let order = this.players.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (this.settings.mode === 'teams') order.sort((a, b) => a.team - b.team);
    // World erwartet Startplätze in Spielerreihenfolge
    const ordered = order.map(p => p);
    this.world = new World(this, ordered.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, team: p.team })), this.settings, seed);
    // World.P ist nach Reihenfolge `ordered` aufgebaut → auf Spieler-ID umsortieren
    const P = new Array(this.players.length);
    for (const pl of this.world.P) P[pl.id] = pl;
    this.world.P = P;
    this.ais = this.players.filter(p => p.isBot).map(p => new AI(this.world, p.id, p.difficulty || this.settings.botDifficulty));
    for (const ws of this.clients) { ws.sent = null; this.sendStart(ws); }
    this.sysChat(`Karte: ${this.world.mapInfo.name}. Viel Erfolg!`);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }
  sendStart(ws) {
    if (!this.world) return;
    ws.sent = null;
    ws.pid = ws.player ? ws.player.id : -1;
    this.send(ws, this.world.initPayload(ws.pid));
    if (this.phase === 'end' && this.result) this.send(ws, this.result);
  }
  tick() {
    const w = this.world;
    if (!w || this.phase !== 'play') return;
    const t0 = performance.now();
    for (const ai of this.ais) ai.update();
    w.tick();
    w.computeVision();
    const evs = w.events; w.events = [];
    const rd = w.resourceDelta();
    const sendPriv = w.tickNo % 3 === 0;
    const sendPlayers = w.tickNo % 10 === 0 || evs.some(e => e.k === 'era' || e.k === 'defeat' || e.k === 'choice');
    const playersMsg = sendPlayers ? w.playersPublic() : null;
    for (const ws of this.clients) {
      if (ws.readyState !== 1) continue;
      ws.pid = ws.player ? ws.player.id : -1;
      const msg = w.snapshot(ws);
      if (rd.ch.length) msg.rc = rd.ch;
      if (rd.rm.length) msg.rr = rd.rm;
      const e = w.eventsFor(ws.pid, evs);
      if (e.length) msg.e = e;
      if (playersMsg) msg.p = playersMsg;
      this.send(ws, msg);
      if (sendPriv && ws.pid >= 0 && w.P[ws.pid]) this.send(ws, w.privateState(w.P[ws.pid]));
    }
    const win = w.winners();
    if (win) this.endGame(win);
    const ms = performance.now() - t0;
    this.load = this.load ? this.load * 0.95 + ms * 0.05 : ms;
  }
  endGame(winners) {
    const w = this.world;
    w.recordStats();
    this.phase = 'end';
    clearInterval(this.timer); this.timer = null;
    this.result = {
      t: 'end', winners: winners.map(p => p.id), duration: Math.round(w.time), mode: this.settings.mode,
      players: w.P.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, alive: p.alive, era: p.era, culture: p.culture, nation: p.nation, stats: p.stats, score: w.score(p), history: p.history, defeatedAt: p.defeatedAt })),
    };
    this.broadcast(this.result);
  }
  backToLobby() {
    this.phase = 'lobby';
    this.world = null;
    this.players = this.players.filter(p => p.isBot || p.connected);
    this.players.forEach((p, i) => { p.id = i; });
    if (!this.players.some(p => p.id === this.hostId && !p.isBot)) { const h = this.players.find(p => !p.isBot); this.hostId = h ? h.id : null; }
    for (const p of this.players) if (p.ws) this.send(p.ws, { t: 'welcome', token: p.token, id: p.id, code: this.code });
    this.broadcastLobby();
  }

  // ---------- Netzwerk ----------
  sysChat(text) {
    const entry = { from: -1, name: 'System', text, ts: Date.now() };
    this.chat.push(entry);
    this.broadcast({ t: 'chat', ...entry });
  }
  send(ws, obj) { if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  broadcast(obj) { const s = JSON.stringify(obj); for (const ws of this.clients) this.send(ws, s); }
  error(ws, text, fatal = false) { this.send(ws, { t: 'error', text, fatal }); }
}
