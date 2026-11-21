// Übersetzung zur Laufzeit: Deutsch ist die Quellsprache, Englisch kommt aus /i18n/en.json.
// Texte werden beim Anzeigen ersetzt (exakt oder als Vorlage mit Platzhaltern {0}, {1} …).
const EMO_LEAD = /^(?:\s|\p{Extended_Pictographic}|️|[◆☰✕✖★✚⚔⏸▶◀⁘➖⬛⏬])+/u;
let lang = 'de';
try { lang = localStorage.getItem('fl_lang') || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); } catch { /* egal */ }
document.documentElement.lang = lang;
const exact = new Map(), patterns = [], cache = new Map();
let ready = false;

export const LANG = () => lang;
export function setLang(l) { try { localStorage.setItem('fl_lang', l); } catch { /* egal */ } location.reload(); }

export async function loadLang() {
  if (lang === 'de') return;
  let dict = {};
  try { dict = await (await fetch('/i18n/' + lang + '.json')).json(); } catch { return; }
  for (let [k, v] of Object.entries(dict)) {
    if (!v) continue;
    k = k.replace(EMO_LEAD, '').trim();
    if (!/\{\d+\}/.test(k)) { exact.set(k, v); continue; }
    const parts = k.split(/\{\d+\}/), idx = [...k.matchAll(/\{(\d+)\}/g)].map(m => +m[1]);
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + parts.map(esc).join('([\\s\\S]*?)') + '$');
    const lit = parts.reduce((a, b) => (b.length > a.length ? b : a), '');
    patterns.push({ re, v, idx, lit, score: parts.join('').length });
  }
  patterns.sort((a, b) => b.score - a.score);
  cache.clear(); ready = true;
}

// Übersetzt einen sichtbaren Text (führende Symbole und Leerraum bleiben erhalten)
export function tr(text) {
  if (lang === 'de' || !text || !ready) return text;
  const s = String(text);
  if (cache.has(s)) return cache.get(s);
  const lead = (s.match(EMO_LEAD) || [''])[0], rest = s.slice(lead.length), trail = (rest.match(/\s+$/) || [''])[0], body = rest.slice(0, rest.length - trail.length);
  let out = body;
  if (exact.has(body)) out = exact.get(body);
  else if (body && /[A-Za-zÄÖÜäöüß]/.test(body)) {
    for (const p of patterns) {
      if (p.lit && !body.includes(p.lit)) continue;
      const m = body.match(p.re);
      if (!m) continue;
      out = p.v.replace(/\{(\d+)\}/g, (x, d) => { const g = m[1 + p.idx.indexOf(+d)]; return g == null ? x : tr(g); });
      break;
    }
  }
  const res = lead + out + trail;
  if (cache.size > 5000) cache.clear();
  cache.set(s, res);
  return res;
}
