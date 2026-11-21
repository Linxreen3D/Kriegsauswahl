// Relais für Mehrspieler über Steam: leitet die WebSocket-Verbindungen des Spiels durch einen
// Paketkanal (Steam-P2P). Der Kanal ist austauschbar (Transport), damit sich alles ohne Steam testen lässt.
//
// Transport: { selfId: string, send(peerId, Buffer): boolean, onPacket(handler(peerId, Buffer)), close() }
//
// Rahmen: 1 Byte Art ('o' öffnen, 'd' Daten, 'z' Daten komprimiert, 'x' schließen) + 4 Byte Verbindungsnummer + Nutzdaten
import { WebSocket, WebSocketServer } from 'ws';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const frame = (kind, conn, payload = Buffer.alloc(0)) => {
  const b = Buffer.allocUnsafe(5 + payload.length);
  b.write(kind, 0, 'latin1'); b.writeUInt32BE(conn, 1); payload.copy(b, 5);
  return b;
};
const encode = text => {
  const raw = Buffer.from(text, 'utf8');
  if (raw.length < 1024) return ['d', raw];
  const z = deflateRawSync(raw, { level: 3 });
  return z.length < raw.length ? ['z', z] : ['d', raw];
};
const parse = buf => ({ kind: String.fromCharCode(buf[0]), conn: buf.readUInt32BE(1), body: buf.subarray(5) });
const decode = (kind, body) => (kind === 'z' ? inflateRawSync(body) : body).toString('utf8');

// Gastgeber: jede entfernte Verbindung wird zu einer echten WebSocket-Verbindung zum eigenen Spielserver
export function hostRelay(transport, localUrl, { allow = () => true, log = () => {} } = {}) {
  const conns = new Map(); // key peer|conn -> { ws, queue }
  const key = (peer, c) => peer + '|' + c;
  transport.onPacket((peer, buf) => {
    if (!allow(peer)) return;
    const { kind, conn, body } = parse(buf), k = key(peer, conn);
    if (kind === 'o') {
      if (conns.has(k)) return;
      const ws = new WebSocket(localUrl), entry = { ws, queue: [] };
      conns.set(k, entry);
      ws.on('open', () => { for (const m of entry.queue) ws.send(m); entry.queue = []; });
      ws.on('message', (data, isBinary) => { const [kd, p] = encode(isBinary ? data.toString('utf8') : data.toString()); transport.send(peer, frame(kd, conn, p)); });
      ws.on('close', () => { if (conns.get(k) === entry) { conns.delete(k); transport.send(peer, frame('x', conn)); } });
      ws.on('error', e => log('Relais (Gastgeber): ' + e.message));
      log(`Verbindung ${conn} von ${peer} geöffnet`);
    } else if (kind === 'd' || kind === 'z') {
      const e = conns.get(k); if (!e) return;
      const text = decode(kind, body);
      if (e.ws.readyState === 1) e.ws.send(text); else e.queue.push(text);
    } else if (kind === 'x') {
      const e = conns.get(k); if (!e) return;
      conns.delete(k); e.ws.close();
    }
  });
  return {
    connections: () => conns.size,
    dropPeer(peer) { for (const [k, e] of conns) if (k.startsWith(peer + '|')) { conns.delete(k); e.ws.close(); } },
    close() { for (const e of conns.values()) e.ws.close(); conns.clear(); },
  };
}

// Mitspieler: lokaler WebSocket-Server, an den sich das Spielfenster verbindet; alles geht zum Gastgeber
export function joinRelay(transport, hostId, { port = 0, log = () => {} } = {}) {
  let next = 1;
  const socks = new Map();
  const wss = new WebSocketServer({ host: '127.0.0.1', port, perMessageDeflate: false, maxPayload: 64 * 1024 });
  wss.on('connection', ws => {
    const conn = next++;
    socks.set(conn, ws);
    transport.send(hostId, frame('o', conn));
    ws.on('message', data => { const [kd, p] = encode(data.toString()); transport.send(hostId, frame(kd, conn, p)); });
    ws.on('close', () => { if (socks.delete(conn)) transport.send(hostId, frame('x', conn)); });
    ws.on('error', () => {});
  });
  transport.onPacket((peer, buf) => {
    if (peer !== hostId) return;
    const { kind, conn, body } = parse(buf), ws = socks.get(conn);
    if (!ws) return;
    if (kind === 'x') { socks.delete(conn); ws.close(); return; }
    if (ws.readyState === 1) ws.send(decode(kind, body));
  });
  const ready = new Promise(r => wss.once('listening', () => r(wss.address().port)));
  return {
    ready, // Promise mit dem lokalen Port
    close() { for (const [c, ws] of socks) { transport.send(hostId, frame('x', c)); ws.close(); } socks.clear(); wss.close(); },
  };
}

// Steam-Transport (steamworks.js): Pakete regelmäßig abholen
export function steamTransport(client, { pollMs = 4 } = {}) {
  const { networking } = client;
  const selfId = String(client.localplayer.getSteamId().steamId64);
  const handlers = [];
  const timer = setInterval(() => {
    for (let n = 0; n < 200; n++) {
      const size = networking.isP2PPacketAvailable();
      if (!size) break;
      const p = networking.readP2PPacket(size);
      const from = String(p.steamId.steamId64);
      for (const h of handlers) h(from, p.data);
    }
  }, pollMs);
  return {
    selfId,
    send: (peer, buf) => networking.sendP2PPacket(BigInt(peer), 2 /* Reliable */, buf),
    onPacket: h => handlers.push(h),
    close: () => clearInterval(timer),
  };
}

// Testtransport: zwei Endpunkte im selben Prozess (ohne Steam)
export function loopbackPair(idA = 'A', idB = 'B') {
  const mk = (self, other) => ({ self, handlers: [], other: null });
  const a = mk(idA), b = mk(idB); a.other = b; b.other = a;
  const api = e => ({
    selfId: e.self,
    send: (peer, buf) => { if (peer !== e.other.self) return false; const copy = Buffer.from(buf); setImmediate(() => e.other.handlers.forEach(h => h(e.self, copy))); return true; },
    onPacket: h => e.handlers.push(h),
    close() {},
  });
  return [api(a), api(b)];
}
