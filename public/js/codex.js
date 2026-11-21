// Nachschlagewerk (F1): Einheitenlinien mit Kontern (aus der Schadenstabelle), Gebäude, Epochen.
import { LINES, BUILDINGS, ERAS, DMG } from '/shared/rules.js';
const CLS = { wrk: 'Arbeiter', inf: 'Infanterie', spr: 'Speer/Panzerabwehr', rng: 'Fernkampf', cav: 'Reiterei/Panzer', sie: 'Belagerung', art: 'Artillerie', sup: 'Sanitäter', env: 'Botschafter', spy: 'Spion',
  bld: 'Gebäude', trn: 'Züge', shp: 'Schiffe', sub: 'U-Boote', air: 'Jäger', bmb: 'Bomber', hel: 'Hubschrauber', aa: 'Flugabwehr' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createCodex({ $, iconFor, bldIcon }) {
  const root = document.createElement('div');
  root.id = 'codexDlg'; root.className = 'modal hidden';
  root.innerHTML = `<div class="card codex-card"><div class="dip-head"><h2>Kodex</h2><div class="codex-tabs"><button class="btn small" data-tab="units">Einheiten</button><button class="btn small" data-tab="blds">Gebäude</button><button class="btn small" data-tab="eras">Epochen</button></div><button class="icon-btn" data-close="1" title="Schließen">✕</button></div><div id="codexBody" class="codex-body"></div></div>`;
  document.body.appendChild(root);
  const strong = cls => Object.entries(DMG[cls] || {}).filter(([k, v]) => v >= 1.3 && CLS[k]).map(([k]) => CLS[k]);
  const weakTo = cls => Object.entries(DMG).filter(([a, row]) => row[cls] >= 1.3 && CLS[a]).map(([a]) => CLS[a]);
  const units = () => Object.entries(LINES).filter(([k, l]) => l.names && l.names.some(Boolean) && k !== 'train').map(([k, l]) => {
    const eras = l.names.map((n, i) => n ? `<span title="${esc(ERAS[i].name)}"><i>${ERAS[i].short}</i> ${esc(n)}</span>` : '').filter(Boolean).join('');
    const row = l.dmgRow || l.cls, s = strong(row), w = weakTo(l.cls);
    return `<div class="codex-row"><div class="codex-ic">${iconFor(k, Math.max(l.minEra, 5))}</div><div><b>${esc(CLS[l.cls] || l.cls)}</b>
      <div class="codex-eras">${eras}</div>
      ${s.length ? `<div class="small">Stark gegen: ${esc(s.join(', '))}</div>` : ''}${w.length ? `<div class="small muted">Schwach gegen: ${esc(w.join(', '))}</div>` : ''}</div></div>`;
  }).join('');
  const blds = () => Object.entries(BUILDINGS).filter(([k, b]) => b.minEra < 99).sort((a, b) => a[1].minEra - b[1].minEra).map(([k, b]) =>
    `<div class="codex-row"><div class="codex-ic">${bldIcon(k)}</div><div><b>${esc(b.name)}</b> <span class="muted small">ab ${esc(ERAS[b.minEra].name)}</span><div class="small">${esc(b.desc || '')}</div></div></div>`).join('');
  const eras = () => ERAS.map((e, i) => `<div class="codex-row"><div class="codex-ic era-num">${e.short}</div><div><b>${esc(e.name)}</b> <span class="muted small">${esc(e.years || '')}</span></div></div>`).join('');
  const show = tab => { $('codexBody').innerHTML = tab === 'blds' ? blds() : tab === 'eras' ? eras() : units(); root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('primary', b.dataset.tab === tab)); };
  root.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) show(t.dataset.tab); if (e.target.closest('[data-close]') || e.target === root) root.classList.add('hidden'); });
  return { open() { show('units'); root.classList.remove('hidden'); }, toggle() { if (root.classList.contains('hidden')) this.open(); else root.classList.add('hidden'); } };
}
