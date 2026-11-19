// Gemeinsame Spieldaten für Server und Client.
// Alle Zahlen hier sind das Balancing – Änderungen wirken auf beiden Seiten.

export const TICK_MS = 100;
export const RES = ['food', 'wood', 'stone', 'gold'];
export const RES_NAMES = { food: 'Nahrung', wood: 'Holz', stone: 'Stein', gold: 'Gold' };
export const RES_ICONS = { food: '🍖', wood: '🪵', stone: '🪨', gold: '🪙' };
export const MAX_POP = 200;

export const COLORS = [
  '#e6483d', '#3d7be6', '#3fbf5f', '#f2b134', '#a55ce6', '#29c4c4', '#ee6fb0', '#f07a2a',
  '#8fd14f', '#5d6be8', '#d4c23f', '#c9583f', '#7a8fa6', '#e8e8e8', '#b07a4f', '#4fb08f',
  '#ff9e9e', '#9ec5ff', '#b6ff9e', '#ffe39e', '#d9a6ff', '#7fe0e0', '#ffb3d9', '#c2c2c2',
];

export const DEFAULT_SETTINGS = {
  mode: 'ffa', // ffa | teams | armageddon
  mapSize: 'auto', // small | medium | large | huge | auto
  mapType: 'random', // random | continent | lakes | highlands | forest
  resources: 'normal', // low | normal | high
  startEra: 0,
  speed: 1,
  botDifficulty: 'normal',
  armageddonMin: 20, // ab wann Meteore fallen (Modus Armageddon)
  maxPlayers: 24,
};

// ---------------- Epochen ----------------
// Spieltempo für Partien bis ca. 4 Stunden: frühe Epochen kurz, späte lang (Zeiten in Spielsekunden).
export const ERAS = [
  { name: 'Steinzeit', short: 'I', years: 'bis 3000 v. Chr.', cost: null, time: 0 },
  { name: 'Bronzezeit', short: 'II', years: '3000–1200 v. Chr.', cost: { food: 500, wood: 250 }, time: 60 },
  { name: 'Eisenzeit', short: 'III', years: '1200 v. Chr.–500', cost: { food: 900, wood: 450, gold: 200 }, time: 90 },
  { name: 'Frühes Mittelalter', short: 'IV', years: '500–1000', cost: { food: 1800, gold: 900, stone: 400 }, time: 150 },
  { name: 'Spätes Mittelalter', short: 'V', years: '1000–1600', cost: { food: 2800, wood: 1400, gold: 1600 }, time: 180 },
  { name: '1. Industrielle Revolution', short: 'VI', years: '1750–1860', cost: { food: 4200, gold: 2800, stone: 1200 }, time: 240 },
  { name: '2. Industrielle Revolution', short: 'VII', years: '1860–1945', cost: { food: 6000, wood: 3000, gold: 4200 }, time: 300 },
  { name: 'Kalter Krieg', short: 'VIII', years: '1945–1990', cost: { food: 8000, wood: 4000, gold: 6000, stone: 2000 }, time: 480 },
];
// Epoche VII hat zwei Stufen: Die Forschung „Moderne Kriegsführung“ schaltet die Technik von 1914–1945 frei.
export const LATE_STAGE = { era: 6, name: 'Moderne Kriegsführung', cost: { food: 3500, wood: 1800, gold: 3500 }, time: 240, hpMul: 1.2, atkMul: 1.2 };
// Aufholhilfe: Wer zwei oder mehr Epochen hinter dem Führenden liegt, zahlt 15 % weniger je Rückstands-Epoche (max. 60 %).
export function catchUpFactor(myEra, leaderEra) {
  const gap = leaderEra - myEra;
  return gap >= 2 ? Math.max(0.4, 1 - 0.15 * gap) : 1;
}
export function eraCost(targetEra, leaderEra) {
  const base = ERAS[targetEra] && ERAS[targetEra].cost;
  if (!base) return null;
  const f = catchUpFactor(targetEra - 1, leaderEra);
  return f === 1 ? base : scaleCost(base, f);
}

// ---------------- Kulturen & Nationen ----------------
// Kultur wird beim Erreichen der Bronzezeit gewählt, die Nation im Frühen Mittelalter.
// Alle Nationen stehen jeder Kultur offen
const ALL_NATIONS = ['usa', 'russia', 'germany', 'china', 'austria', 'yugoslavia', 'india'];
export const CULTURES = {
  steppe: {
    name: 'Steppenvolk', icon: '🐎', desc: 'Reiterei ist 15 % schneller und 15 % billiger. Spezialeinheit: Steppenreiter (berittener Bogenschütze).',
    unique: 'uq_steppe', nations: ALL_NATIONS,
  },
  traders: {
    name: 'Händlerbund', icon: '⚖', desc: 'Gold und Stein werden 25 % schneller abgebaut. Spezialeinheit: Söldner (starke Infanterie gegen Gold).',
    unique: 'uq_traders', nations: ALL_NATIONS,
  },
  builders: {
    name: 'Baumeister', icon: '🏛', desc: 'Gebäude haben 40 % mehr Leben und werden 40 % schneller gebaut, Türme treffen härter. Spezialeinheit: Wallbrecher.',
    unique: 'uq_builders', nations: ALL_NATIONS,
  },
  warriors: {
    name: 'Kriegerkaste', icon: '⚔', desc: 'Infanterie hat 15 % mehr Angriff und 10 % mehr Leben. Spezialeinheit: Berserker.',
    unique: 'uq_warriors', nations: ALL_NATIONS,
  },
};
export const NATIONS = {
  usa: { name: 'USA', desc: 'Alle Ressourcen werden 15 % schneller gesammelt. Weltwunder: Freiheitsstatue.', bonus: { gather: 1.15 } },
  russia: { name: 'Russland', desc: 'Militäreinheiten haben 10 % mehr Leben. „General Winter“: keine Nachteile durch Schnee und Winter in eigenen Provinzen. Weltwunder: Kathedrale mit Zwiebelkuppeln.', bonus: { armyHp: 1.1, winter: true } },
  germany: { name: 'Deutschland', desc: 'Militäreinheiten verursachen 10 % mehr Schaden. Weltwunder: gotischer Dom.', bonus: { armyDmg: 1.1 } },
  china: { name: 'China', desc: 'Einheiten werden 25 % schneller ausgebildet. Weltwunder: Himmelstempel.', bonus: { trainSpeed: 1.25 } },
  austria: { name: 'Österreich-Ungarn', desc: 'Türme haben +2 Reichweite. Weltwunder: Parlament.', bonus: { towerRange: 2 } },
  yugoslavia: { name: 'Jugoslawien', desc: 'Infanterie bewegt sich 15 % schneller. Weltwunder: Kuppeltempel.', bonus: { infSpeed: 1.15 } },
  india: { name: 'Indien', desc: 'Häuser geben +4 Bevölkerung, Belagerung +25 % Schaden. Weltwunder: Marmormausoleum.', bonus: { housePop: 4, siegeDmg: 1.25 } },
};

// ---------------- Einheiten ----------------
// Klassen: wrk (Arbeiter), inf (Infanterie), spr (Spieß/Panzerabwehr), rng (Fernkampf/MG), cav (Reiterei/Panzer),
// sie (Belagerung), art (Artillerie), sup (Unterstützung/Sanitäter). Zeile = Angreifer, Spalte = Ziel.
// Ein Konter gewinnt bei gleichen Kosten etwa 2:1, nicht 10:1.
export const DMG = {
  wrk: { wrk: 1, inf: 1, spr: 1, rng: 1, cav: 1, sie: 1, art: 1, sup: 1, bld: 0.4, env: 1, spy: 1 },
  inf: { wrk: 1.2, inf: 1, spr: 1.0, rng: 1.0, cav: 0.8, sie: 1.6, art: 1.6, sup: 1.2, bld: 0.6, env: 1, spy: 1 },
  spr: { wrk: 1, inf: 1.0, spr: 1, rng: 0.9, cav: 1.3, sie: 1.2, art: 1.2, sup: 1, bld: 0.4, env: 1, spy: 1 },
  rng: { wrk: 1.2, inf: 1.9, spr: 1.5, rng: 1, cav: 0.8, sie: 0.5, art: 0.6, sup: 1.2, bld: 0.25, env: 1, spy: 1 },
  cav: { wrk: 1.4, inf: 1.4, spr: 0.7, rng: 1.3, cav: 1, sie: 1.8, art: 1.8, sup: 1.4, bld: 0.45, env: 1, spy: 1 },
  sie: { wrk: 0.6, inf: 0.6, spr: 0.6, rng: 0.6, cav: 0.5, sie: 1, art: 1, sup: 0.6, bld: 3.2, env: 1, spy: 1 },
  art: { wrk: 1.2, inf: 2.0, spr: 2.0, rng: 2.0, cav: 0.8, sie: 1.3, art: 1.3, sup: 1.2, bld: 1.2, env: 1, spy: 1 },
  sup: { wrk: 0.5, inf: 0.5, spr: 0.5, rng: 0.5, cav: 0.5, sie: 0.5, art: 0.5, sup: 0.5, bld: 0.2, env: 1, spy: 1 },
  env: { wrk: 0.3, inf: 0.3, spr: 0.3, rng: 0.3, cav: 0.3, sie: 0.3, art: 0.3, sup: 0.3, bld: 0.1, env: 0.3, spy: 0.3 },
  spy: { wrk: 1, inf: 0.8, spr: 0.8, rng: 0.8, cav: 0.5, sie: 0.8, art: 0.8, sup: 1, bld: 0.3, env: 1, spy: 1 },
  bld: { wrk: 1, inf: 1, spr: 1, rng: 1.1, cav: 0.9, sie: 1, art: 1, sup: 1, bld: 0.3, env: 1, spy: 1 },
};

// Linien: pro Epoche ein Name; Werte skalieren mit der Epoche.
export const LINES = {
  worker: {
    cls: 'wrk', at: 'town', minEra: 0, key: 'Q', names: ['Sammler', 'Arbeiter', 'Handwerker', 'Leibeigener', 'Bauer', 'Fabrikarbeiter', 'Arbeiter', 'Ingenieur'],
    hp: 40, atk: 3, range: 0.4, cd: 1.5, speed: 1.6, sight: 6, cost: { food: 50 }, pop: 1, time: 10, grow: 0.08, costGrow: 1,
  },
  inf: {
    cls: 'inf', at: 'barracks', minEra: 0, key: 'Q', names: ['Keulenträger', 'Axtkämpfer', 'Schwertkämpfer', 'Hauskrieger', 'Fußritter', 'Linieninfanterist', 'Schütze', 'Mechanisierte Infanterie'], late: 'Infanterist',
    hp: 60, atk: 7, range: 0.5, cd: 1.2, speed: 1.45, sight: 6, cost: { food: 55, wood: 10, env: 1, spy: 1 }, pop: 1, time: 16,
    eraOverride: { 5: { range: 3 }, 6: { range: 4 }, 7: { range: 4.5, speed: 1.7 } },
  },
  spear: {
    cls: 'spr', at: 'barracks', minEra: 1, key: 'W', names: ['', 'Speerträger', 'Phalangit', 'Speerträger', 'Pikenier', 'Bajonettschütze', 'Panzerbüchsenschütze', 'Lenkraketentrupp'], late: 'Panzerabwehrtrupp',
    hp: 70, atk: 6, range: 0.7, cd: 1.3, speed: 1.35, sight: 6, cost: { food: 45, wood: 25 }, pop: 1, time: 16,
    eraOverride: { 6: { range: 3 }, 7: { range: 5 } },
  },
  rng: {
    cls: 'rng', at: 'range', minEra: 0, key: 'Q', names: ['Steinschleuderer', 'Bogenschütze', 'Kompositbogner', 'Langbogenschütze', 'Armbrustschütze', 'Jäger', 'Scharfschütze', 'MG-Schütze'], late: 'MG-Schütze',
    hp: 38, atk: 5, range: 5, cd: 1.6, speed: 1.4, sight: 7, cost: { food: 30, wood: 35, env: 1, spy: 1 }, pop: 1, time: 18,
    eraOverride: { 6: { range: 6 }, 7: { range: 6.5 } },
  },
  cav: {
    cls: 'cav', at: 'stable', minEra: 1, key: 'Q', names: ['', 'Streitwagen', 'Reiter', 'Panzerreiter', 'Ritter', 'Husar', 'Panzerwagen', 'Kampfpanzer'], late: 'Panzer',
    hp: 110, atk: 9, range: 0.6, cd: 1.4, speed: 2.4, sight: 7, cost: { food: 70, gold: 45, env: 1, spy: 1 }, pop: 1, time: 22,
    eraOverride: { 5: { range: 3.5 }, 6: { range: 5, speed: 2.0, hpMul: 1.6, pop: 2 }, 7: { range: 6, speed: 2.2, hpMul: 1.7, pop: 2 } },
  },
  sie: {
    cls: 'sie', at: 'workshop', minEra: 2, key: 'Q', names: ['', '', 'Torsionsgeschütz', 'Blide', 'Bombarde', 'Belagerungsmörser', 'Schwerer Mörser', 'Raketenartillerie'], late: 'Schwere Haubitze',
    hp: 120, atk: 38, range: 7, minRange: 2, cd: 4, speed: 0.95, sight: 8, cost: { wood: 160, gold: 90, env: 1, spy: 1 }, pop: 2, time: 32, splash: 1.2,
  },  art: {
    cls: 'art', at: 'workshop', minEra: 5, key: 'W', names: ['', '', '', '', '', 'Feldkanone', 'Feldgeschütz', 'Panzerhaubitze'], late: 'Haubitze',
    hp: 110, atk: 40, range: 9, minRange: 2.5, cd: 3.5, speed: 1.0, sight: 8, cost: { wood: 140, gold: 110, env: 1, spy: 1 }, pop: 3, time: 30, splash: 1.6,
  },
  envoy: {
    cls: 'env', at: 'town', minEra: 0, key: 'T', names: ['Läufer', 'Reitender Bote', 'Reitender Bote', 'Gesandter', 'Gesandter mit Eskorte', 'Kurier', 'Kurier im Automobil', 'Diplomat im Regierungsjet'],
    hp: 50, atk: 0, range: 0.5, cd: 1, speed: 1.9, sight: 8, cost: { food: 40, gold: 10 }, pop: 1, time: 15, grow: 0.12,
    eraOverride: { 1: { speed: 2.9 }, 2: { speed: 2.9 }, 3: { speed: 3.2 }, 4: { speed: 3.3 }, 5: { speed: 3.6 }, 6: { speed: 4.4 }, 7: { speed: 6 } },
  },
  spy: {
    cls: 'spy', at: 'town', minEra: 4, key: 'A', names: ['', '', '', '', 'Kundschafter', 'Spion', 'Agent', 'Geheimagent'],
    hp: 40, atk: 4, range: 0.5, cd: 1.2, speed: 1.7, sight: 9, cost: { food: 50, gold: 80 }, pop: 1, time: 25, grow: 0.15,
  },
  med: {
    cls: 'sup', at: 'town', minEra: 1, key: 'E', names: ['', 'Heiler', 'Feldarzt', 'Mönch', 'Feldscher', 'Sanitäter', 'Sanitäter', 'Sanitäter'],
    hp: 45, atk: 1, range: 0.5, cd: 2, speed: 1.5, sight: 7, cost: { food: 60, gold: 30 }, pop: 1, time: 20, heal: 2.5, grow: 0.15,
  },

};
export const UNIQUE = {
  uq_steppe: { line: 'cav', name: 'Steppenreiter', mods: { range: 4, atkMul: 0.75, hpMul: 0.85 }, cost: { food: 60, wood: 40, gold: 40 } },
  uq_traders: { line: 'inf', name: 'Söldner', mods: { hpMul: 1.45, atkMul: 1.35 }, cost: { gold: 85 } },
  uq_builders: { line: 'sie', name: 'Wallbrecher', mods: { hpMul: 1.8, range: 1, minRange: 0, atkMul: 1.4, splash: 0 }, cost: { wood: 140, gold: 60 } },
  uq_warriors: { line: 'inf', name: 'Berserker', mods: { atkMul: 1.6, speedMul: 1.2, hpMul: 1.1 }, cost: { food: 70, gold: 30 } },
};
export const UNIQUE_MIN_ERA = 3;

// ---------------- Veteranen, Formationen, Nachschub ----------------
// Erfahrung = Summe (Kosten der besiegten Einheit / eigene Kosten); je Rang +10 % Schaden und Leben
export const VET_RANKS = [3, 8, 16];
export const VET_BONUS = 0.1;
export const FORMATIONS = {
  none: { name: 'Frei', speed: 1 },
  line: { name: 'Linie', key: 'Q', speed: 0.95, desc: 'Fernkämpfer +15 % Schaden. Reiterei und Panzer machen +30 % Schaden gegen sie.', dealRanged: 1.15, takeFrom: { cav: 1.3 } },
  column: { name: 'Kolonne', key: 'W', speed: 1.2, desc: '+20 % Tempo. Artillerie und Belagerung machen +30 % Schaden gegen sie.', takeFrom: { art: 1.3, sie: 1.3 } },
  wedge: { name: 'Keil', key: 'E', speed: 1, desc: 'Reiterei und Panzer +20 % Schaden beim Angriff, aber +10 % erlittener Schaden.', dealCls: { cav: 1.2 }, takeAll: 1.1 },
  square: { name: 'Igel / Karree', key: 'R', speed: 0.4, desc: 'Rundum-Verteidigung: Reiterei macht 40 % weniger Schaden. Fast unbeweglich, Artillerie trifft voll.', takeFrom: { cav: 0.6 } },
  loose: { name: 'Aufgelockert', key: 'T', speed: 1, minEra: 6, desc: 'Flächenschaden −40 %, aber −15 % Schaden im Nahkampf.', splashTaken: 0.6, dealMelee: 0.85 },
};
export const FORMATION_KEYS = Object.keys(FORMATIONS);
export const SUPPLY_RANGE = 16; // Kacheln um Haupthaus, Lager und Türme
export const SUPPLY_GRACE = 120; // Sekunden ohne Nachschub, bevor Leben verloren geht

// ---------------- Diplomatie ----------------
export const REP_START = 70, REP_LOW = 35; // Ansehen 0–100; unter REP_LOW keine gemeinsame Sicht im Bündnis
export const REP_LOSS = { breach: 30, envoy: 20, spy: 5 };
export const CONTACT_RANGE = 7; // Botschafter so nah an einem fremden Gebäude = Kontakt
export const ALLIANCE_NOTICE = 120; // Kündigungsfrist eines Bündnisses in Sekunden
export const PACT_MINUTES = [10, 20, 30];
export const repLabel = r => r >= 80 ? 'hoch' : r >= 55 ? 'gut' : r >= REP_LOW ? 'mäßig' : 'niedrig';

// ---------------- Spionage ----------------
export const SPY_MISSIONS = {
  sabotage: { name: 'Sabotage', key: 'Q', range: 1.5, cd: 90, desc: 'Legt ein feindliches Gebäude 2 Minuten lahm: keine Ausbildung, Türme schießen nicht.' },
  steal: { name: 'Pläne stehlen', key: 'W', range: 1.5, cd: 180, desc: 'An einem feindlichen Haupthaus: dein nächster Epochenaufstieg kostet 25 % weniger.' },
  scout: { name: 'Aufklären', key: 'E', range: 0, cd: 60, desc: 'Deckt den Umkreis des Spions 3 Minuten lang für dich auf.' },
};
export const SPY_DETECT = 10; // Haupthaus, Türme und Außenposten enttarnen Spione in diesem Umkreis

// ---------------- Ereignisse (etwa alle 15–20 Minuten, zwei Möglichkeiten) ----------------
// e: Effekte – res (einmalig), buff {k, v, res, s} (k: gather|farm|train|dmg), workers (Verlust-Chance), morale, rep, eraDiscount
export const EVENTS = {
  harvest: { title: 'Reiche Ernte', minEra: 0, text: 'Das Wetter war gnädig, die Speicher quellen über.', options: [
    { label: '+300 Nahrung einlagern', e: { res: { food: 300 } } },
    { label: 'Felder 5 Minuten +25 %', e: { buff: { k: 'farm', v: 1.25, s: 300 } } }] },
  famine: { title: 'Missernte', minEra: 1, text: 'Dürre hat die Felder ausgedörrt.', options: [
    { label: 'Vorräte öffnen (−200 Nahrung)', e: { res: { food: -200 } } },
    { label: 'Rationieren: Felder 4 Minuten −30 %', e: { buff: { k: 'farm', v: 0.7, s: 240 } } }] },
  caravan: { title: 'Händlerkarawane', minEra: 1, maxEra: 4, text: 'Fremde Händler bieten Gold gegen Holz.', options: [
    { label: '200 Holz gegen 150 Gold tauschen', e: { res: { wood: -200, gold: 150 } } },
    { label: 'Ablehnen', e: {} }] },
  plague: { title: 'Die Pest', minEra: 4, maxEra: 5, text: 'Eine Seuche breitet sich in den Siedlungen aus.', options: [
    { label: 'Quarantäne: 3 Minuten −20 % Sammeln', e: { buff: { k: 'gather', v: 0.8, s: 180 } } },
    { label: 'Weiterarbeiten (25 % Risiko, 10 Arbeiter zu verlieren)', e: { workers: { chance: 0.25, n: 10 } } }] },
  deserters: { title: 'Deserteure', minEra: 2, text: 'Ein Teil der Truppe ist des Kämpfens müde.', options: [
    { label: 'Amnestie und Sold (−150 Gold, +Moral)', e: { res: { gold: -150 }, morale: 20 } },
    { label: 'Hart durchgreifen (−10 Moral)', e: { morale: -10 } }] },
  goldrush: { title: 'Goldrausch', minEra: 5, text: 'In den Bergen wurde Gold gefunden!', options: [
    { label: 'Arbeiter abziehen: 5 Min. +50 % Gold, −20 % Nahrung', e: { buff: [{ k: 'gather', res: 'gold', v: 1.5, s: 300 }, { k: 'gather', res: 'food', v: 0.8, s: 300 }] } },
    { label: 'Ignorieren', e: {} }] },
  espionage: { title: 'Industriespionage', minEra: 6, text: 'Ein Unbekannter bietet fremde Baupläne an.', options: [
    { label: 'Kaufen (300 Gold): nächster Aufstieg −20 %', e: { res: { gold: -300 }, eraDiscount: 0.2 } },
    { label: 'Ablehnen und melden (+5 Ansehen)', e: { rep: 5 } }] },
  election: { title: 'Wahlkampf', minEra: 7, text: 'Das Volk wählt. Was steht im Mittelpunkt?', options: [
    { label: 'Wirtschaft: 5 Min. +15 % Sammeln', e: { buff: { k: 'gather', v: 1.15, s: 300 } } },
    { label: 'Rüstung: 5 Min. +20 % Ausbildungstempo', e: { buff: { k: 'train', v: 1.2, s: 300 } } }] },
  reichsgruendung: { title: 'Reichsgründung 1871', nation: 'germany', minEra: 6, text: 'Die deutschen Staaten vereinen sich zum Kaiserreich.', options: [
    { label: 'Kaiserproklamation: 5 Min. +10 % Schaden', e: { buff: { k: 'dmg', v: 1.1, s: 300 } } },
    { label: 'Reichsgold: +400 Gold', e: { res: { gold: 400 } } }] },
  titostalin: { title: 'Bruch mit Stalin 1948', nation: 'yugoslavia', minEra: 7, text: 'Jugoslawien geht einen eigenen Weg zwischen den Blöcken.', options: [
    { label: 'Blockfreiheit: +10 Ansehen, 5 Min. +10 % Sammeln', e: { rep: 10, buff: { k: 'gather', v: 1.1, s: 300 } } },
    { label: 'Aufrüsten: 5 Min. +20 % Ausbildungstempo', e: { buff: { k: 'train', v: 1.2, s: 300 } } }] },
  gallipoli: { title: 'Gallipoli 1915', nation: 'ottoman', minEra: 6, text: 'Die Verteidiger der Dardanellen halten stand.', options: [
    { label: 'Halten: 5 Min. +20 % Schaden', e: { buff: { k: 'dmg', v: 1.2, s: 300 } } },
    { label: 'Neu aufstellen: +300 Nahrung, +200 Gold', e: { res: { food: 300, gold: 200 } } }] },
  winterwar: { title: 'Strenger Winter', nation: 'russia', minEra: 3, text: 'Der Frost kommt früh – für den Feind.', options: [
    { label: 'Vorräte anlegen: +300 Holz', e: { res: { wood: 300 } } },
    { label: 'Mobilmachen: 5 Min. +20 % Ausbildungstempo', e: { buff: { k: 'train', v: 1.2, s: 300 } } }] },
};
export const EVENT_FIRST = 600, EVENT_GAP = [900, 1200], EVENT_TIMEOUT = 60;

// ---------------- Gelände, Jahreszeiten, Provinzen ----------------
export const TERRAIN = ['Wiese', 'Erde', 'Strand', 'Wasser', 'Fels', 'Hügel', 'Schnee', 'Wüste', 'Sumpf', 'Furt'];
export const SEASON_LEN = 900; // Spielsekunden je Jahreszeit (ein Jahr = 1 Stunde)
export const SEASONS = [
  { name: 'Frühling', icon: '🌱', mud: true, desc: 'Schlammperiode: Fahrzeuge abseits von Straßen −40 % Tempo.' },
  { name: 'Sommer', icon: '☀', desc: 'Hitze: Truppen ohne Nachschub verlieren in der Wüste doppelt so schnell Leben.' },
  { name: 'Herbst', icon: '🍂', mud: true, desc: 'Schlammperiode: Fahrzeuge abseits von Straßen −40 % Tempo.' },
  { name: 'Winter', icon: '❄', desc: 'Schnee bremst stärker, Felder liefern 30 % weniger, Moral ohne Nachschub sinkt doppelt so schnell.' },
];
export const seasonAt = t => Math.floor(t / SEASON_LEN) % 4;
export const PROVINCE_BONUS = 0.1; // schnelleres Sammeln in eigenen Provinzen
export const PROVINCE_WEIGHT = { town: 10, outpost: 6, tower: 3 }; // übrige Gebäude 1, Mauern/Straßen/Brücken 0

// ---------------- Gebäude ----------------
export const BUILDINGS = {
  town: { name: 'Haupthaus', size: 3, hp: 1400, cost: { wood: 300, stone: 150 }, time: 70, pop: 10, drop: true, atk: 6, range: 6, cd: 2, sight: 9, minEra: 0, key: 'Y', desc: 'Bildet Arbeiter aus, Epochenaufstieg, Abgabestelle für alle Ressourcen.' },
  house: { name: 'Haus', size: 2, hp: 300, cost: { wood: 30 }, time: 14, pop: 5, sight: 4, minEra: 0, key: 'Q', desc: '+5 Bevölkerung.' },
  storage: { name: 'Lager', size: 2, hp: 450, cost: { wood: 100 }, time: 20, drop: true, sight: 5, minEra: 0, key: 'W', desc: 'Abgabestelle für alle Ressourcen.' },
  farm: { name: 'Feld', size: 2, hp: 200, cost: { wood: 60 }, time: 10, walkable: true, sight: 2, minEra: 0, key: 'E', yields: 'food', rate: 0.6, desc: 'Unerschöpfliche Nahrung für einen Arbeiter.' },
  barracks: { name: 'Kaserne', size: 3, hp: 900, cost: { wood: 150 }, time: 30, sight: 6, minEra: 0, key: 'R', desc: 'Bildet Nahkämpfer aus.' },
  range: { name: 'Schießplatz', size: 3, hp: 800, cost: { wood: 150 }, time: 30, sight: 6, minEra: 0, key: 'T', desc: 'Bildet Fernkämpfer aus.' },
  stable: { name: 'Stall', size: 3, hp: 900, cost: { wood: 175, gold: 25 }, time: 35, sight: 6, minEra: 1, key: 'D', desc: 'Bildet Reiterei und später Fahrzeuge aus.' },
  tower: { name: 'Wachturm', size: 2, hp: 700, cost: { stone: 125, wood: 25 }, time: 30, atk: 8, range: 7, cd: 1.8, sight: 9, minEra: 1, key: 'G', desc: 'Schießt auf Feinde in Reichweite.' },
  workshop: { name: 'Werkstatt', size: 3, hp: 900, cost: { wood: 200, gold: 50 }, time: 40, sight: 6, minEra: 2, key: 'V', desc: 'Baut Belagerungswaffen.' },
  outpost: { name: 'Außenposten', size: 2, hp: 600, cost: { wood: 120, stone: 60 }, time: 25, sight: 8, minEra: 1, key: 'A', claim: 6, desc: 'Beansprucht die Provinz, versorgt Truppen in der Nähe (Nachschub) und dient als Abgabestelle.', drop: true },
  road: { name: 'Straße', size: 1, hp: 200, cost: { stone: 4 }, time: 2, walkable: true, sight: 1, minEra: 4, key: 'F', line: true, desc: 'Wie eine Mauer ziehen: +25 % Tempo, ignoriert Schlamm und Schnee.' },
  bridge: { name: 'Brücke', size: 1, hp: 400, cost: { wood: 20, stone: 6 }, time: 6, walkable: true, sight: 2, minEra: 1, key: 'X', line: true, onWater: true, desc: 'Wie eine Mauer über Wasser ziehen, Abschnitt für Abschnitt vom Ufer aus. Jeder kann sie benutzen; Abschnitte lassen sich zerstören.' },
  wall: { name: 'Palisade', size: 1, hp: 350, cost: { wood: 4 }, time: 3, sight: 2, minEra: 0, key: 'C', line: true, desc: 'Günstiges Hindernis (ab Mittelalter Steinmauer).' },
};
// Weltwunder: Ausbau des Haupthauses in der letzten Epoche. Wer es 30 Minuten (große Karten: 60) hält, gewinnt.
export const WONDER = { name: 'Weltwunder', cost: { food: 6000, wood: 5000, stone: 5000, gold: 7000 }, time: 240, hold: 1800, holdLarge: 3600, hpMul: 4 };
// Große Karten (Kantenlänge ab 160 Kacheln, d. h. „Groß“/„Riesig“ oder viele Spieler) brauchen 1 Stunde
export const wonderHold = mapW => (mapW >= 160 ? WONDER.holdLarge : WONDER.hold);
export const WONDER_ERA = 8; // Anzeige-Epoche für das Modell (nach der letzten Epoche)

export const BUILD_ORDER = ['house', 'storage', 'farm', 'outpost', 'road', 'bridge', 'barracks', 'range', 'stable', 'tower', 'workshop', 'wall', 'town'];

// ---------------- Rohstoffe auf der Karte ----------------
export const RESOURCE_TYPES = {
  tree: { res: 'wood', amount: 100, size: 1, rate: 0.72 },
  berry: { res: 'food', amount: 150, size: 1, rate: 0.8 },
  gold: { res: 'gold', amount: 1500, size: 2, rate: 0.6 },
  stone: { res: 'stone', amount: 1200, size: 2, rate: 0.6 },
};
// Tiefere Schichten: Ein erschöpftes Gold- oder Steinvorkommen bleibt an seinem Ort und lässt sich
// mit besserer Bergbautechnik weiter abbauen. Es entstehen keine neuen Vorkommen – Lagerstätten bleiben umkämpft.
export const DEPOSIT_LAYERS = [
  { era: 0, mul: 1, name: 'Oberfläche' },
  { era: 3, mul: 1, name: 'Stollenbau' },
  { era: 5, mul: 1.5, name: 'Tiefbau mit Dampfpumpen' },
  { era: 6, mul: 2, name: 'Industrieller Tiefbau' },
  { era: 7, mul: 2, name: 'Großtagebau' },
];
export const hasLayers = rtype => rtype === 'gold' || rtype === 'stone';
export const RESOURCE_KINDS = ['tree', 'berry', 'gold', 'stone'];
export const FARM_RATE = 0.6;
export const CARRY = 10;
// Gebäude, in denen ein Arbeiter dauerhaft sammelt (Feld, Bergwerk, Steinbruch)
export const isProducer = type => !!(BUILDINGS[type] && BUILDINGS[type].yields);

// ---------------- Typtabelle (Index für das Netzwerkprotokoll) ----------------
export const TYPES = [];
export const TYPE_INDEX = {};
for (const [line, d] of Object.entries(LINES)) {
  for (let era = d.minEra; era < ERAS.length; era++) {
    const key = line + era;
    TYPE_INDEX[key] = TYPES.length;
    TYPES.push({ kind: 'u', key, line, era, cls: d.cls, name: d.names[era] });
  }
}
for (const [uq, d] of Object.entries(UNIQUE)) {
  for (let era = UNIQUE_MIN_ERA; era < ERAS.length; era++) {
    const key = uq + '_' + era;
    TYPE_INDEX[key] = TYPES.length;
    TYPES.push({ kind: 'u', key, line: d.line, unique: uq, era, cls: LINES[d.line].cls, name: d.name });
  }
}
for (const b of Object.keys(BUILDINGS)) {
  TYPE_INDEX[b] = TYPES.length;
  TYPES.push({ kind: 'b', key: b, name: BUILDINGS[b].name });
}
export function unitKey(line, era, unique) { return unique ? unique + '_' + era : line + era; }

export function scaleCost(cost, f) {
  const o = {};
  for (const k in cost) o[k] = Math.round(cost[k] * f / 5) * 5;
  return o;
}
export function sumCost(c) { let s = 0; for (const k in c) s += c[k]; return s; }

// Werte einer Einheit (ohne Spielerboni)
export function unitBase(line, era, unique) {
  const d = LINES[line];
  const g = d.grow != null ? d.grow : 0.3;
  const steps = Math.max(0, era - d.minEra);
  const ov = (d.eraOverride && d.eraOverride[era]) || {};
  const cg = d.costGrow != null ? d.costGrow : 1.18;
  const s = {
    line, era, cls: d.cls, name: d.names[era],
    hp: d.hp * Math.pow(1 + g, steps) * (ov.hpMul || 1),
    atk: d.atk * Math.pow(1 + g, steps),
    range: ov.range != null ? ov.range : d.range,
    minRange: d.minRange || 0,
    cd: d.cd, speed: ov.speed || d.speed, sight: d.sight, pop: ov.pop || d.pop,
    time: d.time * (1 + steps * 0.05), splash: d.splash || 0, heal: d.heal ? d.heal * Math.pow(1 + g, steps) : 0,
    cost: scaleCost(d.cost, Math.pow(cg, steps)),
  };
  if (unique) {
    const u = UNIQUE[unique], m = u.mods;
    s.name = u.name;
    s.cost = scaleCost(u.cost, Math.pow(1.18, steps));
    if (m.hpMul) s.hp *= m.hpMul;
    if (m.atkMul) s.atk *= m.atkMul;
    if (m.speedMul) s.speed *= m.speedMul;
    if (m.range != null) s.range = m.range;
    if (m.minRange != null) s.minRange = m.minRange;
    if (m.splash != null) s.splash = m.splash;
  }
  return s;
}

// Bonus-Sammlung eines Spielers aus Kultur + Nation
export function playerMods(culture, nation, late = false) {
  const m = {
    gather: { food: 1, wood: 1, stone: 1, gold: 1 }, armyCost: 1, cavCost: 1, cavSpeed: 1, cavHp: 1, infAtk: 1, infHp: 1, infSpeed: 1,
    bldHp: 1, buildSpeed: 1, towerAtk: 1, towerRange: 0, housePop: 0, trainSpeed: 1, rangedRange: 0, siegeDmg: 1, regen: 0,
    armyHp: 1, armyDmg: 1, late: !!late,
  };
  if (culture === 'steppe') { m.cavSpeed = 1.15; m.cavCost = 0.85; }
  if (culture === 'traders') { m.gather.gold = 1.25; m.gather.stone = 1.25; }
  if (culture === 'builders') { m.bldHp = 1.4; m.buildSpeed = 1.4; m.towerAtk = 1.3; }
  if (culture === 'warriors') { m.infAtk = 1.15; m.infHp = 1.1; }
  const n = nation && NATIONS[nation];
  if (n) {
    const b = n.bonus;
    if (b.gather) for (const k in m.gather) m.gather[k] *= b.gather;
    for (const k of ['armyCost', 'cavHp', 'trainSpeed', 'siegeDmg', 'infSpeed', 'armyHp', 'armyDmg']) if (b[k]) m[k] *= b[k];
    for (const k of ['housePop', 'rangedRange', 'towerRange', 'regen']) if (b[k]) m[k] += b[k];
    if (b.winter) m.winter = true;
  }
  return m;
}

// Endgültige Werte einer Einheit für einen Spieler
export function unitStats(line, era, unique, mods) {
  const s = unitBase(line, era, unique);
  if (!mods) return s;
  const mil = s.cls !== 'wrk';
  if (s.cls === 'cav') { s.speed *= mods.cavSpeed; s.hp *= mods.cavHp; s.cost = scaleCost(s.cost, mods.cavCost); }
  if (s.cls === 'inf') { s.atk *= mods.infAtk; s.hp *= mods.infHp; s.speed *= mods.infSpeed; }
  if (s.cls === 'rng' && s.range > 1) s.range += mods.rangedRange;
  if (s.cls === 'sie') s.atk *= mods.siegeDmg;
  if (mil) { s.hp *= mods.armyHp; s.atk *= mods.armyDmg; s.cost = scaleCost(s.cost, mods.armyCost); }
  if (mods.late && era === LATE_STAGE.era && s.cls !== 'wrk') {
    s.hp *= LATE_STAGE.hpMul; s.atk *= LATE_STAGE.atkMul;
    if (!unique && LINES[line].late) s.name = LINES[line].late;
  }
  s.time /= mods.trainSpeed;
  s.hp = Math.round(s.hp);
  return s;
}
export function buildingStats(type, era, mods) {
  const b = BUILDINGS[type];
  const wallStone = type === 'wall' && era >= 3;
  const s = { ...b, hp: Math.round(b.hp * (1 + 0.15 * era) * (wallStone ? 3 : 1) * (mods ? mods.bldHp : 1)) };
  if (wallStone) { s.name = 'Steinmauer'; s.cost = { stone: 5 }; }
  if (b.atk) {
    s.atk = b.atk * (1 + 0.25 * era) * (mods ? mods.towerAtk : 1);
    s.range = b.range + (mods && type === 'tower' ? mods.towerRange : 0);
  }
  if (type === 'house' && mods) s.pop = b.pop + mods.housePop;
  s.time = b.time / (mods ? mods.buildSpeed : 1);
  return s;
}
// Welche Einheiten kann ein Gebäude für einen Spieler ausbilden?
export function trainable(bType, era, culture) {
  const out = [];
  for (const [line, d] of Object.entries(LINES)) {
    if (d.at === bType && era >= d.minEra) out.push({ line, unique: null });
  }
  if (culture && era >= UNIQUE_MIN_ERA) {
    const uq = CULTURES[culture].unique;
    if (LINES[UNIQUE[uq].line].at === bType) out.push({ line: UNIQUE[uq].line, unique: uq });
  }
  return out;
}
