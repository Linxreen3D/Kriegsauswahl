import { Renderer3D } from './render3d.js';
import { sfx } from './sound.js';
import {
  COLORS, RES, RES_NAMES, RES_ICONS, ERAS, CULTURES, NATIONS, LINES, UNIQUE, UNIQUE_MIN_ERA, BUILDINGS, BUILD_ORDER,
  RESOURCE_KINDS, TYPES, WONDER, WONDER_ERA, LATE_STAGE, unitStats, buildingStats, playerMods, trainable, unitKey, TYPE_INDEX, eraCost, isProducer, FORMATIONS, FORMATION_KEYS, VET_RANKS, SEASONS, seasonAt, TERRAIN,
} from '/shared/rules.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- Symbole ----------------
const UNIT_ICONS = {
  worker: ['👷', '👷', '👷', '👷', '👷', '👷', '👷', '👷'],
  inf: ['🪓', '🪓', '🛡', '⚔', '🗡', '🪖', '🪖', '🪖'],
  spear: ['', '🔱', '🔱', '🔱', '🔱', '🔱', '🧨', '🚀'],
  art: ['', '', '', '', '', '💣', '💥', '💥'],
  med: ['', '🌿', '🌿', '✚', '✚', '✚', '✚', '✚'],
  rng: ['🪨', '🏹', '🏹', '🏹', '🔫', '🔫', '🔫', '🔫'],
  cav: ['', '🛞', '🐎', '🏇', '🏇', '🏇', '🚜', '🚜'],
  sie: ['', '', '🪨', '🪵', '💣', '💣', '💥', '🚀'],
};
const UNIQUE_ICONS = { uq_steppe: '🏹', uq_traders: '💰', uq_builders: '🐏', uq_warriors: '😡' };
const BLD_ICONS = { town: '🏰', house: '🏠', storage: '📦', farm: '🌾', outpost: '🚩', road: '🛣', bridge: '🌉', barracks: '⚔', range: '🎯', stable: '🐴', tower: '🗼', workshop: '⚙', wall: '🧱' };
function iconOf(def) {
  if (def.kind === 'b') return BLD_ICONS[def.key];
  if (def.unique) return UNIQUE_ICONS[def.unique];
  return UNIT_ICONS[def.line][def.era] || '•';
}
function keyIcon(key) { return iconOf(TYPES[TYPE_INDEX[key]]); }

// ---------------- Zustand ----------------
const G = {
  phase: 'home', you: -1, code: null, hostId: -1, settings: {}, players: [],
  W: 0, H: 0, terrain: null, res: new Map(), resAt: null, bldAt: null, ents: new Map(),
  me: { res: { food: 0, wood: 0, stone: 0, gold: 0 }, pop: 0, cap: 0, era: 0, q: [], alive: true },
  vis: null, explored: null, selected: new Set(), groups: {}, time: 0,
  allied(o) { const a = this.players[this.you], b = this.players[o]; return o === this.you || (a && b && a.team === b.team); },
};
const UI = { box: null, ghost: null, rally: null, markers: [], pings: [], mode: null, lastAlert: null };
let renderer = null, ws = null, reconnectDelay = 500;
let wantSession = null;
try { wantSession = JSON.parse(sessionStorage.getItem('fl_session') || 'null'); } catch { /* egal */ }

// ---------------- Netzwerk ----------------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    reconnectDelay = 500;
    $('connLost').classList.add('hidden');
    if (wantSession) send({ t: 'join', code: wantSession.code, token: wantSession.token, name: getName() });
    else autoJoinFromUrl();
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
  ws.onclose = () => {
    if (G.phase !== 'home') $('connLost').classList.remove('hidden');
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(5000, reconnectDelay * 1.6);
  };
}
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function cmd(c) { send({ t: 'cmd', ...c }); }
function getName() {
  const v = $('nameInput').value.trim();
  if (v) try { localStorage.setItem('fl_name', v); } catch { /* egal */ }
  return v || 'Kommandant';
}
function autoJoinFromUrl() {
  const code = new URLSearchParams(location.search).get('r');
  if (code && !G.autoJoined) {
    G.autoJoined = true;
    $('codeInput').value = code.toUpperCase();
    try { if (localStorage.getItem('fl_name')) send({ t: 'join', code, name: getName() }); } catch { /* egal */ }
  }
}
function handle(m) {
  switch (m.t) {
    case 'welcome':
      G.you = m.id; G.code = m.code;
      wantSession = { code: m.code, token: m.token };
      try { sessionStorage.setItem('fl_session', JSON.stringify(wantSession)); } catch { /* egal */ }
      history.replaceState(null, '', '?r=' + m.code);
      break;
    case 'lobby': onLobby(m); break;
    case 'start': onStart(m); break;
    case 'd': onDelta(m); break;
    case 'me': onMe(m); break;
    case 'end': onEnd(m); break;
    case 'chat': addChat(m); break;
    case 'pause': G.paused = m.on; $('pauseOverlay').classList.toggle('hidden', !m.on); $('pauseBtn').textContent = m.on ? '▶ Fortsetzen' : '⏸ Pause'; break;
    case 'saves': showSaves(m.list); break;
    case 'chatlog': $('lobbyChatLog').innerHTML = ''; m.list.forEach(c => addChat(c, true)); break;
    case 'error':
      if (m.fatal) { wantSession = null; sessionStorage.removeItem('fl_session'); showScreen('home'); $('homeError').textContent = m.text; }
      else notice(m.text, 'bad');
      break;
    case 'kicked':
      wantSession = null; sessionStorage.removeItem('fl_session');
      showScreen('home'); $('homeError').textContent = 'Du wurdest aus dem Raum entfernt.';
      break;
    default:
  }
}

function updateSeason(time) {
  if (time == null) return;
  const s = seasonAt(time);
  if (s !== G.season) {
    const first = G.season === -1; G.season = s;
    const se = SEASONS[s];
    $('seasonLabel').innerHTML = `<span class="ri">${se.icon}</span>${se.name}`; $('seasonLabel').title = `${se.name}: ${se.desc}`;
    renderer.setWinter(s === 3 ? 1 : 0);
    if (!first) notice(`${se.icon} ${se.name}: ${se.desc}`);
  }
  // Provinz unter der Kameramitte
  if (G.prov && renderer.cam) {
    const x = Math.floor(renderer.cam.x), y = Math.floor(renderer.cam.y);
    const pv = x >= 0 && y >= 0 && x < G.W && y < G.H ? G.prov[y * G.W + x] : 65535;
    let txt = '';
    if (pv !== 65535 && G.provinces[pv]) { const o = G.provOwner[pv], p = o >= 0 ? G.players[o] : null; txt = `${G.provinces[pv].name}${p ? ' · ' + p.name : ' · frei'}`; }
    if ($('provLabel').textContent !== txt) $('provLabel').textContent = txt;
  }
}
function fmtDur(s) { s = Math.round(s); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) + ' s' : ''}`; }
function showSaves(list) {
  $('savesList').innerHTML = list.length ? list.map(x => `<button class="btn" data-file="${esc(x.file)}">${esc(x.label)}<span class="who">${x.players.map(p => esc(p.name) + ' · ' + esc(ERAS[p.era] ? ERAS[p.era].short : '') + (p.alive ? '' : ' ☠')).join(' | ')}</span></button>`).join('') : '<p class="muted">Noch keine Spielstände vorhanden.</p>';
  $('savesDlg').classList.remove('hidden');
}

function showScreen(name) {
  if (name === 'home') G.phase = 'home';
  $('home').classList.toggle('hidden', name !== 'home');
  $('lobby').classList.toggle('hidden', name !== 'lobby');
  $('hud').classList.toggle('hidden', name !== 'game');
  if (name !== 'game') { $('endScreen').classList.add('hidden'); $('choice').classList.add('hidden'); }
}

// ---------------- Lobby ----------------
const SETTINGS_DEF = [
  { key: 'mode', label: 'Spielmodus', type: 'select', options: [['ffa', 'Jeder gegen jeden'], ['teams', 'Teams'], ['armageddon', 'Armageddon (Meteore)']] },
  { key: 'mapType', label: 'Kartentyp', type: 'select', options: [['random', 'Zufällig'], ['continent', 'Kontinent'], ['lakes', 'Seenplatte'], ['highlands', 'Hochland'], ['forest', 'Urwald']] },
  { key: 'mapSize', label: 'Kartengröße', type: 'select', options: [['auto', 'Automatisch'], ['small', 'Klein'], ['medium', 'Mittel'], ['large', 'Groß'], ['huge', 'Riesig']] },
  { key: 'resources', label: 'Startressourcen', type: 'select', options: [['low', 'Wenig'], ['normal', 'Normal'], ['high', 'Viel']] },
  { key: 'startEra', label: 'Startepoche', type: 'select', options: ERAS.map((e, i) => [String(i), e.name]) },
  { key: 'speed', label: 'Spieltempo', type: 'range', min: 0.5, max: 3, step: 0.25, fmt: v => v + '×' },
  { key: 'armageddonMin', label: 'Meteore ab (Armageddon)', type: 'range', min: 1, max: 60, step: 1, fmt: v => v + ' min' },
  { key: 'botDifficulty', label: 'Bot-Schwierigkeit', type: 'select', options: [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']] },
];
function buildSettingsForm() {
  $('settingsForm').innerHTML = SETTINGS_DEF.map(d => {
    if (d.type === 'range') return `<div class="setting"><label for="s_${d.key}">${d.label}</label><output id="o_${d.key}"></output><input type="range" id="s_${d.key}" min="${d.min}" max="${d.max}" step="${d.step}"></div>`;
    return `<div class="setting"><label for="s_${d.key}">${d.label}</label><select id="s_${d.key}">${d.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`;
  }).join('');
  for (const d of SETTINGS_DEF) {
    const el = $('s_' + d.key);
    el.addEventListener(d.type === 'range' ? 'input' : 'change', () => {
      let v = d.type === 'range' ? Number(el.value) : el.value;
      if (d.key === 'startEra') v = Number(v);
      if (d.type === 'range') $('o_' + d.key).textContent = d.fmt(v);
      clearTimeout(el._t);
      el._t = setTimeout(() => send({ t: 'settings', settings: { [d.key]: v } }), 120);
    });
  }
}
function onLobby(m) {
  G.phase = 'lobby'; G.hostId = m.hostId; G.code = m.code; G.settings = m.settings; G.lobbyPlayers = m.players;
  showScreen('lobby');
  const host = m.hostId === G.you;
  document.body.classList.toggle('is-host', host);
  $('roomCode').textContent = m.code;
  $('playerCount').textContent = `(${m.players.length}/${m.settings.maxPlayers})`;
  const teams = m.settings.mode === 'teams';
  $('playerList').innerHTML = m.players.map(p => `
    <li><span class="swatch" style="background:${p.color}"></span>
    <span class="pname">${esc(p.name)}${p.id === G.you ? ' <span class="muted">(Du)</span>' : ''}</span>
    ${teams ? `<select class="team-sel" data-team="${p.id}" ${(p.id === G.you || (host && p.isBot)) ? '' : 'disabled'}>${[1, 2, 3, 4].map(t => `<option value="${t}" ${p.team === t ? 'selected' : ''}>Team ${t}</option>`).join('')}</select>` : ''}
    ${p.id === m.hostId ? '<span class="tag host">Gastgeber</span>' : ''}
    ${p.isBot ? `<span class="tag">Bot · ${({ easy: 'leicht', normal: 'normal', hard: 'schwer' })[p.difficulty] || ''}</span>` : ''}
    ${!p.isBot && !p.connected ? '<span class="tag off">getrennt</span>' : ''}
    ${host && p.id !== G.you ? `<button class="kick" data-kick="${p.id}" title="Entfernen">✕</button>` : ''}</li>`).join('');
  const me = m.players[G.you];
  const used = new Set(m.players.map(p => p.color));
  $('colorPicker').innerHTML = COLORS.map(c => `<button style="background:${c}" data-color="${c}" class="${me && c === me.color ? 'on' : ''}" ${used.has(c) && (!me || c !== me.color) ? 'disabled' : ''}></button>`).join('');
  for (const d of SETTINGS_DEF) {
    const el = $('s_' + d.key); const v = m.settings[d.key];
    if (document.activeElement === el) continue;
    el.value = String(v);
    if (d.type === 'range') $('o_' + d.key).textContent = d.fmt(v);
  }
  $('saveInfo').classList.toggle('hidden', !m.save);
  if (m.save) $('saveInfo').innerHTML = `📂 <b>${esc(m.save.label)}</b><br><span class="muted small">Reiche: ${m.save.players.map(p => esc(p.name) + (p.isBot ? ' (Bot)' : '')).join(', ')}. Tritt mit demselben Namen bei, um dein Reich zu übernehmen.</span>` + (host ? ' <button id="unloadSave" class="btn small">Neues Spiel statt Spielstand</button>' : '');
  $('lobbyHint').textContent = m.save ? (host ? 'Starten setzt den Spielstand fort.' : 'Der Gastgeber setzt einen Spielstand fort.') : host ? (m.players.length < 2 ? 'Lade Freunde ein oder füge Bots hinzu.' : 'Bereit, wenn du es bist.') : 'Warte, bis der Gastgeber das Spiel startet…';
}

// ---------------- Spielstart ----------------
function onStart(m) {
  G.phase = 'play';
  if (m.hostId != null) { G.hostId = m.hostId; document.body.classList.toggle('is-host', m.hostId === m.you); }
  G.paused = false; $('pauseOverlay').classList.add('hidden'); $('pauseBtn').textContent = '⏸ Pause';
  G.you = m.you; G.settings = m.settings; G.players = m.players;
  G.W = m.w; G.H = m.h; G.wonderHold = m.wonderHold;
  const bin = atob(m.terrain);
  G.terrain = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) G.terrain[i] = bin.charCodeAt(i);
  if (m.prov) { const pb = atob(m.prov), u8 = new Uint8Array(pb.length); for (let i = 0; i < pb.length; i++) u8[i] = pb.charCodeAt(i); G.prov = new Uint16Array(u8.buffer); }
  G.provinces = m.provinces || []; G.provOwner = m.provOwner || []; G.provVer = 1; G.season = -1;
  G.res = new Map();
  G.resAt = new Int32Array(G.W * G.H);
  G.bldAt = new Int32Array(G.W * G.H);
  for (let i = 0; i < m.res.length; i += 6) {
    const r = { id: m.res[i], kind: RESOURCE_KINDS[m.res[i + 1]], x: m.res[i + 2], y: m.res[i + 3], amount: m.res[i + 4], layer: m.res[i + 5] };
    r.size = r.kind === 'gold' || r.kind === 'stone' ? 2 : 1;
    G.res.set(r.id, r);
    for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) G.resAt[y * G.W + x] = r.id;
  }
  G.ents = new Map();
  G.selected = new Set(); G.groups = {};
  G.vis = new Uint8Array(G.W * G.H);
  G.explored = new Uint8Array(G.W * G.H);
  G.time = m.time;
  G.choiceDismissed = false;
  showScreen('game');
  $('menuCode').textContent = G.code;
  renderer.setMap(G);
  renderer.setProvinces(G);
  renderer.resize();
  renderer.cam.z = 1.7;
  renderer.cam.x = m.start.x + 0.5; renderer.cam.y = m.start.y + 2;
  renderer.clampCam();
  G.home = { x: m.start.x + 0.5, y: m.start.y + 0.5 };
  // Startbereich aufdecken
  stampVision();
  renderer.updateFog();
  notice(`Karte: ${m.map.name}`, 'good');
  updateCmdCard(true);
}

function onDelta(m) {
  if (!G.terrain) return;
  const now = performance.now();
  G.time = m.time;
  if (m.f) for (const t of m.f) applyTuple(t, now);
  if (m.m) for (let i = 0; i < m.m.length; i += 4) {
    const e = G.ents.get(m.m[i]); if (!e) continue;
    e.px = e.rx ?? e.x; e.py = e.ry ?? e.y; e.t0 = now;
    e.x = m.m[i + 1] / 20; e.y = m.m[i + 2] / 20; e.dir = m.m[i + 3] / 10 - Math.PI;
  }
  if (m.g) for (const id of m.g) removeEnt(id);
  if (m.h) for (const id of m.h) {
    const e = G.ents.get(id);
    if (!e) continue;
    if (e.def.kind === 'b' && e.owner !== G.you) e.ghost = true; else removeEnt(id);
  }
  if (m.rc) for (let i = 0; i < m.rc.length; i += 3) { const r = G.res.get(m.rc[i]); if (r) { r.amount = m.rc[i + 1]; r.layer = m.rc[i + 2]; } }
  if (m.rr) for (const id of m.rr) {
    const r = G.res.get(id); if (!r) continue;
    G.res.delete(id);
    for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) { G.resAt[y * G.W + x] = 0; renderer.invalidateTile(x, y); }
  }
  if (m.p) G.players = m.p;
  if (m.po) { G.provOwner = m.po; G.provVer++; renderer.setProvinces(G); }
  updateSeason(m.time);
  if (m.e) for (const e of m.e) onEvent(e, now);
  stampVision();
  renderer.updateFog();
}
function applyTuple(t, now) {
  const id = t[0], def = TYPES[t[1]];
  let e = G.ents.get(id);
  const isNew = !e;
  if (!e) { e = { id }; G.ents.set(id, e); }
  else if (e.def && e.def.kind === 'b') clearBld(e);
  e.def = def; e.owner = t[2]; e.hp = t[5]; e.maxHp = t[6];
  if (def.kind === 'u') {
    const x = t[3] / 20, y = t[4] / 20;
    if (isNew) { e.px = x; e.py = y; e.rx = x; e.ry = y; } else { e.px = e.rx ?? x; e.py = e.ry ?? y; }
    e.t0 = now; e.x = x; e.y = y; e.state = t[7]; e.carry = t[8]; e.dir = t[9] / 10 - Math.PI;
    e.rank = t[10] || 0; e.morale = t[11]; e.sup = t[12]; e.form = FORMATION_KEYS[t[13]] || 'none';
  } else {
    e.x = t[3]; e.y = t[4]; e.prog = t[7]; e.q = t[8]; e.era = t[9]; e.ghost = false;
    setBld(e);
  }
}
function setBld(e) { const sz = BUILDINGS[e.def.key].size; for (let y = e.y; y < e.y + sz; y++) for (let x = e.x; x < e.x + sz; x++) G.bldAt[y * G.W + x] = e.id; }
function clearBld(e) { const sz = BUILDINGS[e.def.key].size; for (let y = e.y; y < e.y + sz; y++) for (let x = e.x; x < e.x + sz; x++) if (G.bldAt[y * G.W + x] === e.id) G.bldAt[y * G.W + x] = 0; }
function removeEnt(id) {
  const e = G.ents.get(id); if (!e) return;
  if (e.def.kind === 'b') clearBld(e);
  G.ents.delete(id);
  G.selected.delete(id);
}

const CIRCLES = [];
for (let r = 0; r <= 14; r++) { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) o.push(dx, dy); CIRCLES.push(o); }
function stampVision() {
  const W = G.W, H = G.H, vis = G.vis, exp = G.explored;
  const me = G.players[G.you];
  if (!me || !me.alive || G.phase === 'end') { vis.fill(1); exp.fill(1); return; }
  vis.fill(0);
  const stamp = (x, y, r) => {
    const c = CIRCLES[Math.min(14, Math.round(r))], tx = Math.floor(x), ty = Math.floor(y);
    for (let k = 0; k < c.length; k += 2) { const nx = tx + c[k], ny = ty + c[k + 1]; if (nx >= 0 && ny >= 0 && nx < W && ny < H) { const i = ny * W + nx; vis[i] = 1; exp[i] = 1; } }
  };
  for (const e of G.ents.values()) {
    if (e.ghost || !G.allied(e.owner)) continue;
    if (e.def.kind === 'u') stamp(e.x, e.y, LINES[e.def.line].sight);
    else { const b = BUILDINGS[e.def.key]; stamp(e.x + b.size / 2, e.y + b.size / 2, b.sight + b.size / 2); }
  }
  if (G.home && G.time < 3) stamp(G.home.x, G.home.y, 10);
  // Geister wieder sichtbarer Gebäude entfernen
  for (const e of G.ents.values()) if (e.ghost && vis[e.y * W + e.x]) removeEnt(e.id);
}

function onMe(m) {
  const prevEra = G.me.era, prevChoice = G.me.choice;
  G.me = m;
  // Dialog neu aufbauen, wenn sich die offene Wahl geändert hat (Kultur -> Nation)
  if (m.choice && !G.choiceDismissed && ($('choice').classList.contains('hidden') || prevChoice !== m.choice)) showChoice();
  if (!m.choice) $('choice').classList.add('hidden');
  if (m.era !== prevEra) updateCmdCard(true);
}

function pname(id) { const p = G.players[id]; return p ? `<b style="color:${p.color}">${esc(p.name)}</b>` : '?'; }
function onEvent(e, now) {
  switch (e.k) {
    case 'shot': renderer.addShot(e, now); if (Math.random() < 0.15) sfx.shot(e.c); break;
    case 'death': renderer.addEffect('death', e.x, e.y); if (e.o === G.you && Math.random() < 0.5) sfx.lost(); break;
    case 'destroy': renderer.addEffect('dust', e.x, e.y, { s: e.s }); sfx.crash(); if (e.o === G.you) notice('Ein Gebäude wurde zerstört!', 'bad'); break;
    case 'meteor':
      renderer.addEffect('meteor', e.x, e.y, { dur: e.t * 1000 / (G.settings.speed || 1) });
      if (e.p === G.you) { notice('☄ Ein Meteor stürzt auf dein Reich!', 'bad'); sfx.alert(); }
      UI.pings.push({ x: e.x, y: e.y, t0: now });
      break;
    case 'impact': renderer.addEffect('boom', e.x, e.y); sfx.strike(); break;
    case 'notice': notice(e.text, e.to === -1 ? 'bad' : ''); break;
    case 'alert':
      UI.pings.push({ x: e.x, y: e.y, t0: now }); UI.lastAlert = { x: e.x, y: e.y };
      notice('⚠ Du wirst angegriffen! (Leertaste)', 'bad'); sfx.alert();
      break;
    case 'built': sfx.build(); updateCmdCard(true); break;
    case 'wonder': {
      const who = G.players[e.p], mine = e.p === G.you;
      if (e.what === 'start') { notice(mine ? 'Der Bau deines Weltwunders hat begonnen!' : `⚠ ${who ? who.name : '?'} beginnt mit dem Bau eines Weltwunders!`, mine ? 'good' : 'bad'); sfx.alert(); }
      if (e.what === 'done') { notice(mine ? `🏛 Dein Weltwunder steht! Halte es ${Math.round(e.hold / 60)} Minuten.` : `⚠ ${who ? who.name : '?'} hat ein Weltwunder vollendet – zerstört es!`, mine ? 'good' : 'bad'); sfx.win(); }
      if (e.what === 'lost') notice(mine ? 'Dein Weltwunder wurde zerstört!' : `Das Weltwunder von ${who ? who.name : '?'} ist gefallen!`, mine ? 'bad' : 'good');
      if (e.what === 'cancel' && !mine) chatLine(`${pname(e.p)} hat den Bau des Weltwunders abgebrochen.`, true);
      break;
    }
    case 'late':
      if (e.p === G.you) { notice(`🔬 ${LATE_STAGE.name} erforscht – deine Armee rüstet auf!`, 'good'); sfx.win(); updateCmdCard(true); }
      else chatLine(`${pname(e.p)} hat „${LATE_STAGE.name}“ erforscht.`, true);
      break;
    case 'era':
      if (e.p === G.you) { notice(`${ERAS[e.era].name} erreicht!`, 'good'); sfx.win(); updateCmdCard(true); }
      else chatLine(`${pname(e.p)} erreicht die ${ERAS[e.era].name}.`, true);
      break;
    case 'choice': {
      const v = e.what === 'culture' ? CULTURES[e.v].name : NATIONS[e.v].name;
      chatLine(`${pname(e.p)} wählt ${e.what === 'culture' ? 'die Kultur' : 'die Nation'} ${esc(v)}.`, true);
      if (e.p === G.you) updateCmdCard(true);
      break;
    }
    case 'defeat':
      chatLine(`☠ ${pname(e.p)} ${e.s ? 'hat aufgegeben' : 'wurde besiegt'}.`, true);
      if (e.p === G.you) { notice('Du wurdest besiegt – du kannst weiter zuschauen.', 'bad'); }
      break;
    default:
  }
}

function onEnd(m) {
  G.phase = 'end';
  const won = m.winners.includes(G.you);
  $('endTitle').textContent = won ? 'SIEG!' : 'NIEDERLAGE';
  $('endTitle').style.color = won ? 'var(--accent)' : '#ff8b80';
  const mm = Math.floor(m.duration / 60), ss = String(m.duration % 60).padStart(2, '0');
  $('endReason').textContent = `${m.reason === 'Weltwunder' ? 'Sieg durch Weltwunder · ' : ''}Sieger: ${m.winners.map(w => m.players[w].name).join(', ')} · Spielzeit ${mm}:${ss}`;
  const rows = [...m.players].sort((a, b) => (m.winners.includes(b.id) - m.winners.includes(a.id)) || b.score - a.score);
  $('endTable').innerHTML = '<tr><th>Nation</th><th>Epoche</th><th>Kultur</th><th>Gesammelt</th><th>Getötet</th><th>Verloren</th><th>Punkte</th></tr>' +
    rows.map(p => `<tr><td><span class="sw" style="background:${p.color}"></span>${esc(p.name)}${m.winners.includes(p.id) ? ' 👑' : ''}</td><td>${ERAS[p.era].name}</td><td>${p.culture ? CULTURES[p.culture].icon + ' ' + CULTURES[p.culture].name : '–'}</td><td>${p.stats.gathered}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td><td><b>${p.score}</b></td></tr>`).join('');
  $('rematchBtn').classList.toggle('hidden', G.hostId !== G.you);
  $('endScreen').classList.remove('hidden');
  drawEndChart(m);
  stampVision(); renderer.updateFog();
  if (won) sfx.win();
}
function drawEndChart(m) {
  const c = $('endChart'), g = c.getContext('2d'), W = c.width, H = c.height, pad = 30;
  g.clearRect(0, 0, W, H);
  const maxT = Math.max(1, ...m.players.flatMap(p => p.history.map(h => h[0])));
  const maxV = Math.max(1, ...m.players.flatMap(p => p.history.map(h => h[1])));
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.fillStyle = '#8d9ab3'; g.font = '11px Inter, sans-serif';
  for (let i = 0; i <= 4; i++) { const y = H - pad - (H - 2 * pad) * i / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - 10, y); g.stroke(); g.fillText(Math.round(maxV * i / 4), 4, y + 4); }
  g.fillText('Bevölkerung im Verlauf', pad, 16);
  for (const p of m.players) {
    g.strokeStyle = p.color; g.lineWidth = 2; g.beginPath();
    p.history.forEach(([t, v], i) => { const x = pad + (W - pad - 10) * t / maxT, y = H - pad - (H - 2 * pad) * v / maxV; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
}

// ---------------- Meldungen & Chat ----------------
function notice(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'notice ' + cls; el.textContent = text;
  const box = $('notices');
  // Dubletten zusammenfassen
  if (box.lastChild && box.lastChild.textContent === text) box.lastChild.remove();
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 4000);
}
function chatLine(html, sys) {
  const ov = $('chatOverlay');
  const el = document.createElement('div');
  if (sys) el.className = 'sys';
  el.innerHTML = html;
  ov.appendChild(el);
  while (ov.children.length > 8) ov.firstChild.remove();
  setTimeout(() => el.remove(), 15000);
}
function addChat(c, silent) {
  const html = c.from < 0 ? esc(c.text) : `<b style="color:${c.color}">${esc(c.name)}${c.team ? ' (Team)' : ''}:</b> ${esc(c.text)}`;
  const line = document.createElement('div');
  if (c.from < 0) line.className = 'sys';
  line.innerHTML = html;
  const box = $('lobbyChatLog'); box.appendChild(line); while (box.children.length > 100) box.firstChild.remove(); box.scrollTop = box.scrollHeight;
  if (G.phase === 'play' || G.phase === 'end') { chatLine(html, c.from < 0); if (!silent && c.from >= 0 && c.from !== G.you) sfx.click(); }
}

// ---------------- Auswahl-Hilfen ----------------
function myStats(e) {
  const p = G.players[e.owner];
  const mods = p ? playerMods(p.culture, p.nation, p.id === G.you && G.me.late) : null;
  if (e.def.kind === 'u') return unitStats(e.def.line, e.def.era, e.def.unique || null, mods);
  return buildingStats(e.def.key, e.era || 0, mods);
}
function selectedOwn() { return [...G.selected].map(id => G.ents.get(id)).filter(e => e && e.owner === G.you); }
function setSelection(ids, add = false) {
  if (!add) G.selected.clear();
  for (const id of ids) G.selected.add(id);
  updateCmdCard(true);
}
function entAt(wx, wy) {
  if (mouse.inside && renderer.pickUnit) { const pu = renderer.pickUnit(mouse.x, mouse.y); if (pu) return pu; }
  let best = null, bd = Infinity;
  for (const e of G.ents.values()) {
    if (e.def.kind !== 'u') continue;
    const d = Math.hypot(e.rx - wx, e.ry - wy);
    const r = e.def.cls === 'cav' || e.def.cls === 'sie' ? 0.55 : 0.42;
    if (d < r && d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  const tx = Math.floor(wx), ty = Math.floor(wy);
  if (tx < 0 || ty < 0 || tx >= G.W || ty >= G.H) return null;
  const bid = G.bldAt[ty * G.W + tx];
  if (bid && G.ents.get(bid)) return G.ents.get(bid);
  const rid = G.resAt[ty * G.W + tx];
  if (rid && G.res.get(rid) && G.explored[ty * G.W + tx]) return { ...G.res.get(rid), isRes: true };
  return null;
}

// ---------------- Befehle ----------------
function smartCommand(wx, wy, attackMove = false) {
  const own = selectedOwn();
  if (!own.length) return;
  const units = own.filter(e => e.def.kind === 'u');
  const blds = own.filter(e => e.def.kind === 'b');
  const t = entAt(wx, wy);
  const now = performance.now();
  if (units.length) {
    const ids = units.map(u => u.id);
    const workers = units.filter(u => u.def.cls === 'wrk').map(u => u.id);
    const others = units.filter(u => u.def.cls !== 'wrk').map(u => u.id);
    if (t && !t.isRes && !G.allied(t.owner)) {
      cmd({ c: 'attack', ids, target: t.id });
      UI.markers.push({ x: wx, y: wy, t0: now, color: '#ff5a46' });
      sfx.command();
      return;
    }
    if (t && t.isRes) {
      if (workers.length) cmd({ c: 'gather', ids: workers, target: t.id });
      if (others.length) cmd({ c: 'move', ids: others, x: wx, y: wy });
      UI.markers.push({ x: wx, y: wy, t0: now, color: '#ffd34d' });
      sfx.command();
      return;
    }
    if (t && t.def && t.def.kind === 'b' && G.allied(t.owner) && workers.length) {
      if (isProducer(t.def.key) && t.prog >= 100 && t.owner === G.you) cmd({ c: 'gather', ids: workers, target: t.id });
      else if (t.prog < 100 || t.hp < t.maxHp) cmd({ c: 'repair', ids: workers, target: t.id });
      else cmd({ c: 'move', ids: workers, x: wx, y: wy });
      if (others.length) cmd({ c: 'move', ids: others, x: wx, y: wy });
      UI.markers.push({ x: wx, y: wy, t0: now, color: '#6dff8a' });
      sfx.command();
      return;
    }
    cmd({ c: 'move', ids, x: wx, y: wy, amove: attackMove });
    UI.markers.push({ x: wx, y: wy, t0: now, color: attackMove ? '#ff5a46' : '#6dff8a' });
    sfx.command();
    return;
  }
  if (blds.length) {
    cmd({ c: 'rally', ids: blds.map(b => b.id), x: wx, y: wy, target: t && t.isRes ? t.id : (t && t.def && isProducer(t.def.key) ? t.id : 0) });
    UI.markers.push({ x: wx, y: wy, t0: now, color: '#ffd34d' });
    sfx.command();
  }
}

// Bauplatz-Prüfung (Client-Vorschau)
function placeOk(type, x, y) {
  const sz = BUILDINGS[type].size;
  for (let yy = y; yy < y + sz; yy++) for (let xx = x; xx < x + sz; xx++) {
    if (xx < 0 || yy < 0 || xx >= G.W || yy >= G.H) return false;
    const i = yy * G.W + xx;
    const t = G.terrain[i];
    if (G.resAt[i] || G.bldAt[i] || !G.explored[i]) return false;
    if (BUILDINGS[type].onWater ? !(t === 3 || t === 9) : (t === 3 || t === 4 || t === 9)) return false;
  }
  return true;
}
function ghostCells(type, wx, wy) {
  const sz = BUILDINGS[type].size;
  const x = Math.floor(wx - sz / 2 + 0.5), y = Math.floor(wy - sz / 2 + 0.5);
  if (BUILDINGS[type].line && UI.wallStart) {
    const [x0, y0] = UI.wallStart;
    const cells = [];
    const n = Math.max(Math.abs(x - x0), Math.abs(y - y0));
    for (let k = 0; k <= n && cells.length < 60; k++) {
      const cx = Math.round(x0 + (x - x0) * (n ? k / n : 0)), cy = Math.round(y0 + (y - y0) * (n ? k / n : 0));
      if (!cells.some(c => c[0] === cx && c[1] === cy)) cells.push([cx, cy, placeOk(type, cx, cy)]);
    }
    return cells;
  }
  return [[x, y, placeOk(type, x, y)]];
}
function enterBuildMode(type) {
  const workers = selectedOwn().filter(e => e.def.kind === 'u' && e.def.cls === 'wrk');
  if (!workers.length) return;
  const st = buildingStats(type, G.me.era, playerMods(G.me.culture, G.me.nation, G.me.late));
  if (!affordable(st.cost)) { notice('Nicht genug Rohstoffe.', 'bad'); return; }
  UI.mode = { build: type };
  UI.wallStart = null;
  renderer.canvas.style.cursor = 'crosshair';
  updateCmdCard(true);
}
function cancelMode() {
  UI.mode = null; UI.ghost = null; UI.wallStart = null;
  renderer.canvas.style.cursor = '';
  updateCmdCard(true);
}
function placeBuilding(shift) {
  const type = UI.mode.build;
  const cells = UI.ghost ? UI.ghost.cells.filter(c => c[2]) : [];
  if (!cells.length) { notice('Hier kann nicht gebaut werden.', 'bad'); sfx.error(); return; }
  const workers = selectedOwn().filter(e => e.def.kind === 'u' && e.def.cls === 'wrk').map(e => e.id);
  cmd({ c: 'build', ids: workers, type, pos: cells.map(c => [c[0], c[1]]), queue: shift });
  sfx.command();
  UI.wallStart = null;
  if (!shift) cancelMode();
}
function affordable(cost) { for (const k in cost) if ((G.me.res[k] || 0) < cost[k]) return false; return true; }

// ---------------- Befehlsleiste ----------------
const SLOT_KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Y', 'X', 'C', 'V', 'B'];
let cardButtons = [];
function updateCmdCard(force) {
  if (!force && performance.now() - (G.lastCard || 0) < 250) return;
  G.lastCard = performance.now();
  const own = selectedOwn();
  const slots = new Array(15).fill(null);
  const put = (key, b) => { const i = SLOT_KEYS.indexOf(key); if (i >= 0) slots[i] = { ...b, key }; };
  const mods = playerMods(G.me.culture, G.me.nation, G.me.late);
  const era = G.me.era;
  if (UI.mode && UI.mode.build) {
    put('C', { icon: '✕', title: 'Abbrechen (Esc)', fn: cancelMode });
  } else if (own.length && G.me.alive) {
    const units = own.filter(e => e.def.kind === 'u');
    const blds = own.filter(e => e.def.kind === 'b');
    if (units.length) {
      const hasWorker = units.some(u => u.def.cls === 'wrk');
      if (hasWorker) {
        for (const type of BUILD_ORDER) {
          const b = BUILDINGS[type];
          const st = buildingStats(type, era, mods);
          const ok = era >= b.minEra;
          put(b.key, {
            icon: BLD_ICONS[type], title: st.name || b.name, desc: b.desc + (ok ? '' : ` (ab ${ERAS[b.minEra].name})`), cost: st.cost,
            off: !ok || !affordable(st.cost), fn: () => ok && enterBuildMode(type),
          });
        }
      } else {
        // Formationen
        const mil = units.filter(u => u.def.cls !== 'wrk');
        if (mil.length) {
          const FICONS = { line: '➖', column: '⏬', wedge: '🔺', square: '⬛', loose: '⁘' };
          for (const fk of FORMATION_KEYS) {
            const f = FORMATIONS[fk];
            if (!f.key || (f.minEra && era < f.minEra)) continue;
            const on = mil.every(u => u.form === fk);
            put(f.key, { icon: FICONS[fk], title: `Formation: ${f.name}${on ? ' (aktiv – nochmal klicken zum Auflösen)' : ''}`, desc: f.desc, on, fn: () => cmd({ c: 'formation', ids: mil.map(u => u.id), f: on ? 'none' : fk }) });
          }
        }
        put('A', { icon: '⚔', title: 'Angriffsbewegung (A)', desc: 'Bewegt sich zum Ziel und greift unterwegs alle Feinde an.', fn: () => { UI.mode = { amove: true }; renderer.canvas.style.cursor = 'crosshair'; updateCmdCard(true); }, on: UI.mode && UI.mode.amove });
      }
      put('S', { icon: '✋', title: 'Stopp (S)', fn: () => cmd({ c: 'stop', ids: units.map(u => u.id) }) });
      put('B', { icon: '🗑', title: 'Löschen (Entf)', fn: deleteSelection });
    } else if (blds.length) {
      const type = blds[0].def.key;
      const same = blds.filter(b => b.def.key === type && b.prog >= 100);
      if (same.length) {
        const opts = trainable(type, era, G.me.culture);
        opts.forEach((o, i) => {
          const st = unitStats(o.line, Math.max(era, LINES[o.line].minEra), o.unique, mods);
          const key = o.unique ? 'E' : LINES[o.line].key;
          put(key, {
            icon: o.unique ? UNIQUE_ICONS[o.unique] : UNIT_ICONS[o.line][Math.max(era, LINES[o.line].minEra)], title: `${st.name} ausbilden`, cost: st.cost,
            desc: `Leben ${st.hp} · Angriff ${st.atk.toFixed(0)} · Reichweite ${st.range < 1 ? 'Nahkampf' : st.range.toFixed(0)} · Bevölkerung ${st.pop}` + (o.unique ? ' · Spezialeinheit deiner Kultur' : ''),
            off: !affordable(st.cost), fn: ev => cmd({ c: 'train', ids: same.map(b => b.id), line: o.line, unique: o.unique, n: ev && ev.shiftKey ? 5 : 1 }),
            cnt: queueCount(same, unitKey(o.line, Math.max(era, LINES[o.line].minEra), o.unique)),
          });
        });
        if (type === 'town' && era < ERAS.length - 1) {
          const next = ERAS[era + 1], leader = Math.max(0, ...Object.values(G.players).filter(p => p && p.alive).map(p => p.era));
          const cost = eraCost(era + 1, leader), help = cost !== next.cost;
          put('W', {
            icon: '⬆', title: `Aufstieg: ${next.name}`, cost, desc: `Dauer ${fmtDur(next.time)}. Schaltet neue Einheiten und Gebäude frei` + (era + 1 === 1 ? ' – danach wählst du eine Kultur.' : era + 1 === 3 ? ' – danach wählst du eine Nation.' : '.') + (help ? ' Aufholhilfe: billiger, weil du hinter dem Führenden liegst.' : ''),
            off: !affordable(cost) || !!G.me.adv || !!G.me.choice || !!G.me.lateR, fn: () => {
              if (G.me.choice) { G.choiceDismissed = false; showChoice(); return; }
              cmd({ c: 'era', id: same[0].id });
            },
          });
        }
        if (type === 'town' && era === LATE_STAGE.era && !G.me.late) {
          put('R', {
            icon: '🔬', title: `Forschung: ${LATE_STAGE.name}`, cost: LATE_STAGE.cost,
            desc: `Dauer ${fmtDur(LATE_STAGE.time)}. Zweite Stufe der Epoche (1914–1945): Militäreinheiten dieser Epoche werden zu Panzern, MG-Schützen und schweren Haubitzen (+20 % Leben und Angriff).`,
            off: !affordable(LATE_STAGE.cost) || !!G.me.adv || !!G.me.lateR, fn: () => cmd({ c: 'late', id: same[0].id }),
          });
        }
        if (type === 'town' && era === ERAS.length - 1 && !same.some(b => b.era === WONDER_ERA)) {
          put('W', {
            icon: '🏛', title: 'Weltwunder errichten', cost: WONDER.cost,
            desc: `Baut dieses Haupthaus in ${Math.round(WONDER.time / 60)} Minuten zum Weltwunder aus. Hältst du es danach ${Math.round((G.wonderHold || WONDER.hold) / 60)} Minuten, gewinnst du das Spiel. Alle Spieler werden gewarnt!`,
            off: !affordable(WONDER.cost) || !!G.me.wonderB, fn: () => cmd({ c: 'wonder', id: same[0].id }),
          });
        }
      }
      put('B', { icon: '🗑', title: 'Löschen (Entf)', fn: deleteSelection });
    }
  }
  const html = slots.map((b, i) => b ? `<div class="cmd ${b.off ? 'off' : ''} ${b.on ? 'on' : ''}" data-slot="${i}"><span class="hk">${b.key}</span>${b.icon}${b.cnt ? `<span class="cnt">${b.cnt}</span>` : ''}</div>` : '<div class="cmd empty"></div>').join('');
  cardButtons = slots;
  if ($('cmdCard')._html !== html) { $('cmdCard').innerHTML = html; $('cmdCard')._html = html; }
}
function queueCount(blds, key) {
  let n = 0;
  for (const q of G.me.q || []) if (blds.some(b => b.id === q[0])) n += q[1].filter(k => k === key).length;
  return n || '';
}
function deleteSelection() {
  const own = selectedOwn();
  if (!own.length) return;
  if (own.some(e => e.def.kind === 'b' && e.prog >= 100) && !confirm('Ausgewählte Gebäude wirklich abreißen?')) return;
  cmd({ c: 'delete', ids: own.map(e => e.id) });
}
function showTooltip(b, x, y) {
  const tt = $('tooltip');
  if (!b) { tt.classList.add('hidden'); return; }
  let html = `<b>${esc(b.title)}</b>`;
  if (b.desc) html += `<div class="muted">${esc(b.desc)}</div>`;
  if (b.cost) html += '<div class="cost">' + Object.entries(b.cost).map(([k, v]) => `<span class="${(G.me.res[k] || 0) < v ? 'no' : ''}">${RES_ICONS[k]} ${v}</span>`).join('') + '</div>';
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  tt.style.left = Math.min(window.innerWidth - tt.offsetWidth - 8, x) + 'px';
  tt.style.top = (y - tt.offsetHeight - 12) + 'px';
}

// ---------------- Auswahl-Info ----------------
function updateSelInfo() {
  const sel = [...G.selected].map(id => G.ents.get(id)).filter(Boolean);
  const box = $('selInfo');
  let html = '';
  if (!sel.length) {
    const p = G.players[G.you];
    html = `<div class="hint">${p && !p.alive ? 'Du bist ausgeschieden und schaust zu.' : 'Wähle Einheiten oder Gebäude aus. Rechtsklick gibt Befehle. Arbeiter sammeln Rohstoffe und bauen.'}<br><br>
      ${G.me.culture ? `Kultur: <b>${CULTURES[G.me.culture].icon} ${CULTURES[G.me.culture].name}</b>` : ''} ${G.me.nation ? ` · Nation: <b>${NATIONS[G.me.nation].name}</b>` : ''}</div>`;
  } else if (sel.length === 1) {
    const e = sel[0], p = G.players[e.owner], st = myStats(e);
    const name = e.def.kind === 'b' ? (st.name || BUILDINGS[e.def.key].name) : st.name;
    let stats = '';
    if (e.def.kind === 'u') {
      stats = `<span>⚔ ${st.atk.toFixed(0)}</span><span>🎯 ${st.range < 1 ? 'Nahkampf' : st.range.toFixed(1)}</span><span>👟 ${st.speed.toFixed(1)}</span><span>👁 ${st.sight}</span>`;
      if (st.heal) stats += `<span>✚ heilt ${st.heal.toFixed(1)}/s</span>`;
      if (e.rank) stats += `<span title="Veteran: +${e.rank * 10} % Schaden und Leben">${'★'.repeat(e.rank)}</span>`;
      if (e.owner === G.you && e.def.cls !== 'wrk') {
        stats += `<span title="Moral: unter 50 % −20 % Schaden">💪 ${(e.morale ?? 10) * 10} %</span>`;
        if (e.sup === 0) stats += `<span class="warn" title="Außerhalb der Versorgung (Haupthaus, Lager, Türme): Moral sinkt, nach 2 min verliert die Einheit Leben">⚠ ohne Nachschub</span>`;
        if (e.form && e.form !== 'none') stats += `<span>${esc(FORMATIONS[e.form].name)}</span>`;
      }
      if (e.owner === G.you && e.carry) stats += `<span>trägt ${RES_ICONS[RES[e.carry - 1]]}</span>`;
    } else {
      if (st.atk) stats += `<span>⚔ ${st.atk.toFixed(0)}</span><span>🎯 ${st.range}</span>`;
      if (st.pop) stats += `<span>👥 +${st.pop}</span>`;
      if (e.prog < 100) stats += `<span>🏗 ${e.prog}%</span>`;
    }
    let queue = '';
    if (e.def.kind === 'b' && e.owner === G.you) {
      const q = (G.me.q || []).find(x => x[0] === e.id);
      if (q) {
        queue = '<div class="queue">' + q[1].map((k, i) => `<div class="qi ${i === 0 && q[4] ? 'blocked' : ''}" data-cancel="${e.id}:${i}" title="${i === 0 && q[4] ? 'Bevölkerungslimit erreicht – baue Häuser! ' : ''}Klicken zum Abbrechen">${k === 'era' ? '⬆' : k === 'wonder' ? '🏛' : k === 'late' ? '🔬' : keyIcon(k)}${i === 0 ? `<span class="bar" style="width:${Math.min(100, q[2] / q[3] * 100)}%"></span>` : ''}</div>`).join('') + '</div>';
      }
    }
    html = `<div class="sel-main"><div class="portrait" style="border-color:${p ? p.color : '#888'}">${iconOf(e.def)}</div>
      <div class="sel-text"><h3>${esc(name)}</h3><div class="sub">${p ? esc(p.name) : ''}${e.def.kind === 'u' ? ' · ' + ERAS[e.def.era].name : ''}</div>
      <div class="hpbar"><i style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></i></div>
      <div class="stats"><span>❤ ${Math.ceil(e.hp)}/${e.maxHp}</span>${stats}</div>${queue}</div></div>`;
  } else {
    const groups = new Map();
    for (const e of sel) { const k = e.def.key; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    html = '<div class="sel-grid">' + [...groups.entries()].map(([k, list]) => {
      const hp = list.reduce((s, e) => s + e.hp / e.maxHp, 0) / list.length;
      return `<div class="sg" data-selkey="${k}" title="${esc(list[0].def.name)} (${list.length}) – Klick: nur diese auswählen">${iconOf(list[0].def)}<span class="n">${list.length}</span><span class="h"><i style="width:${hp * 100}%"></i></span></div>`;
    }).join('') + '</div>';
  }
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
}

// ---------------- HUD ----------------
function updateHud() {
  const m = G.me;
  for (const k of RES) { $('r_' + k).textContent = m.res[k]; }
  $('r_pop').textContent = `${m.pop}/${m.cap}`;
  $('r_pop').parentElement.classList.toggle('low', m.cap - m.pop <= 2 && m.cap < 200);
  const cult = m.culture ? CULTURES[m.culture].icon + ' ' : '';
  $('eraLabel').textContent = `${cult}${ERAS[m.era].name}${m.adv ? ' ⬆' : ''}${m.choice ? ' · Wahl offen!' : ''}`;
  const t = G.time;
  const wl = G.players.filter(p => p.wonder != null && p.alive);
  let wb = $('wonderBanner');
  if (wl.length) {
    if (!wb) { wb = document.createElement('div'); wb.id = 'wonderBanner'; $('hud').appendChild(wb); }
    wb.innerHTML = wl.map(p => `<div><span style="color:${p.color}">🏛 ${esc(p.name)}</span> · Weltwunder-Sieg in <b>${Math.floor(p.wonder / 60)}:${String(p.wonder % 60).padStart(2, '0')}</b></div>`).join('');
  } else if (wb) wb.remove();
  $('timeLabel').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const idle = idleWorkers();
  $('idleCount').textContent = idle.length; $('idleCount').classList.toggle('hidden', !idle.length);
  updateSelInfo();
  updateCmdCard();
  if (!$('scorePanel').classList.contains('hidden')) updateScore();
}
function idleWorkers() { return [...G.ents.values()].filter(e => e.owner === G.you && e.def.kind === 'u' && e.def.cls === 'wrk' && e.state === 0); }
function updateScore() {
  const rows = [...G.players].sort((a, b) => b.score - a.score);
  $('scoreTable').innerHTML = '<tr><th>Nation</th><th>Team</th><th>Epoche</th><th>Kultur</th><th>Bev.</th><th>Punkte</th></tr>' + rows.map(p => `
    <tr class="${p.alive ? '' : 'dead'}"><td><span class="sw" style="background:${p.color}"></span>${esc(p.name)}${p.id === G.you ? ' (Du)' : ''}${p.isBot ? ' 🤖' : ''}</td>
    <td>${G.settings.mode === 'teams' ? p.team : '–'}</td><td>${ERAS[p.era].short}</td><td>${p.culture ? CULTURES[p.culture].icon : ''}${p.nation ? ' ' + esc(NATIONS[p.nation].name) : ''}</td><td>${p.pop}</td><td>${p.alive ? p.score : '☠'}</td></tr>`).join('');
}
function showChoice() {
  const m = G.me;
  if (!m.choice) return;
  const isCulture = m.choice === 'culture';
  $('choiceTitle').textContent = isCulture ? 'Wähle deine Kultur' : 'Wähle deine Nation';
  $('choiceSub').textContent = isCulture ? 'Deine Kultur bestimmt Boni und eine Spezialeinheit (ab dem Frühen Mittelalter).' : 'Deine Nation bestimmt einen Bonus, den Baustil deiner Stadt und dein Weltwunder.';
  const opts = isCulture ? Object.entries(CULTURES).map(([k, c]) => ({ k, icon: c.icon, name: c.name, desc: c.desc })) : CULTURES[m.culture].nations.map(k => ({ k, icon: '🏳', name: NATIONS[k].name, desc: NATIONS[k].desc }));
  $('choiceOptions').innerHTML = opts.map(o => `<button class="choice-opt" data-choice="${o.k}"><span class="ic">${o.icon}</span><b>${esc(o.name)}</b><p>${esc(o.desc)}</p></button>`).join('');
  $('choice').classList.remove('hidden');
}

// ---------------- Eingabe ----------------
const keys = new Set();
let mouse = { x: 0, y: 0, inside: false };
function setupInput() {
  const cv = $('game');
  const pointers = new Map();
  let down = null, pinch = null, pan = null, lastClick = { t: 0, id: 0 };

  cv.addEventListener('pointerdown', e => {
    sfx.unlock();
    if (G.phase !== 'play' && G.phase !== 'end') return;
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      down = null; UI.box = null; return;
    }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    const [wx, wy] = renderer.toWorld(e.clientX, e.clientY);
    if (e.button === 1) { pan = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
    if (e.button === 2) {
      if (UI.mode) { cancelMode(); return; }
      smartCommand(wx, wy);
      return;
    }
    if (UI.mode && UI.mode.build) {
      if (BUILDINGS[UI.mode.build].line) { UI.wallStart = [Math.floor(wx), Math.floor(wy)]; return; }
      placeBuilding(e.shiftKey);
      return;
    }
    if (UI.mode && UI.mode.amove) {
      smartCommand(wx, wy, true);
      if (!e.shiftKey) cancelMode();
      return;
    }
    down = { x: e.clientX, y: e.clientY, shift: e.shiftKey, ctrl: e.ctrlKey, touch: e.pointerType === 'touch', moved: false };
  });
  cv.addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { ...pointers.get(e.pointerId), x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const s = renderer.pxPerTile();
      renderer.cam.x -= (cx - pinch.cx) / s; renderer.cam.y -= (cy - pinch.cy) / s;
      renderer.zoomAt(cx, cy, d / pinch.d);
      pinch = { d, cx, cy };
      return;
    }
    if (pan) {
      const s = renderer.pxPerTile();
      renderer.cam.x -= (e.clientX - pan.x) / s; renderer.cam.y -= (e.clientY - pan.y) / s; renderer.clampCam();
      pan = { x: e.clientX, y: e.clientY }; return;
    }
    if (down) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (down.moved) {
        if (down.touch) { // Touch: Kamera verschieben
          const s = renderer.pxPerTile();
          renderer.cam.x -= (e.clientX - (down.lx ?? down.x)) / s; renderer.cam.y -= (e.clientY - (down.ly ?? down.y)) / s; renderer.clampCam();
          down.lx = e.clientX; down.ly = e.clientY;
        } else UI.box = { x0: down.x, y0: down.y, x1: e.clientX, y1: e.clientY };
      }
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.button === 1 || pan) { pan = null; return; }
    if (UI.mode && BUILDINGS[UI.mode.build].line && UI.wallStart) { placeBuilding(e.shiftKey); return; }
    if (!down) return;
    const d = down; down = null;
    const box = UI.box; UI.box = null;
    if (box && d.moved && !d.touch) {
      const bx0 = Math.min(box.x0, box.x1), bx1 = Math.max(box.x0, box.x1), by0 = Math.min(box.y0, box.y1), by1 = Math.max(box.y0, box.y1);
      const inScr = (wx, wy, up = 1) => { const [sx, sy] = renderer.toScreen(wx, wy, up); return sx >= bx0 && sx <= bx1 && sy >= by0 && sy <= by1; };
      const inBox = [...G.ents.values()].filter(x => x.owner === G.you && x.def.kind === 'u' && inScr(x.rx, x.ry));
      // Militär bevorzugen, wenn gemischt
      const mil = inBox.filter(x => x.def.cls !== 'wrk');
      const pickList = mil.length && mil.length < inBox.length && !d.shift ? mil : inBox;
      if (pickList.length) setSelection(pickList.map(x => x.id), d.shift);
      else {
        const blds = [...G.ents.values()].filter(x => x.owner === G.you && x.def.kind === 'b' && inScr(x.x + 1, x.y + 1, 1.5));
        if (blds.length) setSelection(blds.map(x => x.id), d.shift); else if (!d.shift) setSelection([]);
      }
      return;
    }
    if (d.moved) return;
    const [wx, wy] = renderer.toWorld(e.clientX, e.clientY);
    const t = entAt(wx, wy);
    // Touch: Tippen mit Auswahl = Befehl
    if (d.touch && selectedOwn().length && (!t || t.isRes || !G.allied(t.owner) || (t.owner === G.you && t.def.kind === 'b' && selectedOwn().some(x => x.def.cls === 'wrk')))) {
      smartCommand(wx, wy); return;
    }
    if (t && !t.isRes) {
      const now = performance.now();
      if (now - lastClick.t < 350 && lastClick.id === t.id && t.owner === G.you) {
        // Doppelklick: alle gleichen auf dem Bildschirm
        setSelection([...G.ents.values()].filter(x => { if (x.owner !== G.you || x.def.key !== t.def.key) return false; const [sx, sy, sz] = renderer.toScreen(x.rx ?? x.x, x.ry ?? x.y); return sz < 1 && sx >= 0 && sy >= 0 && sx <= renderer.vw && sy <= renderer.vh; }).map(x => x.id));
      } else if (d.shift && t.owner === G.you) {
        if (G.selected.has(t.id)) { G.selected.delete(t.id); updateCmdCard(true); } else setSelection([t.id], true);
      } else setSelection([t.id]);
      lastClick = { t: now, id: t.id };
      sfx.click();
    } else if (!d.shift) setSelection([]);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { mouse.inside = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); renderer.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015))); }, { passive: false });
  document.addEventListener('mouseleave', () => { mouse.inside = false; });

  window.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') {
      if (e.target.id === 'chatInput') {
        if (e.key === 'Enter') { sendChat(); e.preventDefault(); }
        if (e.key === 'Escape') { $('chatInput').value = ''; $('chatInput').classList.add('hidden'); $('chatInput').blur(); }
      } else if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (G.phase !== 'play' && G.phase !== 'end') return;
    keys.add(e.key);
    const k = e.key;
    if (k === 'Enter') { $('chatInput').classList.remove('hidden'); $('chatInput').focus(); e.preventDefault(); return; }
    if (k === 'Escape') { if (UI.mode) cancelMode(); else if (!$('menu').classList.contains('hidden')) $('menu').classList.add('hidden'); else setSelection([]); return; }
    if (k === 'Tab') { e.preventDefault(); $('scorePanel').classList.toggle('hidden'); updateScore(); return; }
    if (k === 'F10') { e.preventDefault(); $('menu').classList.toggle('hidden'); return; }
    if (k === 'Delete') { deleteSelection(); return; }
    if (k === ' ') { e.preventDefault(); const a = UI.lastAlert || G.home; if (a) { renderer.cam.x = a.x; renderer.cam.y = a.y; renderer.clampCam(); } return; }
    if (k === '.' || k === ',') { cycleIdle(); return; }
    if (/^[1-9]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); G.groups[k] = [...G.selected]; notice(`Gruppe ${k} gespeichert (${G.groups[k].length})`); return; }
      const ids = (G.groups[k] || []).filter(id => G.ents.has(id));
      if (!ids.length) return;
      const now = performance.now();
      if (G.lastGroup === k && now - G.lastGroupT < 400) centerOn(ids);
      G.lastGroup = k; G.lastGroupT = now;
      setSelection(ids, e.shiftKey);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const up = k.toUpperCase();
    if (up === 'H') { const tc = [...G.ents.values()].find(x => x.owner === G.you && x.def.key === 'town'); if (tc) { setSelection([tc.id]); centerOn([tc.id]); } return; }
    if (up === 'A' && selectedOwn().some(x => x.def.kind === 'u')) {
      UI.mode = { amove: true }; renderer.canvas.style.cursor = 'crosshair'; updateCmdCard(true); return;
    }
    const i = SLOT_KEYS.indexOf(up === 'Z' ? 'Y' : up);
    if (i >= 0 && cardButtons[i] && cardButtons[i].fn) { if (!cardButtons[i].off || cardButtons[i].title.startsWith('Aufstieg')) cardButtons[i].fn(e); else sfx.error(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('resize', () => renderer.resize());

  // Befehlsleiste
  $('cmdCard').addEventListener('click', e => {
    const el = e.target.closest('[data-slot]'); if (!el) return;
    const b = cardButtons[+el.dataset.slot];
    if (b && b.fn) b.fn(e);
  });
  $('cmdCard').addEventListener('mousemove', e => {
    const el = e.target.closest('[data-slot]');
    const b = el ? cardButtons[+el.dataset.slot] : null;
    showTooltip(b, e.clientX, el ? el.getBoundingClientRect().top : e.clientY);
  });
  $('cmdCard').addEventListener('mouseleave', () => showTooltip(null));
  $('selInfo').addEventListener('click', e => {
    const c = e.target.closest('[data-cancel]');
    if (c) { const [id, i] = c.dataset.cancel.split(':').map(Number); cmd({ c: 'cancel', id, index: i }); return; }
    const s = e.target.closest('[data-selkey]');
    if (s) setSelection([...G.selected].filter(id => G.ents.get(id) && G.ents.get(id).def.key === s.dataset.selkey));
  });
  // Minimap
  const mm = $('minimap');
  const mmWorld = e => { const r = mm.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * G.W, (e.clientY - r.top) / r.height * G.H]; };
  mm.addEventListener('pointerdown', e => {
    const [x, y] = mmWorld(e);
    if (e.button === 2) { smartCommand(x, y); return; }
    mm.setPointerCapture(e.pointerId); mm._drag = true;
    renderer.cam.x = x; renderer.cam.y = y; renderer.clampCam();
  });
  mm.addEventListener('pointermove', e => { if (mm._drag) { const [x, y] = mmWorld(e); renderer.cam.x = x; renderer.cam.y = y; renderer.clampCam(); } });
  mm.addEventListener('pointerup', () => { mm._drag = false; });
  mm.addEventListener('contextmenu', e => e.preventDefault());
}
function centerOn(ids) {
  let x = 0, y = 0, n = 0;
  for (const id of ids) { const e = G.ents.get(id); if (!e) continue; x += e.def.kind === 'b' ? e.x + 1 : e.rx; y += e.def.kind === 'b' ? e.y + 1 : e.ry; n++; }
  if (n) { renderer.cam.x = x / n; renderer.cam.y = y / n; renderer.clampCam(); }
}
function cycleIdle() {
  const idle = idleWorkers();
  if (!idle.length) { notice('Keine untätigen Arbeiter.'); return; }
  G.idleIdx = ((G.idleIdx || 0) + 1) % idle.length;
  const w = idle[G.idleIdx];
  setSelection([w.id]); centerOn([w.id]);
}
function sendChat() {
  let text = $('chatInput').value.trim();
  $('chatInput').value = ''; $('chatInput').classList.add('hidden'); $('chatInput').blur();
  if (!text) return;
  let team = false;
  if (text.startsWith('/t ')) { team = true; text = text.slice(3); }
  send({ t: 'chat', text, team });
}

// ---------------- UI-Verdrahtung ----------------
function setupUi() {
  try { $('nameInput').value = localStorage.getItem('fl_name') || ''; } catch { /* egal */ }
  $('createBtn').onclick = () => { sfx.unlock(); $('homeError').textContent = ''; send({ t: 'create', name: getName() }); };
  const join = () => {
    sfx.unlock();
    const code = $('codeInput').value.trim().toUpperCase();
    if (code.length < 4) { $('homeError').textContent = 'Bitte gib einen Raumcode ein.'; return; }
    $('homeError').textContent = '';
    send({ t: 'join', code, name: getName() });
  };
  $('joinBtn').onclick = join;
  $('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  const params = new URLSearchParams(location.search);
  if (params.get('r')) $('codeInput').value = params.get('r').toUpperCase();
  buildSettingsForm();
  const inviteLink = () => `${location.origin}${location.pathname}?r=${G.code}`;
  const copy = btn => {
    const link = inviteLink();
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
      () => { const o = btn.textContent; btn.textContent = 'Kopiert ✓'; setTimeout(() => { btn.textContent = o; }, 1500); },
      () => prompt('Einladungslink:', link));
  };
  $('copyLink').onclick = () => copy($('copyLink'));
  $('menuInvite').onclick = () => copy($('menuInvite'));
  const leave = () => {
    send({ t: 'leave' }); wantSession = null; sessionStorage.removeItem('fl_session');
    history.replaceState(null, '', location.pathname);
    G.phase = 'home'; showScreen('home'); $('menu').classList.add('hidden');
  };
  $('leaveLobby').onclick = leave; $('leaveGame').onclick = leave; $('endLeave').onclick = leave;
  $('addBot').onclick = () => send({ t: 'addBot', difficulty: $('botDiff').value });
  $('addBots').onclick = () => { for (let i = 0; i < 5; i++) send({ t: 'addBot', difficulty: $('botDiff').value }); };
  $('startBtn').onclick = () => send({ t: 'start' });
  $('playerList').onclick = e => { const b = e.target.closest('[data-kick]'); if (b) send({ t: 'kick', player: +b.dataset.kick }); };
  $('playerList').onchange = e => { const s = e.target.closest('[data-team]'); if (s) send({ t: 'team', player: +s.dataset.team, team: +s.value }); };
  $('colorPicker').onclick = e => { const b = e.target.closest('[data-color]'); if (b && !b.disabled) send({ t: 'color', color: b.dataset.color }); };
  $('lobbyChatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { send({ t: 'chat', text: e.target.value.trim() }); e.target.value = ''; } });
  $('soundBtn').onclick = () => { $('soundBtn').textContent = sfx.toggle() ? '🔊' : '🔇'; };
  $('soundBtn').textContent = sfx.enabled ? '🔊' : '🔇';
  $('menuBtn').onclick = () => $('menu').classList.toggle('hidden');
  $('closeMenu').onclick = () => $('menu').classList.add('hidden');
  $('pauseBtn').onclick = () => send({ t: 'pause' });
  $('pauseResume').onclick = () => send({ t: 'pause' });
  $('saveBtn').onclick = () => { send({ t: 'save' }); $('menu').classList.add('hidden'); };
  $('loadSaveBtn').onclick = () => send({ t: 'saves' });
  $('savesClose').onclick = () => $('savesDlg').classList.add('hidden');
  $('savesList').onclick = e => { const b = e.target.closest('[data-file]'); if (b) { send({ t: 'loadSave', file: b.dataset.file }); $('savesDlg').classList.add('hidden'); } };
  $('saveInfo').onclick = e => { if (e.target.id === 'unloadSave') send({ t: 'loadSave', file: null }); };
  $('scoreBtn').onclick = () => { $('scorePanel').classList.toggle('hidden'); updateScore(); };
  $('idleBtn').onclick = cycleIdle;
  $('surrenderBtn').onclick = () => { if (confirm('Wirklich aufgeben?')) { send({ t: 'surrender' }); $('menu').classList.add('hidden'); } };
  $('rematchBtn').onclick = () => send({ t: 'rematch' });
  $('endView').onclick = () => $('endScreen').classList.add('hidden');
  $('eraLabel').onclick = () => { if (G.me.choice) { G.choiceDismissed = false; showChoice(); } };
  $('choiceOptions').onclick = e => {
    const b = e.target.closest('[data-choice]'); if (!b) return;
    cmd({ c: 'choose', kind: G.me.choice, value: b.dataset.choice });
    $('choice').classList.add('hidden');
    sfx.build();
  };
  $('choiceLater').onclick = () => { G.choiceDismissed = true; $('choice').classList.add('hidden'); };
}

// ---------------- Hauptschleife ----------------
let lastHud = 0, lastMini = 0, lastFrame = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if ((G.phase === 'play' || G.phase === 'end') && G.terrain) {
    // Kamera: Pfeiltasten & Bildschirmrand
    const sp = 26 / renderer.cam.z * dt;
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft')) dx -= 1; if (keys.has('ArrowRight')) dx += 1; if (keys.has('ArrowUp')) dy -= 1; if (keys.has('ArrowDown')) dy += 1;
    if (mouse.inside && document.hasFocus() && !UI.box) {
      const m = 4;
      if (mouse.x <= m) dx -= 1; else if (mouse.x >= window.innerWidth - m) dx += 1;
      if (mouse.y <= m) dy -= 1; else if (mouse.y >= window.innerHeight - m) dy += 1;
    }
    if (dx || dy) { renderer.cam.x += dx * sp; renderer.cam.y += dy * sp; renderer.clampCam(); }
    // Bauvorschau
    if (UI.mode && UI.mode.build && mouse.inside) {
      const [wx, wy] = renderer.toWorld(mouse.x, mouse.y);
      UI.ghost = { type: UI.mode.build, cells: ghostCells(UI.mode.build, wx, wy) };
    } else UI.ghost = null;
    // Sammelpunkt des gewählten Gebäudes zeigen – nicht übertragen, daher nur lokale Markierung
    UI.rally = null;
    UI.markers = UI.markers.filter(m => now - m.t0 < 600);
    UI.pings = UI.pings.filter(p => now - p.t0 < 3000);
    renderer.frame(now, UI);
    if (now - lastHud > 200) { lastHud = now; updateHud(); }
    if (now - lastMini > 250) { lastMini = now; renderer.drawMinimap($('minimap'), UI); }
  } else if (G.phase === 'home' || G.phase === 'lobby') {
    /* Menühintergrund per CSS */
  }
}
function drawMenuBackground() {
  const cv = renderer.canvas, c = renderer.ctx, w = cv.width, h = cv.height;
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0d1a12'); g.addColorStop(1, '#0a1222');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // dekorative Landschaft aus Hügeln & Bäumen
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 18;
    c.fillStyle = `rgba(${40 + Math.random() * 30},${80 + Math.random() * 50},${40 + Math.random() * 20},0.35)`;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
}

async function init() {
  setupUi();
  renderer = new Renderer3D($('game'), $('overlay'));
  window.__renderer = renderer; // für automatisierte Tests
  await renderer.init();
  window.__G = G; window.__R = renderer; // Debug-Zugriff
  setupInput();
  requestAnimationFrame(loop);
  connect();
  window.addEventListener('resize', () => { G.bgDrawn = false; });
}
init();
