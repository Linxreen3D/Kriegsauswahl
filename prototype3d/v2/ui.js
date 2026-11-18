// Spieloberfläche (Entwurf): verzierte Rahmen, 3D-gerenderte Symbole, echte Minimap.
import * as THREE from 'three';
import * as Md from './models.js';
import * as U from './units.js';
import * as TX from './textures.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BLUE = '#1f4fa8';

// ---------- 3D-Symbole ----------
let iconR, iconScene, iconCam;
function iconRenderer(envTex) {
  if (iconR) return;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  iconR = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  iconR.toneMapping = THREE.ACESFilmicToneMapping; iconR.toneMappingExposure = 0.9;
  iconR.shadowMap.enabled = true;
  iconScene = new THREE.Scene();
  iconScene.environment = new THREE.PMREMGenerator(iconR).fromScene(new RoomEnvironment(), 0.04).texture; iconScene.environmentIntensity = 0.6;
  const d = new THREE.DirectionalLight('#fff0d8', 3); d.position.set(4, 8, 6); iconScene.add(d);
  const rim = new THREE.DirectionalLight('#9ac0ff', 1.5); rim.position.set(-6, 3, -5); iconScene.add(rim);
  iconScene.add(new THREE.HemisphereLight('#ffffff', '#554433', 0.6));
  iconCam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
}
function icon(obj, { yaw = 0.6, pitch = 0.45, zoom = 1, focusY = 0.5 } = {}) {
  iconScene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  ctr.y = box.min.y + size.y * focusY;
  const r = Math.max(size.x, size.y, size.z) * 0.62 / zoom;
  const dist = r / Math.tan(THREE.MathUtils.degToRad(15));
  iconCam.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * dist, ctr.y + Math.sin(pitch) * dist, ctr.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  iconCam.lookAt(ctr);
  iconR.render(iconScene, iconCam);
  const url = iconR.domElement.toDataURL('image/png');
  iconScene.remove(obj);
  return url;
}

// ---------- Minimap: Draufsicht der Szene ----------
function minimap(ctx, size = 360, extent = 110) {
  const rt = new THREE.WebGLRenderTarget(size, size);
  const cam = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 1, 600);
  cam.position.set(0, 300, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const fog = ctx.scene.fog; ctx.scene.fog = null;
  ctx.renderer.setRenderTarget(rt); ctx.renderer.render(ctx.scene, cam); ctx.renderer.setRenderTarget(null);
  ctx.scene.fog = fog;
  const px = new Uint8Array(size * size * 4); ctx.renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const s = ((size - 1 - y) * size + x) * 4, d = (y * size + x) * 4; for (let k = 0; k < 3; k++) img.data[d + k] = Math.min(255, Math.pow(px[s + k] / 255, 0.75) * 255); img.data[d + 3] = 255; }
  g.putImageData(img, 0, 0);
  const toMap = (x, z) => [(x + extent) / (2 * extent) * size, (z + extent) / (2 * extent) * size];
  // Einheiten-Punkte
  const dot = (x, z, col, r = 2.4) => { const [a, b] = toMap(x, z); g.fillStyle = col; g.beginPath(); g.arc(a, b, r, 0, 6.3); g.fill(); };
  for (let k = 0; k < 90; k++) dot(-13 + (k % 15) * 1.8, 18 + Math.floor(k / 15) * 1.6, '#4f8cff', 1.6);
  for (let k = 0; k < 14; k++) dot(22 + (k % 4) * 2.6, 14 + Math.floor(k / 4) * 3.2, '#4f8cff', 2);
  for (let k = 0; k < 30; k++) dot(-7 + (k % 8) * 1.8, 12 + Math.floor(k / 8) * 1.4, '#ff4a3a', 1.6);
  // Nebel des Krieges an den Rändern
  const fogG = g.createRadialGradient(size * 0.5, size * 0.55, size * 0.25, size * 0.5, size * 0.55, size * 0.62);
  fogG.addColorStop(0, 'rgba(0,0,0,0)'); fogG.addColorStop(1, 'rgba(8,10,14,0.85)');
  g.fillStyle = fogG; g.fillRect(0, 0, size, size);
  // Kamera-Ausschnitt
  const [a, b] = toMap(-34, -36), [c2, d2] = toMap(36, 40);
  g.strokeStyle = 'rgba(255,240,200,0.95)'; g.lineWidth = 2; g.strokeRect(a, b, c2 - a, d2 - b);
  // Warnung
  const [wx, wy] = toMap(0, 4); g.strokeStyle = '#ff3a2a'; g.lineWidth = 2.5; g.beginPath(); g.arc(wx, wy, 14, 0, 6.3); g.stroke();
  return c.toDataURL();
}

// ---------- Auswahlringe in der 3D-Szene ----------
function selectionRings(ctx) {
  const ring = new THREE.RingGeometry(1.05, 1.25, 32); ring.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.85, depthWrite: false });
  const bar = (k) => { const g = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshBasicMaterial({ color: '#141414', depthTest: false })); const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.52 * k, 0.15), new THREE.MeshBasicMaterial({ color: k > 0.5 ? '#5be05b' : '#e8c03a', depthTest: false })); fg.position.set(-(1.52 - 1.52 * k) / 2, 0, 0.01); bg.renderOrder = fg.renderOrder = 20; g.add(bg, fg); return g; };
  const r = TX.rng(4);
  for (let k = 0; k < 14; k++) {
    const x = 22 + (k % 4) * 2.6 + r(), z = 14 + Math.floor(k / 4) * 3.2 + r();
    // Höhe über Raycast
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(ctx.scene.children.filter(o => o.isMesh && o.geometry.attributes.splat), false)[0];
    const y = hit ? hit.point.y : 1;
    const m = new THREE.Mesh(ring, mat); m.position.set(x, y + 0.08, z); m.renderOrder = 5; ctx.scene.add(m);
    const b = bar(0.45 + ((k * 37) % 50) / 100); b.position.set(x, y + 3.6, z); b.quaternion.copy(ctx.camera.quaternion); ctx.scene.add(b);
  }
}

// ---------- Oberfläche ----------
const SVG = {
  attack: '<path d="M6 42 L30 18 M22 10 L38 26 M30 18 L40 8 L44 4 L42 12 L32 22" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M8 34 L14 40" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
  stop: '<rect x="12" y="12" width="24" height="24" rx="3" fill="currentColor"/>',
  guard: '<path d="M24 5 L40 11 V24 C40 34 32 41 24 44 C16 41 8 34 8 24 V11 Z" fill="none" stroke="currentColor" stroke-width="4"/>',
  patrol: '<path d="M10 30 A14 14 0 1 1 24 38" fill="none" stroke="currentColor" stroke-width="4"/><path d="M6 24 L10 32 L18 28" fill="currentColor"/>',
  formation: '<g fill="currentColor"><circle cx="12" cy="14" r="4"/><circle cx="24" cy="14" r="4"/><circle cx="36" cy="14" r="4"/><circle cx="12" cy="28" r="4"/><circle cx="24" cy="28" r="4"/><circle cx="36" cy="28" r="4"/></g><path d="M8 40 H40" stroke="currentColor" stroke-width="3"/>',
  sword: '<path d="M10 38 L34 14 M30 10 L38 18 M12 30 L18 36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  shield: '<path d="M24 6 L38 12 V24 C38 33 31 39 24 42 C17 39 10 33 10 24 V12 Z" fill="currentColor"/>',
  heart: '<path d="M24 40 C10 30 6 22 10 15 C14 9 21 10 24 16 C27 10 34 9 38 15 C42 22 38 30 24 40 Z" fill="currentColor"/>',
  boot: '<path d="M16 8 H28 V28 L40 32 V40 H12 Z" fill="currentColor"/>',
  eye: '<path d="M4 24 C12 12 36 12 44 24 C36 36 12 36 4 24 Z" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="24" cy="24" r="6" fill="currentColor"/>',
  menu: '<path d="M10 14 H38 M10 24 H38 M10 34 H38" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  flag: '<path d="M12 6 V42" stroke="currentColor" stroke-width="4"/><path d="M14 8 H38 L32 16 L38 24 H14 Z" fill="currentColor"/>',
  chat: '<path d="M8 10 H40 V32 H22 L12 40 V32 H8 Z" fill="none" stroke="currentColor" stroke-width="3.5"/>',
  pop: '<g fill="currentColor"><circle cx="17" cy="15" r="6"/><circle cx="31" cy="15" r="6"/><path d="M5 38 C5 26 29 26 29 38 Z"/><path d="M19 38 C19 26 43 26 43 38 Z" opacity=".8"/></g>',
};
const svg = (k, s = 24) => `<svg viewBox="0 0 48 48" width="${s}" height="${s}">${SVG[k]}</svg>`;

export async function buildUI(ctx, sceneName) {
  iconRenderer(ctx.scene.environment);
  // Symbole rendern
  const I = {};
  const wood = Md.woodpile(); I.wood = icon(wood, { yaw: 0.35, pitch: 0.6, zoom: 1.0 });
  const st = new THREE.Group(); for (let k = 0; k < 5; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + k * 0.05, 1), new THREE.MeshStandardMaterial({ color: '#9a958e', roughness: 0.8 })); r.position.set((k % 3) * 0.45 - 0.45, Math.floor(k / 3) * 0.4, (k % 2) * 0.3); st.add(r); } I.stone = icon(st, { zoom: 1.1 });
  const gd = new THREE.Group(); for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#f0c040', roughness: 0.25, metalness: 0.95 })); r.position.set((k % 3) * 0.32 - 0.32, Math.floor(k / 3) * 0.12 + (k === 4 ? 0.25 : 0), (Math.floor(k / 3) - 1) * 0.3); r.rotation.set(k, k * 2, k); gd.add(r); } I.gold = icon(gd, { zoom: 1.15 });
  I.food = icon(Md.haystack(), { zoom: 1.1 });
  I.knight = icon(U.cavalry({ color: BLUE, era: 3, seed: 502 }), { yaw: 0.7, pitch: 0.2, zoom: 1.35, focusY: 0.5 });
  I.portrait = icon(U.soldier({ color: BLUE, era: 3, weapon: 'sword', shield: true, seed: 9, cape: true }), { yaw: 0.35, pitch: 0.1, zoom: 2.3, focusY: 0.74 });
  I.sword = icon(U.soldier({ color: BLUE, era: 3, weapon: 'sword', shield: true, seed: 3 }), { yaw: 0.5, pitch: 0.15, zoom: 1.5, focusY: 0.6 });
  I.archer = icon(U.soldier({ color: BLUE, era: 3, weapon: 'bow', seed: 7, pose: 'aim' }), { yaw: 0.9, pitch: 0.15, zoom: 1.4, focusY: 0.6 });
  I.treb = icon(Md.trebuchet(BLUE), { yaw: 0.9, pitch: 0.3 });
  I.house = icon(Md.halfTimberHouse(BLUE, 3), { yaw: 0.7, pitch: 0.4 });
  I.barracks = icon(Md.barracksB(BLUE), { yaw: 0.6, pitch: 0.45 });
  I.tower = icon(Md.roundTower(BLUE, 7, 1.5), { yaw: 0.6, pitch: 0.3 });
  I.keep = icon(Md.keep(BLUE), { yaw: 0.7, pitch: 0.35 });
  I.mill = icon(Md.windmill(BLUE), { yaw: 0.4, pitch: 0.25 });
  I.market = icon(Md.marketStall(BLUE, 2), { yaw: 0.6, pitch: 0.4 });
  I.wall = icon(Md.wallSeg(6), { yaw: 0.6, pitch: 0.4 });
  I.gate = icon(Md.gatehouse(BLUE), { yaw: 0.5, pitch: 0.35 });
  I.field = icon(Md.field(6, 5, 2, true), { yaw: 0.6, pitch: 0.6 });

  selectionRings(ctx);
  const mm = minimap(ctx);
  ctx.composer.render();

  // Panel-Textur (dunkles, gemasertes Holz/Leder)
  const pl = TX.plankTex(256, '#3a2618'); const panelTex = pl.canvas.toDataURL();
  const st2 = TX.stoneWallTex(256, '#6a645a'); const stoneTex = st2.canvas.toDataURL();
  const css = `
  :root{--gold1:#f6dc8c;--gold2:#c8952e;--gold3:#7a5418;--ink:#f3e6c4;}
  .hud{position:absolute;inset:0;font-family:'Cinzel','Trajan Pro',Georgia,serif;color:var(--ink);pointer-events:none}
  .frame{position:relative;background:linear-gradient(180deg,rgba(40,26,14,.88),rgba(22,14,8,.93)),url(${panelTex});background-size:auto,180px;
    border:2px solid var(--gold2);box-shadow:0 0 0 1px #000,0 0 0 4px rgba(122,84,24,.9),0 0 0 5px #000,inset 0 0 18px rgba(0,0,0,.8),0 12px 30px rgba(0,0,0,.6);border-radius:6px}
  .frame:before,.frame:after{content:'';position:absolute;width:26px;height:26px;border:3px solid var(--gold1);filter:drop-shadow(0 0 2px #000)}
  .frame:before{left:-6px;top:-6px;border-right:none;border-bottom:none;border-radius:4px 0 0 0}
  .frame:after{right:-6px;bottom:-6px;border-left:none;border-top:none;border-radius:0 0 4px 0}
  .gemL,.gemR{position:absolute;top:50%;width:14px;height:14px;background:radial-gradient(circle at 35% 35%,#ff9a8a,#a8160c 60%,#3a0400);border:2px solid var(--gold1);transform:translateY(-50%) rotate(45deg);box-shadow:0 0 6px #000}
  .gemL{left:-9px}.gemR{right:-9px}
  .top{position:absolute;top:10px;left:50%;transform:translateX(-50%);height:62px;display:flex;align-items:center;gap:6px;padding:0 26px}
  .res{display:flex;align-items:center;gap:8px;padding:4px 14px 4px 6px;font-size:24px;font-weight:700;text-shadow:0 2px 3px #000;letter-spacing:.02em}
  .res img{width:46px;height:46px;filter:drop-shadow(0 2px 3px #000)}
  .res small{font-size:14px;color:#9fd27a;margin-left:2px}
  .sep{width:2px;height:40px;background:linear-gradient(transparent,var(--gold2),transparent)}
  .crest{position:absolute;top:2px;left:50%;transform:translateX(-50%);width:120px;height:132px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
  .crest .sh{width:92px;height:104px;background:linear-gradient(160deg,#2a4f9a,#12285a);border:3px solid var(--gold1);clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%);display:grid;place-items:center;box-shadow:inset 0 0 20px #000}
  .crest .sh span{font-size:30px;font-weight:900;color:var(--gold1);text-shadow:0 2px 4px #000;margin-top:-18px}
  .crest .lbl{margin-top:-6px;padding:2px 14px;background:linear-gradient(#8a1a12,#4a0a06);border:2px solid var(--gold2);font-size:14px;font-weight:700;letter-spacing:.12em;white-space:nowrap;box-shadow:0 3px 8px #000}
  .topwrap{position:absolute;top:0;left:0;right:0;height:84px;display:flex;justify-content:space-between;align-items:flex-start;padding:10px 18px}
  .tl,.tr{display:flex;gap:10px;align-items:center;height:62px;padding:0 18px}
  .btn{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:var(--gold1);background:radial-gradient(circle at 40% 35%,#5a3a1e,#1a0e06);border:2px solid var(--gold2);box-shadow:0 0 0 2px #000,0 4px 8px rgba(0,0,0,.6)}
  .clock{font-size:22px;font-weight:700;text-shadow:0 2px 3px #000}
  .notice{position:absolute;top:150px;left:50%;transform:translateX(-50%);padding:12px 40px;font-size:22px;font-weight:700;letter-spacing:.06em;color:#ffe6c0;text-shadow:0 2px 4px #000;
    background:linear-gradient(90deg,transparent,rgba(120,14,8,.92) 15%,rgba(120,14,8,.92) 85%,transparent);border-top:2px solid var(--gold2);border-bottom:2px solid var(--gold2)}
  .bottom{position:absolute;left:14px;right:14px;bottom:12px;height:250px;display:flex;gap:16px;align-items:flex-end}
  .mm{width:262px;height:262px;padding:10px;flex:none;border-radius:50% 50% 6px 6px/14% 14% 6px 6px}
  .mm img{width:100%;height:100%;border:2px solid #000;border-radius:44% 44% 4px 4px/12% 12% 4px 4px;display:block}
  .mmbtns{position:absolute;right:-12px;top:30px;display:flex;flex-direction:column;gap:8px}
  .mmbtns .btn{width:38px;height:38px}
  .sel{flex:1;height:226px;padding:16px 22px;display:flex;gap:20px}
  .port{width:190px;height:190px;flex:none;border:3px solid var(--gold2);border-radius:8px;background:radial-gradient(circle at 50% 35%,#4a6aa8,#0e1a34 70%);box-shadow:inset 0 0 25px #000,0 0 0 2px #000;overflow:hidden;position:relative}
  .port img{width:100%;height:100%;object-fit:cover}
  .port .lv{position:absolute;left:6px;bottom:6px;padding:1px 9px;background:#000a;border:1px solid var(--gold2);border-radius:3px;font-size:14px;color:var(--gold1)}
  .info{flex:1;min-width:0;display:flex;flex-direction:column}
  .info h2{margin:0;font-size:30px;letter-spacing:.06em;color:var(--gold1);text-shadow:0 2px 3px #000}
  .info .sub{font-family:Georgia,serif;font-style:italic;color:#c8b48a;font-size:16px;margin-bottom:8px}
  .hp{height:16px;border:2px solid #000;outline:1px solid var(--gold3);background:#2a0c08;border-radius:3px;overflow:hidden;width:440px}
  .hp i{display:block;height:100%;width:72%;background:linear-gradient(#8ef08e,#2f9a2f)}
  .stats{display:flex;gap:22px;margin:10px 0 8px;font-size:19px;font-weight:700;text-shadow:0 2px 3px #000}
  .stats span{display:flex;align-items:center;gap:6px;color:var(--ink)} .stats svg{color:var(--gold1)}
  .group{display:flex;gap:6px}
  .gi{width:62px;height:62px;border:2px solid var(--gold3);border-radius:6px;background:radial-gradient(circle at 50% 40%,#3a5590,#0e1a34);position:relative;box-shadow:0 0 0 1px #000}
  .gi img{width:100%;height:100%;object-fit:cover}
  .gi b{position:absolute;right:3px;bottom:0;font-size:16px;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000}
  .gi i{position:absolute;left:3px;right:3px;bottom:3px;height:4px;background:#2a0c08}.gi i:after{content:'';display:block;height:100%;width:80%;background:#5be05b}
  .gi.on{border-color:var(--gold1);box-shadow:0 0 0 1px #000,0 0 10px rgba(246,220,140,.7)}
  .cmd{width:470px;height:226px;padding:14px;flex:none;display:grid;grid-template-columns:repeat(5,1fr);gap:9px}
  .c{position:relative;border:2px solid var(--gold3);border-radius:6px;background:radial-gradient(circle at 50% 35%,#4a3420,#140c06);box-shadow:inset 0 0 10px #000,0 0 0 1px #000;display:grid;place-items:center;color:var(--gold1);overflow:hidden}
  .c img{width:112%;height:112%;object-fit:cover}
  .c .k{position:absolute;left:4px;top:1px;font-family:Georgia;font-size:13px;color:#e8d7a8;text-shadow:0 0 3px #000}
  .c.hot{border-color:var(--gold1);box-shadow:inset 0 0 10px #000,0 0 0 1px #000,0 0 12px rgba(246,220,140,.6)}
  .c.dim{filter:grayscale(.8) brightness(.55)}
  .tip{position:absolute;right:500px;bottom:200px;width:320px;padding:14px 16px;font-family:Georgia,serif}
  .tip h4{margin:0 0 4px;font-family:inherit;color:var(--gold1);font-size:20px}
  .tip p{margin:0 0 8px;font-size:14px;color:#d8c8a0;line-height:1.35}
  .tip .cost{display:flex;gap:14px;font-size:18px;font-weight:700}.tip .cost span{display:flex;align-items:center;gap:4px}.tip .cost img{width:30px;height:30px}
  .players{position:absolute;top:96px;right:18px;width:300px;padding:12px 14px;font-family:Georgia,serif}
  .players h5{margin:0 0 6px;font-family:'Cinzel',serif;color:var(--gold1);font-size:15px;letter-spacing:.14em}
  .pl{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(200,149,46,.25);font-size:15px}
  .pl .sw{width:16px;height:16px;border:1px solid var(--gold2);transform:rotate(45deg)}
  .pl .nm{flex:1}.pl .sc{color:var(--gold1);font-weight:700}
  `;
  const res = [['food', 1460, '+18'], ['wood', 920, '+12'], ['stone', 455, '+4'], ['gold', 1120, '+9']];
  const cmdItems = [
    { svg: 'attack', k: 'A', hot: true }, { svg: 'stop', k: 'S' }, { svg: 'guard', k: 'D' }, { svg: 'patrol', k: 'F' }, { svg: 'formation', k: 'G' },
    { img: I.knight, k: 'Q' }, { img: I.sword, k: 'W' }, { img: I.archer, k: 'E' }, { img: I.treb, k: 'R' }, { img: I.gate, k: 'T', dim: true },
    { img: I.house, k: 'Y' }, { img: I.barracks, k: 'X' }, { img: I.tower, k: 'C' }, { img: I.mill, k: 'V' }, { img: I.keep, k: 'B', dim: true },
  ];
  const html = `<style>${css}</style><div class="hud">
    <div class="topwrap">
      <div class="frame tl"><div class="btn">${svg('menu')}</div><div class="btn">${svg('chat')}</div><div class="btn">${svg('flag')}</div><span class="clock">⌛ 24:17</span><span class="gemR"></span></div>
      <div class="frame tr"><span class="gemL"></span><div class="res"><span>${svg('pop', 34)}</span>148<small>/180</small></div></div>
    </div>
    <div class="frame top"><span class="gemL"></span>${res.slice(0, 2).map(([k, v, d]) => `<div class="res"><img src="${I[k]}">${v}<small>${d}</small></div><div class="sep"></div>`).join('')}
      <div style="width:150px"></div>${res.slice(2).map(([k, v, d]) => `<div class="sep"></div><div class="res"><img src="${I[k]}">${v}<small>${d}</small></div>`).join('')}<span class="gemR"></span></div>
    <div class="crest"><div class="sh"><span>IV</span></div><div class="lbl">MITTELALTER</div></div>
    <div class="notice">⚔ Das Haupttor wird angegriffen!</div>
    <div class="frame players"><h5>NATIONEN</h5>
      ${[['Blaues Königreich (Du)', '#1f4fa8', 4210], ['Rote Krone', '#b8261c', 3880], ['Grünes Kaiserreich', '#1f7a3a', 3105], ['Goldene Horde', '#d8a020', 2470]].map(([n, c, s]) => `<div class="pl"><span class="sw" style="background:${c}"></span><span class="nm">${n}</span><span class="sc">${s}</span></div>`).join('')}</div>
    <div class="bottom">
      <div class="frame mm"><img src="${mm}"><div class="mmbtns"><div class="btn">${svg('eye', 20)}</div><div class="btn">${svg('flag', 20)}</div></div></div>
      <div class="frame sel"><span class="gemL"></span>
        <div class="port"><img src="${I.portrait}"><span class="lv">★★★</span></div>
        <div class="info"><h2>RITTER ×14</h2><div class="sub">Schwere Reiterei · Blaues Königreich · Veteranen</div>
          <div class="hp"><i></i></div>
          <div class="stats"><span>${svg('heart', 22)} 1.840/2.520</span><span>${svg('sword', 22)} 24</span><span>${svg('shield', 22)} 8</span><span>${svg('boot', 22)} 2,8</span><span>${svg('eye', 22)} 9</span></div>
          <div class="group"><div class="gi on"><img src="${I.knight}"><b>14</b><i></i></div><div class="gi"><img src="${I.sword}"><b>45</b><i></i></div><div class="gi"><img src="${I.archer}"><b>30</b><i></i></div><div class="gi"><img src="${I.treb}"><b>3</b><i></i></div></div>
        </div></div>
      <div class="frame cmd"><span class="gemL"></span>${cmdItems.map(c => `<div class="c ${c.hot ? 'hot' : ''} ${c.dim ? 'dim' : ''}"><span class="k">${c.k}</span>${c.img ? `<img src="${c.img}">` : svg(c.svg, 40)}</div>`).join('')}</div>
    </div>
    <div class="frame tip"><h4>Ritter ausbilden</h4><p>Schwer gepanzerte Reiterei. Stark gegen Schützen und Belagerungswaffen, schwach gegen Pikeniere.</p>
      <div class="cost"><span><img src="${I.food}">90</span><span><img src="${I.gold}">75</span><span>⌛ 26 s</span></div></div>
  </div>`;
  const ui = document.getElementById('ui');
  ui.style.cssText = 'position:absolute;inset:0;width:1920px;height:1080px';
  ui.innerHTML = html;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&display=swap'; document.head.appendChild(link);
  await document.fonts.ready.catch(() => {});
  await new Promise(r => setTimeout(r, 800));
}
