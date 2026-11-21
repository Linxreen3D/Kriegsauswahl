import http from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const cache = new Map();
function serveFile(req, res, file) {
  let entry = cache.get(file);
  const mtime = statSync(file).mtimeMs;
  if (!entry || entry.mtime !== mtime) {
    const raw = readFileSync(file);
    entry = { mtime, raw, gz: raw.length > 1024 ? gzipSync(raw, { level: 9 }) : null, etag: '"' + mtime.toString(36) + raw.length.toString(36) + '"' };
    cache.set(file, entry);
  }
  const headers = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', ETag: entry.etag, 'Cache-Control': 'no-cache' };
  if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers); return res.end(); }
  if (entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return res.end(entry.gz);
  }
  res.writeHead(200, headers);
  res.end(entry.raw);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path === '/health') { res.writeHead(200); return res.end('ok'); }
  // Liste aller vorhandenen Blender-Modelle (public/assets/models/**/*.glb), damit der Client sie statt der Platzhalter lädt
  if (path === '/assets/models/index.json') {
    const base = join(ROOT, 'public', 'assets', 'models'), out = [];
    const walk = (dir, rel) => { if (!existsSync(dir)) return; for (const f of readdirSync(dir, { withFileTypes: true })) { if (f.isDirectory()) walk(join(dir, f.name), rel + f.name + '/'); else if (f.name.endsWith('.glb')) out.push(rel + f.name); } };
    walk(base, '');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(out));
  }
  // Vorhandene Führer-Porträts (public/assets/leaders/<id>.png)
  if (path === '/assets/leaders/index.json') {
    const dir = join(ROOT, 'public', 'assets', 'leaders');
    const out = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)) : [];
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(out));
  }
  if (path === '/') path = '/index.html';
  // /shared/* -> shared/, /vendor/three/* -> node_modules/three/, sonst public/
  const routes = [['/shared/', join(ROOT, 'shared')], ['/vendor/three/', join(ROOT, 'node_modules', 'three')]];
  const route = routes.find(([pre]) => path.startsWith(pre));
  const base = route ? route[1] : join(ROOT, 'public');
  const file = normalize(join(base, route ? path.slice(route[0].length) : path));
  if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Nicht gefunden');
  }
  serveFile(req, res, file);
});

const rooms = new Map();
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); } while (rooms.has(c));
  return c;
}

const wss = new WebSocketServer({ server, perMessageDeflate: { threshold: 512 }, maxPayload: 64 * 1024 });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let budget = 60; // einfacher Spam-Schutz: max. ~60 Nachrichten pro Sekunde
  const refill = setInterval(() => { budget = 60; }, 1000);
  ws.on('message', data => {
    if (--budget < 0) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') return ws.send(JSON.stringify({ t: 'pong', c: msg.c }));
    if (msg.t === 'create') {
      if (ws.room) ws.room.leave(ws);
      const room = new Room(makeCode(), r => rooms.delete(r.code));
      rooms.set(room.code, room);
      room.addHuman(ws, msg.name);
      return;
    }
    if (msg.t === 'join') {
      const room = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!room) return ws.send(JSON.stringify({ t: 'error', text: 'Raum nicht gefunden.', fatal: true }));
      if (ws.room) ws.room.leave(ws);
      if (msg.token && room.reconnect(ws, msg.token)) return;
      room.addHuman(ws, msg.name);
      return;
    }
    if (msg.t === 'leave') { if (ws.room) ws.room.leave(ws); return; }
    if (ws.room) ws.room.handle(ws, msg);
  });
  ws.on('close', () => { clearInterval(refill); if (ws.room) ws.room.disconnect(ws); });
  ws.on('error', () => {});
});
// Tote Verbindungen erkennen
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`Frontlinien läuft auf http://localhost:${PORT}`);
});
