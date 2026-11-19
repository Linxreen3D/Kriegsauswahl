// Diplomatie-Oberfläche: Spielerliste, privater Chat, Vertragsfenster, Ereignisse, Chronik.
import { RES, RES_ICONS, RES_NAMES, NATIONS, EVENTS, PACT_MINUTES, repLabel, REP_LOW } from '/shared/rules.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createDiplomacy({ G, send, notice, selectedOwn }) {
  const D = { sel: null, chats: {}, unread: {}, proposals: [], chron: [], evKey: null, draft: null };

  // ---------- Hilfen ----------
  const me = () => G.players[G.you];
  const pl = id => G.players[id];
  const relText = id => {
    const p = me(); if (!p) return '';
    if (p.team === pl(id).team && G.settings.mode === 'teams') return '🤝 Team';
    if ((p.allies || []).includes(id)) {
      const c = ((G.me.dip && G.me.dip.cancels) || []).find(x => x[0] === id);
      return c ? `🤝 Bündnis (endet in ${fmtT(c[1])})` : '🤝 Bündnis';
    }
    const pact = (p.pacts || []).find(x => x[0] === id);
    if (pact) return `🕊 Pakt (${fmtT(pact[1])})`;
    return '⚔ Krieg';
  };
  const hasContact = id => { const p = me(); return !!p && ((p.contacts || []).includes(id) || (p.allies || []).includes(id) || (G.settings.mode === 'teams' && p.team === pl(id).team)); };
  const provName = i => (G.provinces[i] ? G.provinces[i].name : '?');
  D.isPact = id => !!(me() && (me().pacts || []).some(x => x[0] === id));

  // Angebot in Worten, aus Sicht des Betrachters
  function describe(prop) {
    const o = prop.offer, mine = prop.from === G.you, other = pl(mine ? prop.to : prop.from);
    const side = s => {
      const parts = [];
      for (const k in s.res) parts.push(`${s.res[k]} ${RES_ICONS[k]}`);
      if (s.tribute) parts.push(`Tribut ${s.tribute.perMin} ${RES_ICONS[s.tribute.res]}/min für ${s.tribute.min} min`);
      if (s.prov.length) parts.push('Provinz ' + s.prov.map(provName).join(', '));
      if (s.units.length) parts.push(`${s.units.length} Einheiten`);
      return parts.join(' · ') || 'nichts';
    };
    const a = mine ? 'Du gibst' : `${esc(other.name)} gibt`, b = mine ? `${esc(other.name)} gibt` : 'Du gibst';
    const terms = [o.alliance ? '🤝 Bündnis' : '', o.pact ? `🕊 Nichtangriffspakt ${o.pact} min` : ''].filter(Boolean).join(' · ');
    return `<div><b>${a}:</b> ${side(o.give)}</div><div><b>${b}:</b> ${side(o.get)}</div>${terms ? `<div><b>Vereinbarung:</b> ${terms}</div>` : ''}`;
  }

  // ---------- Fenster ----------
  D.open = (id = null) => { if (id != null) D.sel = id; $('dipDlg').classList.remove('hidden'); D.render(); };
  D.close = () => $('dipDlg').classList.add('hidden');
  D.render = (listOnly = false) => {
    if ($('dipDlg').classList.contains('hidden')) return;
    const p = me();
    $('dipRep').textContent = p ? `Dein Ansehen: ${repLabel(p.rep)} (${p.rep})` : '';
    const others = G.players.filter(q => q.id !== G.you);
    if (D.sel == null && others.length) D.sel = others[0].id;
    $('dipList').innerHTML = others.map(q => {
      const inc = D.proposals.some(x => x.from === q.id && x.to === G.you), un = D.unread[q.id];
      return `<button class="dip-row ${D.sel === q.id ? 'on' : ''} ${q.alive ? '' : 'dead'}" data-p="${q.id}">
        <span class="sw" style="background:${q.color}"></span><b>${esc(q.name)}</b>${q.nation ? ` <span class="muted">${esc(NATIONS[q.nation].name)}</span>` : ''}
        <span class="dip-sub">${hasContact(q.id) ? relText(q.id) : '✉ kein Kontakt'} · Ansehen ${repLabel(q.rep)}${inc ? ' · <b class="hot">Angebot!</b>' : ''}${un ? ` · <b class="hot">${un} neu</b>` : ''}</span></button>`;
    }).join('');
    // Detailansicht neu zeichnen, wenn sich Kontakt oder Beziehung zum gewählten Spieler geändert hat
    const sig = D.sel != null ? hasContact(D.sel) + '|' + relText(D.sel) + '|' + (pl(D.sel) || {}).rep : '';
    if (!listOnly || sig !== D.paneSig) { D.paneSig = sig; renderPane(); }
  };
  function renderPane() {
    // Eingaben beim Neuzeichnen erhalten
    const chatEl = $('dipChatIn'), keepChat = chatEl ? chatEl.value : '', focusChat = document.activeElement === chatEl;
    if (D.draft && $('dipPropose')) readDraft();
    const detailsOpen = $('dipPane').querySelector('details') ? $('dipPane').querySelector('details').open : null;
    paneHtml();
    const c2 = $('dipChatIn'); if (c2) { c2.value = keepChat; if (focusChat) c2.focus(); }
    const d2 = $('dipPane').querySelector('details'); if (d2 && detailsOpen != null) d2.open = detailsOpen || d2.open;
  }
  function paneHtml() {
    const id = D.sel, q = id != null ? pl(id) : null, box = $('dipPane');
    if (!q) { box.innerHTML = '<p class="muted">Keine anderen Spieler.</p>'; return; }
    D.unread[id] = 0; updateBadge();
    if (!hasContact(id)) {
      box.innerHTML = `<h3>${esc(q.name)}</h3><p class="muted">Noch kein Kontakt. Bilde im Haupthaus einen <b>Botschafter</b> aus (Taste T) und schicke ihn in die Nähe eines Gebäudes von ${esc(q.name)}. Botschafter sind unantastbar – wer einen tötet, verliert Ansehen.</p>`;
      return;
    }
    const allied = (me().allies || []).includes(id);
    const inc = D.proposals.find(x => x.from === id && x.to === G.you), out = D.proposals.find(x => x.from === G.you && x.to === id);
    const chat = (D.chats[id] || []).map(c => `<div class="dc ${c.from === G.you ? 'me' : ''}"><span class="muted">${fmtT(c.t || c.time || 0)}</span> <b>${esc(pl(c.from).name)}:</b> ${esc(c.text)}</div>`).join('');
    box.innerHTML = `
      <div class="dip-pane-head"><h3><span class="sw" style="background:${q.color}"></span>${esc(q.name)}</h3><span>${relText(id)} · Ansehen ${repLabel(q.rep)} (${q.rep})${q.rep < REP_LOW ? ' – unzuverlässig' : ''}</span>
        ${allied ? '<button class="btn small" id="dipCancel">Bündnis kündigen</button>' : ''}</div>
      <div class="dip-chat" id="dipChat">${chat || '<p class="muted">Noch keine Nachrichten.</p>'}</div>
      <div class="row"><input id="dipChatIn" class="chat-input" maxlength="300" placeholder="Private Nachricht an ${esc(q.name)}…"><button class="btn small" id="dipChatSend">Senden</button></div>
      ${inc ? `<div class="dip-offer in"><h4>Angebot von ${esc(q.name)}</h4>${describe(inc)}<div class="row"><button class="btn primary small" data-acc="${inc.id}">Unterzeichnen</button><button class="btn small" data-rej="${inc.id}">Ablehnen</button><button class="btn small" data-counter="${inc.id}">Gegenangebot</button></div></div>` : ''}
      ${out ? `<div class="dip-offer out"><h4>Dein Angebot (wartet)</h4>${describe(out)}<div class="row"><button class="btn small" data-rej="${out.id}">Zurückziehen</button></div></div>` : ''}
      <details class="dip-treaty" ${inc || out ? '' : 'open'}><summary>📜 Vertrag aufsetzen</summary>${editor(id)}</details>`;
    const log = $('dipChat'); log.scrollTop = log.scrollHeight;
  }
  function editor(id) {
    const d = D.draft && D.draft.to === id ? D.draft : (D.draft = { to: id, give: { res: {}, prov: [], units: false, tribute: null }, get: { res: {}, prov: [], tribute: null }, alliance: false, pact: 0 });
    const myProv = G.provinces.filter(p => G.provOwner[p.id] === G.you), theirProv = G.provinces.filter(p => G.provOwner[p.id] === id);
    const resIn = (side, k) => `<label class="ri-in">${RES_ICONS[k]}<input type="number" min="0" step="50" data-side="${side}" data-res="${k}" value="${d[side].res[k] || ''}" placeholder="0"></label>`;
    const tribute = side => `<div class="trib">Tribut: <select data-side="${side}" data-trib="res"><option value="">–</option>${RES.map(k => `<option value="${k}" ${d[side].tribute && d[side].tribute.res === k ? 'selected' : ''}>${RES_NAMES[k]}</option>`).join('')}</select>
      <input type="number" min="0" step="10" data-side="${side}" data-trib="perMin" value="${d[side].tribute ? d[side].tribute.perMin : ''}" placeholder="pro min"> × <input type="number" min="0" max="60" data-side="${side}" data-trib="min" value="${d[side].tribute ? d[side].tribute.min : ''}" placeholder="min"></div>`;
    const provs = (side, list) => list.length ? `<div class="provs">${list.map(p => `<label><input type="checkbox" data-side="${side}" data-prov="${p.id}" ${d[side].prov.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>` : '<div class="muted small">keine Provinzen</div>';
    const nSel = selectedOwn().filter(e => e.def.kind === 'u').length;
    return `<div class="treaty-grid">
      <div><h4>Du gibst</h4><div class="res-row">${RES.map(k => resIn('give', k)).join('')}</div>${tribute('give')}<div class="small">Provinzen:</div>${provs('give', myProv)}
        <label class="small"><input type="checkbox" data-units="1" ${d.give.units ? 'checked' : ''}> Ausgewählte Einheiten übergeben (${nSel})</label></div>
      <div><h4>Du erhältst</h4><div class="res-row">${RES.map(k => resIn('get', k)).join('')}</div>${tribute('get')}<div class="small">Provinzen:</div>${provs('get', theirProv)}</div>
    </div>
    <div class="row"><label><input type="checkbox" data-term="alliance" ${d.alliance ? 'checked' : ''}> 🤝 Bündnis (gemeinsame Sicht, gemeinsamer Sieg)</label>
      <label>🕊 Nichtangriffspakt <select data-term="pact"><option value="0">–</option>${PACT_MINUTES.map(m => `<option value="${m}" ${d.pact === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label></div>
    <div class="row"><button class="btn primary" id="dipPropose">Angebot senden</button><span class="muted small">Erst wenn beide unterzeichnen, wird alles auf einmal getauscht.</span></div>`;
  }
  function readDraft() {
    const d = D.draft, box = $('dipPane');
    for (const el of box.querySelectorAll('[data-res]')) { const v = Math.max(0, Math.floor(+el.value || 0)); if (v) d[el.dataset.side].res[el.dataset.res] = v; else delete d[el.dataset.side].res[el.dataset.res]; }
    for (const side of ['give', 'get']) {
      d[side].prov = [...box.querySelectorAll(`[data-side="${side}"][data-prov]`)].filter(x => x.checked).map(x => +x.dataset.prov);
      const r = box.querySelector(`[data-side="${side}"][data-trib="res"]`).value, pm = +box.querySelector(`[data-side="${side}"][data-trib="perMin"]`).value || 0, mn = +box.querySelector(`[data-side="${side}"][data-trib="min"]`).value || 0;
      d[side].tribute = r && pm > 0 && mn > 0 ? { res: r, perMin: pm, min: mn } : null;
    }
    const u = box.querySelector('[data-units]'); d.give.units = !!(u && u.checked);
    d.alliance = !!box.querySelector('[data-term="alliance"]').checked;
    d.pact = +box.querySelector('[data-term="pact"]').value || 0;
  }

  // ---------- Ereignis-Dialog ----------
  D.onMe = () => {
    const ev = G.me.dip && G.me.dip.ev;
    if (!ev) { if (D.evKey) { $('eventDlg').classList.add('hidden'); D.evKey = null; } return; }
    const E = EVENTS[ev.key];
    if (D.evKey !== ev.key) {
      D.evKey = ev.key;
      $('evTitle').textContent = E.title; $('evText').textContent = E.text;
      $('evOpts').innerHTML = E.options.map((o, i) => `<button class="btn ${i ? '' : 'primary'}" data-ev="${i}">${esc(o.label)}</button>`).join('');
      $('eventDlg').classList.remove('hidden');
    }
    $('evTimer').textContent = `Ohne Entscheidung gilt in ${ev.left} s die erste Möglichkeit.`;
    if (!$('dipDlg').classList.contains('hidden')) D.render();
  };

  // ---------- Server-Nachrichten ----------
  D.onStart = m => {
    const d = m.dip || {};
    D.chats = d.chats || {}; D.proposals = d.proposals || []; D.chron = d.chron || []; D.unread = {}; D.sel = null; D.draft = null; D.evKey = null;
    updateBadge();
  };
  D.onChat = m => {
    (D.chats[m.with] || (D.chats[m.with] = [])).push({ from: m.from, text: m.text, t: m.time });
    if (m.from !== G.you) {
      if ($('dipDlg').classList.contains('hidden') || D.sel !== m.with) { D.unread[m.with] = (D.unread[m.with] || 0) + 1; notice(`✉ ${pl(m.from).name}: ${m.text}`); }
    }
    updateBadge(); D.render();
  };
  D.onEvent = e => {
    if (e.k === 'proposal') {
      D.proposals = D.proposals.filter(x => !(x.from === e.prop.from && x.to === e.prop.to) && !(x.from === e.prop.to && x.to === e.prop.from));
      D.proposals.push(e.prop);
      if (e.prop.to === G.you) notice(`📜 ${pl(e.prop.from).name} schlägt dir einen Vertrag vor (Diplomatie öffnen: P).`, 'good');
      updateBadge(); D.render();
    } else if (e.k === 'proposalEnd') {
      D.proposals = D.proposals.filter(x => x.id !== e.id);
      if (e.ok) D.draft = null;
      updateBadge(); D.render();
    } else if (e.k === 'chron') {
      D.chron.push(e.e);
      if (!$('chronDlg').classList.contains('hidden')) renderChron();
    } else if (e.k === 'contact') D.render();
  };
  function updateBadge() {
    const n = D.proposals.filter(x => x.to === G.you).length + Object.values(D.unread).reduce((a, b) => a + (b || 0), 0);
    $('dipBadge').textContent = n; $('dipBadge').classList.toggle('hidden', !n);
  }
  function renderChron() {
    $('chronList').innerHTML = D.chron.length ? [...D.chron].reverse().map(c => `<div class="chron-row k-${c.k}"><span class="muted">${fmtT(c.t)}</span> ${esc(c.text)}</div>`).join('') : '<p class="muted">Noch nichts geschehen.</p>';
  }
  D.openChron = () => { renderChron(); $('chronDlg').classList.remove('hidden'); };

  // ---------- Bedienung ----------
  $('dipBtn').onclick = () => ($('dipDlg').classList.contains('hidden') ? D.open() : D.close());
  $('dipClose').onclick = D.close;
  $('dipList').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { D.sel = +b.dataset.p; D.draft = null; D.render(); } };
  $('dipPane').addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'dipChatSend') sendChat();
    else if (t.id === 'dipCancel') { if (confirm('Bündnis kündigen? Es endet nach 2 Minuten – das ist kein Vertragsbruch.')) send({ t: 'dip', op: 'cancel', to: D.sel }); }
    else if (t.id === 'dipPropose') {
      readDraft();
      const d = D.draft, offer = { give: { ...d.give, units: d.give.units ? selectedOwn().filter(x => x.def.kind === 'u').map(x => x.id) : [] }, get: { ...d.get, units: [] }, alliance: d.alliance, pact: d.pact };
      send({ t: 'dip', op: 'propose', to: D.sel, offer });
    } else if (t.dataset.acc) send({ t: 'dip', op: 'respond', id: +t.dataset.acc, accept: true });
    else if (t.dataset.rej) send({ t: 'dip', op: 'respond', id: +t.dataset.rej, accept: false });
    else if (t.dataset.counter) {
      const p = D.proposals.find(x => x.id === +t.dataset.counter);
      if (p) { const o = p.offer; D.draft = { to: D.sel, give: { ...o.get, units: false }, get: { ...o.give, units: false }, alliance: o.alliance, pact: o.pact }; paneHtml(); $('dipPane').querySelector('details').open = true; }
    }
  });
  $('dipPane').addEventListener('change', () => { if (D.draft) readDraft(); });
  $('dipPane').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'dipChatIn') sendChat(); });
  function sendChat() { const el = $('dipChatIn'); if (el && el.value.trim()) { send({ t: 'dip', op: 'chat', to: D.sel, text: el.value.trim() }); el.value = ''; } }
  $('evOpts').onclick = e => { const b = e.target.closest('[data-ev]'); if (b) { send({ t: 'dip', op: 'event', choice: +b.dataset.ev }); $('eventDlg').classList.add('hidden'); } };
  $('chronClose').onclick = () => $('chronDlg').classList.add('hidden');
  return D;
}
