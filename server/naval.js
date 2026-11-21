// Seekrieg: Wasser-Wegfindung, Werft, Fischerboote, Transporter, Kriegsschiffe, U-Boote, Küstenbatterie.
import { T_WATER } from './mapgen.js';

export function installNaval(World) {
  const W = World.prototype;

  // Befahrbar: offenes Wasser ohne Brücke oder Fischgrund
  W.buildWPass = function () {
    const N = this.W * this.H;
    this.wpass = new Uint8Array(N);
    for (let i = 0; i < N; i++) this.wpass[i] = this.terrain[i] === T_WATER && !this.occ[i] ? 1 : 0;
  };
  W.updateWTile = function (i) { if (this.wpass) this.wpass[i] = this.terrain[i] === T_WATER && !this.occ[i] ? 1 : 0; };
  // Schiffe nutzen für Wegfindung vorübergehend das Wasserraster
  W.withWater = function (fn) { const lp = this.pass; this.pass = this.wpass; try { return fn(); } finally { this.pass = lp; } };
  W.passFor = function (u, x, y) { const tx = Math.floor(x), ty = Math.floor(y); return this.inBounds(tx, ty) && (u.naval ? this.wpass : this.pass)[ty * this.W + tx] === 1; };
  W.coastal = function (x, y, size) {
    for (let yy = y - 1; yy <= y + size; yy++) for (let xx = x - 1; xx <= x + size; xx++) if (this.inBounds(xx, yy) && this.terrain[this.idx(xx, yy)] === T_WATER) return true;
    return false;
  };

  // ---------- Transport ----------
  W.shipCargoPop = function (s) { return (s.cargo || []).reduce((a, id) => { const u = this.ents.get(id); return a + (u ? u.st.pop : 0); }, 0); };
  W.boardCommand = function (pid, units, ship) {
    if (!ship || ship.dead || !ship.st.capacity || !this.allied(ship.owner, pid)) return;
    const land = units.filter(u => !u.naval);
    if (!land.length) return;
    // Anlegestelle: Wasserkachel mit Landnachbar, die die Truppen zu Fuß erreichen können
    let cx = 0, cy = 0; for (const u of land) { cx += u.x; cy += u.y; } cx /= land.length; cy /= land.length;
    const dist = this.dijkstra(this.pointSources(Math.floor(cx), Math.floor(cy)));
    let best = null, bd = Infinity;
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    for (let y = Math.max(1, y0 - 30); y < Math.min(this.H - 1, y0 + 30); y++) for (let x = Math.max(1, x0 - 30); x < Math.min(this.W - 1, x0 + 30); x++) {
      if (!this.wpass[this.idx(x, y)]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = this.idx(x + dx, y + dy), d = dist[j];
        if (this.pass[j] && d < bd) { bd = d; best = { wx: x + 0.5, wy: y + 0.5, lx: x + dx + 0.5, ly: y + dy + 0.5 }; }
      }
    }
    if (!best) { this.notice(pid, 'Keine Anlegestelle in der Nähe der Truppen gefunden.'); return; }
    for (const u of land) { u.order = { t: 'boardShip', ship: ship.id, px: best.lx, py: best.ly, key: 'p' + Math.floor(best.lx) + ',' + Math.floor(best.ly) }; u.buildQ = []; }
    this.withWater(() => this.groupMove([ship], best.wx, best.wy, false));
  };
  W.doBoardShip = function (u, dt) {
    const s = this.ents.get(u.order.ship);
    if (!s || s.dead) { u.order = { t: 'idle' }; return; }
    if (Math.hypot(s.x - u.x, s.y - u.y) <= 2.2) {
      if (this.shipCargoPop(s) + u.st.pop > s.st.capacity) { this.notice(u.owner, 'Das Schiff ist voll.'); u.order = { t: 'idle' }; return; }
      (s.cargo || (s.cargo = [])).push(u.id); u.aboard = 'S' + s.id; u.order = { t: 'wait' };
      return;
    }
    // zur Anlegestelle gehen und dort auf das Schiff warten
    const o = u.order;
    if (Math.hypot(o.px - u.x, o.py - u.y) > 0.6) {
      if (!this.steer(u, o.px, o.py, o.key, () => this.pointSources(Math.floor(o.px), Math.floor(o.py)), dt)) u.order = { t: 'idle' };
    }
  };
  W.unloadCommand = function (ship, x, y) {
    if (!ship.cargo || !ship.cargo.length) return;
    // Wasserkachel mit Landnachbar nahe am Zielpunkt suchen
    let best = null, bd = Infinity;
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let r = 0; r <= 14 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!this.inBounds(nx, ny) || !this.wpass[this.idx(nx, ny)]) continue;
      let shore = false; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inBounds(nx + ax, ny + ay) && this.pass[this.idx(nx + ax, ny + ay)]) shore = true;
      if (!shore) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [nx + 0.5, ny + 0.5]; }
    }
    if (!best) return;
    ship.order = { t: 'unload', x: best[0], y: best[1], dest: [x, y], key: 'p' + Math.floor(best[0]) + ',' + Math.floor(best[1]) };
  };
  W.doUnload = function (s, dt) {
    const o = s.order;
    if (Math.hypot(o.x - s.x, o.y - s.y) > 0.8) {
      const ok = this.steer(s, o.x, o.y, o.key, () => this.pointSources(Math.floor(o.x), Math.floor(o.y)), dt);
      if (!ok) s.order = { t: 'idle' };
      return;
    }
    this.unloadAll(s, o.dest);
    s.order = { t: 'idle' };
  };
  W.unloadAll = function (s, dest) {
    const lp = this.pass; // Landraster für das Aussteigen
    const out = [];
    for (const id of s.cargo || []) {
      const u = this.ents.get(id); if (!u || u.dead) continue;
      const p = this.nearestFreeOn(lp, s.x, s.y, 4);
      if (!p) continue;
      u.x = p[0]; u.y = p[1]; u.aboard = null; u.order = { t: 'idle' };
      this.cells[this.cellOf(u.x, u.y)].push(u); out.push(u);
    }
    s.cargo = (s.cargo || []).filter(id => !out.some(u => u.id === id));
    if (out.length && dest) this.groupMove(out, dest[0], dest[1], true);
    if (out.length) this.achieve(s.owner, 'LANDING');
  };
  W.nearestFreeOn = function (grid, x, y, maxR) { const lp = this.pass; this.pass = grid; try { return this.nearestFree(x, y, maxR); } finally { this.pass = lp; } };
  // Schiff versenkt: Ladung geht mit unter
  W.shipSunk = function (s) {
    for (const id of s.cargo || []) { const u = this.ents.get(id); if (u && !u.dead) { u.aboard = null; this.kill(u, -1); } }
    s.cargo = [];
  };
}
