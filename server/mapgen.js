// Prozeduraler Kartengenerator: Gelände, Wälder, Rohstoffe, Startpositionen.
// Terrain-Codes: 0 Gras, 1 Erde, 2 Sand (Strand), 3 Wasser (blockiert), 4 Fels (blockiert),
// 5 Hügel, 6 Schnee, 7 Wüste, 8 Sumpf, 9 Furt (flaches Flusswasser, begehbar)
export const T_GRASS = 0, T_DIRT = 1, T_SAND = 2, T_WATER = 3, T_ROCK = 4, T_HILL = 5, T_SNOW = 6, T_DESERT = 7, T_SWAMP = 8, T_FORD = 9;
export const blockedTerrain = t => t === T_WATER || t === T_ROCK;
export const waterTerrain = t => t === T_WATER || t === T_FORD;

// Provinznamen (zusammengesetzt), dazu sehr selten die Widmungsnamen
const PROV_A = ['Eichen', 'Birken', 'Grauen', 'Silber', 'Raben', 'Wolfs', 'Falken', 'Nebel', 'Sonnen', 'Kalten', 'Roten', 'Hohen', 'Tiefen', 'Weiden', 'Stein', 'Linden', 'Bären', 'Adler', 'Moos', 'Kiefern', 'Erlen', 'Mühl', 'Burg', 'Fels', 'Dorn', 'Klee', 'Hirsch', 'Ulmen', 'Schwarzen', 'Weißen'];
const PROV_B = ['tal', 'mark', 'au', 'feld', 'heim', 'grund', 'wald', 'berg', 'land', 'furt', 'stein', 'hain', 'bruck', 'moor', 'ried', 'eck', 'hof', 'weiler', 'gau', 'see'];
const DEDICATION = ['Antonija', 'Marija', 'Ljiljes See'];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(rand) {
  const N = 256, perm = new Uint8Array(N * 2), vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = rand(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const s = t => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x, y, oct = 4) => {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { sum += noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
}

export const MAP_TYPES = {
  continent: { name: 'Kontinent', water: 0.30, rock: 0.80, forest: 0.60, snow: 0.08, desert: 0.06 },
  lakes: { name: 'Seenplatte', water: 0.42, rock: 0.86, forest: 0.62, snow: 0.06, desert: 0.04 },
  highlands: { name: 'Hochland', water: 0.26, rock: 0.66, forest: 0.62, ridges: true, snow: 0.14, desert: 0.03 },
  islands: { name: 'Inseln', water: 0.5, rock: 0.9, forest: 0.6, snow: 0.04, desert: 0.03, islands: true },
  forest: { name: 'Urwald', water: 0.30, rock: 0.82, forest: 0.52, snow: 0.04, desert: 0.03 },
};

export function mapSide(setting, players) {
  if (setting === 'small') return 96;
  if (setting === 'medium') return 128;
  if (setting === 'large') return 168;
  if (setting === 'huge') return 210;
  return Math.round(Math.min(210, 84 + 26 * Math.sqrt(Math.max(2, players))));
}

export function generateMap({ players, seed, size = 'auto', type = 'random', resources = 'normal' }) {
  const rand = rng(seed);
  const types = Object.keys(MAP_TYPES);
  const typeKey = type === 'random' || !MAP_TYPES[type] ? types[Math.floor(rand() * types.length)] : type;
  const T = MAP_TYPES[typeKey];
  const W = mapSide(size, players), H = W;
  const elev = makeNoise(rand), moist = makeNoise(rand), forestN = makeNoise(rand), detail = makeNoise(rand), climate = makeNoise(rand);
  const terrain = new Uint8Array(W * H), tempA = new Float32Array(W * H), moistA = new Float32Array(W * H), elevA = new Float32Array(W * H);
  const freq = 4.5 / 128;
  // Inselkarte: je Spieler eine Insel auf dem Startkreis, dazu kleinere Inseln; Meerengen dazwischen
  let isleCenters = null;
  if (T.islands) {
    const ir = rng(seed + 991), R0 = W * (players <= 2 ? 0.30 : 0.37), off0 = ir() * Math.PI * 2;
    isleCenters = [];
    for (let i = 0; i < players; i++) { const a = off0 + (i / players) * Math.PI * 2; isleCenters.push({ x: Math.round(W / 2 + Math.cos(a) * R0), y: Math.round(H / 2 + Math.sin(a) * R0), r: W * Math.min(0.2, 0.62 / Math.max(2, players) + 0.07), start: true }); }
    isleCenters.push({ x: W / 2, y: H / 2, r: W * 0.1 });
    for (let k = 0; k < players; k++) { const a = off0 + ((k + 0.5) / players) * Math.PI * 2, rr = W * (0.18 + ir() * 0.25); isleCenters.push({ x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr, r: W * (0.04 + ir() * 0.04) }); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let e = elev(x * freq, y * freq, 5);
    if (isleCenters) { let m = 0; for (const c of isleCenters) m = Math.max(m, 1 - Math.hypot(x - c.x, y - c.y) / c.r); e = e * 0.45 + Math.max(0, m) * 0.75; }
    if (T.ridges) e = Math.max(e, 1 - Math.abs(elev(x * freq * 0.7 + 50, y * freq * 0.7 + 50, 3) - 0.5) * 2.6);
    const m = moist(x * freq * 1.3 + 100, y * freq * 1.3, 3);
    let t = T_GRASS;
    if (e < T.water) t = T_WATER;
    else if (e < T.water + 0.025) t = T_SAND;
    else if (e > T.rock) t = T_ROCK;
    else if (e > T.rock - 0.07) t = T_HILL;
    else if (m < 0.3 || detail(x * 0.15, y * 0.15, 2) > 0.74) t = T_DIRT;
    terrain[y * W + x] = t;
    tempA[y * W + x] = climate(x * freq * 0.8 + 300, y * freq * 0.8 + 300, 3);
    moistA[y * W + x] = m; elevA[y * W + x] = e;
  }
  // Klimazonen über Anteile statt fester Schwellen: kälteste Gegenden verschneit, heißeste und trockene Wüste, feuchte Senken Sumpf
  {
    const q = (arr, f) => { const a = Array.from(arr).sort((p, q2) => p - q2); return a[Math.min(a.length - 1, Math.floor(a.length * f))]; };
    const coldT = q(tempA, T.snow), hotT = q(tempA, 1 - T.desert * 2), wetM = q(moistA, 0.5);
    for (let i = 0; i < W * H; i++) {
      const t = terrain[i];
      if (t !== T_GRASS && t !== T_DIRT && t !== T_HILL) continue;
      if (tempA[i] < coldT) terrain[i] = T_SNOW;
      else if (tempA[i] > hotT && moistA[i] < wetM && t !== T_HILL) terrain[i] = T_DESERT;
      else if (moistA[i] > 0.64 && elevA[i] < T.water + 0.08) terrain[i] = T_SWAMP;
    }
  }

  // Flüsse: vom Hochland bergab bis zu einem See oder zum Rand; Furten als Übergänge
  const river = new Uint8Array(W * H);
  const nRivers = typeKey === 'lakes' ? 1 : 1 + Math.floor(rand() * 2) + (W > 150 ? 1 : 0);
  for (let r = 0; r < nRivers; r++) {
    let bx = 0, by = 0, be = -1;
    for (let k = 0; k < 60; k++) { const x = 8 + Math.floor(rand() * (W - 16)), y = 8 + Math.floor(rand() * (H - 16)); const e = elev(x * freq, y * freq, 5); if (e > be && e < T.rock) { be = e; bx = x; by = y; } }
    let x = bx, y = by, dir = rand() * Math.PI * 2, len = 0, sinceFord = 0;
    while (len++ < W * 2 && x > 1 && y > 1 && x < W - 2 && y < H - 2) {
      // Richtung: bergab mit Mäandern
      let best = dir, bestE = Infinity;
      for (let k = -2; k <= 2; k++) { const a = dir + k * 0.35, e = elev((x + Math.cos(a) * 3) * freq, (y + Math.sin(a) * 3) * freq, 5) + (rand() - 0.5) * 0.02; if (e < bestE) { bestE = e; best = a; } }
      dir = best * 0.7 + dir * 0.3 + (rand() - 0.5) * 0.25;
      x += Math.cos(dir); y += Math.sin(dir);
      const ix = Math.round(x), iy = Math.round(y);
      if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= H - 1) break;
      const i = iy * W + ix;
      if (terrain[i] === T_WATER && !river[i] && len > 6) break; // mündet in einen See
      const ford = ++sinceFord > 14 && rand() < 0.25;
      if (ford) sinceFord = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
        const j = (iy + dy) * W + ix + dx;
        if (terrain[j] === T_ROCK) continue;
        river[j] = 1; terrain[j] = ford ? T_FORD : T_WATER;
      }
    }
  }

  // Startpositionen gleichmäßig auf einem Kreis
  const starts = [];
  const R = W * (players <= 2 ? 0.30 : 0.37);
  const off = rand() * Math.PI * 2;
  for (let i = 0; i < players; i++) {
    const a = off + (i / players) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const r = R * (0.92 + rand() * 0.12);
    starts.push({ x: Math.round(W / 2 + Math.cos(a) * r), y: Math.round(H / 2 + Math.sin(a) * r) });
  }
  if (isleCenters) for (let i = 0; i < players; i++) { starts[i].x = isleCenters[i].x; starts[i].y = isleCenters[i].y; }
  const clear = (cx, cy, rad) => {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = y * W + x;
      if (river[i]) { if (rad <= 2) terrain[i] = T_FORD; else terrain[i] = T_GRASS; continue; }
      if (blockedTerrain(terrain[i]) || terrain[i] === T_SAND || terrain[i] >= T_SNOW) terrain[i] = T_GRASS;
    }
  };
  for (const s of starts) clear(s.x, s.y, 11);

  // Erreichbarkeit sicherstellen: Korridore zwischen den Starts schlagen
  const carve = (a, b) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(a.x + (b.x - a.x) * k / steps), y = Math.round(a.y + (b.y - a.y) * k / steps);
      clear(x, y, 2);
    }
  };
  const reach = () => {
    const seen = new Uint8Array(W * H), q = [starts[0].y * W + starts[0].x];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(), x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!seen[j] && !blockedTerrain(terrain[j])) { seen[j] = 1; q.push(j); }
      }
    }
    return seen;
  };
  for (let guard = 0; guard < (T.islands ? 0 : players + 2); guard++) {
    const seen = reach();
    const bad = starts.findIndex(s => !seen[s.y * W + s.x]);
    if (bad < 0) break;
    // mit nächstem erreichbaren Start verbinden
    let best = null;
    for (const s of starts) if (seen[s.y * W + s.x]) { const d = Math.hypot(s.x - starts[bad].x, s.y - starts[bad].y); if (!best || d < best[0]) best = [d, s]; }
    carve(starts[bad], best[1]);
  }
  const reachable = reach();

  // Belegung für Rohstoffe
  const occ = new Uint8Array(W * H);
  const resList = [];
  const resMul = resources === 'low' ? 0.6 : resources === 'high' ? 1.6 : 1;
  const nearStart = (x, y, d) => starts.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < d * d);
  const free = (x, y, sz = 1) => {
    for (let yy = y; yy < y + sz; yy++) for (let xx = x; xx < x + sz; xx++) {
      if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) return false;
      const i = yy * W + xx;
      if (occ[i] || blockedTerrain(terrain[i]) || terrain[i] === T_FORD || !reachable[i]) return false;
    }
    return true;
  };
  const place = (type, x, y, sz = 1) => {
    if (!free(x, y, sz)) return false;
    for (let yy = y; yy < y + sz; yy++) for (let xx = x; xx < x + sz; xx++) occ[yy * W + xx] = 1;
    resList.push({ type, x, y, mul: resMul });
    return true;
  };
  // Startbereich freihalten (Haupthaus + Platz)
  for (const s of starts) for (let y = s.y - 4; y <= s.y + 4; y++) for (let x = s.x - 4; x <= s.x + 4; x++) if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 2;

  const ringPlace = (s, type, dMin, dMax, sz, tries = 80) => {
    for (let t = 0; t < tries; t++) {
      const a = rand() * Math.PI * 2, d = dMin + rand() * (dMax - dMin);
      const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
      if (place(type, x, y, sz)) return { x, y };
    }
    return null;
  };
  const cluster = (cx, cy, type, n, spread) => {
    let placed = 0;
    for (let t = 0; t < n * 6 && placed < n; t++) {
      const x = Math.round(cx + (rand() - 0.5) * spread * 2), y = Math.round(cy + (rand() - 0.5) * spread * 2);
      if (place(type, x, y)) placed++;
    }
    return placed;
  };
  // Fairer Startbereich für jeden Spieler
  for (const s of starts) {
    const b = ringPlace(s, 'berry', 6, 8, 1);
    if (b) cluster(b.x, b.y, 'berry', 6, 2);
    ringPlace(s, 'gold', 8, 11, 2);
    ringPlace(s, 'stone', 9, 12, 2);
    ringPlace(s, 'gold', 15, 20, 2);
    for (let f = 0; f < 3; f++) {
      const c = ringPlace(s, 'tree', 10, 15, 1);
      if (c) cluster(c.x, c.y, 'tree', 24, 3.5);
    }
  }
  // Wälder nach Rauschen
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (occ[i] || terrain[i] !== T_GRASS && terrain[i] !== T_DIRT && terrain[i] !== T_HILL && terrain[i] !== T_SNOW) continue;
    if (nearStart(x, y, 9)) continue;
    const f = forestN(x * 0.07, y * 0.07, 4);
    if (f > T.forest && rand() < 0.85) place('tree', x, y);
    else if (rand() < 0.004) place('tree', x, y);
  }
  // verstreute Minen und Beeren
  const area = W * H;
  const scatter = (type, count, sz, minD) => {
    for (let c = 0, t = 0; c < count && t < count * 50; t++) {
      const x = 2 + Math.floor(rand() * (W - 4)), y = 2 + Math.floor(rand() * (H - 4));
      if (nearStart(x, y, minD)) continue;
      if (type === 'berry') { if (place('berry', x, y)) { cluster(x, y, 'berry', 4, 2); c++; } } else if (place(type, x, y, sz)) c++;
    }
  };
  scatter('gold', Math.round(area / 1000), 2, 16);
  scatter('stone', Math.round(area / 1300), 2, 16);
  scatter('berry', Math.round(area / 1800), 1, 14);
  // Fischgründe: Wasserkacheln nahe der Küste (für Fischerboote)
  const isWater = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && terrain[y * W + x] === T_WATER && !occ[y * W + x];
  const nearCoast = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const t = terrain[(y + dy) * W + x + dx]; if (t !== undefined && t !== T_WATER) return true; } return false; };
  const fishAt = (x, y) => { if (!isWater(x, y) || !nearCoast(x, y)) return false; occ[y * W + x] = 1; resList.push({ type: 'fish', x, y, mul: resMul }); return true; };
  for (const s of starts) for (let k = 0, t = 0; k < 3 && t < 300; t++) { const a = rand() * Math.PI * 2, d = 7 + rand() * 12; if (fishAt(Math.round(s.x + Math.cos(a) * d), Math.round(s.y + Math.sin(a) * d))) k++; }
  for (let k = 0, t = 0; k < Math.round(area / 700) && t < area / 20; t++) if (fishAt(2 + Math.floor(rand() * (W - 4)), 2 + Math.floor(rand() * (H - 4)))) k++;

  // Provinzen: Voronoi um Startpunkte und weitere Zentren (ca. 6 je Spieler)
  const centers = starts.map(s => ({ x: s.x, y: s.y }));
  const want = Math.max(6, Math.round(players * 6)), minD = Math.max(9, W / Math.sqrt(want) * 0.8);
  for (let t = 0; t < want * 60 && centers.length < want; t++) {
    const x = 3 + Math.floor(rand() * (W - 6)), y = 3 + Math.floor(rand() * (H - 6));
    if (blockedTerrain(terrain[y * W + x])) continue;
    if (centers.some(c => (c.x - x) ** 2 + (c.y - y) ** 2 < minD * minD)) continue;
    centers.push({ x, y });
  }
  const prov = new Uint16Array(W * H).fill(65535);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (terrain[i] === T_WATER || terrain[i] === T_ROCK) continue;
    let best = 0, bd = Infinity;
    for (let k = 0; k < centers.length; k++) { const d = (centers[k].x - x) ** 2 + (centers[k].y - y) ** 2 * 1.0 + detail(x * 0.2 + k, y * 0.2, 2) * 30; if (d < bd) { bd = d; best = k; } }
    prov[i] = best;
  }
  const used = new Set();
  const provinces = centers.map((c, k) => {
    let name;
    if (rand() < 0.04 && DEDICATION.some(n => !used.has(n))) name = DEDICATION.find(n => !used.has(n));
    for (let t = 0; !name && t < 50; t++) { const n = PROV_A[Math.floor(rand() * PROV_A.length)] + PROV_B[Math.floor(rand() * PROV_B.length)]; if (!used.has(n)) name = n; }
    used.add(name);
    return { id: k, name: name || 'Provinz ' + (k + 1), x: c.x, y: c.y };
  });

  return { w: W, h: H, terrain, resources: resList, starts, mapType: typeKey, mapName: T.name, prov, provinces };
}
