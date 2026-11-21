import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TICK_MS, COLORS, DEFAULT_SETTINGS, ERAS } from '../shared/rules.js';
import { World } from './world.js';
import { AI } from './ai.js';

// Spielstände liegen als JSON im Ordner saves/ (für die Desktop-Version später im Benutzerordner).
const SAVE_DIR = process.env.FL_SAVES || fileURLToPath(new URL('../saves', import.meta.url));
const AUTOSAVE_EVERY = 300; // Spielsekunden
const SUB_DELAY = 20000; // ms bis ein Bot einen getrennten Spieler vertritt
const safeFile = f => typeof f === 'string' && /^[\w.-]+\.json$/.test(f) && !f.endsWith('.meta.json') ? f : null;

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
    this.paused = false;
    this.subs = new Map(); // Spieler-ID -> Bot-Vertretung
    this.pendingSave = null; // gewählter Spielstand in der Lobby
    this.lastAutosave = 0;
  }

  // ---------- Lobby ----------
  addHuman(ws, name) {
    if (this.phase !== 'lobby') {
      // Wiedereinstieg ohne Token (z. B. anderes Gerät): freien Platz mit gleichem Namen übernehmen
      const n = String(name || '').trim().toLowerCase();
      const p = n && this.players.find(x => !x.isBot && !x.connected && x.name.toLowerCase() === n);
      if (!p) return this.error(ws, 'Das Spiel läuft bereits.', true);
      p.token = newToken();
      this.attach(ws, p);
      this.sysChat(`${p.name} ist wieder da.`);
      return;
    }
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
    if (this.phase === 'play' && this.subs.has(p.id)) {
      this.subs.delete(p.id);
      this.sysChat(`${p.name} übernimmt wieder selbst.`);
    }
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
    } else {
      this.sysChat(`${p.name} hat die Verbindung verloren.`);
      setTimeout(() => { if (!p.connected && this.phase === 'play' && this.players.includes(p)) this.addSub(p); }, SUB_DELAY);
    }
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
  addSub(p) {
    const w = this.world;
    if (!w || this.subs.has(p.id) || !w.P[p.id] || !w.P[p.id].alive) return;
    this.subs.set(p.id, new AI(w, p.id, 'normal', { defensive: true }));
    this.sysChat(`Ein Bot vertritt ${p.name}, bis er zurück ist (verteidigt nur).`);
  }
  lobbyState() {
    return {
      t: 'lobby', code: this.code, hostId: this.hostId, settings: this.settings, save: this.pendingSave ? this.pendingSave.meta : null,
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
        if (['random', 'continent', 'lakes', 'highlands', 'forest', 'islands'].includes(s.mapType)) st.mapType = s.mapType;
        if (['low', 'normal', 'high'].includes(s.resources)) st.resources = s.resources;
        if ('startEra' in s) st.startEra = Math.round(num(s.startEra, 0, ERAS.length - 1, st.startEra));
        if ('speed' in s) st.speed = num(s.speed, 0.5, 3, st.speed);
        if (['pause', 'nopause', 'off'].includes(s.conferences)) st.conferences = s.conferences;
        if ('confMin' in s && [3, 5, 8].includes(+s.confMin)) st.confMin = +s.confMin;
        if ('nukes' in s) st.nukes = s.nukes === true || s.nukes === 'true' || s.nukes === 'on';
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
        if (this.pendingSave) return this.startGame();
        if (this.players.length < 2) return this.error(ws, 'Mindestens 2 Teilnehmer (Spieler oder Bots) nötig.');
        if (this.settings.mode === 'teams' && new Set(this.players.map(x => x.team)).size < 2) return this.error(ws, 'Im Teammodus braucht es mindestens 2 Teams.');
        return this.startGame();
      case 'cmd':
        if (this.phase === 'play' && this.world && !this.paused) this.world.command(p.id, msg);
        return;
      case 'pause':
        if (!isHost || this.phase !== 'play') return;
        this.paused = !this.paused;
        this.broadcast({ t: 'pause', on: this.paused, by: p.name });
        return this.sysChat(this.paused ? `${p.name} hat das Spiel pausiert.` : `${p.name} setzt das Spiel fort.`);
      case 'save': {
        if (!isHost || this.phase !== 'play') return;
        try { const f = this.saveGame(false); this.sysChat(`Spiel gespeichert (${f}).`); } catch (e) { this.error(ws, 'Speichern fehlgeschlagen: ' + e.message); }
        return;
      }
      case 'saves':
        return this.send(ws, { t: 'saves', list: this.listSaves() });
      case 'loadSave': {
        if (!isHost || this.phase !== 'lobby') return;
        if (msg.file == null) { this.pendingSave = null; return this.broadcastLobby(); }
        const f = safeFile(msg.file);
        const meta = f && this.readMeta(f);
        if (!meta) return this.error(ws, 'Spielstand nicht gefunden.');
        this.pendingSave = { file: f, meta };
        this.sysChat(`Spielstand gewählt: ${meta.label}. Spieler werden über ihren Namen ihrem Reich zugeordnet.`);
        return this.broadcastLobby();
      }
      case 'debug': // nur für automatisierte Tests (Server mit FL_DEBUG=1 starten)
        if (!process.env.FL_DEBUG || !this.world) return;
        if (msg.op === 'contact') this.world.makeContact(p.id, msg.with | 0);
        if (msg.op === 'event') this.world.P[p.id].nextEvent = this.world.time;
        if (msg.op === 'res') this.world.P[p.id].res = { food: 9999, wood: 9999, stone: 9999, gold: 9999 };
        return;
      case 'dip': {
        if (this.phase !== 'play' || !this.world || this.paused) return;
        const out = this.world.diplomacy(p.id, msg);
        if (out && out.to) for (const pid of out.to) { const q = this.players[pid]; if (q && q.ws) this.send(q.ws, { ...out.msg, with: pid === out.msg.from ? out.to.find(x => x !== pid) : out.msg.from }); }
        return;
      }
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
    if (this.pendingSave) return this.startFromSave();
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
    this.subs.clear(); this.paused = false; this.lastAutosave = 0;
    for (const ws of this.clients) { ws.sent = null; this.sendStart(ws); }
    this.sysChat(`Karte: ${this.world.mapInfo.name}. Viel Erfolg!`);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }
  sendStart(ws) {
    if (!this.world) return;
    ws.sent = null;
    ws.pid = ws.player ? ws.player.id : -1;
    this.send(ws, { ...this.world.initPayload(ws.pid), hostId: this.hostId });
    if (this.paused) this.send(ws, { t: 'pause', on: true });
    if (this.phase === 'end' && this.result) this.send(ws, this.result);
  }
  tick() {
    const w = this.world;
    if (!w || this.phase !== 'play' || this.paused) return;
    const t0 = performance.now();
    const confPause = w.conf && w.conf.paused;
    if (confPause) {
      for (const ai of this.ais) ai.conference && ai.conference();
      w.confStep(TICK_MS / 1000);
    } else {
      for (const ai of this.ais) ai.update();
      for (const ai of this.subs.values()) ai.update();
      w.tick();
    }
    w.computeVision();
    const evs = w.events; w.events = [];
    const rd = w.resourceDelta();
    const sendPriv = w.tickNo % 3 === 0;
    const sendPlayers = w.tickNo % 10 === 0 || evs.some(e => e.k === 'era' || e.k === 'defeat' || e.k === 'choice');
    const playersMsg = sendPlayers ? w.playersPublic() : null;
    const provMsg = w.provDirty ? Array.from(w.provOwner) : null; w.provDirty = false;
    for (const ws of this.clients) {
      if (ws.readyState !== 1) continue;
      ws.pid = ws.player ? ws.player.id : -1;
      const msg = w.snapshot(ws);
      if (rd.ch.length) msg.rc = rd.ch;
      if (rd.rm.length) msg.rr = rd.rm;
      const e = w.eventsFor(ws.pid, evs);
      if (e.length) msg.e = e;
      if (playersMsg) msg.p = playersMsg;
      if (provMsg) msg.po = provMsg;
      this.send(ws, msg);
      if (sendPriv && ws.pid >= 0 && w.P[ws.pid]) this.send(ws, w.privateState(w.P[ws.pid]));
    }
    const win = w.winners();
    if (win) return this.endGame(win);
    if (w.time - this.lastAutosave >= AUTOSAVE_EVERY) {
      this.lastAutosave = w.time;
      try { this.saveGame(true); } catch (e) { console.error('Autosave fehlgeschlagen:', e.message); }
    }
    const ms = performance.now() - t0;
    this.load = this.load ? this.load * 0.95 + ms * 0.05 : ms;
  }
  endGame(winners) {
    const w = this.world;
    w.recordStats();
    this.phase = 'end';
    clearInterval(this.timer); this.timer = null;
    this.subs.clear(); this.paused = false;
    this.result = {
      t: 'end', reason: w.winReason || 'Sieg', winners: winners.map(p => p.id), duration: Math.round(w.time), mode: this.settings.mode,
      players: w.P.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, alive: p.alive, era: p.era, culture: p.culture, nation: p.nation, stats: p.stats, score: w.score(p), history: p.history, defeatedAt: p.defeatedAt, rep: p.rep })),
      chron: w.chron, awards: this.awards(w),
    };
    this.broadcast(this.result);
    // Steam-Errungenschaften für die Sieger
    const hard = this.players.some(p => p.isBot && p.difficulty === 'hard');
    for (const p of winners) {
      const q = this.players[p.id]; if (!q || q.isBot || !q.ws) continue;
      this.send(q.ws, { t: 'ach', id: 'FIRST_WIN' });
      if (hard) this.send(q.ws, { t: 'ach', id: 'WIN_HARD' });
    }
  }
  // Auszeichnungen am Spielende (nur vergeben, wenn der Wert > 0 ist)
  awards(w) {
    const defs = [
      ['🗡', 'Größter Verräter', p => p.stats.breaches || 0],
      ['🕊', 'Friedensstifter', p => p.stats.treaties || 0],
      ['🌉', 'Brückenbauer', p => p.stats.bridges || 0],
      ['⚔', 'Feldherr', p => p.stats.kills],
      ['🏗', 'Baumeister', p => p.stats.built],
      ['💰', 'Sammler', p => p.stats.gathered],
      ['🕵', 'Meisterspion', p => p.stats.spied || 0],
      ['🛡', 'Eiserne Verteidigung', p => p.alive ? Math.max(0, p.stats.kills - p.stats.lost) : 0],
    ];
    const out = [];
    for (const [icon, name, f] of defs) {
      let best = null, bv = 0;
      for (const p of w.P) { const v = f(p); if (v > bv) { bv = v; best = p; } }
      if (best) out.push({ icon, name, p: best.id, v: Math.round(bv) });
    }
    return out;
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

  // ---------- Speichern / Laden ----------
  saveGame(auto) {
    const w = this.world;
    mkdirSync(SAVE_DIR, { recursive: true });
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
    const file = auto ? `auto_${this.code}.json` : `${stamp}_${this.code}.json`;
    const mins = Math.floor(w.time / 60);
    const meta = {
      file, auto, date: d.toISOString(), time: Math.round(w.time), map: w.mapInfo.name, code: this.code,
      label: `${auto ? 'Autosave' : 'Spielstand'} ${d.toLocaleDateString('de-DE')} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${w.mapInfo.name} · ${Math.floor(mins / 60)} h ${mins % 60} min`,
      players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, isBot: p.isBot, difficulty: p.difficulty, era: w.P[p.id] ? w.P[p.id].era : 0, alive: w.P[p.id] ? w.P[p.id].alive : false })),
    };
    // erst in Temp-Datei schreiben, dann umbenennen: kein halber Spielstand bei Absturz
    const tmp = join(SAVE_DIR, file + '.tmp');
    writeFileSync(tmp, JSON.stringify({ meta, world: w.serialize() }));
    renameSync(tmp, join(SAVE_DIR, file));
    writeFileSync(join(SAVE_DIR, file.replace(/\.json$/, '.meta.json')), JSON.stringify(meta));
    return file;
  }
  readMeta(file) {
    const m = join(SAVE_DIR, file.replace(/\.json$/, '.meta.json'));
    if (!existsSync(m) || !existsSync(join(SAVE_DIR, file))) return null;
    try { return JSON.parse(readFileSync(m, 'utf8')); } catch { return null; }
  }
  listSaves() {
    if (!existsSync(SAVE_DIR)) return [];
    return readdirSync(SAVE_DIR).filter(f => f.endsWith('.meta.json')).map(f => this.readMeta(basename(f).replace(/\.meta\.json$/, '.json'))).filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
      .map(m => ({ file: m.file, label: m.label, players: m.players.map(p => ({ name: p.name, isBot: p.isBot, alive: p.alive, era: p.era })) }));
  }
  startFromSave() {
    let data;
    try { data = JSON.parse(readFileSync(join(SAVE_DIR, this.pendingSave.file), 'utf8')); } catch { this.pendingSave = null; this.broadcastLobby(); return this.sysChat('Spielstand konnte nicht gelesen werden.'); }
    const slots = data.meta.players;
    const humans = this.players.filter(p => !p.isBot);
    const used = new Set();
    const host = this.players[this.hostId];
    const np = slots.map((s, i) => {
      const p = { id: i, name: s.name, color: s.color, team: s.team, isBot: s.isBot, difficulty: s.difficulty, token: null, ws: null, connected: s.isBot };
      if (!s.isBot) {
        const h = humans.find(x => !used.has(x) && x.name.toLowerCase() === s.name.toLowerCase());
        if (h) { used.add(h); p.token = h.token; p.ws = h.ws; p.connected = h.connected; }
      }
      return p;
    });
    if (!used.size) return this.sysChat('Kein Spielername passt zum Spielstand. Tretet mit denselben Namen bei wie beim Speichern.');
    // Lobby-Spieler ohne Platz im Spielstand schauen zu
    for (const h of humans) if (!used.has(h) && h.ws) { h.ws.player = null; this.send(h.ws, { t: 'welcome', token: null, id: -1, code: this.code }); }
    this.players = np;
    const hostP = np.find(p => p.ws && host && p.ws === host.ws) || np.find(p => p.ws);
    this.hostId = hostP ? hostP.id : null;
    for (const p of np) if (p.ws) { p.ws.player = p; this.send(p.ws, { t: 'welcome', token: p.token, id: p.id, code: this.code }); }
    this.settings = { ...this.settings, ...data.world.settings };
    this.world = World.restore(this, data.world);
    this.phase = 'play';
    this.ais = np.filter(p => p.isBot).map(p => new AI(this.world, p.id, p.difficulty || this.settings.botDifficulty));
    this.subs.clear(); this.paused = false; this.lastAutosave = this.world.time;
    for (const p of np) if (!p.isBot && !p.connected) this.addSub(p);
    this.pendingSave = null;
    for (const ws of this.clients) { ws.sent = null; this.sendStart(ws); }
    this.sysChat(`Spielstand geladen: ${data.meta.label}. Weiter geht's!`);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
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
