// Gemeinsame Spielregeln für Server und Client.
export const TICK_MS = 100;

export const COLORS = [
  '#e6483d', '#3d7be6', '#3fbf5f', '#f2b134', '#a55ce6', '#29c4c4', '#ee6fb0', '#f07a2a',
  '#8fd14f', '#5d6be8', '#d4c23f', '#c9583f', '#7a8fa6', '#e8e8e8', '#b07a4f', '#4fb08f',
];

export const DEFAULT_SETTINGS = {
  speed: 1, // Spielgeschwindigkeit 0.5 – 2
  victory: 60, // % aller Regionen für Sieg
  timeLimit: 0, // Minuten, 0 = aus
  draftTime: 25, // Sekunden für Startwahl
  peace: 30, // Sekunden Friedensphase (keine Angriffe auf Spieler)
  startTroops: 60,
  neutralStrength: 1, // Faktor für neutrale Truppen
  botDifficulty: 'normal',
  fog: false, // Nebel des Krieges
  maxPlayers: 12,
};

export const BUILDINGS = {
  factory: { name: 'Fabrik', icon: '⚙', desc: '+50 % Goldertrag je Stufe', cost: [60, 130, 240] },
  barracks: { name: 'Kaserne', icon: '⚔', desc: '+40 % Truppenproduktion & Kapazität je Stufe', cost: [80, 170, 300] },
  fort: { name: 'Festung', icon: '⛨', desc: '+35 % Verteidigung je Stufe', cost: [70, 150, 270] },
};
export const BUILDING_KEYS = ['factory', 'barracks', 'fort'];
export const MAX_LEVEL = 3;

export const ABILITIES = {
  airstrike: { name: 'Luftschlag', icon: '✈', cost: 150, cooldown: 40, desc: 'Vernichtet 40 % der Truppen einer feindlichen Region in bis zu 3 Feldern Entfernung.', target: 'enemy', range: 3 },
  mobilize: { name: 'Mobilmachung', icon: '📯', cost: 180, cooldown: 90, desc: 'Verdoppelt 25 s lang die Truppenproduktion in allen Regionen.', target: 'none', duration: 25 },
  paradrop: { name: 'Luftlandung', icon: '🪂', cost: 120, cooldown: 35, desc: 'Schickt 50 % der Truppen der gewählten Region per Luft zu einem Ziel in bis zu 4 Feldern Entfernung.', target: 'any', range: 4 },
  sabotage: { name: 'Sabotage', icon: '💣', cost: 140, cooldown: 50, desc: 'Zerstört eine Gebäudestufe in einer feindlichen Region (bis 3 Felder Entfernung).', target: 'enemy', range: 3 },
};
export const ABILITY_KEYS = ['airstrike', 'mobilize', 'paradrop', 'sabotage'];

export const CAPITAL_DEFENSE = 1.25;

export function production(region, mobilized) {
  // Truppen pro Sekunde
  const b = region.b ? region.b[1] : 0;
  return 0.3 * region.value * (1 + 0.4 * b) * (mobilized ? 2 : 1);
}
export function capacity(region) {
  const b = region.b ? region.b[1] : 0;
  return Math.round((40 + 22 * region.value) * (1 + 0.4 * b));
}
export function income(region) {
  const f = region.b ? region.b[0] : 0;
  return 0.12 * region.value * (1 + 0.5 * f);
}
export function defenseMult(region) {
  const f = region.b ? region.b[2] : 0;
  return (1 + 0.35 * f) * (region.capital ? CAPITAL_DEFENSE : 1);
}
export function buildCost(kind, level) {
  const c = BUILDINGS[kind].cost;
  return level < c.length ? c[level] : Infinity;
}
// Reisegeschwindigkeit in Kartenpixeln pro Sekunde
export const ARMY_SPEED = 38;
export function travelTime(dist, type) {
  if (type === 3) return 6; // Verbindung über die Datumsgrenze
  const sea = type === 2 ? 0.7 : 1;
  return Math.max(1.2, dist / (ARMY_SPEED * sea));
}
