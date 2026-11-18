import { MapRenderer, fmt, rgba } from './render.js';
import { sfx } from './sound.js';
import {
  COLORS, BUILDINGS, BUILDING_KEYS, MAX_LEVEL, ABILITIES, ABILITY_KEYS,
  production, capacity, income, defenseMult, buildCost,
} from '/shared/rules.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- Zustand ----------------
const G = {
  map: null, phase: 'home', you: -1, code: null, hostId: -1, settings: {},
  regions: [], armies: new Map(), players: [], picks: new Map(),
  me: { gold: 0, cooldowns: {}, mob: 0, allyReq: [] },
  serverTime: 0, recvAt: 0,
  selected: new Set(), hover: -1, drag: null, targeting: null, pct: 0.5,
  sentAllyReq: new Set(), lobby: null, ended: null,
  gameTime() {
    const dt = (performance.now() - this.recvAt) / 1000 * (this.settings.speed || 1);
    return this.serverTime + Math.min(dt, 0.5);
  },
};
let renderer = null;
let ws = null;
let reconnectDelay = 500;
let wantSession = null; // {code, token}
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
    case 'state': onState(m); break;
    case 'd': onDelta(m); break;
    case 'ev': onEvents(m.e); break;
    case 'me': G.me = m; break;
    case 'players': G.players = m.list; renderer && (renderer.dirty = true); break;
    case 'picks': G.picks = new Map(m.picks); renderer.dirty = true; sfx.click(); break;
    case 'draftTime': G.draftLeft = m.left; break;
    case 'end': onEnd(m); break;
    case 'chat': addChat(m); break;
    case 'chatlog': $('chatLog').innerHTML = ''; $('lobbyChatLog').innerHTML = ''; m.list.forEach(c => addChat(c, true)); break;
    case 'error':
      if (m.fatal) {
        wantSession = null; sessionStorage.removeItem('fl_session');
        showScreen('home'); $('homeError').textContent = m.text;
      } else toast(m.text);
      break;
    case 'kicked':
      wantSession = null; sessionStorage.removeItem('fl_session');
      showScreen('home'); $('homeError').textContent = 'Du wurdest aus dem Raum entfernt.';
      break;
    default:
  }
}

// ---------------- Bildschirme ----------------
function showScreen(name) {
  G.phase = name === 'home' ? 'home' : G.phase;
  $('home').classList.toggle('hidden', name !== 'home');
  $('lobby').classList.toggle('hidden', name !== 'lobby');
  $('hud').classList.toggle('hidden', name !== 'game');
  if (name !== 'game') $('endScreen').classList.add('hidden');
}

// ---------------- Lobby ----------------
const SETTINGS_DEF = [
  { key: 'speed', label: 'Spielgeschwindigkeit', type: 'range', min: 0.5, max: 3, step: 0.25, fmt: v => v + '×' },
  { key: 'victory', label: 'Siegbedingung (Anteil der Welt)', type: 'range', min: 30, max: 100, step: 5, fmt: v => v + ' %' },
  { key: 'timeLimit', label: 'Zeitlimit', type: 'range', min: 0, max: 120, step: 5, fmt: v => v ? v + ' min' : 'aus' },
  { key: 'draftTime', label: 'Zeit für Startwahl', type: 'range', min: 5, max: 90, step: 5, fmt: v => v + ' s' },
  { key: 'peace', label: 'Friedensphase zu Beginn', type: 'range', min: 0, max: 180, step: 10, fmt: v => v ? v + ' s' : 'aus' },
  { key: 'startTroops', label: 'Starttruppen', type: 'range', min: 20, max: 300, step: 10, fmt: v => v },
  { key: 'neutralStrength', label: 'Stärke neutraler Länder', type: 'range', min: 0.2, max: 3, step: 0.1, fmt: v => Math.round(v * 100) + ' %' },
  { key: 'botDifficulty', label: 'Bot-Schwierigkeit', type: 'select', options: [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']] },
  { key: 'fog', label: 'Nebel des Krieges', type: 'check' },
];
function buildSettingsForm() {
  const f = $('settingsForm');
  f.innerHTML = SETTINGS_DEF.map(d => {
    if (d.type === 'range') return `<div class="setting"><label for="s_${d.key}">${d.label}</label><output id="o_${d.key}"></output><input type="range" id="s_${d.key}" min="${d.min}" max="${d.max}" step="${d.step}"></div>`;
    if (d.type === 'select') return `<div class="setting"><label for="s_${d.key}">${d.label}</label><select id="s_${d.key}">${d.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`;
    return `<div class="setting"><label for="s_${d.key}">${d.label}</label><input type="checkbox" id="s_${d.key}"></div>`;
  }).join('');
  for (const d of SETTINGS_DEF) {
    const el = $('s_' + d.key);
    const ev = d.type === 'range' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      const v = d.type === 'check' ? el.checked : d.type === 'range' ? Number(el.value) : el.value;
      if (d.type === 'range') $('o_' + d.key).textContent = d.fmt(v);
      clearTimeout(el._t);
      el._t = setTimeout(() => send({ t: 'settings', settings: { [d.key]: v } }), 120);
    });
  }
}
function onLobby(m) {
  G.phase = 'lobby'; G.lobby = m; G.hostId = m.hostId; G.code = m.code; G.settings = m.settings;
  G.players = m.players;
  showScreen('lobby');
  document.body.classList.toggle('is-host', m.hostId === G.you);
  $('roomCode').textContent = m.code;
  $('playerCount').textContent = `(${m.players.length}/${m.settings.maxPlayers})`;
  $('playerList').innerHTML = m.players.map(p => `
    <li><span class="swatch" style="background:${p.color}"></span>
    <span class="pname">${esc(p.name)}${p.id === G.you ? ' <span class="muted">(Du)</span>' : ''}</span>
    ${p.id === m.hostId ? '<span class="tag host">Gastgeber</span>' : ''}
    ${p.isBot ? `<span class="tag">Bot · ${({ easy: 'leicht', normal: 'normal', hard: 'schwer' })[p.difficulty] || ''}</span>` : ''}
    ${!p.isBot && !p.connected ? '<span class="tag off">getrennt</span>' : ''}
    ${G.you === m.hostId && p.id !== G.you ? `<button class="kick" data-kick="${p.id}" title="Entfernen">✕</button>` : ''}</li>`).join('');
  const myColor = (m.players[G.you] || {}).color;
  const used = new Set(m.players.map(p => p.color));
  $('colorPicker').innerHTML = COLORS.map(c => `<button style="background:${c}" data-color="${c}" class="${c === myColor ? 'on' : ''}" ${used.has(c) && c !== myColor ? 'disabled' : ''}></button>`).join('');
  for (const d of SETTINGS_DEF) {
    const el = $('s_' + d.key); const v = m.settings[d.key];
    if (document.activeElement === el) continue;
    if (d.type === 'check') el.checked = !!v; else el.value = v;
    if (d.type === 'range') $('o_' + d.key).textContent = d.fmt(v);
  }
  $('lobbyHint').textContent = m.hostId === G.you
    ? (m.players.length < 2 ? 'Lade Freunde ein oder füge Bots hinzu.' : 'Bereit, wenn du es bist.')
    : 'Warte, bis der Gastgeber das Spiel startet…';
}

// ---------------- Spielzustand ----------------
function tupleToRegion(t) {
  return { owner: t[1], troops: t[2], b: [t[3], t[4], t[5]], capital: !!t[6], hidden: t[2] < 0 };
}
function tupleToArmy(t) { return { id: t[0], owner: t[1], from: t[2], to: t[3], count: t[4], start: t[5], arrive: t[6], type: t[7] }; }

function onState(m) {
  const prevPhase = G.phase;
  G.phase = m.phase; G.hostId = m.hostId; G.settings = m.settings; G.you = m.you; G.code = m.code;
  G.regions = new Array(G.map.regions.length);
  for (const t of m.regions) G.regions[t[0]] = tupleToRegion(t);
  G.armies = new Map(m.armies.map(t => [t[0], tupleToArmy(t)]));
  G.players = m.players;
  G.picks = new Map(m.picks);
  G.serverTime = m.time; G.recvAt = performance.now();
  G.draftLeft = m.draftLeft;
  G.selected.clear(); G.targeting = null;
  showScreen('game');
  $('menuCode').textContent = m.code;
  renderer.resize();
  if (prevPhase !== 'draft' && prevPhase !== 'play') renderer.fitWorld();
  renderer.dirty = true;
  if (m.phase === 'play' && prevPhase === 'draft') {
    const me = G.players[G.you];
    if (me && me.capital >= 0) renderer.centerOn(me.capital, 2.6);
    banner('Der Krieg beginnt!', 'Erobere benachbarte Regionen – ziehe von deinem Gebiet aus auf ein Ziel.', 3500);
    sfx.alert();
  }
  buildAbilityBar();
  updateHud(true);
}

function onDelta(m) {
  if (G.phase !== 'play') return;
  G.serverTime = m.time; G.recvAt = performance.now();
  let layerDirty = false;
  for (const t of m.r) {
    const old = G.regions[t[0]];
    const n = tupleToRegion(t);
    if (!old || old.owner !== n.owner || old.hidden !== n.hidden) layerDirty = true;
    G.regions[t[0]] = n;
  }
  for (const t of m.a) G.armies.set(t[0], tupleToArmy(t));
  if (m.p) { G.players = m.p; }
  if (m.e && m.e.length) onEvents(m.e);
  // angekommene Armeen entfernen
  const now = m.time;
  for (const [id, a] of G.armies) if (a.arrive <= now) G.armies.delete(id);
  if (layerDirty) { renderer.dirty = true; G.minimapDirty = true; }
  // Auswahl bereinigen, falls Regionen verloren
  for (const id of G.selected) if (G.regions[id].owner !== G.you && G.selected.size > 1) G.selected.delete(id);
}

function pname(id) {
  const p = G.players[id];
  if (!p) return '<b>Neutral</b>';
  return `<b style="color:${p.color}">${esc(p.name)}</b>`;
}
function rname(id) { const r = G.map.regions[id]; return r ? `<span class="rg" data-region="${id}">${esc(r.name)}</span>` : '?'; }

function onEvents(list) {
  const me = G.you;
  for (const e of list) {
    const pc = G.players[e.p] ? G.players[e.p].color : '#fff';
    switch (e.k) {
      case 'capture':
        renderer.addEffect('capture', e.r, pc);
        if (e.p === me) { sfx.capture(); if (e.q >= 0) feed(`Du hast ${rname(e.r)} von ${pname(e.q)} erobert.`); }
        else if (e.q === me) { sfx.lost(); feed(`⚠ ${pname(e.p)} hat ${rname(e.r)} erobert!`, 'bad'); }
        break;
      case 'repel':
        renderer.addEffect('repel', e.r);
        if (e.q === me && e.p >= 0) feed(`Angriff von ${pname(e.p)} auf ${rname(e.r)} abgewehrt.`);
        break;
      case 'capital':
        feed(`★ ${pname(e.p)} hat die Hauptstadt von ${pname(e.q)} eingenommen${e.g ? ` und ${e.g} Gold erbeutet` : ''}!`, e.q === me ? 'bad' : '');
        if (e.q === me) { banner('Hauptstadt gefallen!', 'Eine neue Hauptstadt wurde ernannt.', 3000); sfx.alert(); }
        if (e.p === me) banner('Hauptstadt erobert!', `+${e.g} Gold Beute`, 2500);
        break;
      case 'elim':
        feed(e.s ? `${pname(e.p)} hat kapituliert.` : `☠ ${pname(e.p)} wurde ${e.by >= 0 ? 'von ' + pname(e.by) + ' ' : ''}ausgelöscht.`);
        if (e.p === me) { banner('Du wurdest besiegt', 'Du kannst weiter zuschauen.', 5000); G.selected.clear(); }
        break;
      case 'ability': {
        const ab = ABILITIES[e.a];
        if (e.a === 'airstrike' || e.a === 'sabotage') { renderer.addEffect('strike', e.r); if (e.p === me || e.q === me) sfx.strike(); }
        if (e.p === me || e.q === me || e.a === 'mobilize') feed(`${ab.icon} ${pname(e.p)}: ${ab.name}${e.r >= 0 ? ' auf ' + rname(e.r) : ''}`, e.q === me ? 'bad' : '');
        break;
      }
      case 'build':
        renderer.addEffect('build', e.r); sfx.build();
        break;
      case 'allyReq':
        if (e.q === me) { feed(`🤝 ${pname(e.p)} bietet dir ein Bündnis an.`); banner(`${G.players[e.p].name} bietet ein Bündnis an`, 'Annehmen in der Nationen-Liste links.', 3500); sfx.alert(); }
        break;
      case 'ally':
        G.sentAllyReq.delete(e.p); G.sentAllyReq.delete(e.q);
        feed(`🤝 ${pname(e.p)} und ${pname(e.q)} sind jetzt verbündet.`);
        break;
      case 'allyDecline':
        if (e.q === me) { feed(`${pname(e.p)} hat dein Bündnisangebot abgelehnt.`); G.sentAllyReq.delete(e.p); }
        break;
      case 'betray':
        feed(`💔 ${pname(e.p)} hat das Bündnis mit ${pname(e.q)} gebrochen!`, e.q === me ? 'bad' : '');
        if (e.q === me) sfx.alert();
        break;
      case 'support':
        if (e.q === me) feed(`${pname(e.p)} schickt dir ${e.n} Truppen nach ${rname(e.r)}.`);
        break;
      default:
    }
  }
  G.scoreKey = null;
}

function onEnd(m) {
  G.ended = m;
  G.phase = 'end';
  const won = m.winners.includes(G.you);
  $('endTitle').textContent = won ? 'SIEG!' : (m.winners.length ? (m.winners.map(w => m.players[w].name).join(' & ') + ' gewinnt') : 'Spielende');
  $('endTitle').style.color = won ? 'var(--accent)' : '';
  const mm = Math.floor(m.duration / 60), ss = String(m.duration % 60).padStart(2, '0');
  $('endReason').textContent = `${m.reason} · Spieldauer ${mm}:${ss} (Spielzeit)`;
  const rows = [...m.players].sort((a, b) => (m.winners.includes(b.id) - m.winners.includes(a.id)) || b.regions - a.regions || (b.eliminatedAt || 1e9) - (a.eliminatedAt || 1e9));
  $('endTable').innerHTML = '<tr><th>#</th><th>Nation</th><th>Regionen</th><th>Eroberungen</th><th>Besiegte Truppen</th></tr>' +
    rows.map((p, i) => `<tr><td>${i + 1}</td><td><span class="sw" style="background:${p.color}"></span>${esc(p.name)}${m.winners.includes(p.id) ? ' 👑' : ''}</td><td>${p.regions}</td><td>${p.captured}</td><td>${fmt(p.kills)}</td></tr>`).join('');
  $('rematchBtn').classList.toggle('hidden', G.hostId !== G.you);
  $('endScreen').classList.remove('hidden');
  drawEndChart(m);
  if (won) sfx.win();
}
function drawEndChart(m) {
  const c = $('endChart'), g = c.getContext('2d');
  const W = c.width, H = c.height, pad = 30;
  g.clearRect(0, 0, W, H);
  const maxT = Math.max(1, ...m.players.flatMap(p => p.history.map(h => h[0])));
  const maxV = Math.max(1, ...m.players.flatMap(p => p.history.map(h => h[1])));
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.fillStyle = '#8d9ab3'; g.font = '11px Inter, sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = H - pad - (H - 2 * pad) * i / 4;
    g.beginPath(); g.moveTo(pad, y); g.lineTo(W - 10, y); g.stroke();
    g.fillText(Math.round(maxV * i / 4), 4, y + 4);
  }
  g.fillText('Regionen im Verlauf', pad, 16);
  for (const p of m.players) {
    if (!p.history.length) continue;
    g.strokeStyle = p.color; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath();
    p.history.forEach(([t, v], i) => {
      const x = pad + (W - pad - 10) * t / maxT, y = H - pad - (H - 2 * pad) * v / maxV;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  }
}

// ---------------- Feed & Chat ----------------
function feed(html, cls = '') {
  const t = G.gameTime();
  const el = document.createElement('div');
  if (cls === 'bad') el.style.color = '#ffb0a8';
  el.innerHTML = `<span class="t">${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</span>${html}`;
  const f = $('feed');
  f.appendChild(el);
  while (f.children.length > 80) f.firstChild.remove();
  f.scrollTop = f.scrollHeight;
}
let unread = 0;
function addChat(c, silent) {
  const line = document.createElement('div');
  if (c.from < 0) { line.className = 'sys'; line.textContent = c.text; } else {
    line.innerHTML = `<b style="color:${c.color}">${esc(c.name)}${c.allies ? ' (Bündnis)' : ''}:</b> ${esc(c.text)}`;
    if (c.allies) line.classList.add('ally');
  }
  for (const id of ['chatLog', 'lobbyChatLog']) {
    const box = $(id); box.appendChild(line.cloneNode(true));
    while (box.children.length > 100) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  }
  if (!silent && c.from >= 0 && $('chatBox').classList.contains('hidden') && G.phase !== 'lobby') {
    unread++; $('chatBadge').textContent = unread; $('chatBadge').classList.remove('hidden');
  }
}

// ---------------- HUD ----------------
let toastTimer, bannerTimer;
function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
function banner(title, sub = '', ms = 2500) {
  const b = $('banner'); b.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : ''); b.classList.remove('hidden');
  clearTimeout(bannerTimer); if (ms) bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

function myStats() {
  let regions = 0, troops = 0, inc = 0.6;
  for (let i = 0; i < G.regions.length; i++) {
    const r = G.regions[i];
    if (r && r.owner === G.you) { regions++; troops += r.troops; inc += income({ value: G.map.regions[i].value, b: r.b }); }
  }
  return { regions, troops, inc };
}

function updateHud(force) {
  if (G.phase === 'draft') {
    $('phaseLabel').textContent = `Startwahl · ${G.draftLeft ?? ''} s`;
    if (!$('banner').dataset.draft) {
      banner('Wähle dein Startgebiet', 'Klicke auf ein freies Gebiet. Abgedunkelte Gebiete sind zu nah an anderen Spielern.', 0);
      $('banner').dataset.draft = '1';
    }
  } else {
    if ($('banner').dataset.draft) { delete $('banner').dataset.draft; $('banner').classList.add('hidden'); }
    const peaceLeft = (G.settings.peace || 0) - G.gameTime();
    $('phaseLabel').textContent = G.phase === 'end' ? 'Spielende' : (G.players[G.you] && !G.players[G.you].alive ? 'Zuschauer'
      : peaceLeft > 0 ? `Friedensphase · ${Math.ceil(peaceLeft / (G.settings.speed || 1))} s` : 'Im Krieg');
  }
  const s = myStats();
  $('goldVal').textContent = Math.floor(G.me.gold || 0);
  $('incomeVal').textContent = `+${(s.inc * (G.settings.speed || 1)).toFixed(1)}/s`;
  $('regionVal').textContent = s.regions;
  $('troopVal').textContent = fmt(s.troops);
  const t = G.gameTime();
  const lim = G.settings.timeLimit ? G.settings.timeLimit * 60 : 0;
  const shown = lim ? Math.max(0, lim - t) : t;
  $('timeVal').textContent = `${Math.floor(shown / 60)}:${String(Math.floor(shown % 60)).padStart(2, '0')}`;
  updateScoreboard();
  updateInfo();
  if (G.hover >= 0 && G.mouse && !$('tooltip').classList.contains('hidden')) showTooltip(G.hover, G.mouse[0], G.mouse[1]);
  updateAbilities();
}

function updateScoreboard() {
  const me = G.players[G.you];
  const total = G.map.regions.length;
  const list = [...G.players].sort((a, b) => (b.alive - a.alive) || b.regions - a.regions || b.troops - a.troops);
  const reqs = new Set(G.me.allyReq || []);
  const key = JSON.stringify([list.map(p => [p.id, p.regions, Math.round(p.troops / 10), p.alive, p.allies, p.connected]), [...reqs], [...G.sentAllyReq], G.phase]);
  if (key === G.scoreKey) return;
  G.scoreKey = key;
  $('scoreList').innerHTML = list.map(p => {
    let dip = '';
    if (me && me.alive && p.alive && p.id !== G.you && G.phase === 'play') {
      if (me.allies.includes(p.id)) dip = `<span class="ally-badge">🤝 verbündet</span><button class="dip break" data-dip="break" data-p="${p.id}">brechen</button>`;
      else if (reqs.has(p.id)) dip = `<button class="dip accept" data-dip="accept" data-p="${p.id}">✓ Bündnis annehmen</button><button class="dip" data-dip="decline" data-p="${p.id}">✕</button>`;
      else if (G.sentAllyReq.has(p.id)) dip = '<span>Angebot gesendet…</span>';
      else dip = `<button class="dip" data-dip="propose" data-p="${p.id}">Bündnis anbieten</button>`;
    } else if (me && p.id !== G.you && me.allies.includes(p.id)) dip = '<span class="ally-badge">🤝</span>';
    const status = !p.alive ? '☠ besiegt' : (!p.isBot && !p.connected ? '⚠ getrennt' : (p.isBot ? 'Bot' : ''));
    return `<li class="${p.id === G.you ? 'me' : ''} ${p.alive ? '' : 'dead'}">
      <span class="sw" style="background:${p.color}"></span>
      <span class="nm">${esc(p.name)}${p.id === G.you ? ' (Du)' : ''}</span>
      <span class="num">${p.regions}</span>
      <span class="sub">${status ? `<span>${status}</span>` : ''}<span>⚑ ${fmt(p.troops)}</span>${dip}</span>
      <span class="bar"><i style="width:${(p.regions / total * 100).toFixed(1)}%;background:${p.color}"></i></span></li>`;
  }).join('');
}

function updateInfo() {
  const panel = $('infoPanel');
  const sel = [...G.selected];
  const id = sel.length === 1 ? sel[0] : (sel.length === 0 && G.inspect != null ? G.inspect : -1);
  if (sel.length > 1) {
    const troops = sel.reduce((s, i) => s + G.regions[i].troops, 0);
    const html = `<div class="info-head"><h2>${sel.length} Regionen</h2></div><div class="info-sub">Sammelangriff: Klicke ein Ziel, das an mindestens eine ausgewählte Region grenzt.</div>
      <div class="info-grid"><div><small>Truppen gesamt</small><b>${fmt(troops)}</b></div><div><small>Gesendet</small><b>${fmt(troops * G.pct)}</b></div></div>`;
    if (panel._html !== html) { panel.querySelector('#infoContent').innerHTML = html; panel._html = html; }
    panel.classList.remove('hidden');
    return;
  }
  if (id < 0 || G.phase === 'draft') { panel.classList.add('hidden'); panel._html = ''; return; }
  const r = G.map.regions[id], st = G.regions[id];
  const owner = st.owner >= 0 ? G.players[st.owner] : null;
  const mine = st.owner === G.you;
  const reg = { value: r.value, b: st.b, capital: st.capital };
  const mob = mine && G.me.mob > G.gameTime();
  const spd = G.settings.speed || 1;
  let html = `<div class="info-head"><span style="width:14px;height:14px;border-radius:4px;background:${owner ? owner.color : '#4a5468'}"></span><h2>${esc(r.name)}${st.capital ? ' ★' : ''}</h2></div>
    <div class="info-sub">${r.country !== r.name ? esc(r.country) + ' · ' : ''}${owner ? esc(owner.name) : 'Neutral'} · Wert ${r.value}</div>`;
  if (st.hidden) html += '<div class="info-sub">Im Nebel des Krieges – keine Informationen.</div>';
  else {
    html += `<div class="info-grid">
      <div><small>Truppen</small><b>${fmt(st.troops)}</b>${owner ? ` <small style="display:inline">/ ${capacity(reg)}</small>` : ''}</div>
      <div><small>Verteidigung</small><b>×${defenseMult(reg).toFixed(2)}</b></div>
      ${owner ? `<div><small>Produktion</small><b>+${(production(reg, mob) * spd).toFixed(1)}/s</b></div>
      <div><small>Gold</small><b>+${(income(reg) * spd).toFixed(2)}/s</b></div>` : ''}
      <div><small>Verbindungen</small><b>${r.adj.length}</b></div>
      ${mine ? '' : `<div><small>Zum Erobern nötig</small><b>&gt; ${fmt(st.troops * defenseMult(reg))}</b></div>`}
    </div>`;
    if (mine) {
      for (const k of BUILDING_KEYS) {
        const i = BUILDING_KEYS.indexOf(k), lvl = st.b[i], cost = buildCost(k, lvl), bd = BUILDINGS[k];
        const can = lvl < MAX_LEVEL && G.me.gold >= cost;
        html += `<div class="build"><span class="ic">${bd.icon}</span><div><b>${bd.name}</b><small>${bd.desc}</small>
          <div class="lv">${[0, 1, 2].map(l => `<i class="${l < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          ${lvl < MAX_LEVEL ? `<button class="btn small" data-build="${k}" data-region="${id}" ${can ? '' : 'disabled'}><span class="cost">● ${cost}</span></button>` : '<span class="muted small">max</span>'}</div>`;
      }
    } else if (st.b.some(x => x > 0)) {
      html += `<div class="info-sub">Gebäude: ${BUILDING_KEYS.map((k, i) => st.b[i] ? `${BUILDINGS[k].icon} ${BUILDINGS[k].name} ${st.b[i]}` : '').filter(Boolean).join(' · ')}</div>`;
    }
  }
  if (panel._html !== html) { $('infoContent').innerHTML = html; panel._html = html; }
  panel.classList.remove('hidden');
}

function buildAbilityBar() {
  $('abilityBar').innerHTML = ABILITY_KEYS.map((k, i) => {
    const a = ABILITIES[k];
    return `<div class="ability" data-ability="${k}" title="${a.name} (${'QWER'[i]}) – ${a.desc} Kosten: ${a.cost} Gold, Abklingzeit ${a.cooldown} s">
      <span class="key">${'QWER'[i]}</span><span class="ai">${a.icon}</span><span class="ac">● ${a.cost}</span><span class="cd"></span></div>`;
  }).join('');
}
function updateAbilities() {
  const bar = $('abilityBar');
  const me = G.players[G.you];
  bar.classList.toggle('hidden', G.phase !== 'play' || !me || !me.alive);
  const t = G.gameTime();
  for (const el of bar.children) {
    const k = el.dataset.ability, a = ABILITIES[k];
    const cdEnd = (G.me.cooldowns || {})[k] || 0;
    const left = Math.max(0, cdEnd - t);
    el.querySelector('.cd').style.height = (left / a.cooldown * 100) + '%';
    el.classList.toggle('off', left > 0 || G.me.gold < a.cost);
    el.classList.toggle('armed', G.targeting === k);
    const active = k === 'mobilize' && G.me.mob > t;
    if (active !== !!el.querySelector('.active')) {
      if (active) el.insertAdjacentHTML('beforeend', '<span class="active"></span>'); else el.querySelector('.active').remove();
    }
  }
}

// ---------------- Aktionen ----------------
function linked(a, b) { return G.map.regions[a].adj.some(([o]) => o === b); }
function isFriendly(id) {
  const st = G.regions[id]; const me = G.players[G.you];
  return st.owner === G.you || (me && me.allies.includes(st.owner));
}
function sendFrom(froms, to) {
  const valid = froms.filter(f => f !== to && G.regions[f].owner === G.you && linked(f, to));
  if (!valid.length) return false;
  send({ t: 'send', from: valid.length === 1 ? valid[0] : valid, to, pct: G.pct });
  sfx.send();
  return true;
}
function armAbility(k) {
  const a = ABILITIES[k];
  if (G.phase !== 'play') return;
  if (G.targeting === k) { G.targeting = null; renderer.canvas.style.cursor = ''; return; }
  if (a.target === 'none') { send({ t: 'ability', kind: k, target: 0 }); return; }
  if (k === 'paradrop') {
    const src = [...G.selected].find(id => G.regions[id].owner === G.you);
    if (src == null) { toast('Wähle zuerst eine eigene Region als Startpunkt.'); return; }
  }
  G.targeting = k;
  renderer.canvas.style.cursor = 'crosshair';
  toast(`${a.name}: Ziel auswählen (Esc bricht ab)`);
}
function clickRegion(id, shift) {
  if (G.phase === 'draft') { send({ t: 'pick', region: id }); return; }
  if (G.phase !== 'play') { G.inspect = id; return; }
  const meAlive = G.players[G.you] && G.players[G.you].alive;
  if (G.targeting) {
    const k = G.targeting;
    const src = [...G.selected].find(s => G.regions[s].owner === G.you);
    send({ t: 'ability', kind: k, target: id, source: src });
    G.targeting = null; renderer.canvas.style.cursor = '';
    return;
  }
  const st = G.regions[id];
  if (meAlive && G.selected.size && !G.selected.has(id)) {
    const froms = [...G.selected];
    if (froms.some(f => linked(f, id)) && !(shift && st.owner === G.you)) {
      sendFrom(froms, id);
      if (st.owner !== G.you) return;
      return;
    }
  }
  if (st.owner === G.you && meAlive) {
    if (shift) { if (G.selected.has(id)) G.selected.delete(id); else G.selected.add(id); } else {
      if (G.selected.size === 1 && G.selected.has(id)) { G.selected.clear(); G.inspect = id; } else { G.selected.clear(); G.selected.add(id); }
    }
    sfx.click();
  } else {
    G.selected.clear(); G.inspect = id;
  }
}

// ---------------- Eingabe ----------------
function setupInput() {
  const cv = $('map');
  const pointers = new Map();
  let down = null, pinch = null;

  cv.addEventListener('pointerdown', e => {
    sfx.unlock();
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      down = null; G.drag = null; return;
    }
    const hit = renderer.hitTest(e.clientX, e.clientY);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, hit, button: e.button, shift: e.shiftKey };
    // Ziehen von eigener Region startet einen Angriff
    if (G.phase === 'play' && e.button === 0 && hit >= 0 && G.regions[hit].owner === G.you && !G.targeting) {
      const froms = G.selected.has(hit) ? [...G.selected] : [hit];
      down.dragFrom = froms;
    }
  });
  cv.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      renderer.pan(cx - pinch.cx, cy - pinch.cy);
      renderer.zoomAt(cx, cy, d / pinch.d);
      pinch = { d, cx, cy };
      return;
    }
    G.mouse = [e.clientX, e.clientY];
    const hit = renderer.hitTest(e.clientX, e.clientY);
    if (hit !== G.hover) { G.hover = hit; showTooltip(hit, e.clientX, e.clientY); } else if (hit >= 0) moveTooltip(e.clientX, e.clientY);
    if (!down) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist > 6) down.moved = true;
    if (down.dragFrom && down.moved) {
      const R = G.map.regions;
      const valid = hit >= 0 && down.dragFrom.some(f => f !== hit && linked(f, hit));
      const to = valid ? [R[hit].cx, R[hit].cy] : renderer.screenToWorld(e.clientX, e.clientY);
      G.drag = { fromPts: down.dragFrom.map(f => [R[f].cx, R[f].cy]), to, valid, target: valid ? hit : -1 };
      cv.style.cursor = valid ? 'pointer' : 'grabbing';
    } else if (down.moved) {
      renderer.pan(e.clientX - down.lx, e.clientY - down.ly);
      cv.style.cursor = 'grabbing';
    }
    down.lx = e.clientX; down.ly = e.clientY;
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!down) return;
    const d = down; down = null;
    cv.style.cursor = G.targeting ? 'crosshair' : '';
    if (G.drag) {
      if (G.drag.valid) sendFrom(d.dragFrom, G.drag.target);
      G.drag = null; return;
    }
    if (d.moved) return;
    if (d.button === 2) { G.selected.clear(); G.targeting = null; G.inspect = null; return; }
    if (d.hit >= 0) clickRegion(d.hit, d.shift || e.shiftKey);
    else { G.selected.clear(); G.inspect = null; G.targeting = null; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { G.hover = -1; $('tooltip').classList.add('hidden'); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
    renderer.zoomAt(e.clientX, e.clientY, f);
    G.hover = renderer.hitTest(e.clientX, e.clientY);
    showTooltip(G.hover, e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (G.phase !== 'play' && G.phase !== 'draft' && G.phase !== 'end') return;
    const k = e.key.toLowerCase();
    if (['1', '2', '3', '4'].includes(k)) setPct([0.25, 0.5, 0.75, 1][+k - 1]);
    else if (k === 'escape') { G.selected.clear(); G.targeting = null; G.inspect = null; renderer.canvas.style.cursor = ''; $('menu').classList.add('hidden'); }
    else if (k === ' ') { e.preventDefault(); const me = G.players[G.you]; if (me && me.capital >= 0) renderer.centerOn(me.capital); }
    else if (k === 'enter') { e.preventDefault(); switchTab('chat'); $('chatInput').focus(); }
    else if ('qwer'.includes(k) && k.length === 1) armAbility(ABILITY_KEYS['qwer'.indexOf(k)]);
    else if (k === 'f') renderer.fitWorld();
    else if (k === 'a' && e.ctrlKey) { e.preventDefault(); G.selected = new Set(G.regions.map((r, i) => r.owner === G.you ? i : -1).filter(i => i >= 0)); }
  });
  window.addEventListener('resize', () => { renderer.resize(); G.minimapDirty = true; });

  const mm = $('minimap');
  const mmMove = e => {
    const rect = mm.getBoundingClientRect();
    renderer.cam.x = (e.clientX - rect.left) / rect.width * G.map.width;
    renderer.cam.y = (e.clientY - rect.top) / rect.height * G.map.height;
    renderer.clampCam(); renderer.dirty = true; G.minimapDirty = true;
  };
  mm.addEventListener('pointerdown', e => { mm.setPointerCapture(e.pointerId); mmMove(e); mm._drag = true; });
  mm.addEventListener('pointermove', e => { if (mm._drag) mmMove(e); });
  mm.addEventListener('pointerup', () => { mm._drag = false; });
}
function setPct(p) {
  G.pct = p;
  for (const b of $('pctGroup').children) b.classList.toggle('on', Number(b.dataset.p) === p);
}
function showTooltip(id, x, y) {
  const tt = $('tooltip');
  if (id < 0) { tt.classList.add('hidden'); return; }
  const r = G.map.regions[id], st = G.regions[id];
  if (!st) { tt.classList.add('hidden'); return; }
  const owner = G.phase === 'draft' ? null : G.players[st.owner];
  let extra = '';
  if (G.phase === 'play' && G.selected.size && !G.selected.has(id)) {
    const froms = [...G.selected].filter(f => linked(f, id));
    if (froms.length) {
      const sending = froms.reduce((s, f) => s + Math.floor(G.regions[f].troops * G.pct), 0);
      if (isFriendly(id)) extra = `<br>→ Verstärkung: ${fmt(sending)}`;
      else if (!st.hidden) {
        const need = st.troops * defenseMult({ b: st.b, capital: st.capital });
        extra = `<br>${sending > need ? '✅' : '❌'} Angriff: ${fmt(sending)} gegen ${fmt(need)}`;
      }
    }
  }
  tt.innerHTML = `<b>${esc(r.name)}</b>${r.country !== r.name ? ` <span class="muted">(${esc(r.country)})</span>` : ''}<br>${owner ? `<span style="color:${owner.color}">${esc(owner.name)}</span>` : 'Neutral'} · ${st.hidden ? '?' : fmt(st.troops)} Truppen${extra}`;
  tt.classList.remove('hidden');
  moveTooltip(x, y);
}
function moveTooltip(x, y) {
  const tt = $('tooltip');
  tt.style.left = Math.min(window.innerWidth - tt.offsetWidth - 8, x + 16) + 'px';
  tt.style.top = Math.min(window.innerHeight - tt.offsetHeight - 8, y + 16) + 'px';
}
function switchTab(name) {
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  $('feed').classList.toggle('hidden', name !== 'feed');
  $('chatBox').classList.toggle('hidden', name !== 'chat');
  if (name === 'chat') { unread = 0; $('chatBadge').classList.add('hidden'); $('chatLog').scrollTop = 1e9; }
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
    G.phase = 'home'; G.ended = null; showScreen('home'); $('menu').classList.add('hidden');
  };
  $('leaveLobby').onclick = leave;
  $('leaveGame').onclick = leave;
  $('endLeave').onclick = leave;
  $('addBot').onclick = () => send({ t: 'addBot', difficulty: $('botDiff').value });
  $('startBtn').onclick = () => send({ t: 'start' });
  $('playerList').onclick = e => { const b = e.target.closest('[data-kick]'); if (b) send({ t: 'kick', player: +b.dataset.kick }); };
  $('colorPicker').onclick = e => { const b = e.target.closest('[data-color]'); if (b && !b.disabled) send({ t: 'color', color: b.dataset.color }); };
  const chatSend = (input, allies) => {
    const text = input.value.trim(); if (!text) return;
    send({ t: 'chat', text, allies }); input.value = '';
  };
  $('lobbyChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') chatSend(e.target, false); });
  $('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { chatSend(e.target, $('allyChat').checked); } });

  $('pctGroup').onclick = e => { const b = e.target.closest('button'); if (b) setPct(Number(b.dataset.p)); };
  $('soundBtn').onclick = () => { $('soundBtn').textContent = sfx.toggle() ? '🔊' : '🔇'; };
  $('soundBtn').textContent = sfx.enabled ? '🔊' : '🔇';
  $('menuBtn').onclick = () => $('menu').classList.toggle('hidden');
  $('closeMenu').onclick = () => $('menu').classList.add('hidden');
  $('surrenderBtn').onclick = () => { if (confirm('Wirklich kapitulieren? Deine Gebiete werden neutral.')) { send({ t: 'surrender' }); $('menu').classList.add('hidden'); } };
  $('rematchBtn').onclick = () => send({ t: 'rematch' });
  $('endView').onclick = () => $('endScreen').classList.add('hidden');
  document.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); };
  document.querySelectorAll('.collapse').forEach(b => { b.onclick = () => { const t = $(b.dataset.target); t.classList.toggle('hidden'); b.textContent = t.classList.contains('hidden') ? '+' : '–'; }; });
  $('scoreList').onclick = e => {
    const b = e.target.closest('[data-dip]'); if (!b) return;
    const action = b.dataset.dip, p = +b.dataset.p;
    if (action === 'break' && !confirm('Bündnis wirklich brechen?')) return;
    send({ t: 'ally', player: p, action });
    if (action === 'propose') G.sentAllyReq.add(p);
    G.scoreKey = null;
  };
  $('infoPanel').onclick = e => {
    const b = e.target.closest('[data-build]');
    if (b) send({ t: 'build', region: +b.dataset.region, kind: b.dataset.build });
  };
  $('abilityBar').onclick = e => { const b = e.target.closest('[data-ability]'); if (b) armAbility(b.dataset.ability); };
  $('feed').onclick = e => { const r = e.target.closest('[data-region]'); if (r) renderer.centerOn(+r.dataset.region); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && renderer) renderer.dirty = true; });
}

// ---------------- Hauptschleife ----------------
let lastHud = 0, lastMini = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (G.phase === 'draft' || G.phase === 'play' || G.phase === 'end') {
    renderer.frame(G, now);
    if (now - lastHud > 250) { lastHud = now; updateHud(); }
    if (now - lastMini > 1000 || (G.minimapDirty && now - lastMini > 120)) {
      lastMini = now; G.minimapDirty = false;
      if ($('minimap').offsetParent) renderer.drawMinimap($('minimap'), G);
    }
  } else if (renderer && (G.phase === 'home' || G.phase === 'lobby') && now - (G.lastMenuFrame || 0) > 50) {
    G.lastMenuFrame = now;
    // dekorativer Hintergrund: langsam wandernde Karte
    if (!G.bgRegions) {
      G.bgRegions = G.map.regions.map(() => ({ owner: -1, troops: 0, b: [0, 0, 0] }));
    }
    const saved = { regions: G.regions, phase: G.phase };
    G.regions = G.bgRegions;
    renderer.cam.x = G.map.width / 2 + Math.sin(now / 9000) * 300;
    renderer.cam.z = Math.max(renderer.minZ, Math.min(window.innerWidth / G.map.width, window.innerHeight / G.map.height) * 1.6);
    renderer.clampCam(); renderer.dirty = true;
    G.phase = 'menu';
    renderer.frame({ ...G, selected: new Set(), hover: -1, drag: null, armies: new Map(), picks: new Map(), regions: G.bgRegions }, now);
    G.regions = saved.regions; G.phase = saved.phase;
  }
}

async function init() {
  setupUi();
  const res = await fetch('map.json');
  G.map = await res.json();
  renderer = new MapRenderer($('map'), G.map);
  window.__G = G; window.__R = renderer; // Debug-Zugriff (Konsole)
  setupInput();
  requestAnimationFrame(loop);
  connect();
}
init();
