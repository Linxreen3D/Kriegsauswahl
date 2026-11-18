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
export const ERAS = [
  { name: 'Steinzeit', short: 'I', cost: null, time: 0 },
  { name: 'Bronzezeit', short: 'II', cost: { food: 400, wood: 200 }, time: 35 },
  { name: 'Eisenzeit', short: 'III', cost: { food: 700, wood: 350, gold: 150 }, time: 45 },
  { name: 'Frühes Mittelalter', short: 'IV', cost: { food: 1000, gold: 500, stone: 200 }, time: 60 },
  { name: 'Spätes Mittelalter', short: 'V', cost: { food: 1400, wood: 700, gold: 800 }, time: 70 },
  { name: '1. Industrielle Revolution', short: 'VI', cost: { food: 1800, gold: 1200, stone: 500 }, time: 80 },
  { name: '2. Industrielle Revolution', short: 'VII', cost: { food: 2200, wood: 1200, gold: 1600 }, time: 90 },
];

// ---------------- Kulturen & Nationen ----------------
// Kultur wird beim Erreichen der Bronzezeit gewählt, die Nation im Frühen Mittelalter.
export const CULTURES = {
  steppe: {
    name: 'Steppenvolk', icon: '🐎', desc: 'Reiterei ist 15 % schneller und 15 % billiger. Spezialeinheit: Steppenreiter (berittener Bogenschütze).',
    unique: 'uq_steppe', nations: ['horde', 'riders', 'nomads'],
  },
  traders: {
    name: 'Händlerbund', icon: '⚖', desc: 'Gold und Stein werden 25 % schneller abgebaut. Spezialeinheit: Söldner (starke Infanterie gegen Gold).',
    unique: 'uq_traders', nations: ['league', 'republic', 'guilds'],
  },
  builders: {
    name: 'Baumeister', icon: '🏛', desc: 'Gebäude haben 40 % mehr Leben und werden 40 % schneller gebaut, Türme treffen härter. Spezialeinheit: Wallbrecher.',
    unique: 'uq_builders', nations: ['empire', 'citadel', 'kingdom'],
  },
  warriors: {
    name: 'Kriegerkaste', icon: '⚔', desc: 'Infanterie hat 15 % mehr Angriff und 10 % mehr Leben. Spezialeinheit: Berserker.',
    unique: 'uq_warriors', nations: ['clans', 'legion', 'order'],
  },
};
export const NATIONS = {
  horde: { name: 'Große Horde', desc: 'Militäreinheiten kosten 10 % weniger.', bonus: { armyCost: 0.9 } },
  riders: { name: 'Reiterbund', desc: 'Reiterei hat 20 % mehr Leben.', bonus: { cavHp: 1.2 } },
  nomads: { name: 'Nomadenreich', desc: 'Häuser geben +4 Bevölkerung.', bonus: { housePop: 4 } },
  league: { name: 'Hansebund', desc: 'Alle Ressourcen werden 15 % schneller gesammelt.', bonus: { gather: 1.15 } },
  republic: { name: 'Seerepublik', desc: 'Einheiten werden 25 % schneller ausgebildet.', bonus: { trainSpeed: 1.25 } },
  guilds: { name: 'Gildenland', desc: 'Fernkämpfer haben +1 Reichweite.', bonus: { rangedRange: 1 } },
  empire: { name: 'Kaiserreich', desc: 'Belagerungswaffen verursachen 25 % mehr Schaden.', bonus: { siegeDmg: 1.25 } },
  citadel: { name: 'Zitadellenstaat', desc: 'Türme haben +2 Reichweite.', bonus: { towerRange: 2 } },
  kingdom: { name: 'Königreich', desc: 'Einheiten regenerieren 1 Leben pro Sekunde.', bonus: { regen: 1 } },
  clans: { name: 'Clanbund', desc: 'Infanterie bewegt sich 15 % schneller.', bonus: { infSpeed: 1.15 } },
  legion: { name: 'Legionsstaat', desc: 'Militäreinheiten haben 10 % mehr Leben.', bonus: { armyHp: 1.1 } },
  order: { name: 'Kriegsorden', desc: 'Militäreinheiten verursachen 10 % mehr Schaden.', bonus: { armyDmg: 1.1 } },
};

// ---------------- Einheiten ----------------
// Klassen: wrk (Arbeiter), inf (Nahkampf), rng (Fernkampf), cav (Reiterei/Fahrzeuge), sie (Belagerung)
export const DMG = {
  wrk: { wrk: 1, inf: 1, rng: 1, cav: 1, sie: 1, bld: 0.4 },
  inf: { wrk: 1.2, inf: 1, rng: 1.1, cav: 1.6, sie: 1.6, bld: 0.6 },
  rng: { wrk: 1.2, inf: 1.2, rng: 1, cav: 0.8, sie: 0.5, bld: 0.25 },
  cav: { wrk: 1.4, inf: 0.9, rng: 1.7, cav: 1, sie: 1.8, bld: 0.45 },
  sie: { wrk: 0.6, inf: 0.6, rng: 0.6, cav: 0.5, sie: 1, bld: 3.2 },
  bld: { wrk: 1, inf: 1, rng: 1.1, cav: 0.9, sie: 1, bld: 0.3 },
};

// Linien: pro Epoche ein Name; Werte skalieren mit der Epoche.
export const LINES = {
  worker: {
    cls: 'wrk', at: 'town', minEra: 0, key: 'Q', names: ['Sammler', 'Arbeiter', 'Handwerker', 'Leibeigener', 'Bauer', 'Fabrikarbeiter', 'Arbeiter'],
    hp: 40, atk: 3, range: 0.4, cd: 1.5, speed: 1.6, sight: 6, cost: { food: 50 }, pop: 1, time: 10, grow: 0.08, costGrow: 1,
  },
  inf: {
    cls: 'inf', at: 'barracks', minEra: 0, key: 'Q', names: ['Keulenträger', 'Speerträger', 'Schwertkämpfer', 'Hauskrieger', 'Hellebardier', 'Linieninfanterist', 'Infanterist'],
    hp: 60, atk: 7, range: 0.5, cd: 1.2, speed: 1.45, sight: 6, cost: { food: 55, wood: 10 }, pop: 1, time: 16,
  },
  rng: {
    cls: 'rng', at: 'range', minEra: 0, key: 'Q', names: ['Steinschleuderer', 'Bogenschütze', 'Bogenschütze', 'Langbogenschütze', 'Armbrustschütze', 'Jäger', 'Scharfschütze'],
    hp: 38, atk: 5, range: 5, cd: 1.6, speed: 1.4, sight: 7, cost: { food: 30, wood: 35 }, pop: 1, time: 18,
  },
  cav: {
    cls: 'cav', at: 'stable', minEra: 1, key: 'Q', names: ['', 'Streitwagen', 'Reiter', 'Panzerreiter', 'Ritter', 'Husar', 'Panzerwagen'],
    hp: 110, atk: 9, range: 0.6, cd: 1.4, speed: 2.4, sight: 7, cost: { food: 70, gold: 45 }, pop: 1, time: 22,
    eraOverride: { 5: { range: 3.5 }, 6: { range: 5, speed: 2.0, hpMul: 1.6, pop: 2 } },
  },
  sie: {
    cls: 'sie', at: 'workshop', minEra: 2, key: 'Q', names: ['', '', 'Torsionsgeschütz', 'Blide', 'Bombarde', 'Feldkanone', 'Feldhaubitze'],
    hp: 120, atk: 38, range: 7, minRange: 2, cd: 4, speed: 0.95, sight: 8, cost: { wood: 160, gold: 90 }, pop: 2, time: 32, splash: 1.2,
  },
};
export const UNIQUE = {
  uq_steppe: { line: 'cav', name: 'Steppenreiter', mods: { range: 4, atkMul: 0.75, hpMul: 0.85 }, cost: { food: 60, wood: 40, gold: 40 } },
  uq_traders: { line: 'inf', name: 'Söldner', mods: { hpMul: 1.45, atkMul: 1.35 }, cost: { gold: 85 } },
  uq_builders: { line: 'sie', name: 'Wallbrecher', mods: { hpMul: 1.8, range: 1, minRange: 0, atkMul: 1.4, splash: 0 }, cost: { wood: 140, gold: 60 } },
  uq_warriors: { line: 'inf', name: 'Berserker', mods: { atkMul: 1.6, speedMul: 1.2, hpMul: 1.1 }, cost: { food: 70, gold: 30 } },
};
export const UNIQUE_MIN_ERA = 3;

// ---------------- Gebäude ----------------
export const BUILDINGS = {
  town: { name: 'Haupthaus', size: 3, hp: 1400, cost: { wood: 300, stone: 150 }, time: 70, pop: 10, drop: true, atk: 6, range: 6, cd: 2, sight: 9, minEra: 0, key: 'Y', desc: 'Bildet Arbeiter aus, Epochenaufstieg, Abgabestelle für alle Ressourcen.' },
  house: { name: 'Haus', size: 2, hp: 300, cost: { wood: 30 }, time: 14, pop: 5, sight: 4, minEra: 0, key: 'Q', desc: '+5 Bevölkerung.' },
  storage: { name: 'Lager', size: 2, hp: 450, cost: { wood: 100 }, time: 20, drop: true, sight: 5, minEra: 0, key: 'W', desc: 'Abgabestelle für alle Ressourcen.' },
  farm: { name: 'Feld', size: 2, hp: 200, cost: { wood: 60 }, time: 10, walkable: true, sight: 2, minEra: 0, key: 'E', desc: 'Unerschöpfliche Nahrung für einen Arbeiter.' },
  barracks: { name: 'Kaserne', size: 3, hp: 900, cost: { wood: 150 }, time: 30, sight: 6, minEra: 0, key: 'R', desc: 'Bildet Nahkämpfer aus.' },
  range: { name: 'Schießplatz', size: 3, hp: 800, cost: { wood: 150 }, time: 30, sight: 6, minEra: 0, key: 'T', desc: 'Bildet Fernkämpfer aus.' },
  stable: { name: 'Stall', size: 3, hp: 900, cost: { wood: 175, gold: 25 }, time: 35, sight: 6, minEra: 1, key: 'D', desc: 'Bildet Reiterei und später Fahrzeuge aus.' },
  tower: { name: 'Wachturm', size: 2, hp: 700, cost: { stone: 125, wood: 25 }, time: 30, atk: 8, range: 7, cd: 1.8, sight: 9, minEra: 1, key: 'G', desc: 'Schießt auf Feinde in Reichweite.' },
  workshop: { name: 'Werkstatt', size: 3, hp: 900, cost: { wood: 200, gold: 50 }, time: 40, sight: 6, minEra: 2, key: 'V', desc: 'Baut Belagerungswaffen.' },
  wall: { name: 'Palisade', size: 1, hp: 350, cost: { wood: 4 }, time: 3, sight: 2, minEra: 0, key: 'C', desc: 'Günstiges Hindernis (ab Mittelalter Steinmauer).' },
};
// Weltwunder: Ausbau des Haupthauses in der letzten Epoche. Wer es 30 Minuten (große Karten: 60) hält, gewinnt.
export const WONDER = { name: 'Weltwunder', cost: { food: 3000, wood: 2500, stone: 3000, gold: 3500 }, time: 240, hold: 1800, holdLarge: 3600, hpMul: 4 };
// Große Karten (Kantenlänge ab 160 Kacheln, d. h. „Groß“/„Riesig“ oder viele Spieler) brauchen 1 Stunde
export const wonderHold = mapW => (mapW >= 160 ? WONDER.holdLarge : WONDER.hold);
export const WONDER_ERA = 7; // Anzeige-Epoche für das Modell

export const BUILD_ORDER = ['house', 'storage', 'farm', 'barracks', 'range', 'stable', 'tower', 'workshop', 'wall', 'town'];

// ---------------- Rohstoffe auf der Karte ----------------
export const RESOURCE_TYPES = {
  tree: { res: 'wood', amount: 100, size: 1, rate: 0.72 },
  berry: { res: 'food', amount: 150, size: 1, rate: 0.8 },
  gold: { res: 'gold', amount: 900, size: 2, rate: 0.6 },
  stone: { res: 'stone', amount: 700, size: 2, rate: 0.6 },
};
export const RESOURCE_KINDS = ['tree', 'berry', 'gold', 'stone'];
export const FARM_RATE = 0.6;
export const CARRY = 10;

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
    time: d.time * (1 + steps * 0.05), splash: d.splash || 0,
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
export function playerMods(culture, nation) {
  const m = {
    gather: { food: 1, wood: 1, stone: 1, gold: 1 }, armyCost: 1, cavCost: 1, cavSpeed: 1, cavHp: 1, infAtk: 1, infHp: 1, infSpeed: 1,
    bldHp: 1, buildSpeed: 1, towerAtk: 1, towerRange: 0, housePop: 0, trainSpeed: 1, rangedRange: 0, siegeDmg: 1, regen: 0,
    armyHp: 1, armyDmg: 1,
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
