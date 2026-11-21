// Konferenzsaal: Verhandlungstisch der beiden Kriegsparteien, Galerie für Zuschauer (Kapitel 12.4).
import { RES, RES_ICONS, RES_NAMES, NATIONS, LEADER } from '/shared/rules.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createConference({ G, send, notice, portrait }) {
  const C = { s: null, builtFor: null };
  const root = document.createElement('div');
  root.id = 'confRoom'; root.className = 'modal hidden';
  root.innerHTML = '<div class="card conf-card"><div id="confHead"></div><div class="conf-body"><div id="confMain"></div><div class="conf-side"><div id="confChat" class="conf-chat"></div><div class="row"><input id="confChatIn" class="chat-input" maxlength="300" placeholder="Nachricht…"><button class="btn small" id="confChatSend">Senden</button></div><div id="confGallery"></div></div></div></div>';
  document.body.appendChild(root);
  const pl = id => G.players[id] || { name: '?', color: '#888' };
  const party = () => C.s && (C.s.a === G.you || C.s.b === G.you);
  const foeId = () => (C.s.a === G.you ? C.s.b : C.s.a);

  function side(s) {
    const parts = [];
    for (const k in s.res) parts.push(`${s.res[k]} ${RES_ICONS[k]}`);
    if (s.tribute) parts.push(`Reparationen ${s.tribute.perMin} ${RES_ICONS[s.tribute.res]}/min für ${s.tribute.min} min`);
    if (s.prov.length) parts.push('Provinz ' + s.prov.map(i => (G.provinces[i] ? esc(G.provinces[i].name) : '?')).join(', '));
    return parts.join(' · ') || 'nichts';
  }
  function offerHtml(o) {
    if (!o) return '<p class="muted">Noch kein Vorschlag auf dem Tisch.</p>';
    const A = pl(C.s.a), B = pl(C.s.b);
    const peace = o.peace === 'peace' ? '🕊 Frieden (20 min, Bruch = Vertragsbruch)' : o.peace === 'ceasefire' ? '⏸ Waffenstillstand (10 min)' : 'kein Frieden';
    const extra = (arms, dis) => (arms ? ' · Rüstungsbeschränkung 15 min' : '') + (dis ? ' · Abrüstung (¼ der Truppen, ½ Kosten zurück)' : '');
    const dmz = o.dmz && o.dmz.length ? `<div><b>Entmilitarisierte Zone (20 min):</b> ${o.dmz.map(i => esc((G.provinces[i] || {}).name || '?')).join(', ')}</div>` : '';
    return `<div class="conf-offer"><div><b>${esc(A.name)} gibt:</b> ${side(o.a)}${extra(o.armsA, o.disarmA)}</div>
      <div><b>${esc(B.name)} gibt:</b> ${side(o.b)}${extra(o.armsB, o.disarmB)}</div><div><b>Vereinbarung:</b> ${peace}</div>${dmz}
      <div class="muted small">Vorschlag von ${esc(pl(o.by).name)} · unterschrieben: ${C.s.signed.map(id => esc(pl(id).name)).join(', ') || 'noch niemand'}</div></div>`;
  }
  function partyHtml(id) {
    const p = pl(id), L = p.leader && LEADER[p.leader];
    return `<div class="conf-party" style="border-bottom-color:${p.color}">${L ? portrait(L) : '<span class="leader-portrait"><i>🏳</i></span>'}<div><b>${esc(p.name)}</b><div class="muted small">${p.nation ? esc(NATIONS[p.nation].name) : ''}${L ? ' · ' + esc(L.name) : ''}</div></div></div>`;
  }
  function editorHtml() {
    const med = !party();
    const me = med ? C.s.a : G.you, foe = med ? C.s.b : foeId();
    const L1 = med ? `${esc(pl(me).name)} gibt` : 'Du gibst', L2 = med ? `${esc(pl(foe).name)} gibt` : 'Du erhältst';
    const myProv = G.provinces.filter(p => G.provOwner[p.id] === me), theirProv = G.provinces.filter(p => G.provOwner[p.id] === foe);
    const dmzList = [...myProv, ...theirProv];
    const resIn = sd => RES.map(k => `<label class="ri-in">${RES_ICONS[k]}<input type="number" min="0" step="50" data-cs="${sd}" data-res="${k}" placeholder="0"></label>`).join('');
    const trib = sd => `<div class="trib">Reparationen: <select data-cs="${sd}" data-trib="res"><option value="">–</option>${RES.map(k => `<option value="${k}">${RES_NAMES[k]}</option>`).join('')}</select>
      <input type="number" min="0" step="10" data-cs="${sd}" data-trib="perMin" placeholder="pro min"> × <input type="number" min="0" max="60" data-cs="${sd}" data-trib="min" placeholder="min"></div>`;
    const provs = (sd, list) => list.length ? `<div class="provs">${list.map(p => `<label><input type="checkbox" data-cs="${sd}" data-prov="${p.id}"> ${esc(p.name)}</label>`).join('')}</div>` : '<div class="muted small">keine Provinzen</div>';
    return `<details class="dip-treaty" open><summary>📜 Vorschlag aufsetzen</summary><div class="treaty-grid">
      <div><h4>${L1}</h4><div class="res-row">${resIn('give')}</div>${trib('give')}<div class="small">Gebietsabtretung:</div>${provs('give', myProv)}
        <label class="small"><input type="checkbox" id="confArmsGive"> Rüstungsbeschränkung für ${esc(pl(me).name)} (15 min)</label>
        <label class="small"><input type="checkbox" id="confDisarmGive"> Abrüstung ${esc(pl(me).name)}</label></div>
      <div><h4>${L2}</h4><div class="res-row">${resIn('get')}</div>${trib('get')}<div class="small">Gebietsabtretung:</div>${provs('get', theirProv)}
        <label class="small"><input type="checkbox" id="confArmsGet"> Rüstungsbeschränkung für ${esc(pl(foe).name)} (15 min)</label>
        <label class="small"><input type="checkbox" id="confDisarmGet"> Abrüstung ${esc(pl(foe).name)}</label></div>
      </div>
      <div class="small">Entmilitarisierte Zone (20 min keine Truppen und Türme beider Seiten):</div>
      ${dmzList.length ? `<div class="provs">${dmzList.map(p => `<label><input type="checkbox" data-dmz="${p.id}"> ${esc(p.name)}</label>`).join('')}</div>` : '<div class="muted small">keine Provinzen</div>'}<div class="row"><label>Vereinbarung <select id="confPeace"><option value="peace">🕊 Frieden</option><option value="ceasefire">⏸ Waffenstillstand</option><option value="">keine</option></select></label>
      <button class="btn primary" id="confPropose">Auf den Tisch legen</button></div></details>`;
  }
  function readEditor() {
    const sideOf = sd => {
      const res = {}; for (const el of root.querySelectorAll(`[data-cs="${sd}"][data-res]`)) { const v = Math.floor(+el.value || 0); if (v > 0) res[el.dataset.res] = v; }
      const prov = [...root.querySelectorAll(`[data-cs="${sd}"][data-prov]`)].filter(x => x.checked).map(x => +x.dataset.prov);
      const r = root.querySelector(`[data-cs="${sd}"][data-trib="res"]`).value, pm = +root.querySelector(`[data-cs="${sd}"][data-trib="perMin"]`).value || 0, mn = +root.querySelector(`[data-cs="${sd}"][data-trib="min"]`).value || 0;
      return { res, prov, units: [], tribute: r && pm > 0 && mn > 0 ? { res: r, perMin: pm, min: mn } : null };
    };
    return { give: sideOf('give'), get: sideOf('get'), peace: $('confPeace').value, armsGive: $('confArmsGive').checked, armsGet: $('confArmsGet').checked,
      disarmGive: $('confDisarmGive').checked, disarmGet: $('confDisarmGet').checked, dmz: [...root.querySelectorAll('[data-dmz]')].filter(x => x.checked).map(x => +x.dataset.dmz) };
  }

  function render() {
    const s = C.s;
    if (!s || s.phase === 'done') { root.classList.add('hidden'); C.builtFor = null; return; }
    root.classList.remove('hidden');
    const A = pl(s.a), B = pl(s.b);
    $('confHead').innerHTML = `<h2>${s.secret ? '🤫 Geheime Verhandlung' : '🕊 Friedenskonferenz'}</h2>
      <div class="conf-timer">${s.phase === 'countdown' ? `Beginn in ${s.countdown} s` : `Restzeit ${fmtT(s.left)}`} · ${s.paused ? 'Spiel pausiert' : 'Spiel läuft – Waffenruhe zwischen beiden'}</div>
      <div class="conf-table">${partyHtml(s.a)}<span class="conf-vs">am Tisch mit</span>${partyHtml(s.b)}</div>`;
    // Hauptbereich: Vorschlag + Unterschrift (Parteien) bzw. Ansicht (Zuschauer)
    const role = party() ? 'p' : s.mediator === G.you ? 'm' : 'g';
    if (C.builtFor !== s.id + role) {
      C.builtFor = s.id + role;
      $('confMain').innerHTML = `<div id="confOffer"></div><div id="confRoles"></div>${role === 'p' ? `<div class="row"><button class="btn primary" id="confSign">✍ Unterschreiben</button><button class="btn" id="confLeave">Tisch verlassen</button></div>${editorHtml()}` : role === 'm' ? `<p class="muted small">⚖ Du vermittelst: Lege einen Vorschlag auf den Tisch – unterschreiben müssen beide Parteien.</p>${editorHtml()}` : ''}`;
    }
    // Vermittler, Beitritte, Sanktionen
    const spect = G.players.filter(q => q && q.alive && q.id !== s.a && q.id !== s.b);
    let roles = s.mediator != null ? `<div>⚖ Vermittler: <b>${esc(pl(s.mediator).name)}</b></div>` : '';
    if (role === 'p' && !s.secret && spect.length) roles += `<div class="row small">Vermittler vorschlagen: <select id="confMedSel"><option value="-1">–</option>${spect.map(q => `<option value="${q.id}" ${s.medVotes && +s.medVotes[G.you] === q.id ? 'selected' : ''}>${esc(q.name)}</option>`).join('')}</select>
      <span class="muted">${s.medVotes && s.medVotes[foeId()] != null && s.medVotes[foeId()] >= 0 ? `${esc(pl(foeId()).name)} schlägt ${esc(pl(s.medVotes[foeId()]).name)} vor` : ''}</span></div>`;
    for (const j of s.joins || []) roles += `<div class="small">➕ ${esc(pl(j.id).name)} will auf Seite von ${esc(pl(j.side).name)} beitreten ${j.ok.length >= 2 ? '– <b>zugelassen</b>' : `(${j.ok.length}/2 zugestimmt)`}${role === 'p' && !j.ok.includes(G.you) ? ` <button class="btn small" data-joinok="${j.id}">Zulassen</button>` : ''}</div>`;
    for (const x of s.sanctions || []) roles += `<div class="small">⛔ ${esc(pl(x.from).name)} droht ${esc(pl(x.side).name)} mit Sanktionen, falls nicht unterschrieben wird</div>`;
    if ($('confRoles').innerHTML !== roles && document.activeElement !== $('confMedSel')) $('confRoles').innerHTML = roles;
    $('confOffer').innerHTML = offerHtml(s.offer) + (s.support.length || s.guarantees.length ? `<div class="conf-pledges">${s.support.map(x => `<div>🎁 ${esc(pl(x.from).name)} unterstützt ${esc(pl(x.side).name)}: ${Object.entries(x.res).map(([k, v]) => v + ' ' + RES_ICONS[k]).join(' ')}</div>`).join('')}${s.guarantees.map(g => `<div>🛡 ${esc(pl(g.from).name)} garantiert für ${esc(pl(g.side).name)}</div>`).join('')}</div>` : '');
    const sign = $('confSign'); if (sign) { sign.disabled = !s.offer || s.signed.includes(G.you) || s.phase !== 'open'; sign.textContent = s.signed.includes(G.you) ? '✍ Unterschrieben – warte auf Gegenseite' : '✍ Unterschreiben'; }
    $('confChat').innerHTML = s.chat.map(c => `<div class="dc ${c.gallery ? 'gal' : ''}"><b style="color:${pl(c.from).color}">${esc(pl(c.from).name)}${c.gallery ? ' (Galerie)' : ''}:</b> ${esc(c.text)}</div>`).join('') || '<p class="muted small">Noch keine Nachrichten.</p>';
    $('confChat').scrollTop = 1e6;
    // Galerie: Zuschauer können unterstützen und garantieren
    const gal = $('confGallery');
    if (!party() && G.players[G.you] && G.players[G.you].alive && !s.secret) {
      if (gal.dataset.for !== String(s.id)) {
        gal.dataset.for = String(s.id);
        gal.innerHTML = `<h4>Galerie</h4><div class="small">Rohstoffe zusagen (werden nach der Konferenz in jedem Fall übergeben):</div>
          <div class="res-row">${RES.map(k => `<label class="ri-in">${RES_ICONS[k]}<input type="number" min="0" step="50" data-sup="${k}" placeholder="0"></label>`).join('')}</div>
          <div class="row"><button class="btn small" data-supfor="${s.a}">für ${esc(A.name)}</button><button class="btn small" data-supfor="${s.b}">für ${esc(B.name)}</button></div>
          <div class="small">Garantie (bei Scheitern trittst du dieser Seite bei):</div>
          <div class="row"><button class="btn small" data-gar="${s.a}">🛡 ${esc(A.name)}</button><button class="btn small" data-gar="${s.b}">🛡 ${esc(B.name)}</button></div>
          <div class="small">Sanktionen androhen (unterschreibt die Seite nicht, bekommt sie 20 min keine Angebote von dir):</div>
          <div class="row"><button class="btn small" data-sanc="${s.a}">⛔ ${esc(A.name)}</button><button class="btn small" data-sanc="${s.b}">⛔ ${esc(B.name)}</button></div>
          <div class="small">Dem Vertrag beitreten (beide Parteien müssen zustimmen):</div>
          <div class="row"><button class="btn small" data-join="${s.a}">➕ an Seite ${esc(A.name)}</button><button class="btn small" data-join="${s.b}">➕ an Seite ${esc(B.name)}</button></div>`;
      }
    } else { gal.innerHTML = ''; gal.dataset.for = ''; }
  }

  C.onEvent = e => {
    if (e.k === 'conf') {
      const was = C.s && C.s.phase;
      C.s = e.s.phase === 'done' ? null : e.s;
      if (!C.s && was) root.classList.add('hidden');
      render();
    } else if (e.k === 'confInvite') {
      const from = pl(e.from);
      setTimeout(() => send({ t: 'dip', op: 'confRespond', accept: confirm(`${from.name} beantragt eine Friedenskonferenz. Annehmen? (Ablehnen kostet nichts.)`) }), 0);
    }
  };
  C.onStart = () => { C.s = null; C.builtFor = null; root.classList.add('hidden'); };
  root.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'confPropose') send({ t: 'dip', op: 'confOffer', offer: readEditor() });
    else if (t.id === 'confSign' && C.s) send({ t: 'dip', op: 'confSign', ver: C.s.ver });
    else if (t.id === 'confLeave') { if (confirm('Tisch verlassen? Die Konferenz ist dann gescheitert.')) send({ t: 'dip', op: 'confLeave' }); }
    else if (t.id === 'confChatSend') chat();
    else if (t.dataset.supfor) {
      const res = {}; for (const el of root.querySelectorAll('[data-sup]')) { const v = Math.floor(+el.value || 0); if (v > 0) res[el.dataset.sup] = v; el.value = ''; }
      send({ t: 'dip', op: 'confSupport', side: +t.dataset.supfor, res });
    } else if (t.dataset.sanc) send({ t: 'dip', op: 'confSanction', side: +t.dataset.sanc });
    else if (t.dataset.join) send({ t: 'dip', op: 'confJoin', side: +t.dataset.join });
    else if (t.dataset.joinok) send({ t: 'dip', op: 'confJoinOk', id: +t.dataset.joinok });
    else if (t.dataset.gar) { if (confirm('Garantie geben? Scheitert die Konferenz, bist du automatisch mit dieser Seite verbündet und mit der anderen im Krieg.')) send({ t: 'dip', op: 'confGuarantee', side: +t.dataset.gar }); }
  });
  root.addEventListener('change', e => { if (e.target.id === 'confMedSel') send({ t: 'dip', op: 'confMediator', id: +e.target.value }); });
  root.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'confChatIn') chat(); });
  function chat() { const el = $('confChatIn'); if (el.value.trim()) { send({ t: 'dip', op: 'confChat', text: el.value.trim() }); el.value = ''; } }
  C.request = id => send({ t: 'dip', op: 'confRequest', to: id });
  return C;
}
