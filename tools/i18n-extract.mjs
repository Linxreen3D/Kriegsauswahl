// Sammelt alle sichtbaren deutschen Texte (auch Vorlagen mit Platzhaltern) aus Client, Regeln und Server.
// Ergebnis: i18n/catalog.json  { "Vorlage {0}": "" } – Übersetzungen kommen nach i18n/en.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

const FILES = ['public/index.html', 'public/js/main.js', 'public/js/i18n.js', 'public/js/diplomacy.js', 'public/js/conference.js', 'public/js/tutorial.js',
  'shared/rules.js', 'server/world.js', 'server/diplomacy.js', 'server/conference.js', 'server/nukes.js', 'server/rail.js', 'server/naval.js',
  'server/air.js', 'server/leaders.js', 'server/celo.js', 'server/room.js', 'server/mapgen.js'];
const GERMAN = /[äöüßÄÖÜ]|\b(der|die|das|und|mit|nicht|ein|eine|ist|für|von|auf|im|zum|zur|des|den|dem|wird|sind|kann|kein|noch|nur|oder|bei|aus|alle|nach|über|Spiel|Einheit|Gebäude|Rohstoffe|Bündnis|Epoche)\b/;
const out = new Set();
const add = t => {
  for (let f of t.split(/<[^>]*>|\n/)) {
    f = f.replace(/\s+/g, ' ').trim();
    if (f.replace(/\{\d+\}/g, '').replace(/[^A-Za-zÄÖÜäöüß]/g, '').length < 2) continue;
    if (/^[a-z][\w-]*$/.test(f) || /^[\w.-]+\.(js|css|png|json|glb)$/.test(f) || /^#[0-9a-f]+$/i.test(f)) continue;
    if (/[;=]|=>|\(\)|^\.|^\[|^\w+\(/.test(f) && !GERMAN.test(f)) continue;
    // Namen und Bezeichnungen (Großbuchstabe) oder erkennbar deutscher Text
    if (GERMAN.test(f) || /^[A-ZÄÖÜ]/.test(f) || / /.test(f)) out.add(f);
  }
};
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  if (file.endsWith('.html')) { for (const m of src.matchAll(/>([^<]+)</g)) add(m[1]); for (const m of src.matchAll(/(?:title|placeholder)="([^"]+)"/g)) add(m[1]); continue; }
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  simple(ast, {
    Literal(n) { if (typeof n.value === 'string') add(n.value); },
    TemplateLiteral(n) { let s = ''; n.quasis.forEach((q, i) => { s += q.value.cooked ?? q.value.raw; if (i < n.expressions.length) s += '{' + i + '}'; }); add(s); },
  });
}
// Platzhalter je Fragment neu durchnummerieren
const norm = f => { let i = 0; const map = {}; return f.replace(/\{(\d+)\}/g, (m, d) => '{' + (map[d] ??= i++) + '}'); };
const list = [...new Set([...out].map(norm))].filter(f => !/^\{\d+\}$/.test(f)).sort();
mkdirSync('i18n', { recursive: true });
const EN = 'public/i18n/en.json';
const prev = existsSync(EN) ? JSON.parse(readFileSync(EN, 'utf8')) : {};
writeFileSync('i18n/catalog.json', JSON.stringify(Object.fromEntries(list.map(k => [k, prev[k] || ''])), null, 1));
const missing = list.filter(k => !prev[k]);
console.log('Texte:', list.length, '– davon noch ohne Übersetzung:', missing.length);
