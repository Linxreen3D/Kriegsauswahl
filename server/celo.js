// Widmung: Celo (Jugoslawien) – Leibwächter, Gedenkstein, Rückkehr zu seiner Familie, Brief von zu Hause.
const FAMILY_SHIPS = ['Ljilje', 'Antonija', 'Marija'];

export function installCelo(World) {
  const W = World.prototype;

  W.findSpotNear = function (type, cx, cy, rMin = 3, rMax = 12) {
    for (let r = rMin; r <= rMax; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy;
      if (this.canPlace(type, x, y)) return [x, y];
    }
    return null;
  };

  // jede Spielsekunde
  W.updateCelo = function (dt) {
    for (const u of this.units) {
      if (u.dead || !u.st.celo || u.aboard) continue;
      const pl = this.P[u.owner];
      // Celos Haus neben dem Haupthaus, sobald er das erste Mal ausgebildet wurde
      if (!this.buildings.some(b => !b.dead && b.type === 'celohouse' && b.owner === u.owner)) {
        const town = this.buildings.find(b => !b.dead && b.type === 'town' && b.owner === u.owner);
        const spot = town && this.findSpotNear('celohouse', town.cx, town.cy, 3, 10);
        if (spot) this.addBuilding(u.owner, 'celohouse', spot[0], spot[1], true);
      }
      // Leibwächter: in der Nähe des Schutzziels bleiben
      const t = u.guarding && this.ents.get(u.guarding);
      if (t && !t.dead && u.order.t === 'idle') {
        const tx = t.kind === 'u' ? t.x : t.cx, ty = t.kind === 'u' ? t.y : t.cy;
        if (Math.hypot(tx - u.x, ty - u.y) > 2.5) this.groupMove([u], tx + 1, ty + 1, false);
      } else if (u.guarding && (!t || t.dead)) u.guarding = null;
      pl.celoAlive = true;
    }
    for (const pl of this.P) {
      // Rückkehr nach 3 Minuten an seinem Haus
      if (pl.celoRespawnAt && this.time >= pl.celoRespawnAt) {
        pl.celoRespawnAt = 0;
        const house = this.buildings.find(b => !b.dead && b.type === 'celohouse' && b.owner === pl.id) || this.buildings.find(b => !b.dead && b.type === 'town' && b.owner === pl.id);
        if (house && pl.alive) {
          const p = this.spawnPoint(house);
          if (p) { const u = this.addUnit(pl.id, 'inf', 'nu_yugoslavia_celo', p[0], p[1]); pl.pop += u.st.pop; this.cells[this.cellOf(u.x, u.y)].push(u); }
          this.notice(pl.id, 'Celo ist zurück bei seiner Familie.');
        }
      }
    }
    // Gedenkstein: eigene Einheiten in der Nähe schöpfen Mut
    for (const b of this.buildings) {
      if (b.dead || b.type !== 'memorial') continue;
      this.nearbyUnits(b.cx, b.cy, 6, o => { if (!o.dead && o.owner === b.owner && o.morale != null) o.morale = Math.min(100, o.morale + 2 * dt); });
    }
  };
  W.celoFallen = function (u) {
    const pl = this.P[u.owner];
    const t = u.guarding && this.ents.get(u.guarding); if (t && t.guardedBy === u.id) t.guardedBy = null;
    const spot = this.findSpotNear('memorial', u.x, u.y, 0, 6);
    if (spot && !this.buildings.some(b => !b.dead && b.type === 'memorial' && b.owner === u.owner && Math.hypot(b.x - spot[0], b.y - spot[1]) < 3)) this.addBuilding(u.owner, 'memorial', spot[0], spot[1], true);
    pl.celoRespawnAt = this.time + 180;
    this.notice(u.owner, 'Celo ist gefallen. An der Stelle steht nun ein Gedenkstein. In 3 Minuten kehrt er zu seiner Familie zurück.');
  };
  // Effekte des Ereignisses „Brief von zu Hause“
  W.celoLetter = function (pl, e) {
    const c = this.units.find(u => !u.dead && u.owner === pl.id && u.st.celo);
    if (!c) return;
    if (e.celoPause) { c.order = { t: 'idle' }; c.stunUntil = this.time + e.celoPause; }
    if (e.celoLetter) c.letterBuff = true;
  };
  // Die ersten drei jugoslawischen Kriegs- und Transportschiffe tragen die Namen der Familie
  W.nameShip = function (u, pl) {
    if (pl.nation !== 'yugoslavia' || !u.naval || u.cls === 'wrk') return;
    pl.shipNames = pl.shipNames || 0;
    if (pl.shipNames < FAMILY_SHIPS.length) u.title = FAMILY_SHIPS[pl.shipNames++];
  };
}
