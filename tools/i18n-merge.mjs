// Übernimmt Übersetzungen „Nummer<TAB>Englisch“ (Nummer = Position in i18n/catalog.json) nach public/i18n/en.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const keys = Object.keys(JSON.parse(readFileSync('i18n/catalog.json', 'utf8')));
const EN = 'public/i18n/en.json';
const en = existsSync(EN) ? JSON.parse(readFileSync(EN, 'utf8')) : {};
let n = 0;
for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  const m = line.match(/^(\d+)\t(.+)$/); if (!m) continue;
  const k = keys[+m[1]]; if (!k) { console.warn('unbekannte Nummer', m[1]); continue; }
  en[k] = m[2].trim(); n++;
}
writeFileSync(EN, JSON.stringify(en, null, 1));
console.log('übernommen:', n, '– gesamt:', Object.keys(en).length, 'von', keys.length);
