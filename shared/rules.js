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
  nukes: true, // Atomwaffen für historische Atommächte (Kalter Krieg)
  conferences: 'pause', // Friedenskonferenzen: pause | nopause | off
  confMin: 5, // Zeitlimit einer Konferenz in Minuten (3, 5, 8)
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
const ALL_NATIONS = ['usa', 'russia', 'germany', 'china', 'austria', 'yugoslavia', 'india', 'france', 'britain', 'italy', 'japan', 'ottoman'];
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
  usa: { name: 'USA', desc: 'Alle Rohstoffe werden 15 % schneller gesammelt (gleicht die fehlenden Einheiten im Mittelalter aus). Weltwunder: Freiheitsstatue.', bonus: { gather: 1.15 } },
  russia: { name: 'Russland', desc: 'Militäreinheiten haben 10 % mehr Leben. „General Winter“: keine Nachteile durch Schnee und Winter in eigenen Provinzen. Weltwunder: Basilius-Kathedrale.', bonus: { armyHp: 1.1, winter: true } },
  germany: { name: 'Deutschland', desc: 'Militäreinheiten verursachen 10 % mehr Schaden. Weltwunder: Kölner Dom.', bonus: { armyDmg: 1.1 } },
  china: { name: 'China', desc: 'Einheiten werden 25 % schneller ausgebildet. Weltwunder: Himmelstempel.', bonus: { trainSpeed: 1.25 } },
  austria: { name: 'Österreich-Ungarn', desc: 'Türme haben +2 Reichweite. Weltwunder: Parlament Budapest.', bonus: { towerRange: 2 } },
  yugoslavia: { name: 'Jugoslawien', desc: 'Infanterie bewegt sich 15 % schneller. Weltwunder: Tempel des hl. Sava.', bonus: { infSpeed: 1.15 } },
  india: { name: 'Indien', desc: 'Häuser geben +4 Bevölkerung, Belagerung +25 % Schaden. Weltwunder: Taj Mahal.', bonus: { housePop: 4, siegeDmg: 1.25 } },
  france: { name: 'Frankreich', desc: 'Gebäude haben 20 % mehr Leben, Mauern, Türme und Außenposten kosten 25 % weniger. Weltwunder: Eiffelturm.', bonus: { bldHp: 1.2, fortCost: 0.75 } },
  britain: { name: 'Großbritannien', desc: 'Fernkämpfer +1 Reichweite. Später: Schiffe 20 % billiger, Werften 25 % schneller. Weltwunder: Tower Bridge.', bonus: { rangedRange: 1, shipCost: 0.8, shipBuild: 1.25 } },
  italy: { name: 'Italien', desc: 'Infanterie und Fernkämpfer machen auf Hügeln 20 % mehr Schaden. Weltwunder: Petersdom.', bonus: { hillDmg: 1.2 } },
  japan: { name: 'Japan', desc: 'Spezialeinheiten (Kultur und Nation) kosten 20 % weniger. Weltwunder: Tōdai-ji.', bonus: { uniqueCost: 0.8 } },
  ottoman: { name: 'Osmanisches Reich', desc: 'Infanterie kostet 15 % weniger. Weltwunder: Sultan-Ahmed-Moschee.', bonus: { infCost: 0.85 } },
};

// Eigene Einheiten je Nation und Epoche (3 = Frühes MA, 4 = Spätes MA, 5 = 1. IR). Eine Einheit ist nur in ihrer Epoche ausbildbar.
// mods: hpMul, atkMul, speedMul, cdMul (Schussfolge), range (fest) bzw. rangeAdd, splash, dmgVs {Klasse: Faktor}, plunder, costMul, timeMul; at = anderes Gebäude
export const NATION_UNITS = {
  germany: [
    { era: 3, id: 'germany_otto', line: 'cav', name: 'Ottonischer Panzerreiter', icon: '🏇', hist: 'Lechfeld, 955', mods: { hpMul: 1.3 }, costMul: 1.05 },
    { era: 4, id: 'germany_landsknecht', line: 'inf', name: 'Landsknecht', icon: '⚔', hist: 'ab 1490, Zweihänder', mods: { atkMul: 1.1, splash: 0.8, dmgVs: { spr: 1.5 } }, costMul: 1.15 },
    { era: 5, id: 'germany_grenadier', line: 'inf', name: 'Preußischer Grenadier', icon: '🪖', hist: 'Zündnadelgewehr, 1841', mods: { cdMul: 0.75 }, costMul: 1.15 },
    { era: 6, id: 'germany_krupp', line: 'art', name: 'Krupp-Feldartillerie', icon: '💣', hist: '1870/71', mods: { rangeAdd: 2, atkMul: 1.1 }, costMul: 1.1 },
    { era: 6, reqLate: true, id: 'germany_tiger', line: 'cav', name: 'Tiger I', icon: '🛡', hist: '1942, schwerer Panzer', mods: { hpMul: 1.5, atkMul: 1.25, speedMul: 0.8 }, costMul: 1.4 },
    { era: 6, reqLate: true, sig: true, max: 1, id: 'germany_gustav', line: 'sie', name: 'Schwerer Gustav', icon: '💥', hist: '80-cm-Eisenbahngeschütz, 1942 – nur auf Gleisen, wird am Bahnhof gebaut', at: 'station', mods: { range: 26, minRange: 8, atkMul: 4, cdMul: 3, speedMul: 0.6, hpMul: 3, splash: 3, railOnly: true }, costMul: 7 },
    { era: 7, id: 'germany_gepard', line: 'flak', name: 'Gepard', icon: '🎯', hist: 'Flakpanzer, 1976', mods: { atkMul: 1.4, hpMul: 1.2 }, costMul: 1.2 },
    { era: 7, sig: true, max: 6, id: 'germany_leopard', line: 'cav', name: 'Leopard 2', icon: '🛡', hist: '1979', mods: { hpMul: 1.4, atkMul: 1.3, speedMul: 1.1 }, costMul: 1.3 },
  ],
  austria: [
    { era: 3, id: 'austria_magyar', line: 'cav', name: 'Magyarischer Bogenreiter', icon: '🏹', hist: 'Ungarnzüge, 10. Jh.', mods: { range: 4, atkMul: 0.95, speedMul: 1.1 }, costMul: 1.05 },
    { era: 4, id: 'austria_hussar', line: 'cav', name: 'Ungarischer Husar', icon: '🐎', hist: 'Schwarze Armee, 15. Jh.', mods: { speedMul: 1.2, atkMul: 1.1 }, costMul: 0.95 },
    { era: 5, id: 'austria_cuirassier', line: 'cav', name: 'Kaiserlicher Kürassier', icon: '🛡', hist: '18. Jh.', mods: { hpMul: 1.25, atkMul: 1.05 }, costMul: 1.15 },
    { era: 6, id: 'austria_kaiserjaeger', line: 'inf', name: 'Tiroler Kaiserjäger', icon: '⛰', hist: 'Gebirgstruppe', mods: { hpMul: 1.15, speedMul: 1.1, noHillSlow: true }, costMul: 1.0 },
    { era: 6, reqLate: true, id: 'austria_zrinyi', line: 'art', name: 'Zrínyi II', icon: '🛡', hist: 'ungarisches Sturmgeschütz, 1943', mods: { hpMul: 1.7, dmgVs: { bld: 1.5 } }, costMul: 1.3 },
    { era: 6, sig: true, max: 1, id: 'austria_skoda', line: 'sie', name: 'Škoda-30,5-cm-Mörser', icon: '💥', hist: '1911, im Einsatz ab 1914', mods: { range: 18, minRange: 5, atkMul: 3, cdMul: 2.2, hpMul: 2, splash: 2.5 }, costMul: 5 },
    { era: 7, id: 'austria_sk105', line: 'cav', name: 'SK-105 Kürassier', icon: '🛡', hist: 'Jagdpanzer, 1971', mods: { speedMul: 1.25, atkMul: 1.1, hpMul: 0.9 }, costMul: 1.0 },
    { era: 7, sig: true, max: 10, id: 'austria_jagdkommando', line: 'inf', name: 'Jagdkommando', icon: '🎖', hist: 'Spezialkräfte, ab 1962', mods: { hpMul: 1.4, atkMul: 1.6, camo: true }, costMul: 1.4 },
  ],
  russia: [
    { era: 3, id: 'russia_druzhina', line: 'inf', name: 'Druschina', icon: '🛡', hist: 'Kiewer Rus', mods: { hpMul: 1.25 }, costMul: 1.1 },
    { era: 4, id: 'russia_strelets', line: 'rng', name: 'Strelize', icon: '🔫', hist: 'ab 1550, Arkebuse und Berdysch', mods: { hpMul: 1.3, atkMul: 1.05, dmgVs: { inf: 1.15 } }, costMul: 1.1 },
    { era: 5, id: 'russia_cossack', line: 'cav', name: 'Kosak', icon: '🐎', hist: 'Höhepunkt 18./19. Jh., plündert', mods: { hpMul: 0.9, speedMul: 1.1, plunder: true }, costMul: 0.8 },
    { era: 6, sig: true, max: 2, id: 'russia_muromets', line: 'bomber', name: 'Ilja Muromez', icon: '🛬', hist: '1913, erster viermotoriger Bomber', mods: { hpMul: 1.3, atkMul: 0.8 }, costMul: 1.3 },
    { era: 6, reqLate: true, id: 'russia_t34', line: 'cav', name: 'T-34', icon: '🛡', hist: '1940', mods: { hpMul: 1.05 }, costMul: 0.8, timeMul: 0.7 },
    { era: 6, reqLate: true, sig: true, max: 4, id: 'russia_katyusha', line: 'art', name: 'Katjuscha (BM-13)', icon: '🎆', hist: 'Raketenwerfer, 1941', mods: { splash: 3, atkMul: 1.7, cdMul: 2, rangeAdd: 2 }, costMul: 1.6 },
    { era: 7, id: 'russia_mi24', line: 'heli', name: 'Mi-24 „Hind“', icon: '🚁', hist: 'Kampfhubschrauber, 1972', mods: { hpMul: 1.35, atkMul: 1.1 }, costMul: 1.2 },
    { era: 7, sig: true, max: 1, id: 'russia_tu160', line: 'bomber', name: 'Tu-160', icon: '🛬', hist: 'strategischer Bomber, 1987', mods: { hpMul: 2, atkMul: 2, fuelMul: 2, speedMul: 1.3 }, costMul: 3 },
  ],
  china: [
    { era: 3, id: 'china_zhugenu', line: 'rng', name: 'Repetierarmbrust (Zhuge Nu)', icon: '🏹', hist: 'seit der Han-Zeit', mods: { cdMul: 0.5, atkMul: 0.8, range: 4.5 }, costMul: 0.95 },
    { era: 4, id: 'china_beehive', line: 'sie', name: 'Raketenwerfer „Bienenstock“', icon: '🎆', hist: 'Ming, um 1400', mods: { splash: 2.4, dmgVs: { inf: 2.5, spr: 2.5, rng: 2.5, wrk: 2 }, atkMul: 0.8 }, costMul: 1.1 },
    { era: 5, id: 'china_banner', line: 'cav', name: 'Banner-Reiter', icon: '🏹', hist: 'Acht Banner der Qing', mods: { range: 5, hpMul: 1.15 }, costMul: 1.1 },
    { era: 6, id: 'china_newarmy', line: 'inf', name: 'Neue Armee (Xinjun)', icon: '🪖', hist: '1895–1911', mods: { atkMul: 1.15 }, costMul: 1.0, timeMul: 0.7 },
    { era: 6, id: 'china_dingyuan', line: 'warship', name: 'Panzerschiff Dingyuan', icon: '🚢', hist: '1881, Beiyang-Flotte', mods: { hpMul: 1.6, atkMul: 1.3 }, costMul: 1.5 },
    { era: 6, reqLate: true, id: 'china_dadao', line: 'inf', name: 'Dadao-Truppe', icon: '🗡', hist: '29. Armee an der Großen Mauer, 1933', mods: { range: 0.5, atkMul: 2.0, hpMul: 1.25, speedMul: 1.15 }, costMul: 1.1 },
    { era: 6, reqLate: true, sig: true, max: 3, id: 'china_guerilla', line: 'inf', name: 'Guerilla der 8. Route-Armee', icon: '🌾', hist: '1937–45', mods: { camo: true, atkMul: 1.2 }, costMul: 0.9 },
    { era: 7, id: 'china_type59', line: 'cav', name: 'Typ 59', icon: '🛡', hist: 'Kampfpanzer, 1959', mods: {}, costMul: 0.75 },
    { era: 7, sig: true, max: 3, id: 'china_hq2', line: 'flak', name: 'HQ-2-Raketenstellung', icon: '🚀', hist: 'Flugabwehrraketen, 1960er', mods: { rangeAdd: 5, atkMul: 2, speedMul: 0.5 }, costMul: 1.4 },
  ],
  india: [
    { era: 3, id: 'india_elephant', line: 'cav', name: 'Kriegselefant', icon: '🐘', hist: 'Standard indischer Reiche', mods: { hpMul: 1.8, speedMul: 0.75, dmgVs: { bld: 2 }, atkMul: 1.1 }, costMul: 1.3 },
    { era: 4, id: 'india_rajput', line: 'cav', name: 'Rajputen-Reiter', icon: '🏇', hist: 'Rajputen-Reiche, 8.–16. Jh.', mods: { atkMul: 1.25 }, costMul: 1.1 },
    { era: 5, id: 'india_mysore', line: 'rng', name: 'Mysore-Raketenträger', icon: '🎆', hist: 'Tipu Sultan, 1780–1799', mods: { rangeAdd: 2, splash: 1.2, cdMul: 1.3 }, costMul: 1.15 },
    { era: 6, id: 'india_elephantbattery', line: 'art', name: 'Elefanten-Batterie', icon: '🐘', hist: 'Britisch-Indien, 1860–1900', mods: { hpMul: 1.5, speedMul: 1.2, noHillSlow: true }, costMul: 1.2 },
    { era: 6, reqLate: true, id: 'india_sikh', line: 'inf', name: 'Sikh-Infanterie', icon: '🪖', hist: 'Sikh-Regimenter in beiden Weltkriegen', mods: { hpMul: 1.3, atkMul: 1.1 }, costMul: 1.15 },
    { era: 6, reqLate: true, sig: true, max: 10, id: 'india_gurkha', line: 'inf', name: 'Gurkha', icon: '🗡', hist: 'Gurkha-Regimenter', mods: { range: 0.5, atkMul: 2.0, hpMul: 1.5, speedMul: 1.1 }, costMul: 1.25 },
    { era: 7, id: 'india_vijayanta', line: 'cav', name: 'Vijayanta', icon: '🛡', hist: 'Kampfpanzer, 1965', mods: { hpMul: 1.15 }, costMul: 0.95 },
    { era: 7, sig: true, max: 2, id: 'india_prithvi', line: 'art', name: 'Prithvi-Raketenwerfer', icon: '🚀', hist: '1988', mods: { rangeAdd: 7, atkMul: 2.2, cdMul: 1.6, splash: 2.5 }, costMul: 1.6 },
  ],
  yugoslavia: [
    { era: 3, id: 'yugoslavia_narentine', line: 'inf', name: 'Narentaner', icon: '⛵', hist: 'Adria-Seeräuber, 9. Jh., plündert', mods: { speedMul: 1.25, plunder: true }, costMul: 1.0 },
    { era: 4, id: 'yugoslavia_serbknight', line: 'cav', name: 'Serbischer Panzerreiter', icon: '🏇', hist: 'Heer Stefan Dušans, 1340er', mods: { hpMul: 1.15, atkMul: 1.1 }, costMul: 1.1 },
    { era: 5, id: 'yugoslavia_pandur', line: 'inf', name: 'Pandur', icon: '🌲', hist: 'Militärgrenze, 1740er', mods: { speedMul: 1.15, atkMul: 1.1, sightAdd: 2 }, costMul: 1.05 },
    { era: 6, id: 'yugoslavia_komitadji', line: 'inf', name: 'Komitadschi', icon: '🌲', hist: 'Freischärler, Balkankriege 1912–13', mods: { camo: true, speedMul: 1.1 }, costMul: 1.0 },
    { era: 6, reqLate: true, id: 'yugoslavia_partisan', line: 'inf', name: 'Partisan', icon: '⭐', hist: 'Tito, 1941–45', mods: { speedMul: 1.1 }, costMul: 0.7, timeMul: 0.7 },
    { era: 6, sig: true, max: 3, id: 'yugoslavia_mountainbattery', line: 'art', name: 'Serbische Gebirgsbatterie', icon: '⛰', hist: '1912–18', mods: { speedMul: 1.35, noHillSlow: true, rangeAdd: 1, hpMul: 1.1 }, costMul: 1.0 },
    { era: 7, id: 'yugoslavia_m84', line: 'cav', name: 'M-84', icon: '🛡', hist: 'Kampfpanzer, 1984', mods: { hpMul: 1.2, atkMul: 1.05 }, costMul: 1.0 },
  ],
  usa: [
    { era: 5, id: 'usa_minuteman', line: 'inf', at: 'town', name: 'Minuteman', icon: '🪖', hist: '1775, Miliz aus dem Haupthaus', mods: { hpMul: 0.85 }, costMul: 0.7, timeMul: 0.5 },
    { era: 5, id: 'usa_kentucky', line: 'rng', name: 'Kentucky-Büchsenschütze', icon: '🎯', hist: '18. Jh., gezogene Büchse', mods: { rangeAdd: 2, cdMul: 1.2, atkMul: 1.45 }, costMul: 1.1 },
    { era: 6, id: 'usa_roughrider', line: 'cav', name: 'Rough Rider', icon: '🏇', hist: '1898', mods: { speedMul: 1.15, atkMul: 1.1 }, costMul: 1.05 },
    { era: 6, reqLate: true, id: 'usa_sherman', line: 'cav', name: 'M4 Sherman', icon: '🛡', hist: '1942', mods: {}, costMul: 0.85, timeMul: 0.7 },
    { era: 6, reqLate: true, sig: true, max: 3, id: 'usa_b17', line: 'bomber', name: 'B-17 „Fliegende Festung“', icon: '🛬', hist: '1938', mods: { hpMul: 1.7, atkMul: 1.1 }, costMul: 1.5 },
    { era: 7, id: 'usa_abrams', line: 'cav', name: 'M1 Abrams', icon: '🛡', hist: '1980', mods: { rangeAdd: 1.5, hpMul: 1.2 }, costMul: 1.0 },
    { era: 7, sig: true, max: 4, id: 'usa_apache', line: 'heli', name: 'AH-64 Apache', icon: '🚁', hist: '1986', mods: { atkMul: 1.6, hpMul: 1.2 }, costMul: 1.6 },
  ],
  france: [
    { era: 3, id: 'france_scara', line: 'cav', name: 'Fränkische Scara', icon: '🏇', hist: 'Panzerreiter der Karolinger', mods: { hpMul: 1.3, atkMul: 1.05 }, costMul: 1.1 },
    { era: 4, id: 'france_gendarme', line: 'cav', name: 'Gendarme', icon: '🛡', hist: 'Ordonnanzkompanien, 1445', mods: { hpMul: 1.3, atkMul: 1.1 }, costMul: 1.15 },
    { era: 5, id: 'france_oldguard', line: 'inf', name: 'Alte Garde', icon: '🎖', hist: 'Grande Armée, 1804', mods: { hpMul: 1.3, atkMul: 1.2 }, costMul: 1.15 },
    { era: 6, id: 'france_mitrailleuse', line: 'rng', name: 'Mitrailleuse', icon: '🔫', hist: '1866', mods: { cdMul: 0.5, atkMul: 0.75 }, costMul: 1.1 },
    { era: 6, reqLate: true, id: 'france_ft', line: 'cav', name: 'Renault FT', icon: '🛡', hist: '1917, erster Panzer mit Drehturm', mods: { hpMul: 0.9 }, costMul: 0.75, timeMul: 0.8 },
    { era: 6, reqLate: true, sig: true, max: 10, id: 'france_legion', line: 'inf', name: 'Fremdenlegionär', icon: '🎖', hist: 'Légion étrangère', mods: { hpMul: 1.4, atkMul: 1.4 }, costMul: 1.3 },
    { era: 7, id: 'france_mirage', line: 'fighter', name: 'Mirage III', icon: '✈', hist: '1961', mods: { atkMul: 1.2, speedMul: 1.2 }, costMul: 1.15 },
    { era: 7, sig: true, max: 10, id: 'france_2rep', line: 'para', name: 'Fremdenlegion-Fallschirmjäger (2e REP)', icon: '🪂', hist: 'ab 1955', mods: { hpMul: 1.5, atkMul: 1.5 }, costMul: 1.35 },
  ],
  britain: [
    { era: 3, id: 'britain_huscarl', line: 'inf', name: 'Huskarl', icon: '🪓', hist: 'angelsächsische Leibgarde, um 1000', mods: { atkMul: 1.25, dmgVs: { inf: 1.15 } }, costMul: 1.15 },
    { era: 4, id: 'britain_longbow', line: 'rng', name: 'Englischer Langbogenschütze', icon: '🏹', hist: 'Crécy, 1346', mods: { rangeAdd: 2 }, costMul: 1.1 },
    { era: 5, id: 'britain_redcoat', line: 'inf', name: 'Rotrock', icon: '🪖', hist: 'Brown Bess', mods: { cdMul: 0.85, hpMul: 1.1 }, costMul: 1.0 },
    { era: 5, id: 'britain_congreve', line: 'sie', name: 'Congreve-Raketen', icon: '🎆', hist: 'ab 1805', mods: { splash: 2, dmgVs: { inf: 2.2, spr: 2.2, rng: 2.2 }, rangeAdd: 2 }, costMul: 1.1 },
    { era: 6, id: 'britain_leeenfield', line: 'inf', name: 'Lee-Enfield-Schütze', icon: '🪖', hist: '1895, „Mad Minute“', mods: { cdMul: 0.8 }, costMul: 1.1 },
    { era: 6, reqLate: true, id: 'britain_markiv', line: 'cav', name: 'Mark-IV-Panzer', icon: '🛡', hist: '1916, erste Panzer der Welt', mods: { hpMul: 1.3, atkMul: 1.1, speedMul: 0.75, dmgVs: { bld: 1.4 } }, costMul: 1.15 },
    { era: 6, reqLate: true, sig: true, max: 6, id: 'britain_spitfire', line: 'fighter', name: 'Spitfire', icon: '✈', hist: '1938', mods: { atkMul: 1.4, speedMul: 1.15 }, costMul: 1.15 },
    { era: 7, id: 'britain_harrier', line: 'fighter', name: 'Harrier', icon: '✈', hist: 'Senkrechtstarter, 1969', mods: { dmgVs: { cav: 4, art: 4, inf: 3, bld: 3 }, fuelMul: 1.3 }, costMul: 1.25 },
    { era: 7, sig: true, max: 8, id: 'britain_sas', line: 'inf', name: 'SAS', icon: '🎖', hist: 'Spezialkräfte, ab 1941', mods: { hpMul: 1.3, atkMul: 1.6, camo: true, dmgVs: { bld: 2 } }, costMul: 1.35 },
  ],
  italy: [
    { era: 3, id: 'italy_lombard', line: 'cav', name: 'Langobardischer Reiter', icon: '🏇', hist: 'ab 568, Lanze', mods: { atkMul: 1.3, hpMul: 1.1 }, costMul: 1.1 },
    { era: 4, id: 'italy_genoese', line: 'rng', name: 'Genuesischer Armbrustschütze', icon: '🏹', hist: '14. Jh., mit Setzschild', mods: { hpMul: 1.4, atkMul: 1.1 }, costMul: 1.15 },
    { era: 5, id: 'italy_bersaglieri', line: 'inf', name: 'Bersagliere', icon: '🪶', hist: '1836', mods: { speedMul: 1.3, atkMul: 1.1 }, costMul: 1.0 },
    { era: 6, id: 'italy_alpini', line: 'inf', name: 'Alpino', icon: '⛰', hist: '1872', mods: { hpMul: 1.1, speedMul: 1.1, noHillSlow: true }, costMul: 1.05 },
    { era: 6, reqLate: true, id: 'italy_folgore', line: 'para', name: 'Folgore-Fallschirmjäger', icon: '🪂', hist: 'El Alamein, 1942', mods: { hpMul: 1.3, atkMul: 1.2 }, costMul: 1.15 },
    { era: 6, reqLate: true, sig: true, max: 4, id: 'italy_decimamas', line: 'sub', name: 'Decima MAS', icon: '🤿', hist: 'Kampfschwimmer, Alexandria 1941', mods: { atkMul: 1.6, hpMul: 0.6, speedMul: 1.2 }, costMul: 0.9 },
    { era: 7, id: 'italy_mod56', line: 'art', name: 'Mod-56-Gebirgshaubitze', icon: '⛰', hist: '1957, zerlegbar', mods: { speedMul: 1.4, noHillSlow: true }, costMul: 0.8 },
    { era: 7, sig: true, max: 4, id: 'italy_mangusta', line: 'heli', name: 'A129 Mangusta', icon: '🚁', hist: 'Kampfhubschrauber, 1990', mods: { speedMul: 1.2, atkMul: 1.3 }, costMul: 1.4 },
  ],
  japan: [
    { era: 3, id: 'japan_bushi', line: 'cav', name: 'Berittener Bogenkrieger (Bushi)', icon: '🏹', hist: 'Heian-Zeit, 10. Jh.', mods: { range: 4.5, atkMul: 0.85 }, costMul: 1.1 },
    { era: 4, id: 'japan_ashigaru', line: 'rng', name: 'Ashigaru mit Teppō', icon: '🔫', hist: 'Nagashino, 1575', mods: { atkMul: 1.0 }, costMul: 0.9, timeMul: 0.7 },
    { era: 5, id: 'japan_samurai', line: 'inf', name: 'Samurai der Edo-Zeit', icon: '🗡', hist: 'bis 1868', mods: { range: 0.5, atkMul: 1.6, hpMul: 1.3, speedMul: 1.1 }, costMul: 1.2 },
    { era: 6, id: 'japan_meiji', line: 'inf', name: 'Meiji-Infanterie', icon: '🪖', hist: 'ab 1873', mods: { atkMul: 1.1, hpMul: 1.05 }, costMul: 1.05 },
    { era: 6, reqLate: true, id: 'japan_zero', line: 'fighter', name: 'A6M „Zero“', icon: '✈', hist: '1940', mods: { speedMul: 1.15, fuelMul: 1.6, hpMul: 0.85 }, costMul: 1.0 },
    { era: 6, reqLate: true, sig: true, max: 1, id: 'japan_yamato', line: 'battleship', name: 'Yamato', icon: '🚢', hist: 'Schlachtschiff, 1941', mods: { hpMul: 2.2, atkMul: 1.7, rangeAdd: 3 }, costMul: 3 },
    { era: 7, id: 'japan_type74', line: 'cav', name: 'Typ 74', icon: '🛡', hist: 'Kampfpanzer, 1975', mods: { hpMul: 1.1, noHillSlow: true }, costMul: 1.05 },
    { era: 7, sig: true, max: 6, id: 'japan_type90', line: 'cav', name: 'Typ 90', icon: '🛡', hist: 'Kampfpanzer, 1990', mods: { hpMul: 1.4, atkMul: 1.3 }, costMul: 1.6 },
  ],
  ottoman: [
    { era: 3, id: 'ottoman_turkmen', line: 'cav', name: 'Turkmenischer Bogenreiter', icon: '🏹', hist: '10. Jh.', mods: { range: 4, speedMul: 1.15 }, costMul: 1.05 },
    { era: 4, id: 'ottoman_janissary', line: 'rng', name: 'Janitschar', icon: '🔫', hist: 'ab 1360er', mods: { hpMul: 1.3, atkMul: 1.2 }, costMul: 1.15 },
    { era: 5, id: 'ottoman_nizam', line: 'inf', name: 'Nizam-ı Cedid', icon: '🪖', hist: '„Neue Ordnung“, 1792', mods: { atkMul: 1.1 }, costMul: 0.95 },
    { era: 6, id: 'ottoman_hamidiye', line: 'cav', name: 'Hamidiye-Reiter', icon: '🐎', hist: '1891', mods: { speedMul: 1.1 }, costMul: 0.85 },
    { era: 6, reqLate: true, id: 'ottoman_mehmetcik', line: 'inf', name: 'Mehmetçik (Gallipoli)', icon: '🪖', hist: '1915', mods: { hpMul: 1.35 }, costMul: 1.1 },
    { era: 6, sig: true, max: 2, id: 'ottoman_dardanelles', line: 'art', name: 'Dardanellen-Batterie', icon: '🎯', hist: '1915', mods: { rangeAdd: 4, dmgVs: { shp: 3, sub: 1 }, hpMul: 1.5, speedMul: 0.5 }, costMul: 1.3 },
    { era: 7, id: 'ottoman_commando', line: 'para', name: 'Türkischer Kommando', icon: '🪂', hist: 'Zypern, 1974', mods: { hpMul: 1.3, atkMul: 1.1 }, costMul: 1.1 },
    { era: 7, sig: true, max: 4, id: 'ottoman_f16', line: 'fighter', name: 'F-16 (Lizenzfertigung)', icon: '✈', hist: 'ab 1987', mods: { atkMul: 1.4, hpMul: 1.2 }, costMul: 1.2 },
  ],
};
// Widmung: Celo – Leibwächter, Elite der Top 40 (nur Jugoslawien, Kalter Krieg, max. 1)
NATION_UNITS.yugoslavia.push({ era: 7, sig: true, max: 1, id: 'yugoslavia_celo', line: 'inf', at: 'town', name: 'Celo', icon: '🛡', hist: 'In Erinnerung an Celo – Leibwächter, Vater, Ehemann', mods: { hpMul: 2.2, atkMul: 1.8, rangeAdd: 1, sightAdd: 4, celo: true }, costMul: 1.5, celo: true });
export const NATION_UNIT = {};
for (const [n, list] of Object.entries(NATION_UNITS)) for (const u of list) NATION_UNIT['nu_' + u.id] = { ...u, nation: n };
export const isNationUnit = uq => !!uq && uq.startsWith('nu_');

// ---------------- Einheiten ----------------
// Klassen: wrk (Arbeiter), inf (Infanterie), spr (Spieß/Panzerabwehr), rng (Fernkampf/MG), cav (Reiterei/Panzer),
// sie (Belagerung), art (Artillerie), sup (Unterstützung/Sanitäter). Zeile = Angreifer, Spalte = Ziel.
// Ein Konter gewinnt bei gleichen Kosten etwa 2:1, nicht 10:1.
export const DMG = {
  wrk: { wrk: 1, inf: 1, spr: 1, rng: 1, cav: 1, sie: 1, art: 1, sup: 1, bld: 0.4, env: 1, spy: 1, trn: 0.3, shp: 0.2, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
  inf: { wrk: 1.2, inf: 1, spr: 1.0, rng: 1.0, cav: 0.8, sie: 1.6, art: 1.6, sup: 1.2, bld: 0.6, env: 1, spy: 1, trn: 0.6, shp: 0.3, sub: 0, air: 0, bmb: 0, hel: 0.3, aa: 1 },
  spr: { wrk: 1, inf: 1.0, spr: 1, rng: 0.9, cav: 1.3, sie: 1.2, art: 1.2, sup: 1, bld: 0.4, env: 1, spy: 1, trn: 1.5, shp: 0.4, sub: 0, air: 0, bmb: 0, hel: 0.4, aa: 1 },
  rng: { wrk: 1.2, inf: 1.9, spr: 1.5, rng: 1, cav: 0.8, sie: 0.5, art: 0.6, sup: 1.2, bld: 0.25, env: 1, spy: 1, trn: 0.5, shp: 0.6, sub: 0, air: 0, bmb: 0, hel: 0.6, aa: 1 },
  cav: { wrk: 1.4, inf: 1.4, spr: 0.7, rng: 1.3, cav: 1, sie: 1.8, art: 1.8, sup: 1.4, bld: 0.45, env: 1, spy: 1, trn: 0.8, shp: 0.3, sub: 0, air: 0, bmb: 0, hel: 0.2, aa: 0.7 },
  sie: { wrk: 0.6, inf: 0.6, spr: 0.6, rng: 0.6, cav: 0.5, sie: 1, art: 1, sup: 0.6, bld: 3.2, env: 1, spy: 1, trn: 1.5, shp: 1, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
  art: { wrk: 1.2, inf: 2.0, spr: 2.0, rng: 2.0, cav: 0.8, sie: 1.3, art: 1.3, sup: 1.2, bld: 1.2, env: 1, spy: 1, trn: 1.5, shp: 1.5, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
  sup: { wrk: 0.5, inf: 0.5, spr: 0.5, rng: 0.5, cav: 0.5, sie: 0.5, art: 0.5, sup: 0.5, bld: 0.2, env: 1, spy: 1, trn: 0.3, shp: 0, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
  env: { wrk: 0.3, inf: 0.3, spr: 0.3, rng: 0.3, cav: 0.3, sie: 0.3, art: 0.3, sup: 0.3, bld: 0.1, env: 0.3, spy: 0.3, trn: 0.3, shp: 0, sub: 0, air: 0, bmb: 0, hel: 0, aa: 0.3 },
  spy: { wrk: 1, inf: 0.8, spr: 0.8, rng: 0.8, cav: 0.5, sie: 0.8, art: 0.8, sup: 1, bld: 0.3, env: 1, spy: 1, trn: 0.3, shp: 0.2, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
  atr: { wrk: 1.2, inf: 1.3, spr: 1.3, rng: 1.3, cav: 0.9, sie: 1.2, art: 1.0, sup: 1, bld: 0.8, env: 1, spy: 1, trn: 1.2, shp: 0.4, sub: 0, air: 0, bmb: 0, hel: 0.6, aa: 1 },
  trn: { wrk: 0, inf: 0, spr: 0, rng: 0, cav: 0, sie: 0, art: 0, sup: 0, bld: 0, env: 0, spy: 0, trn: 0, shp: 0, sub: 0, air: 0, bmb: 0, hel: 0, aa: 0 },
  bsh: { wrk: 0.8, inf: 0.8, spr: 0.8, rng: 0.8, cav: 0.9, sie: 1, art: 1, sup: 0.8, env: 0.5, spy: 0.8, bld: 1.3, trn: 1, shp: 1.3, sub: 0.15, air: 0, bmb: 0, hel: 0.3, aa: 0.8 },
  shp: { wrk: 0.8, inf: 0.8, spr: 0.8, rng: 0.8, cav: 0.8, sie: 1, art: 1, sup: 0.8, env: 0.5, spy: 0.8, bld: 1, trn: 1, shp: 1.2, sub: 1.5, air: 0.5, bmb: 0.5, hel: 0.8, aa: 0.8 },
  sub: { wrk: 0, inf: 0, spr: 0, rng: 0, cav: 0, sie: 0, art: 0, sup: 0, env: 0, spy: 0, bld: 0, trn: 0, shp: 2.5, sub: 1, air: 0, bmb: 0, hel: 0, aa: 0 },
  air: { wrk: 0.3, inf: 0.3, spr: 0.3, rng: 0.3, cav: 0.2, sie: 0.4, art: 0.4, sup: 0.3, env: 0.2, spy: 0.3, bld: 0.1, trn: 0.4, shp: 0.3, sub: 0, air: 1.5, bmb: 1.8, hel: 1.6, aa: 0.3 },
  bmb: { wrk: 1, inf: 1.2, spr: 1.2, rng: 1.2, cav: 1.4, sie: 1.6, art: 1.6, sup: 1, env: 0.5, spy: 1, bld: 3, trn: 2, shp: 1.5, sub: 0.5, air: 0, bmb: 0, hel: 0, aa: 0.7 },
  hel: { wrk: 1.2, inf: 1.2, spr: 1.1, rng: 1.2, cav: 2.6, sie: 1.6, art: 1.5, sup: 1, env: 0.5, spy: 1, bld: 0.6, trn: 1.5, shp: 1, sub: 0.8, air: 0, bmb: 0, hel: 0.6, aa: 0.8 },
  aa: { wrk: 0.3, inf: 0.3, spr: 0.3, rng: 0.3, cav: 0.3, sie: 0.3, art: 0.3, sup: 0.3, env: 0, spy: 0.3, bld: 0.2, trn: 0.3, shp: 0.3, sub: 0, air: 3, bmb: 3, hel: 3, aa: 0.5 },
  bld: { wrk: 1, inf: 1, spr: 1, rng: 1.1, cav: 0.9, sie: 1, art: 1, sup: 1, bld: 0.3, env: 1, spy: 1, trn: 1, shp: 1.2, sub: 0, air: 0, bmb: 0, hel: 0, aa: 1 },
};

// Linien: pro Epoche ein Name; Werte skalieren mit der Epoche.
export const LINES = {
  worker: {
    cls: 'wrk', at: 'town', minEra: 0, key: 'Q', names: ['Sammler', 'Arbeiter', 'Handwerker', 'Leibeigener', 'Bauer', 'Fabrikarbeiter', 'Arbeiter', 'Ingenieur'],
    hp: 40, atk: 3, range: 0.4, cd: 1.5, speed: 1.6, sight: 6, cost: { food: 50 }, pop: 1, time: 10, grow: 0.08, costGrow: 1,
  },
  inf: {
    cls: 'inf', at: 'barracks', minEra: 0, key: 'Q', names: ['Keulenträger', 'Axtkämpfer', 'Schwertkämpfer', 'Hauskrieger', 'Fußritter', 'Linieninfanterist', 'Schütze', 'Mechanisierte Infanterie'], late: 'Infanterist',
    hp: 60, atk: 7, range: 0.5, cd: 1.2, speed: 1.45, sight: 6, cost: { food: 55, wood: 10 }, pop: 1, time: 16,
    eraOverride: { 5: { range: 3 }, 6: { range: 4 }, 7: { range: 4.5, speed: 1.7 } },
  },
  spear: {
    cls: 'spr', at: 'barracks', minEra: 1, key: 'W', names: ['', 'Speerträger', 'Phalangit', 'Speerträger', 'Pikenier', 'Bajonettschütze', 'Panzerbüchsenschütze', 'Lenkraketentrupp'], late: 'Panzerabwehrtrupp',
    hp: 70, atk: 6, range: 0.7, cd: 1.3, speed: 1.35, sight: 6, cost: { food: 45, wood: 25 }, pop: 1, time: 16,
    eraOverride: { 6: { range: 3 }, 7: { range: 5 } },
  },
  rng: {
    cls: 'rng', at: 'range', minEra: 0, key: 'Q', names: ['Steinschleuderer', 'Bogenschütze', 'Kompositbogner', 'Langbogenschütze', 'Armbrustschütze', 'Jäger', 'Scharfschütze', 'MG-Schütze'], late: 'MG-Schütze',
    hp: 38, atk: 5, range: 5, cd: 1.6, speed: 1.4, sight: 7, cost: { food: 30, wood: 35 }, pop: 1, time: 18,
    eraOverride: { 6: { range: 6 }, 7: { range: 6.5 } },
  },
  cav: {
    cls: 'cav', at: 'stable', minEra: 1, key: 'Q', names: ['', 'Streitwagen', 'Reiter', 'Panzerreiter', 'Ritter', 'Husar', 'Panzerwagen', 'Kampfpanzer'], late: 'Panzer',
    hp: 110, atk: 9, range: 0.6, cd: 1.4, speed: 2.4, sight: 7, cost: { food: 70, gold: 45 }, pop: 1, time: 22,
    eraOverride: { 5: { range: 3.5 }, 6: { range: 5, speed: 2.0, hpMul: 1.6, pop: 2 }, 7: { range: 6, speed: 2.2, hpMul: 1.7, pop: 2 } },
  },
  sie: {
    cls: 'sie', at: 'workshop', minEra: 2, key: 'Q', names: ['', '', 'Torsionsgeschütz', 'Blide', 'Bombarde', 'Belagerungsmörser', 'Schwerer Mörser', 'Raketenartillerie'], late: 'Schwere Haubitze',
    hp: 120, atk: 38, range: 7, minRange: 2, cd: 4, speed: 0.95, sight: 8, cost: { wood: 160, gold: 90 }, pop: 2, time: 32, splash: 1.2,
  },  art: {
    cls: 'art', at: 'workshop', minEra: 5, key: 'W', names: ['', '', '', '', '', 'Feldkanone', 'Feldgeschütz', 'Panzerhaubitze'], late: 'Haubitze',
    hp: 110, atk: 40, range: 9, minRange: 2.5, cd: 3.5, speed: 1.0, sight: 8, cost: { wood: 140, gold: 110 }, pop: 3, time: 30, splash: 1.6,
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
  // Panzerzug: fährt nur auf Gleisen, stark bewaffnet (DMG-Zeile 'atr')
  armtrain: {
    cls: 'trn', at: 'station', minEra: 6, key: 'Q', names: ['', '', '', '', '', '', 'Panzerzug', 'Panzerzug'], dmgRow: 'atr',
    hp: 1500, atk: 34, range: 6, cd: 2.2, speed: 3.2, sight: 9, cost: { wood: 250, stone: 150, gold: 300 }, pop: 4, time: 50, railOnly: true, grow: 0.3,
  },
  train: {
    cls: 'trn', at: null, minEra: 5, key: '', names: ['', '', '', '', '', 'Dampfzug', 'Dampfzug', 'Diesellok'],
    hp: 600, atk: 0, range: 0.5, cd: 1, speed: 6, sight: 7, cost: {}, pop: 0, time: 0, grow: 0.25,
  },
  fishboat: {
    cls: 'wrk', naval: true, at: 'dock', minEra: 1, key: 'Q', names: ['', 'Fischerboot', 'Fischerboot', 'Fischerboot', 'Fischerkogge', 'Fischkutter', 'Dampftrawler', 'Fangschiff'],
    hp: 60, atk: 0, range: 0.5, cd: 1, speed: 1.8, sight: 6, cost: { wood: 60 }, pop: 1, time: 14, grow: 0.12, costGrow: 1.05,
  },
  transport: {
    cls: 'shp', naval: true, at: 'dock', minEra: 1, key: 'W', names: ['', 'Lastkahn', 'Frachtgaleere', 'Transportschiff', 'Karacke', 'Truppentransporter', 'Truppendampfer', 'Landungsschiff'],
    hp: 200, atk: 0, range: 0.5, cd: 1, speed: 2.2, sight: 7, cost: { wood: 120, gold: 20 }, pop: 1, time: 25, grow: 0.25, capacity: 10,
  },
  warship: {
    cls: 'shp', naval: true, at: 'dock', minEra: 1, key: 'E', names: ['', 'Galeere', 'Trireme', 'Langschiff', 'Kogge', 'Fregatte', 'Panzerschiff', 'Lenkwaffenzerstörer'], late: 'Zerstörer',
    hp: 220, atk: 12, range: 5, cd: 2, speed: 2.1, sight: 8, cost: { wood: 140, gold: 60 }, pop: 2, time: 30, detects: true,
  },
  battleship: {
    cls: 'shp', naval: true, at: 'dock', minEra: 5, key: 'R', names: ['', '', '', '', '', 'Linienschiff', 'Schlachtschiff', 'Kreuzer'], late: 'Schlachtschiff',
    hp: 1100, atk: 90, range: 10, cd: 4, dmgRow: 'bsh', speed: 1.5, sight: 10, cost: { wood: 250, gold: 250, stone: 100 }, pop: 5, time: 50, splash: 1.5,
  },
  sub: {
    cls: 'sub', naval: true, at: 'dock', minEra: 6, key: 'T', names: ['', '', '', '', '', '', 'U-Boot', 'Atom-U-Boot'],
    hp: 260, atk: 45, range: 5, cd: 4, speed: 1.9, sight: 8, cost: { wood: 100, gold: 220 }, pop: 3, time: 45,
  },
  scout: {
    cls: 'air', air: true, at: 'airfield', minEra: 6, key: 'Q', names: ['', '', '', '', '', '', 'Doppeldecker-Aufklärer', 'Aufklärungsjet'], late: 'Aufklärer',
    hp: 90, atk: 0, range: 0.5, cd: 1, speed: 6, sight: 14, cost: { wood: 80, gold: 80 }, pop: 2, time: 25, fuel: 120, ammo: 0,
  },
  fighter: {
    cls: 'air', air: true, reqLate: true, at: 'airfield', minEra: 6, key: 'W', names: ['', '', '', '', '', '', 'Jagdflugzeug', 'Düsenjäger'],
    hp: 160, atk: 16, range: 3, cd: 1, speed: 6.5, sight: 10, cost: { wood: 120, gold: 160 }, pop: 3, time: 30, fuel: 75, ammo: 10,
  },
  bomber: {
    cls: 'bmb', air: true, reqLate: true, at: 'airfield', minEra: 6, key: 'E', names: ['', '', '', '', '', '', 'Bomber', 'Strategischer Bomber'],
    hp: 320, atk: 70, range: 1.5, cd: 3, speed: 4.2, sight: 9, cost: { wood: 200, gold: 260, stone: 60 }, pop: 5, time: 45, fuel: 110, ammo: 4, splash: 1.8,
  },
  heli: {
    cls: 'hel', air: true, low: true, at: 'airfield', minEra: 7, key: 'R', names: ['', '', '', '', '', '', '', 'Kampfhubschrauber'],
    hp: 420, atk: 34, range: 6.5, cd: 1.5, speed: 3.6, sight: 10, cost: { wood: 150, gold: 280 }, pop: 4, time: 40, fuel: 140, ammo: 18,
  },
  para: {
    cls: 'inf', reqLate: true, at: 'airfield', minEra: 6, key: 'T', names: ['', '', '', '', '', '', 'Fallschirmjäger', 'Luftlandesoldat'],
    hp: 60, atk: 7, range: 0.5, cd: 1.2, speed: 1.6, sight: 7, cost: { food: 90, gold: 60 }, pop: 1, time: 22, para: true,
    eraOverride: { 6: { range: 4 }, 7: { range: 4.5 } },
  },
  flak: {
    cls: 'aa', at: 'workshop', minEra: 6, key: 'E', names: ['', '', '', '', '', '', 'Ballonabwehrkanone', 'Flakpanzer'], late: 'Flak',
    hp: 150, atk: 14, range: 7, cd: 1.2, speed: 1.1, sight: 9, cost: { wood: 120, gold: 120 }, pop: 3, time: 30,
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
  letter: { title: 'Brief von zu Hause', nation: 'yugoslavia', minEra: 7, needCelo: true, repeat: true, text: 'Ein Brief von Ljilje, Antonija und Marija ist für Celo angekommen.', options: [
    { label: 'Celo liest ihn sofort: alle Einheiten 3 Minuten mehr Moral', e: { morale: 15, buff: { k: 'dmg', v: 1.05, s: 180 }, celoPause: 30 } },
    { label: 'Er steckt ihn ein und kämpft weiter: Celo +10 % Schaden', e: { celoLetter: true } }] },
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
export const PROVINCE_WEIGHT = { town: 10, outpost: 6, tower: 3 }; // übrige Gebäude 1, Mauern/Straßen/Brücken/Gleise 0

// ---------------- Eisenbahn ----------------
export const RAIL = { capacity: 20, waitDepart: 5, freightEvery: 40, freightMin: 50, freightBonus: 1.1, homeRange: 10, captureHp: 0.25 };

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
  outpost: { name: 'Außenposten', size: 2, hp: 600, cost: { wood: 120, stone: 60 }, time: 25, sight: 8, minEra: 1, key: 'T', page: 2, claim: 6, desc: 'Beansprucht die Provinz, versorgt Truppen in der Nähe (Nachschub) und dient als Abgabestelle.', drop: true },
  road: { name: 'Straße', size: 1, hp: 200, cost: { stone: 4 }, time: 2, walkable: true, sight: 1, minEra: 4, key: 'Q', page: 2, line: true, desc: 'Wie eine Mauer ziehen: +25 % Tempo, ignoriert Schlamm und Schnee.' },
  bridge: { name: 'Brücke', size: 1, hp: 400, cost: { wood: 20, stone: 6 }, time: 6, walkable: true, sight: 2, minEra: 1, key: 'W', page: 2, line: true, onWater: true, desc: 'Wie eine Mauer über Wasser ziehen, Abschnitt für Abschnitt vom Ufer aus. Jeder kann sie benutzen; Abschnitte lassen sich zerstören.' },
  rail: { name: 'Gleis', size: 1, hp: 250, cost: { wood: 8, stone: 8 }, time: 3, walkable: true, sight: 1, minEra: 5, key: 'E', page: 2, line: true, desc: 'Wie eine Mauer ziehen und an Bahnhöfe anschließen. Eiserne Brücken (ab 1. IR) tragen Gleise.' },
  station: { name: 'Bahnhof', size: 2, hp: 900, cost: { wood: 150, stone: 100, gold: 50 }, time: 35, sight: 7, minEra: 5, key: 'R', page: 2, drop: true, desc: 'Truppen: Rechtsklick auf einen angeschlossenen Bahnhof – sie steigen am nächsten Bahnhof in den Zug. Fern vom Haupthaus sammelt er Rohstoffe, die Güterzüge mit +10 % nach Hause bringen.' },
  dock: { name: 'Werft', size: 3, hp: 900, cost: { wood: 200 }, time: 35, sight: 7, minEra: 1, key: 'X', coastal: true, drop: true, desc: 'Muss an die Küste gebaut werden. Baut Fischerboote, Transporter und Kriegsschiffe; Abgabestelle für alle Rohstoffe.' },
  coastgun: { name: 'Küstenbatterie', size: 2, hp: 900, cost: { stone: 200, gold: 80 }, time: 35, atk: 20, range: 11, cd: 3, sight: 11, minEra: 5, key: 'A', page: 2, coastal: true, vsShip: 2.2, desc: 'An der Küste: schwere Geschütze gegen Schiffe (große Reichweite, doppelter Schaden gegen Schiffe).' },
  airfield: { name: 'Flugplatz', size: 3, hp: 1100, cost: { wood: 250, stone: 150, gold: 100 }, time: 45, sight: 9, minEra: 6, key: 'D', page: 2, desc: 'Baut Flugzeuge und Fallschirmjäger. Flugzeuge tanken und munitionieren hier wieder auf – ohne Flugplatz stürzen sie bei leerem Tank ab.' },
  nukelab: { name: 'Atomforschungszentrum', size: 3, hp: 2400, cost: { wood: 1500, stone: 2000, gold: 3000 }, time: 300, sight: 6, minEra: 7, key: 'X', page: 2, nuclear: true, desc: 'Nur Atommächte. Ermöglicht Raketensilos. Andere Spieler erfahren, dass jemand baut – aber nicht wo.' },
  silo: { name: 'Raketensilo', size: 2, hp: 1800, cost: { stone: 1200, gold: 1200 }, time: 120, sight: 5, minEra: 7, key: 'V', page: 2, nuclear: true, needs: 'nukelab', desc: 'Baut eine Atomrakete (6 min). Wird das Silo beschädigt, stoppt der Bau.' },
  abm: { name: 'Raketenabwehr', size: 2, hp: 1200, cost: { stone: 800, gold: 1000 }, time: 90, sight: 12, minEra: 7, key: 'C', page: 2, desc: 'Fängt Atomraketen im Umkreis von 16 Feldern mit 30 % ab, mehrere Stellungen bis 50 %. Danach 5 min Nachladen. Nationen ohne Atomwaffen: 40 % billiger, doppelt so schnell nachgeladen.' },
  bunker: { name: 'Bunker', size: 2, hp: 2600, cost: { stone: 500, gold: 150 }, time: 60, sight: 6, minEra: 6, key: 'Y', page: 2, desc: 'Bis zu 12 eigene Einheiten im Umkreis von 2 Feldern überstehen einen Atomschlag unversehrt.' },
  flakpos: { name: 'Flak-Stellung', size: 2, hp: 700, cost: { stone: 120, gold: 80 }, time: 30, atk: 16, range: 9, cd: 1.2, sight: 10, minEra: 6, key: 'G', page: 2, dmgRow: 'aa', desc: 'Schießt auf Flugzeuge und Hubschrauber (dreifacher Schaden gegen Luftziele).' },
  celohouse: { name: 'Celos Haus', size: 2, hp: 99999, cost: {}, time: 1, sight: 3, minEra: 99, decor: true, desc: 'Hier warten Ljilje, Antonija und Marija auf Celo.' },
  memorial: { name: 'Gedenkstein', size: 1, hp: 99999, cost: {}, time: 1, sight: 3, minEra: 99, decor: true, walkable: true, desc: 'Celo – Leibwächter, Vater, Ehemann. Für Ljilje, Antonija und Marija.' },
  wall: { name: 'Palisade', size: 1, hp: 350, cost: { wood: 4 }, time: 3, sight: 2, minEra: 0, key: 'C', line: true, desc: 'Günstiges Hindernis (ab Mittelalter Steinmauer).' },
};
// Weltwunder: Ausbau des Haupthauses in der letzten Epoche. Wer es 30 Minuten (große Karten: 60) hält, gewinnt.
export const WONDER = { name: 'Weltwunder', cost: { food: 6000, wood: 5000, stone: 5000, gold: 7000 }, time: 240, hold: 1800, holdLarge: 3600, hpMul: 4 };
// Große Karten (Kantenlänge ab 160 Kacheln, d. h. „Groß“/„Riesig“ oder viele Spieler) brauchen 1 Stunde
export const wonderHold = mapW => (mapW >= 160 ? WONDER.holdLarge : WONDER.hold);
export const WONDER_ERA = 8; // Anzeige-Epoche für das Modell (nach der letzten Epoche)

export const BUILD_ORDER = ['house', 'storage', 'farm', 'outpost', 'road', 'bridge', 'rail', 'station', 'dock', 'coastgun', 'airfield', 'flakpos', 'nukelab', 'silo', 'abm', 'bunker', 'barracks', 'range', 'stable', 'tower', 'workshop', 'wall', 'town'];

// ---------------- Rohstoffe auf der Karte ----------------
export const RESOURCE_TYPES = {
  tree: { res: 'wood', amount: 100, size: 1, rate: 0.72 },
  berry: { res: 'food', amount: 150, size: 1, rate: 0.8 },
  gold: { res: 'gold', amount: 1500, size: 2, rate: 0.6 },
  stone: { res: 'stone', amount: 1200, size: 2, rate: 0.6 },
  fish: { res: 'food', amount: 700, size: 1, rate: 0.75, water: true },
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
export const RESOURCE_KINDS = ['tree', 'berry', 'gold', 'stone', 'fish'];
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
for (const [key, u] of Object.entries(NATION_UNIT)) {
  TYPE_INDEX[key] = TYPES.length;
  TYPES.push({ kind: 'u', key, line: u.line, unique: key, era: u.era, cls: LINES[u.line].cls, name: u.name, icon: u.icon, hist: u.hist });
}
for (const b of Object.keys(BUILDINGS)) {
  TYPE_INDEX[b] = TYPES.length;
  TYPES.push({ kind: 'b', key: b, name: BUILDINGS[b].name });
}
export function unitKey(line, era, unique) { return unique ? (isNationUnit(unique) ? unique : unique + '_' + era) : line + era; }

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
    naval: !!d.naval, capacity: d.capacity || 0, detects: !!d.detects, air: !!d.air, low: !!d.low, fuel: d.fuel || 0, ammo: d.ammo || 0, para: !!d.para, railOnly: !!d.railOnly, atkCls: d.dmgRow || null,
    cost: scaleCost(d.cost, Math.pow(cg, steps)),
  };
  if (isNationUnit(unique)) {
    const u = NATION_UNIT[unique], m = u.mods;
    s.name = u.name; s.national = true;
    s.cost = scaleCost(s.cost, u.costMul || 1); s.time *= u.timeMul || 1;
    if (m.hpMul) s.hp *= m.hpMul;
    if (m.atkMul) s.atk *= m.atkMul;
    if (m.speedMul) s.speed *= m.speedMul;
    if (m.cdMul) s.cd *= m.cdMul;
    if (m.range != null) s.range = m.range;
    if (m.rangeAdd) s.range += m.rangeAdd;
    if (m.sightAdd) s.sight += m.sightAdd;
    if (m.splash != null) s.splash = m.splash;
    if (m.dmgVs) s.dmgVs = m.dmgVs;
    if (m.plunder) s.plunder = true;
    if (m.camo) s.camo = true;
    if (m.noHillSlow) s.noHillSlow = true;
    if (m.railOnly) s.railOnly = true;
    if (m.fuelMul) s.fuel *= m.fuelMul;
    if (m.minRange != null) s.minRange = m.minRange;
    if (m.celo) s.celo = true;
    if (u.sig) { s.sig = true; s.max = u.max; }
  } else if (unique) {
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
export function playerMods(culture, nation, late = false, leader = null) {
  const m = {
    gather: { food: 1, wood: 1, stone: 1, gold: 1 }, armyCost: 1, cavCost: 1, cavSpeed: 1, cavHp: 1, infAtk: 1, infHp: 1, infSpeed: 1,
    bldHp: 1, buildSpeed: 1, towerAtk: 1, towerRange: 0, housePop: 0, trainSpeed: 1, rangedRange: 0, siegeDmg: 1, regen: 0,
    armyHp: 1, armyDmg: 1, late: !!late, nation: nation || null, fortCost: 1, uniqueCost: 1, infCost: 1, hillDmg: 1, shipCost: 1, shipBuild: 1,
  };
  if (culture === 'steppe') { m.cavSpeed = 1.15; m.cavCost = 0.85; }
  if (culture === 'traders') { m.gather.gold = 1.25; m.gather.stone = 1.25; }
  if (culture === 'builders') { m.bldHp = 1.4; m.buildSpeed = 1.4; m.towerAtk = 1.3; }
  if (culture === 'warriors') { m.infAtk = 1.15; m.infHp = 1.1; }
  const n = nation && NATIONS[nation];
  if (n) {
    const b = n.bonus;
    if (b.gather) for (const k in m.gather) m.gather[k] *= b.gather;
    for (const k of ['armyCost', 'cavHp', 'trainSpeed', 'siegeDmg', 'infSpeed', 'armyHp', 'armyDmg', 'bldHp', 'fortCost', 'uniqueCost', 'infCost', 'hillDmg', 'shipCost', 'shipBuild']) if (b[k]) m[k] *= b[k];
    for (const k of ['housePop', 'rangedRange', 'towerRange', 'regen']) if (b[k]) m[k] += b[k];
    if (b.winter) m.winter = true;
  }
  const ld = leader && LEADER[leader];
  if (ld) {
    const b = ld.b;
    m.leader = ld.id;
    if (b.gather) for (const k in m.gather) m.gather[k] *= b.gather;
    if (b.gatherRes) for (const k in b.gatherRes) m.gather[k] *= b.gatherRes[k];
    for (const k of ['buildSpeed', 'bldHp', 'towerAtk', 'fortCost', 'hillDmg']) if (b[k]) m[k] *= b[k];
    if (b.housePop) m.housePop += b.housePop;
    for (const k of ['cls', 'unitCost', 'envoySpeed', 'railCost', 'railSpeed', 'nukeTime', 'nukeCost', 'eraSpeed', 'abm', 'homeShield', 'homeDmg', 'forestDmg', 'roadSpeed', 'fortHp', 'outpostCost', 'bldCost', 'repFloor', 'pactMul', 'peaceRep']) if (b[k] != null) m[k] = b[k];
  }
  return m;
}

// Endgültige Werte einer Einheit für einen Spieler
export function unitStats(line, era, unique, mods) {
  const s = unitBase(line, era, unique);
  if (!mods) return s;
  const mil = s.cls !== 'wrk';
  if (s.cls === 'cav') { s.speed *= mods.cavSpeed; s.hp *= mods.cavHp; s.cost = scaleCost(s.cost, mods.cavCost); }
  if (s.cls === 'inf') { s.atk *= mods.infAtk; s.hp *= mods.infHp; s.speed *= mods.infSpeed; s.cost = scaleCost(s.cost, mods.infCost); }
  if (unique) s.cost = scaleCost(s.cost, mods.uniqueCost);
  if (s.naval) { s.cost = scaleCost(s.cost, mods.shipCost); s.time /= mods.shipBuild; }
  if (s.cls === 'rng' && s.range > 1) s.range += mods.rangedRange;
  if (s.cls === 'sie') s.atk *= mods.siegeDmg;
  if (mil) { s.hp *= mods.armyHp; s.atk *= mods.armyDmg; s.cost = scaleCost(s.cost, mods.armyCost); }
  if (mods.late && era === LATE_STAGE.era && s.cls !== 'wrk') {
    s.hp *= LATE_STAGE.hpMul; s.atk *= LATE_STAGE.atkMul;
    if (!unique && LINES[line].late) s.name = LINES[line].late;
  }
  if (mods.cls) for (const g in mods.cls) if (inGroup(g, s)) {
    const c = mods.cls[g];
    if (c.cost) s.cost = scaleCost(s.cost, c.cost);
    if (c.time) s.time *= c.time;
    if (c.atk) s.atk *= c.atk;
    if (c.hp) s.hp *= c.hp;
    if (c.speed) s.speed *= c.speed;
    if (c.range && s.range > 1) s.range += c.range;
    if (c.sight) s.sight += c.sight;
  }
  if (mods.unitCost && unique && mods.unitCost[unique]) s.cost = scaleCost(s.cost, mods.unitCost[unique]);
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
  if (mods && mods.fortCost !== 1 && (type === 'wall' || type === 'tower' || type === 'outpost')) s.cost = scaleCost(s.cost || b.cost, mods.fortCost);
  if (mods) {
    const fort = ['wall', 'tower', 'outpost', 'coastgun', 'flakpos', 'bunker', 'abm'].includes(type);
    if (mods.fortHp && fort) s.hp = Math.round(s.hp * mods.fortHp);
    if (mods.outpostCost && type === 'outpost') s.cost = scaleCost(s.cost || b.cost, mods.outpostCost);
    if (mods.railCost && (type === 'rail' || type === 'station')) s.cost = scaleCost(s.cost || b.cost, mods.railCost);
    if (mods.bldCost && !b.decor) s.cost = scaleCost(s.cost || b.cost, mods.bldCost);
    if (type === 'abm' && !NUCLEAR_NATIONS.includes(mods.nation)) s.cost = scaleCost(s.cost || b.cost, 0.6);
  }
  s.time = b.time / (mods ? mods.buildSpeed : 1);
  return s;
}
// Welche Einheiten kann ein Gebäude für einen Spieler ausbilden?
export function trainable(bType, era, culture, nation, late = true) {
  const out = [];
  for (const [line, d] of Object.entries(LINES)) {
    if (d.at === bType && era >= d.minEra && !(d.reqLate && era === LATE_STAGE.era && !late)) out.push({ line, unique: null });
  }
  if (culture && era >= UNIQUE_MIN_ERA) {
    const uq = CULTURES[culture].unique;
    if (LINES[UNIQUE[uq].line].at === bType) out.push({ line: UNIQUE[uq].line, unique: uq });
  }
  if (nation && NATION_UNITS[nation]) for (const u of NATION_UNITS[nation]) {
    if (u.era === era && (u.at || LINES[u.line].at) === bType && !(u.reqLate && !late)) out.push({ line: u.line, unique: 'nu_' + u.id });
  }
  return out;
}

// ---------------- Staatsführer (Epoche VII und VIII) ----------------
// Dauerboni (b) wirken über playerMods, Fähigkeiten (a) als zeitlich begrenzte Effekte.
// Gruppen: inf = Infanterie/Speer/Fernkampf, tank = Panzer/Kavallerie, art = Artillerie/Belagerung, veh = tank+art,
// ship = Schiffe, air = Flugzeuge/Hubschrauber, aa = Flugabwehr, wrk = Arbeiter, spec = Spezialkräfte (Signatur-Infanterie), all = alle Militäreinheiten
export const UNIT_GROUPS = {
  inf: ['inf', 'spr', 'rng'], tank: ['cav'], art: ['art', 'sie'], veh: ['cav', 'art', 'sie'], ship: ['shp', 'sub'], air: ['air', 'bmb', 'hel'], aa: ['aa'], wrk: ['wrk'],
};
export function inGroup(g, st) {
  if (!g || g === 'all') return st.cls !== 'wrk';
  if (g === 'spec') return !!st.sig && (st.cls === 'inf' || st.cls === 'rng');
  if (g === 'para') return !!st.para;
  return (UNIT_GROUPS[g] || []).includes(st.cls);
}
const L = (id, nation, era, name, years, p, b, a, extra = {}) => ({ id, nation, era, name, years, p, b, a, ...extra });
export const LEADERS = [
  // Deutschland
  L('bismarck', 'germany', 6, 'Otto von Bismarck', '1871–1890', 'Botschafter +50 % Tempo; jeder Vertrag +5 Ansehen; eigene Einheiten +5 % Schaden', { envoySpeed: 1.5, peaceRep: 5, cls: { all: { atk: 1.05 } } },
    { name: 'Kongress', desc: 'Erzwingt eine Friedenskonferenz mit einem Kriegsgegner, die er nicht ablehnen kann (1× pro Epoche).', special: 'congress', once: true }),
  L('wilhelm2', 'germany', 6, 'Wilhelm II.', '1888–1918', 'Schiffe 25 % billiger und 20 % schneller gebaut; Artillerie +1 Reichweite', { cls: { ship: { cost: 0.75, time: 0.8 }, art: { range: 1 } } },
    { name: 'Flottenparade', desc: '60 s lang alle Schiffe +30 % Schaden.', buffs: [{ k: 'dmg', v: 1.3, s: 60, g: 'ship' }] }),
  L('ah', 'germany', 6, 'A.H.', '1933–1945', 'Panzer und Flugzeuge 30 % schneller gebaut; Panzer +10 % Schaden. Nachteil: Ansehen fällt bei Wahl auf „niedrig“', { cls: { tank: { time: 0.7, atk: 1.1 }, air: { time: 0.7 } }, repSet: -60 },
    { name: 'Blitzkrieg', desc: '60 s lang Fahrzeuge +40 % Tempo und +15 % Schaden.', buffs: [{ k: 'speed', v: 1.4, s: 60, g: 'veh' }, { k: 'dmg', v: 1.15, s: 60, g: 'veh' }] }, { silhouette: true }),
  L('adenauer', 'germany', 7, 'Konrad Adenauer', '1949–1963', 'Wirtschaftswunder: +20 % Sammeltempo; Gebäude 25 % schneller gebaut', { gather: 1.2, buildSpeed: 1.25 },
    { name: 'Westbindung', desc: '5 min lang +20 % Abfangchance der Raketenabwehr (Obergrenze 70 %) und Verteidigungsgebäude +15 % Schaden.', buffs: [{ k: 'abm', v: 0.2, s: 300 }, { k: 'tower', v: 1.15, s: 300 }] }),
  L('schmidt', 'germany', 7, 'Helmut Schmidt', '1974–1982', 'Verteidigungsgebäude +30 % Leben; Flugabwehr +20 % Schaden', { fortHp: 1.3, cls: { aa: { atk: 1.2 } } },
    { name: 'Doppelbeschluss', desc: '3 min lang +25 % Abfangchance (Obergrenze 75 %).', buffs: [{ k: 'abm', v: 0.25, s: 180 }] }),
  // Österreich
  L('franzjoseph', 'austria', 6, 'Franz Joseph I.', '1848–1916', 'Gebäude +25 % Leben; Türme +15 % Schaden', { bldHp: 1.25, towerAtk: 1.15 },
    { name: 'Viribus Unitis', desc: '90 s lang alle Einheiten in eigenen Provinzen +20 % Leben.', buffs: [{ k: 'hp', v: 1.2, s: 90, own: true }] }),
  L('karl1', 'austria', 6, 'Karl I.', '1916–1918', 'Infanterie 15 % billiger; jeder Vertrag +5 Ansehen', { cls: { inf: { cost: 0.85 } }, peaceRep: 5 },
    { name: 'Sixtus-Brief', desc: 'Geheime Friedenskonferenz mit einem Kriegsgegner, ohne Zuschauer und ohne Pause.', special: 'secretCongress', cd: 900 }),
  L('kreisky', 'austria', 7, 'Bruno Kreisky', '1970–1983', 'Nichtangriffspakte doppelt so lang; +15 % Goldertrag', { pactMul: 2, gatherRes: { gold: 1.15 } },
    { name: 'Wiener Gipfel', desc: '3 min lang +25 % Sammeltempo und +15 Ansehen.', buffs: [{ k: 'gather', v: 1.25, s: 180 }], rep: 15 }),
  L('raab', 'austria', 7, 'Julius Raab', '1953–1961', 'Außenposten 50 % billiger; +15 % Sammeltempo', { outpostCost: 0.5, gather: 1.15 },
    { name: 'Staatsvertrag', desc: '2 min lang erleiden eigene Einheiten und Gebäude in eigenen Provinzen 60 % weniger Schaden (Abklingzeit 20 min).', buffs: [{ k: 'hp', v: 2.5, s: 120, own: true }, { k: 'bldHp', v: 2.5, s: 120 }], cd: 1200 }),
  // Russland
  L('alexander2', 'russia', 6, 'Alexander II.', '1855–1881', 'Arbeiter 25 % billiger; Gleisbau 25 % billiger', { cls: { wrk: { cost: 0.75 } }, railCost: 0.75 },
    { name: 'Große Reformen', desc: 'Die nächste Aufstiegsforschung ist 30 % schneller (1× pro Epoche).', special: 'eraFast', once: true }),
  L('stalin', 'russia', 6, 'Josef Stalin', '1924–1953', 'Panzer 25 % billiger; Infanterie 20 % schneller ausgebildet. Nachteil: Botschafter −25 % Tempo', { cls: { tank: { cost: 0.75 }, inf: { time: 0.8 } }, envoySpeed: 0.75 },
    { name: 'Kein Schritt zurück', desc: '90 s lang Infanterie in eigenen Provinzen +30 % Leben.', buffs: [{ k: 'hp', v: 1.3, s: 90, g: 'inf', own: true }] }),
  L('khrushchev', 'russia', 7, 'Nikita Chruschtschow', '1953–1964', 'Atomrakete 40 % schneller und 25 % billiger gebaut', { nukeTime: 0.6, nukeCost: 0.75 },
    { name: 'Kuba-Krise', desc: 'Der nächste Atomstart erfolgt ohne Vorwarnung.', special: 'noWarning' }),
  L('brezhnev', 'russia', 7, 'Leonid Breschnew', '1964–1982', 'Panzer +15 % Leben und 15 % billiger', { cls: { tank: { hp: 1.15, cost: 0.85 } } },
    { name: 'Breschnew-Doktrin', desc: '3 min lang alle Einheiten +15 % Schaden.', buffs: [{ k: 'dmg', v: 1.15, s: 180 }] }),
  L('gorbachev', 'russia', 7, 'Michail Gorbatschow', '1985–1991', 'Jeder Vertrag +5 Ansehen; +10 % Sammeltempo', { peaceRep: 5, gather: 1.1 },
    { name: 'Perestroika', desc: '3 min lang alle Gebäude 50 % schneller gebaut.', buffs: [{ k: 'build', v: 1.5, s: 180 }] }),
  // China
  L('sunyatsen', 'china', 6, 'Sun Yat-sen', '1912', 'Infanterie 20 % billiger; Aufstiegsforschung 15 % schneller', { cls: { inf: { cost: 0.8 } }, eraSpeed: 1.15 },
    { name: 'Drei Volksprinzipien', desc: '3 min lang +25 % Sammeltempo.', buffs: [{ k: 'gather', v: 1.25, s: 180 }] }),
  L('chiang', 'china', 6, 'Chiang Kai-shek', '1928–1949', 'Befestigungen 30 % billiger und +25 % Leben', { fortCost: 0.7, fortHp: 1.25 },
    { name: 'Verbrannte Erde', desc: '2 min lang sind Gegner in deinen Provinzen 50 % langsamer.', special: 'zoneSlow', v: 0.5, s: 120 }),
  L('mao', 'china', 7, 'Mao Zedong', '1949–1976', 'Infanterie 30 % schneller ausgebildet und +10 % Leben. Nachteil: −10 % Sammeltempo', { cls: { inf: { time: 0.7, hp: 1.1 } }, gather: 0.9 },
    { name: 'Volkskrieg', desc: '2 min lang bilden alle Gebäude doppelt so schnell aus.', buffs: [{ k: 'train', v: 2, s: 120 }] }),
  L('deng', 'china', 7, 'Deng Xiaoping', '1978–1989', '+20 % Sammeltempo; +15 % Goldertrag', { gather: 1.2, gatherRes: { gold: 1.15 } },
    { name: 'Sonderwirtschaftszone', desc: '5 min lang +30 % Sammeltempo.', buffs: [{ k: 'gather', v: 1.3, s: 300 }] }),
  // Indien
  L('gandhi', 'india', 6, 'Mahatma Gandhi', 'Unabhängigkeitsbewegung', 'Ansehen sinkt nie unter neutral; Gegner in eigenen Provinzen −15 % Schaden', { repFloor: 0, homeShield: 0.85 },
    { name: 'Salzmarsch', desc: '2 min lang sind Gegner in deinen Provinzen 25 % langsamer und können dort nicht sammeln.', special: 'zoneSlow', v: 0.75, s: 120, noGather: true }),
  L('bose', 'india', 6, 'Subhas Chandra Bose', 'Indische Nationalarmee, 1943', 'Infanterie 20 % billiger und +10 % Schaden', { cls: { inf: { cost: 0.8, atk: 1.1 } } },
    { name: 'Delhi Chalo', desc: '60 s lang Infanterie +30 % Tempo.', buffs: [{ k: 'speed', v: 1.3, s: 60, g: 'inf' }] }),
  L('nehru', 'india', 7, 'Jawaharlal Nehru', '1947–1964', 'Jeder Vertrag +5 Ansehen; Häuser +2 Bevölkerung', { peaceRep: 5, housePop: 2 },
    { name: 'Bandung-Konferenz', desc: '+20 Ansehen und 3 min lang +20 % Sammeltempo.', buffs: [{ k: 'gather', v: 1.2, s: 180 }], rep: 20 }),
  L('indira', 'india', 7, 'Indira Gandhi', '1966–1977, 1980–1984', 'Panzer und Artillerie +15 % Schaden', { cls: { veh: { atk: 1.15 } } },
    { name: 'Feldzug 1971', desc: '2 min lang alle Einheiten +20 % Tempo.', buffs: [{ k: 'speed', v: 1.2, s: 120 }] }),
  // Jugoslawien
  L('peter1', 'yugoslavia', 6, 'Peter I.', 'Serbien, 1903–1921', 'Infanterie +15 % Leben; Gebirgsbatterie 25 % billiger', { cls: { inf: { hp: 1.15 } }, unitCost: { nu_yugoslavia_mountainbattery: 0.75 } },
    { name: 'Rückzug über Albanien', desc: '30 s lang alle Einheiten +50 % Tempo.', buffs: [{ k: 'speed', v: 1.5, s: 30 }] }),
  L('tito41', 'yugoslavia', 6, 'Josip Broz Tito', 'Partisanenführer, 1941–1945', 'Partisanen 40 % billiger; Infanterie im Wald +15 % Schaden', { unitCost: { nu_yugoslavia_partisan: 0.6 }, forestDmg: 1.15 },
    { name: 'Partisanenkrieg', desc: '2 min lang ist alle Infanterie im Wald unsichtbar.', special: 'stealth', s: 120 }),
  L('tito', 'yugoslavia', 7, 'Josip Broz Tito', '1945–1980', 'Blockfreiheit: jeder Vertrag +5 Ansehen; +15 % Goldertrag', { peaceRep: 5, gatherRes: { gold: 1.15 } },
    { name: 'Totale Volksverteidigung', desc: '3 min lang alle Einheiten in eigenen Provinzen +20 % Schaden und +20 % Leben.', buffs: [{ k: 'dmg', v: 1.2, s: 180, own: true }, { k: 'hp', v: 1.2, s: 180, own: true }] }),
  L('presidium', 'yugoslavia', 7, 'Kollektives Staatspräsidium', '1980–1991', 'Gebäude +20 % Leben; Infanterie 15 % billiger', { bldHp: 1.2, cls: { inf: { cost: 0.85 } } },
    { name: 'Rotation', desc: '3 min lang alle Gebäude doppelt so schnell in der Ausbildung.', buffs: [{ k: 'train', v: 2, s: 180 }] }),
  // USA
  L('lincoln', 'usa', 6, 'Abraham Lincoln', '1861–1865', 'Gleisbau 40 % billiger; Züge +30 % Tempo', { railCost: 0.6, railSpeed: 1.3 },
    { name: 'Union', desc: '3 min lang +20 % Leben für alle Einheiten in eigenen Provinzen.', buffs: [{ k: 'hp', v: 1.2, s: 180, own: true }] }),
  L('troosevelt', 'usa', 6, 'Theodore Roosevelt', '1901–1909', 'Schiffe 20 % schneller gebaut und 10 % billiger', { cls: { ship: { time: 0.8, cost: 0.9 } } },
    { name: 'Große Weiße Flotte', desc: '2 min lang Schiffe +25 % Tempo.', buffs: [{ k: 'speed', v: 1.25, s: 120, g: 'ship' }] }),
  L('fdr', 'usa', 6, 'Franklin D. Roosevelt', '1933–1945', 'Fließband: Fahrzeuge, Flugzeuge und Schiffe 25 % schneller gebaut', { cls: { veh: { time: 0.75 }, air: { time: 0.75 }, ship: { time: 0.75 } } },
    { name: 'Arsenal der Demokratie', desc: '2 min lang alle Gebäude 50 % schneller in der Ausbildung.', buffs: [{ k: 'train', v: 1.5, s: 120 }] }),
  L('eisenhower', 'usa', 7, 'Dwight D. Eisenhower', '1953–1961', 'Eigene Einheiten +5 % Schaden; Straßen +40 % statt +25 % Tempo', { cls: { all: { atk: 1.05 } }, roadSpeed: 1.4 },
    { name: 'Operation Overlord', desc: '2 min lang Schiffe und Fallschirmjäger +30 % Leben.', buffs: [{ k: 'hp', v: 1.3, s: 120, g: 'ship' }, { k: 'hp', v: 1.3, s: 120, g: 'para' }] }),
  L('kennedy', 'usa', 7, 'John F. Kennedy', '1961–1963', 'Spezialkräfte 30 % billiger; alle Einheiten +1 Sicht', { cls: { spec: { cost: 0.7 }, all: { sight: 1 } } },
    { name: 'Seeblockade', desc: 'Feindliche Schiffe in Sicht deiner Einheiten sind 60 s lang bewegungsunfähig.', special: 'blockade', s: 60 }),
  L('reagan', 'usa', 7, 'Ronald Reagan', '1981–1989', 'Raketenabwehr +20 % Abfangchance (Obergrenze 70 %)', { abm: 0.2 },
    { name: 'Rüstungswettlauf', desc: '3 min lang alle Produktionsgebäude +30 % Tempo.', buffs: [{ k: 'train', v: 1.3, s: 180 }] }),
  // Frankreich
  L('napoleon3', 'france', 6, 'Napoleon III.', '1852–1870', 'Artillerie +15 % Schaden; Gleisbau 20 % billiger', { cls: { art: { atk: 1.15 } }, railCost: 0.8 },
    { name: 'Haussmann', desc: '3 min lang Gebäude 50 % schneller gebaut.', buffs: [{ k: 'build', v: 1.5, s: 180 }] }),
  L('clemenceau', 'france', 6, 'Georges Clemenceau', '1917–1920', 'Befestigungen +30 % Leben; Infanterie in eigenen Provinzen +10 % Schaden', { fortHp: 1.3, homeDmg: { inf: 1.1 } },
    { name: 'Der Tiger', desc: '2 min lang alle Einheiten +20 % Schaden in eigenen Provinzen.', buffs: [{ k: 'dmg', v: 1.2, s: 120, own: true }] }),
  L('degaulle', 'france', 7, 'Charles de Gaulle', '1959–1969', 'Force de frappe: Atomrakete 30 % billiger; +10 Ansehen', { nukeCost: 0.7, repAdd: 10 },
    { name: 'Politik der Größe', desc: 'Kündigt ein Bündnis ohne Ansehensverlust (Abklingzeit 20 min).', special: 'freeLeave', cd: 1200 }),
  L('mitterrand', 'france', 7, 'François Mitterrand', '1981–1995', 'Züge +40 % Tempo (TGV); +10 % Sammeltempo', { railSpeed: 1.4, gather: 1.1 },
    { name: 'Achse Paris–Bonn', desc: '3 min lang +15 % Sammeltempo für dich und alle Verbündeten.', buffs: [{ k: 'gather', v: 1.15, s: 180 }], allies: true }),
  // Großbritannien
  L('victoria', 'britain', 6, 'Königin Victoria', '1837–1901', 'Werften 30 % schneller; Schiffe +10 % Leben', { cls: { ship: { time: 0.7, hp: 1.1 } } },
    { name: 'Weltreich', desc: '3 min lang +10 % Sammeltempo je eigener Küstenprovinz (höchstens +40 %).', special: 'empire', s: 180 }),
  L('churchill', 'britain', 6, 'Winston Churchill', '1940–1945', 'Einheiten in eigenen Provinzen +15 % Schaden; Jäger +15 % Schaden', { homeDmg: { all: 1.15 }, cls: { air: { atk: 1.15 } } },
    { name: 'Wir werden niemals kapitulieren', desc: '2 min lang alle Einheiten in eigenen Provinzen +30 % Leben.', buffs: [{ k: 'hp', v: 1.3, s: 120, own: true }] }),
  L('attlee', 'britain', 7, 'Clement Attlee', '1945–1951', 'Arbeiter +20 % Leben; Häuser +2 Bevölkerung', { cls: { wrk: { hp: 1.2 } }, housePop: 2 },
    { name: 'Wiederaufbau', desc: 'Alle eigenen Gebäude erhalten sofort 30 % Leben zurück (Abklingzeit 20 min).', special: 'rebuild', cd: 1200 }),
  L('thatcher', 'britain', 7, 'Margaret Thatcher', '1979–1990', 'Schiffe 20 % billiger; Spezialkräfte +20 % Leben', { cls: { ship: { cost: 0.8 }, spec: { hp: 1.2 } } },
    { name: 'Falkland', desc: '2 min lang Flotte +25 % Tempo und +15 % Schaden.', buffs: [{ k: 'speed', v: 1.25, s: 120, g: 'ship' }, { k: 'dmg', v: 1.15, s: 120, g: 'ship' }] }),
  // Italien
  L('garibaldi', 'italy', 6, 'Giuseppe Garibaldi', 'Risorgimento', 'Infanterie +20 % Tempo; Infanterie auf Hügeln +10 % Schaden', { cls: { inf: { speed: 1.2 } }, hillDmg: 1.1 },
    { name: 'Zug der Tausend', desc: 'Sofort 10 Infanteristen kostenlos am Haupthaus (1× pro Epoche).', special: 'freeInf', n: 10, once: true }),
  L('mussolini', 'italy', 6, 'Benito Mussolini', '1922–1943', 'Flugzeuge 20 % billiger; Schiffe 10 % billiger. Nachteil: Infanterie −5 % Leben', { cls: { air: { cost: 0.8 }, ship: { cost: 0.9 }, inf: { hp: 0.95 } } },
    { name: 'Mare Nostrum', desc: '2 min lang Schiffe +20 % Schaden.', buffs: [{ k: 'dmg', v: 1.2, s: 120, g: 'ship' }] }),
  L('degasperi', 'italy', 7, 'Alcide De Gasperi', '1945–1953', 'Gebäude 30 % schneller gebaut; +15 % Sammeltempo', { buildSpeed: 1.3, gather: 1.15 },
    { name: 'Marshallplan', desc: 'Sofort 1200 Nahrung, 800 Holz und 600 Gold (Abklingzeit 15 min).', special: 'grant', res: { food: 1200, wood: 800, gold: 600 }, cd: 900 }),
  L('craxi', 'italy', 7, 'Bettino Craxi', '1983–1987', '+15 % Goldertrag; Gebirgshaubitze 20 % billiger', { gatherRes: { gold: 1.15 }, unitCost: { nu_italy_mod56: 0.8 } },
    { name: 'Sigonella', desc: 'Fremde Truppen in deinen Provinzen sind 1 min lang bewegungsunfähig.', special: 'immobilize', s: 60 }),
  // Japan
  L('meiji', 'japan', 6, 'Kaiser Meiji', '1867–1912', 'Aufstiegsforschung 20 % schneller; Infanterie 15 % billiger', { eraSpeed: 1.2, cls: { inf: { cost: 0.85 } } },
    { name: 'Meiji-Restauration', desc: 'Alle eigenen Einheiten sofort kostenlos auf die aktuelle Epoche nachrüsten (1× pro Epoche).', special: 'refit', once: true }),
  L('tojo', 'japan', 6, 'Hideki Tōjō', '1941–1944', 'Schiffe und Flugzeuge +15 % Schaden. Nachteil: Ansehen fällt bei Wahl auf „niedrig“', { cls: { ship: { atk: 1.15 }, air: { atk: 1.15 } }, repSet: -60 },
    { name: 'Pazifikoffensive', desc: '2 min lang Flugzeuge +30 % Tempo und +15 % Schaden.', buffs: [{ k: 'speed', v: 1.3, s: 120, g: 'air' }, { k: 'dmg', v: 1.15, s: 120, g: 'air' }] }),
  L('yoshida', 'japan', 7, 'Shigeru Yoshida', '1946–1954', '+20 % Sammeltempo; Gebäude 15 % billiger', { gather: 1.2, bldCost: 0.85 },
    { name: 'Yoshida-Doktrin', desc: '5 min lang erleiden deine Gebäude 25 % weniger Schaden.', buffs: [{ k: 'bldHp', v: 1.33, s: 300 }] }),
  L('nakasone', 'japan', 7, 'Yasuhiro Nakasone', '1982–1987', 'Flugabwehr +25 % Schaden; Schiffe +10 % Leben', { cls: { aa: { atk: 1.25 }, ship: { hp: 1.1 } } },
    { name: 'Unsinkbarer Flugzeugträger', desc: '3 min lang Küstenbatterien, Flak und Türme +40 % Reichweite.', buffs: [{ k: 'towerRange', v: 1.4, s: 180 }] }),
  // Osmanisches Reich / Türkei
  L('abdulhamid', 'ottoman', 6, 'Abdülhamid II.', '1876–1909', 'Gleisbau 30 % billiger (Hedschasbahn); Botschafter +30 % Tempo', { railCost: 0.7, envoySpeed: 1.3 },
    { name: 'Panislamische Diplomatie', desc: '+15 Ansehen sofort und 3 min lang +20 % Sammeltempo.', rep: 15, buffs: [{ k: 'gather', v: 1.2, s: 180 }] }),
  L('ataturk', 'ottoman', 6, 'Mustafa Kemal Atatürk', '1923–1938', 'Infanterie +15 % Leben; Gebäude 20 % schneller gebaut', { cls: { inf: { hp: 1.15 } }, buildSpeed: 1.2 },
    { name: 'Gallipoli', desc: '2 min lang Infanterie in eigenen Provinzen +35 % Leben.', buffs: [{ k: 'hp', v: 1.35, s: 120, g: 'inf', own: true }] }),
  L('inonu', 'ottoman', 7, 'İsmet İnönü', '1938–1950', 'Nichtangriffspakte doppelt so lang; +10 Ansehen', { pactMul: 2, repAdd: 10 },
    { name: 'Aktive Neutralität', desc: '2 min lang erleiden deine Einheiten und Gebäude in eigenen Provinzen 50 % weniger Schaden (Abklingzeit 30 min).', buffs: [{ k: 'hp', v: 2, s: 120, own: true }, { k: 'bldHp', v: 2, s: 120 }], cd: 1800 }),
  L('ozal', 'ottoman', 7, 'Turgut Özal', '1983–1989', '+15 % Sammeltempo; +15 % Goldertrag', { gather: 1.15, gatherRes: { gold: 1.15 } },
    { name: 'Öffnung', desc: '3 min lang +40 % Goldertrag.', buffs: [{ k: 'gather', v: 1.4, s: 180, res: 'gold' }] }),
];
export const LEADER = Object.fromEntries(LEADERS.map(l => [l.id, l]));
export const LEADER_CD = 600;
export function leaderOptions(nation, era) { return LEADERS.filter(l => l.nation === nation && l.era === era); }

// ---------------- Atomwaffen (Kalter Krieg) ----------------
export const NUCLEAR_NATIONS = ['usa', 'russia', 'britain', 'france', 'china'];
export const NUKE = {
  cost: { food: 3000, wood: 2000, gold: 5000 }, time: 360, flight: 10, radius: 9, inner: 4, pause: 720, maxPerGame: 3,
  abmRange: 16, abmBase: 0.3, abmStep: 0.1, abmCap: 0.5, abmReload: 300, radiation: 240, bunkerCap: 12, wonderSetback: 600,
};
