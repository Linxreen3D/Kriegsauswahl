// Erzeugt public/js/icons.js (nur die benötigten SVG-Symbole) und kopiert die Schriften nach public/fonts.
// Aufruf: node tools/build-ui-assets.mjs   (benötigt die devDependencies)
// Symbole: game-icons.net (CC BY 3.0, Autoren: Lorc, Delapouite u. a.) und Lucide (ISC) – Nennung in CREDITS.md.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SETS = { gi: require('@iconify-json/game-icons/icons.json'), lu: require('@iconify-json/lucide/icons.json') };

// Name -> Kandidaten (der erste vorhandene gewinnt)
const ICONS = {
  // Rohstoffe & Zustand
  food: ['gi:wheat'], wood: ['gi:wood-pile'], stone: ['gi:stone-pile'], gold: ['gi:coins'], pop: ['lu:users'], fish: ['gi:fishing'],
  heart: ['lu:heart'], atk: ['lu:swords'], range: ['lu:crosshair'], speed: ['gi:boots'], sight: ['lu:eye'], morale: ['lu:flame'], fuel: ['lu:fuel'],
  star: ['lu:star'], warn: ['lu:triangle-exclamation-point'], skull: ['lu:skull'], build: ['lu:construction'], person: ['lu:person-standing'], bot: ['lu:bot'],
  // Oberfläche
  menu: ['lu:menu'], close: ['lu:x'], sound: ['lu:volume-2'], mute: ['lu:volume-x'], idle: ['lu:moon'], dove: ['gi:dove'], flag: ['lu:flag'],
  pause: ['lu:pause'], play: ['lu:play'], save: ['lu:save'], load: ['lu:folder-open'], scroll: ['lu:scroll-text'], up: ['lu:arrow-big-up'], back: ['lu:chevron-left'],
  plus: ['lu:plus'], tools: ['lu:hammer'], trash: ['lu:trash'], stop: ['lu:hand'], attack: ['gi:crossed-swords'], research: ['lu:flask-conical'],
  ban: ['lu:ban'], mail: ['lu:mail'], pen: ['lu:pen-line'], gift: ['lu:gift'], scale: ['lu:scale'], handshake: ['lu:handshake'], lock: ['lu:lock'],
  check: ['lu:check'], crown: ['gi:crown'], medal: ['gi:medal'], spring: ['lu:sprout'], summer: ['lu:sun'], autumn: ['lu:leaf'], winter: ['lu:snowflake'],
  meteor: ['gi:meteor-impact'], nuclear: ['gi:radioactive', 'gi:nuclear'], wonder: ['gi:greek-temple', 'gi:temple-gate'], explosion: ['gi:explosion-rays', 'gi:bright-explosion'],
  mountain: ['gi:mountains', 'gi:mountain-cave'], forest: ['gi:pine-tree'], target: ['gi:targeted', 'lu:target'], whistle: ['lu:megaphone'],
  // Formationen
  f_line: ['lu:grip-horizontal'], f_column: ['lu:grip-vertical'], f_wedge: ['lu:triangle'], f_square: ['lu:square'], f_loose: ['lu:grip'],
  // Einheiten
  worker: ['gi:farmer', 'gi:miner', 'gi:hammer-nails'], sword: ['gi:broadsword'], axe: ['gi:battle-axe', 'gi:wood-axe'], spear: ['gi:spears', 'gi:spear-hook'],
  pike: ['gi:spear-hook'], bow: ['gi:bow-arrow'], musket: ['gi:musket'], rifle: ['gi:winchester-rifle'], soldier: ['gi:brodie-helmet'], helmet: ['gi:crested-helmet'], cavalry: ['gi:cavalry'],
  tank: ['gi:battle-tank', 'gi:tank'], catapult: ['gi:catapult'], cannon: ['gi:cannon'], artillery: ['gi:field-gun', 'gi:cannon'], rocketlauncher: ['gi:missile-launcher'],
  envoy: ['gi:scroll-unfurled'], spy: ['gi:spy'], train: ['gi:subway-train'], armtrain: ['gi:steam-locomotive'], fishboat: ['gi:fishing-boat'],
  transport: ['gi:cargo-ship'], warship: ['gi:iron-hulled-warship'], galley: ['gi:drakkar', 'gi:galleon'], sailship: ['gi:galleon'], battleship: ['gi:battleship'],
  sub: ['gi:submarine'], scout: ['gi:biplane'], fighter: ['gi:jet-fighter'], bomber: ['gi:bomber'], heli: ['gi:helicopter'], para: ['gi:parachute'],
  flak: ['gi:anti-aircraft-gun', 'gi:radar-dish'], med: ['gi:medical-pack', 'lu:cross'], celo: ['gi:shield'], elephant: ['gi:elephant'], rocket: ['gi:rocket'],
  // Gebäude
  town: ['gi:castle'], house: ['gi:family-house'], storage: ['gi:wooden-crate', 'gi:open-chest'], farm: ['gi:barn'], outpost: ['gi:flying-flag'],
  road: ['gi:stone-path'], bridge: ['gi:stone-bridge'], rail: ['gi:railway'], station: ['gi:steam-locomotive'], dock: ['gi:anchor'], coastgun: ['gi:pirate-cannon'],
  airfield: ['gi:airplane-departure'], flakpos: ['gi:radar-dish'], barracks: ['gi:barracks', 'gi:barracks-tent'], range_b: ['gi:archery-target'],
  stable: ['gi:horse-head'], tower: ['gi:stone-tower'], workshop: ['gi:anvil'], wall: ['gi:stone-wall'], nukelab: ['gi:nuclear-plant'], silo: ['gi:missile-pod'],
  abm: ['gi:radar-sweep', 'gi:radar-dish'], bunker: ['gi:bunker'], celohouse: ['gi:cottage', 'gi:family-house'], memorial: ['gi:tombstone'],
};

// Emoji -> Symbolname (alles andere wird entfernt)
const EMOJI = {
  '🍖': 'food', '🌾': 'food', '🪵': 'wood', '🪨': 'stone', '🪙': 'gold', '💰': 'gold', '👥': 'pop', '🧍': 'person', '❤': 'heart', '⚔': 'attack', '🎯': 'range',
  '👟': 'speed', '👁': 'sight', '💪': 'morale', '⛽': 'fuel', '★': 'star', '⭐': 'star', '⚠': 'warn', '☠': 'skull', '🏗': 'build', '🤖': 'bot',
  '☰': 'menu', '✕': 'close', '✖': 'close', '🔊': 'sound', '🔇': 'mute', '💤': 'idle', '🕊': 'dove', '🏳': 'flag', '🚩': 'outpost', '⏸': 'pause', '▶': 'play',
  '💾': 'save', '📂': 'load', '📜': 'scroll', '⬆': 'up', '◀': 'back', '➕': 'plus', '✚': 'med', '🛠': 'tools', '🗑': 'trash', '✋': 'stop', '🔬': 'research',
  '⛔': 'ban', '🚫': 'ban', '✉': 'mail', '✍': 'pen', '🎁': 'gift', '⚖': 'scale', '🤝': 'handshake', '🤫': 'lock', '👑': 'crown', '🎖': 'medal',
  '🌱': 'spring', '☀': 'summer', '🍂': 'autumn', '❄': 'winter', '☄': 'meteor', '☢': 'nuclear', '🏛': 'wonder', '💥': 'explosion', '🎆': 'rocketlauncher',
  '⛰': 'mountain', '🌲': 'forest', '🌿': 'forest', '➖': 'f_line', '⏬': 'f_column', '🔺': 'f_wedge', '⬛': 'f_square', '⁘': 'f_loose',
  '👷': 'worker', '🪓': 'axe', '🗡': 'sword', '🔱': 'spear', '🏹': 'bow', '🔫': 'rifle', '🪖': 'soldier', '🐎': 'cavalry', '🏇': 'cavalry', '🐴': 'stable',
  '🛡': 'celo', '🚜': 'tank', '🛞': 'catapult', '🧨': 'cannon', '💣': 'cannon', '🚀': 'rocket', '🕵': 'spy', '🚂': 'train', '🚆': 'train', '🚃': 'armtrain',
  '🛶': 'fishboat', '⛵': 'sailship', '🚤': 'fishboat', '⛴': 'transport', '🚢': 'warship', '🐋': 'sub', '🤿': 'sub', '🛩': 'scout', '✈': 'fighter', '🛬': 'bomber',
  '🚁': 'heli', '🪂': 'para', '🛰': 'abm', '🐘': 'elephant', '🐏': 'catapult', '😡': 'axe', '🪶': 'bow',
  '🏰': 'town', '🏠': 'house', '📦': 'storage', '🛣': 'road', '🌉': 'bridge', '🛤': 'rail', '🚉': 'station', '⚓': 'dock', '🛫': 'airfield', '🗼': 'tower',
  '⚙': 'workshop', '🧱': 'wall', '🏚': 'bunker', '🏡': 'celohouse', '🪦': 'memorial', '⛏': 'worker', '◆': '',
};

const out = {}, miss = [];
for (const [name, cands] of Object.entries(ICONS)) {
  const hit = cands.map(c => c.split(':')).find(([s, n]) => SETS[s].icons[n]);
  if (!hit) { miss.push(name + ' ' + cands.join('/')); continue; }
  const [s, n] = hit, set = SETS[s], ic = set.icons[n];
  const w = ic.width || set.width || 24, h = ic.height || set.height || 24;
  out[name] = [w, h, s === 'lu' ? 1 : 0, ic.body];
}
if (miss.length) console.warn('Nicht gefunden:', miss.join('; '));
const js = `// Automatisch erzeugt von tools/build-ui-assets.mjs – nicht von Hand bearbeiten.
// Symbole: game-icons.net (CC BY 3.0) und Lucide (ISC), siehe CREDITS.md.
export const ICONS = ${JSON.stringify(out)};
export const EMOJI = ${JSON.stringify(EMOJI)};
// SVG-Markup eines Symbols (übernimmt die Textfarbe)
export function icon(name, cls = '') {
  const d = ICONS[name]; if (!d) return '';
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 ' + d[0] + ' ' + d[1] + '" aria-hidden="true"' + (d[2] ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : ' fill="currentColor"') + '>' + d[3].replace(/fill="#000"/g, 'fill="currentColor"') + '</svg>';
}
// Ersetzt Emojis in HTML-Text durch Symbole und entfernt die übrigen
const RE = /(?:\\p{Extended_Pictographic}|[◆☰✕✖★✚⚔⏸▶◀⁘➖⬛⏬])\\uFE0F?/gu;
export function iconize(html) { return String(html).replace(RE, m => { const n = EMOJI[m.replace('\\uFE0F', '')]; return n ? icon(n) : ''; }); }
`;
writeFileSync(new URL('../public/js/icons.js', import.meta.url), js);
console.log('Symbole:', Object.keys(out).length, '→ public/js/icons.js', (js.length / 1024).toFixed(0) + ' KB');

// Schriften
const fonts = [['oswald', 'oswald', [500, 600, 700]], ['ibm-plex-sans-condensed', 'ibm-plex-sans-condensed', [400, 500, 600]]];
mkdirSync(new URL('../public/fonts/', import.meta.url), { recursive: true });
for (const [pkg, file, weights] of fonts) for (const w of weights) for (const sub of ['latin', 'latin-ext']) {
  const f = `${file}-${sub}-${w}-normal.woff2`;
  copyFileSync(require.resolve(`@fontsource/${pkg}/files/${f}`), new URL('../public/fonts/' + f, import.meta.url));
}
console.log('Schriften kopiert nach public/fonts');
copyFileSync(require.resolve('@fontsource/oswald/LICENSE'), new URL('../public/fonts/OFL-Oswald.txt', import.meta.url));
copyFileSync(require.resolve('@fontsource/ibm-plex-sans-condensed/LICENSE'), new URL('../public/fonts/OFL-IBM-Plex.txt', import.meta.url));
