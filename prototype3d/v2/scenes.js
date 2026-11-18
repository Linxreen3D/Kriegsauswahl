import * as THREE from 'three';
import * as W from './world.js';
import * as Md from './models.js';
import { rng } from './textures.js';

const RED = '#b8261c', BLUE = '#1f4fa8', GREEN = '#1f7a3a', GOLD = '#d8a020';

function placer(scene, T) {
  return (o, x, z, ry = 0, s = 1, dy = 0) => { o.position.set(x, T.height(x, z) + dy, z); o.rotation.y = ry; if (s !== 1) o.scale.multiplyScalar(s); scene.add(o); return o; };
}
function ring(cx, cz, R, n, off = Math.PI / n) { const p = []; for (let k = 0; k < n; k++) { const a = off + k / n * Math.PI * 2; p.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } return p; }
function walls(P, corners, color, gateEdge = -1) {
  for (let k = 0; k < corners.length; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % corners.length];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    if (k === gateEdge) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, side = (len - 9.5) / 2;
      for (const s of [-1, 1]) { const cx = mx + Math.cos(ang) * s * (4.75 + side / 2), cz = mz + Math.sin(ang) * s * (4.75 + side / 2); P(Md.wallSeg(side), cx, cz, -ang); }
      P(Md.gatehouse(color), mx, mz, -ang);
    } else P(Md.wallSeg(len - 2.6), (ax + bx) / 2, (az + bz) / 2, -ang);
    P(Md.roundTower(color, 7.5, 1.7), ax, az);
  }
}

// ---------- Belagerung einer Stadt ----------
export function siege(ctx) {
  const { scene, camera } = ctx;
  const town = [0, -16], R = 24;
  const T = W.createTerrain(scene, {
    seed: 21, hills: 0.9, river: [[-140, -40], [-70, -55], [-30, -70], [40, -78], [140, -70]], riverW: 8,
    flats: [[town[0], town[1], R + 6, 1.4], [0, 22, 28, 1.2]],
    dirt: [[0, -16, 14], [0, 4, 6], [-6, 26, 18], [8, 30, 14]],
    paths: [[[0, -16], [0, 8], [6, 45]], [[-20, -10], [-55, 5]]],
    mountains: [[-110, -130, 70, 40], [90, -140, 60, 34], [150, 40, 50, 20]],
  });
  W.createWater(scene, ctx.sunDir);
  const P = placer(scene, T), r = rng(4);
  const inTown = (x, z) => Math.hypot(x - town[0], z - town[1]) < R + 4;
  const army = (x, z) => z > 6 && z < 48 && Math.abs(x) < 40;
  // Stadt
  const corners = ring(town[0], town[1], R, 8, Math.PI / 8);
  walls(P, corners, RED, 1);
  P(Md.keep(RED), 0, -20, 0);
  const houses = [[-12, -26], [-15, -16], [-12, -7], [-6, -2], [8, -3], [13, -9], [15, -19], [11, -29], [-4, -33], [5, -33], [-18, -24], [17, -27]];
  houses.forEach(([x, z], i) => P(i % 4 === 3 ? Md.cottage(RED, i) : Md.halfTimberHouse(RED, i, { w: 3.6 + r() * 1.4, d: 3.2 + r() * 0.6, floors: 1 + (i % 3 ? 1 : 0), roof: i % 5 === 0 ? 'slate' : 'red' }), x, z, Math.atan2(-x, -(z + 16)) + Math.PI, 1));
  for (let k = 0; k < 4; k++) P(Md.marketStall(RED, k), -4 + k * 2.8, -6, 0);
  P(Md.well(), 4, -10);
  for (let k = 0; k < 8; k++) P(k % 2 ? Md.barrel() : Md.crate(), -6 + r() * 12, -9 + r() * 4, r() * 6);
  P(Md.cart(), 6, -6, 1.2);
  // Brände in der Stadt
  P(Md.fire(1.6, 1), 8, -3, 0, 1, 6.5); P(Md.smoke(1.5, 2), 8.5, -3, 0, 1, 7);
  P(Md.fire(1.4, 7), 13, -9, 0, 1, 6); P(Md.smoke(1.4, 8), 13.5, -9, 0, 1, 7);
  P(Md.fire(1.2, 3), -15, -16, 0, 1, 3.6); P(Md.smoke(1.3, 4), -14.5, -16, 0, 1, 5);
  // Verteidiger auf den Mauern
  for (let k = 0; k < 8; k++) {
    if (k === 1) continue;
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 8];
    for (let j = 1; j <= 3; j++) { const t = j / 4, x = ax + (bx - ax) * t, z = az + (bz - az) * t; const s = Md.soldier({ color: RED, era: 3, weapon: 'bow', seed: 100 + k * 5 + j, pose: 'aim' }); P(s, x, z, Math.atan2(x - town[0], z - town[1]), 1, 4.2); }
  }
  // Verteidiger vor dem Tor
  for (let k = 0; k < 24; k++) P(Md.soldier({ color: RED, era: 3, weapon: k % 3 ? 'sword' : 'pike', seed: 200 + k, shield: k % 3 !== 0, pose: k % 2 ? 'attack' : 'idle' }), -7 + (k % 8) * 1.8 + r() * 0.4, 12 + Math.floor(k / 8) * 1.4 + r() * 0.4, 0.05);
  // Angreifer (Blau)
  for (let k = 0; k < 60; k++) P(Md.soldier({ color: BLUE, era: 3, weapon: k % 4 === 0 ? 'axe' : 'sword', seed: 300 + k, shield: true, pose: k % 3 ? 'attack' : 'walk', cape: k % 10 === 0 }), -13 + (k % 15) * 1.8 + r() * 0.5, 18 + Math.floor(k / 15) * 1.5 + r() * 0.5, Math.PI + (r() - 0.5) * 0.3);
  for (let k = 0; k < 30; k++) P(Md.soldier({ color: BLUE, era: 3, weapon: 'bow', seed: 400 + k, pose: 'aim' }), -18 + (k % 15) * 2.4 + r() * 0.5, 28 + Math.floor(k / 15) * 1.6, Math.PI);
  for (let k = 0; k < 14; k++) P(Md.cavalry({ color: BLUE, era: 3, seed: 500 + k }), 22 + (k % 4) * 2.6 + r(), 14 + Math.floor(k / 4) * 3.2 + r(), Math.PI - 0.6);
  for (let k = 0; k < 10; k++) P(Md.cavalry({ color: RED, era: 3, seed: 600 + k }), -22 - (k % 4) * 2.6, 13 + Math.floor(k / 4) * 3, 0.5);
  for (const [x, z] of [[-10, 38], [4, 40], [16, 37]]) P(Md.trebuchet(BLUE), x, z, Math.PI);
  P(Md.banner(BLUE, 3.4, 1.4, 2.0, 0.35), 0, 33); P(Md.banner(BLUE, 3.4, 1.4, 2.0, 0.35), 10, 31);
  // Pfeile
  for (let k = 0; k < 60; k++) { const a = Md.arrow(); a.position.set(-20 + r() * 40, 6 + r() * 6, 2 + r() * 20); a.rotation.set(-0.35 + (k % 2) * 0.7, k % 2 ? 0 : Math.PI, 0); scene.add(a); }
  // Felder & Mühle draußen
  for (let k = 0; k < 4; k++) P(Md.field(9, 7, k, k % 2 === 0), -48 + (k % 2) * 11, -6 + Math.floor(k / 2) * 9, 0.15);
  P(Md.windmill(RED, 0.5), -40, -20, 0.6); P(Md.haystack(), -36, 8); P(Md.haystack(), -33, 10);
  P(Md.cottage(RED, 9), -58, -14, 0.4); P(Md.woodpile(), -54, -10, 0.4);
  // Natur
  const avoid = (x, z) => inTown(x, z) || army(x, z) || (x < -28 && x > -64 && z > -26 && z < 18);
  const kinds = W.makeTreeKinds();
  let spots = [].concat(W.forestSpots(T, 50, -10, 26, 650, 1, avoid), W.forestSpots(T, -45, 45, 28, 600, 2, avoid), W.forestSpots(T, 0, -60, 40, 700, 3, avoid, 0.6), W.forestSpots(T, 70, 40, 25, 400, 5, avoid), W.forestSpots(T, -80, -30, 25, 400, 6, avoid));
  W.plantForest(scene, T, kinds, spots);
  W.plantGrass(scene, T, 45000, [-110, -90, 110, 90], (x, z) => inTown(x, z) || (Math.abs(x) < 30 && z > 8 && z < 45));
  W.bushes(scene, T, 700, [-110, -90, 110, 90], avoid);
  W.scatterRocks(scene, T, 260, [-110, -90, 110, 90], avoid);
  camera.fov = 36; camera.updateProjectionMatrix();
  camera.position.set(42, 46, 74); camera.lookAt(-2, 0, 2);
}

// ---------- Wirtschaft: Dorf im Frieden ----------
export function village(ctx) {
  const { scene, camera } = ctx;
  const T = W.createTerrain(scene, {
    seed: 33, hills: 1.0, river: [[-140, 30], [-60, 18], [-25, 32], [10, 60], [60, 90]], riverW: 7,
    flats: [[8, -6, 26, 1.3]], dirt: [[8, -6, 9], [20, 8, 5], [-4, -16, 5]], paths: [[[8, -6], [30, 20], [60, 30]], [[8, -6], [-20, 8]], [[8, -6], [10, -40]]],
    mountains: [[-90, -110, 60, 38], [80, -120, 70, 42]],
  });
  W.createWater(scene, ctx.sunDir);
  const P = placer(scene, T), r = rng(8);
  const core = (x, z) => Math.hypot(x - 8, z + 6) < 24;
  P(Md.keep(RED), 8, -10, 0.1, 0.8);
  const hs = [[-6, -2], [-4, -14], [22, -2], [24, -14], [14, 8], [2, 8], [-8, 8], [30, 6], [18, -24], [-2, -26]];
  hs.forEach(([x, z], i) => P(i % 3 === 0 ? Md.cottage(RED, i) : Md.halfTimberHouse(RED, i + 20, { floors: 1 + i % 2, roof: i % 4 === 0 ? 'thatch' : 'red' }), x, z, Math.atan2(8 - x, -6 - z) + Math.PI));
  for (let k = 0; k < 3; k++) P(Md.marketStall(RED, k), 2 + k * 3, -1, 0.1);
  P(Md.well(), 14, -2); P(Md.cart(), 12, 2, 0.4); P(Md.woodpile(), -10, -8, 0.3); P(Md.woodpile(), 28, 12, 1);
  for (let k = 0; k < 10; k++) P(k % 2 ? Md.barrel() : Md.crate(), 18 + r() * 4, 2 + r() * 3, r() * 6);
  for (let k = 0; k < 6; k++) P(Md.field(9, 7, 10 + k, k % 3 !== 0), 40 + (k % 3) * 11, -14 + Math.floor(k / 3) * 9, -0.1);
  P(Md.windmill(RED, 0.2), 36, -30, 0.8); P(Md.haystack(), 50, 6); P(Md.haystack(), 53, 4);
  P(Md.barracksB(RED), -18, -22, 0.6);
  // Leben: Arbeiter, Bauern, Holzfäller, Soldaten im Training
  for (let k = 0; k < 40; k++) { const a = r() * 6.28, d = 6 + r() * 16; P(Md.soldier({ color: RED, era: 1, weapon: 'tool', seed: 700 + k, helmet: false, pose: r() < 0.5 ? 'walk' : 'idle', carry: r() < 0.4 ? ['wood', 'food', 'gold', 'stone'][k % 4] : null }), 8 + Math.cos(a) * d, -6 + Math.sin(a) * d, r() * 6); }
  for (let k = 0; k < 18; k++) P(Md.soldier({ color: RED, era: 1, weapon: 'tool', seed: 800 + k, helmet: false, pose: 'attack' }), 36 + (k % 6) * 5 + r(), -12 + Math.floor(k / 6) * 9 + r() * 2, r() * 6);
  for (let k = 0; k < 8; k++) P(Md.soldier({ color: RED, era: 1, weapon: 'axe', seed: 900 + k, helmet: false, pose: 'attack' }), -30 + r() * 6, 14 + r() * 6, r() * 6);
  for (let k = 0; k < 20; k++) P(Md.soldier({ color: RED, era: 3, weapon: k < 10 ? 'spear' : 'bow', seed: 950 + k, shield: k < 10, pose: k < 10 ? 'idle' : 'aim' }), -26 + (k % 5) * 1.5, -14 + Math.floor(k / 5) * 1.5, 0.6);
  for (let k = 0; k < 4; k++) P(Md.cavalry({ color: RED, era: 3, seed: 980 + k }), -8 + k * 3, -34, 0.3);
  const kinds = W.makeTreeKinds();
  const avoid = (x, z) => core(x, z) || (x > 32 && x < 72 && z > -24 && z < 12) || (x < -10 && x > -34 && z > -30 && z < -6);
  let spots = [].concat(W.forestSpots(T, -40, 30, 25, 600, 11, avoid), W.forestSpots(T, -50, -30, 26, 600, 12, avoid), W.forestSpots(T, 60, 40, 26, 500, 13, avoid), W.forestSpots(T, 20, -60, 30, 600, 14, avoid, 0.6));
  W.plantForest(scene, T, kinds, spots);
  W.plantGrass(scene, T, 45000, [-110, -90, 110, 90], (x, z) => core(x, z) || (x > 34 && x < 70 && z > -20 && z < 10));
  W.bushes(scene, T, 700, [-110, -90, 110, 90], avoid);
  W.scatterRocks(scene, T, 200, [-110, -90, 110, 90], avoid);
  camera.fov = 36; camera.updateProjectionMatrix();
  camera.position.set(-38, 44, 62); camera.lookAt(10, 0, -4);
}

// ---------- Asiatische Stadt & Kriegselefanten ----------
export function eastern(ctx) {
  const { scene, camera } = ctx;
  const T = W.createTerrain(scene, {
    seed: 77, hills: 0.8, flats: [[0, -18, 30, 1.4], [0, 18, 26, 1.2]], dirt: [[0, 8, 14], [0, -16, 12]],
    paths: [[[0, -16], [0, 40]]], river: [[-140, 60], [-60, 70], [40, 80], [140, 70]], mountains: [[-80, -100, 60, 45], [70, -110, 60, 50], [0, -140, 50, 40]],
  });
  W.createWater(scene, ctx.sunDir);
  const P = placer(scene, T), r = rng(12);
  // Mauer quer mit Tor
  for (let x = -40; x <= 40; x += 8) if (Math.abs(x) > 4) P(Md.wallSeg(8.4, 5, 1.8), x, -2, 0);
  P(Md.gatehouse(GREEN), 0, -2);
  for (const x of [-20, 20, -38, 38]) P(Md.roundTower(GREEN, 8, 1.8, Md.col('#2f5446', 0.7)), x, -2);
  P(Md.pagoda(GREEN, 5), 0, -24);
  P(Md.pagoda(GREEN, 3), -22, -22, 0.2); P(Md.pagoda(GREEN, 3), 22, -26, -0.2);
  for (let k = 0; k < 18; k++) { const x = -34 + (k % 9) * 8.5 + r() * 2, z = -10 - Math.floor(k / 9) * 9 - r() * 2; if (Math.abs(x) < 8 && z < -14) continue; P(Md.asianHouse(GREEN, k), x, z, (r() - 0.5) * 0.3); }
  for (let k = 0; k < 10; k++) P(Md.soldier({ color: GREEN, era: 3, weapon: 'bow', seed: 1000 + k, pose: 'aim' }), -36 + k * 8 + (k > 4 ? 2 : -2), -2.4, 0, 1, 5);
  for (let k = 0; k < 5; k++) P(Md.elephant(GREEN, k + 1), -10 + k * 5, 7, (k - 2) * 0.12);
  for (let k = 0; k < 24; k++) P(Md.soldier({ color: GREEN, era: 3, weapon: 'spear', seed: 1100 + k, shield: true, pose: 'attack' }), -12 + (k % 12) * 2, 12 + Math.floor(k / 12) * 1.4, 0);
  for (let k = 0; k < 64; k++) P(Md.soldier({ color: RED, era: 3, weapon: k % 3 === 0 ? 'pike' : 'sword', seed: 1200 + k, shield: k % 3 !== 0, pose: k % 2 ? 'attack' : 'walk' }), -18 + (k % 16) * 2.2 + r() * 0.5, 17 + Math.floor(k / 16) * 1.5 + r() * 0.4, Math.PI);
  for (let k = 0; k < 12; k++) P(Md.cavalry({ color: RED, era: 3, seed: 1300 + k }), 22 + (k % 4) * 2.6, 12 + Math.floor(k / 4) * 3, Math.PI - 0.6);
  for (const [x, z] of [[-14, 36], [0, 38], [14, 36]]) P(Md.trebuchet(RED), x, z, Math.PI);
  P(Md.fire(1.5, 5), -22, -10, 0, 1, 3); P(Md.smoke(1.6, 6), -21.5, -10, 0, 1, 5);
  for (let k = 0; k < 50; k++) { const a = Md.arrow(); a.position.set(-25 + r() * 50, 7 + r() * 6, 2 + r() * 16); a.rotation.set(-0.35 + (k % 2) * 0.7, k % 2 ? 0 : Math.PI, 0); scene.add(a); }
  const kinds = W.makeTreeKinds();
  const avoid = (x, z) => (Math.abs(x) < 46 && z > -40 && z < 46);
  let spots = [].concat(W.forestSpots(T, -70, 10, 28, 700, 21, avoid, 0.3), W.forestSpots(T, 70, 10, 28, 700, 22, avoid, 0.3), W.forestSpots(T, 0, -60, 40, 600, 23, avoid, 0.6));
  W.plantForest(scene, T, kinds, spots);
  W.plantGrass(scene, T, 40000, [-110, -90, 110, 90], (x, z) => (Math.abs(x) < 44 && z < 0 && z > -40) || (Math.abs(x) < 28 && z > 4 && z < 42));
  W.bushes(scene, T, 600, [-110, -90, 110, 90], avoid);
  camera.fov = 36; camera.updateProjectionMatrix();
  camera.position.set(-40, 44, 70); camera.lookAt(2, 0, 0);
}

export const SCENES = { siege, village, eastern };
