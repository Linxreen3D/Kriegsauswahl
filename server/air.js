// Luftkrieg: Flugzeuge fliegen geradlinig, verbrauchen Treibstoff und Munition und müssen zum Flugplatz zurück.
import { DMG } from '../shared/rules.js';

const REARM_RANGE = 3;

export function installAir(World) {
  const W = World.prototype;

  W.nearestAirfield = function (u) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.dead || !b.built || (b.type !== 'airfield' && !(b.carrier)) || !this.allied(b.owner, u.owner)) continue;
      const d = Math.hypot(b.cx - u.x, b.cy - u.y); if (d < bd) { bd = d; best = b; }
    }
    return best;
  };
  W.flyTo = function (u, tx, ty, dt) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const sp = Math.min(d, u.st.speed * dt);
    u.x = Math.max(0.3, Math.min(this.W - 0.3, u.x + dx / d * sp)); u.y = Math.max(0.3, Math.min(this.H - 0.3, u.y + dy / d * sp));
    u.dir = Math.atan2(dy, dx); u.state = 1;
    return d - sp < 0.05;
  };
  // Flugzeug-Update (ersetzt die Bodenlogik)
  W.updateAir = function (u, dt) {
    if (u.cd > 0) u.cd -= dt;
    if (u.fuel == null) { u.fuel = u.st.fuel; u.ammo = u.st.ammo; }
    const base = this.nearestAirfield(u);
    const atBase = base && Math.hypot(base.cx - u.x, base.cy - u.y) <= REARM_RANGE;
    const o = u.order;
    u.state = 0;
    // am Flugplatz: tanken und aufmunitionieren (gelandet, verbraucht nichts)
    if (atBase && (o.t === 'idle' || o.t === 'return')) {
      u.fuel = Math.min(u.st.fuel, u.fuel + u.st.fuel * 0.1 * dt);
      u.ammo = Math.min(u.st.ammo, u.ammo + Math.max(1, u.st.ammo) * 0.1 * dt);
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.02 * dt);
      if (o.t === 'return' && u.fuel >= u.st.fuel && u.ammo >= u.st.ammo) u.order = { t: 'idle' };
      return;
    }
    u.fuel -= dt;
    if (u.fuel <= 0) { this.notice(u.owner, `✈ ${u.st.name} ist ohne Treibstoff abgestürzt.`); this.kill(u, -1); return; }
    // Rückkehr, wenn Treibstoff knapp oder Munition leer
    const home = base ? Math.hypot(base.cx - u.x, base.cy - u.y) / u.st.speed + 4 : Infinity;
    if (o.t !== 'return' && base && (u.fuel <= home || (u.st.ammo > 0 && u.ammo <= 0))) { u.order = { t: 'return' }; }
    switch (u.order.t) {
      case 'return': {
        if (!base) { u.order = { t: 'idle' }; return; }
        this.flyTo(u, base.cx + ((u.id % 3) - 1) * 0.9, base.cy + base.size / 2 + 0.6, dt);
        return;
      }
      case 'move': case 'amove': {
        const m = u.order;
        if (m.t === 'amove' && u.ammo > 0) { const t = this.findTarget(u.owner, u.x, u.y, this.sightOf(u), true, u.cls); if (t) { u.order = { t: 'attack', target: t.id, resume: m }; return; } }
        if (this.flyTo(u, m.gx ?? m.x, m.gy ?? m.y, dt)) u.order = { t: 'idle' };
        return;
      }
      case 'attack': {
        const t = this.ents.get(u.order.target);
        if (!t || t.dead || u.ammo <= 0 || !this.visibleTo(u.owner, t)) { u.order = u.order.resume || { t: 'idle' }; return; }
        const tx = t.kind === 'u' ? t.x : t.cx, ty = t.kind === 'u' ? t.y : t.cy;
        const d = Math.hypot(tx - u.x, ty - u.y) - (t.kind === 'b' ? t.size / 2 : 0);
        if (d > u.st.range) { this.flyTo(u, tx, ty, dt); return; }
        // Jäger kreisen über dem Ziel, Bomber überfliegen es
        u.dir = (u.dir || 0) + dt * 1.5; u.x += Math.cos(u.dir) * u.st.speed * 0.3 * dt; u.y += Math.sin(u.dir) * u.st.speed * 0.3 * dt; u.state = 2;
        if (u.cd <= 0) {
          u.cd = u.st.cd; u.ammo--;
          this.hit(u, t, u.st.atk * this.dealMul(u, u.st.range), u.cls, u.st.splash);
          this.event({ k: 'shot', x: u.x, y: u.y, tx, ty, c: u.cls === 'bmb' ? 1 : 2 });
        }
        return;
      }
      default: { // im Leerlauf: Jäger verteidigen den Luftraum, sonst zurück zum Platz
        if (u.ammo > 0 && u.st.atk > 0) { const t = this.findTarget(u.owner, u.x, u.y, this.sightOf(u), true, u.cls); if (t) { u.order = { t: 'attack', target: t.id }; return; } }
        if (base && !atBase) u.order = { t: 'return' };
      }
    }
  };

  // ---------- Fallschirmjäger ----------
  W.paradropCommand = function (pid, units, x, y) {
    const v = this.vis && this.vis.get(this.P[pid].team);
    if (v && !v[this.idx(Math.floor(x), Math.floor(y))]) { this.notice(pid, 'Absprung nur über Gebiet, das du siehst.'); return; }
    let n = 0;
    for (const u of units) {
      if (!u.st.para) continue;
      const base = this.buildings.find(b => !b.dead && b.built && b.type === 'airfield' && b.owner === pid && Math.hypot(b.cx - u.x, b.cy - u.y) <= 6);
      if (!base) continue;
      const d = Math.hypot(x - u.x, y - u.y);
      u.aboard = 'P'; u.drop = { x: x + ((n % 4) - 1.5) * 0.8, y: y + Math.floor(n / 4) * 0.8, at: this.time + 4 + d / 8 }; u.order = { t: 'wait' };
      n++;
    }
    if (!n) this.notice(pid, 'Fallschirmjäger müssen an einem eigenen Flugplatz stehen.');
    else this.notice(pid, `🪂 ${n} Fallschirmjäger sind in der Luft.`);
  };
  W.updateParadrops = function () {
    for (const u of this.units) {
      if (u.dead || u.aboard !== 'P' || !u.drop || this.time < u.drop.at) continue;
      const p = this.nearestFree(u.drop.x, u.drop.y, 6);
      if (p) { u.x = p[0]; u.y = p[1]; }
      u.aboard = null; u.drop = null; u.order = { t: 'idle' };
      this.cells[this.cellOf(u.x, u.y)].push(u);
      this.event({ k: 'paradrop', x: u.x, y: u.y, o: u.owner });
    }
  };
  // Flak-Gebäude nutzt die Flak-Schadenszeile
  W.bldDamage = function (b, t) { const row = DMG[b.st.dmgRow || 'bld']; return b.st.atk * (row[t.cls] ?? 1) * (b.st.vsShip && (t.cls === 'shp' || t.cls === 'sub') ? b.st.vsShip : 1); };
}
