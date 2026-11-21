// Steam-Anbindung (steamworks.js). Ohne laufendes Steam bleibt alles abgeschaltet und das Spiel läuft normal weiter.
// Ablauf Mehrspieler:
//  Gastgeber: Raum erstellen -> Steam-Lobby (nur Freunde) mit Raumcode -> Freunde über das Overlay einladen
//  Freund: Einladung annehmen -> Lobby beitreten -> Relais zum Gastgeber über Steam-P2P -> Spiel tritt dem Raum bei
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { hostRelay, joinRelay, steamTransport } from './relay.mjs';

const require = createRequire(import.meta.url);

export function loadSteamConfig(file) {
  try { return { appId: 480, ...JSON.parse(readFileSync(file, 'utf8')) }; } catch { return { appId: 480 }; }
}

// Vor app.whenReady aufrufen (das Overlay braucht Startschalter)
export function initSteam({ app, appId, log }) {
  let sw;
  try { sw = require('steamworks.js'); } catch (e) { log('Steam: steamworks.js nicht verfügbar – ' + e.message); return null; }
  // Echte App-ID: ohne Start über Steam neu über Steam starten (bei der Test-App 480 nicht)
  if (app.isPackaged && appId !== 480) { try { if (sw.restartAppIfNecessary(appId)) { app.quit(); return null; } } catch { /* egal */ } }
  let client;
  try { client = sw.init(appId); } catch (e) { log('Steam: nicht gestartet oder nicht angemeldet – Spiel läuft ohne Steam. (' + e.message + ')'); return null; }
  try { sw.electronEnableSteamOverlay(); } catch (e) { log('Steam-Overlay: ' + e.message); }
  log(`Steam: angemeldet als ${client.localplayer.getName()} (App ${appId})`);
  return { sw, client };
}

export function setupSteam({ steam, ipcMain, getWin, gamePort, version, log }) {
  const status = () => ({ available: !!steam, name: steam ? steam.client.localplayer.getName() : null });
  ipcMain.handle('steam:status', status);
  ipcMain.handle('steam:achievement', (e, id) => { if (!steam) return false; try { return steam.client.achievement.activate(String(id)); } catch { return false; } });
  if (!steam) {
    for (const ch of ['steam:host', 'steam:invite', 'steam:leave']) ipcMain.handle(ch, () => false);
    return { joinFromArgs() {} };
  }
  const { client } = steam;
  const transport = steamTransport(client);
  let lobby = null, role = null, relay = null, host = null;

  const members = () => { try { return lobby ? lobby.getMembers().map(m => String(m.steamId64)) : []; } catch { return []; } };
  const leave = () => {
    if (relay) { relay.close(); relay = null; }
    if (lobby) { try { lobby.leave(); } catch { /* egal */ } lobby = null; }
    role = null;
    try { client.localplayer.setRichPresence('connect', null); } catch { /* egal */ }
  };

  // Verbindungsanfragen nur von Mitgliedern der eigenen Lobby annehmen
  client.callback.register(client.callback.SteamCallback.P2PSessionRequest, ({ remote }) => {
    const id = String(remote);
    if (members().includes(id) || (role === 'member' && id === host)) client.networking.acceptP2PSession(remote);
  });
  // Einladung angenommen (Overlay oder Freundesliste)
  client.callback.register(client.callback.SteamCallback.GameLobbyJoinRequested, ({ lobby_steam_id }) => join(lobby_steam_id));

  ipcMain.handle('steam:host', async (e, code) => {
    leave();
    lobby = await client.matchmaking.createLobby(1 /* nur Freunde */, 16);
    role = 'host';
    lobby.setData('code', String(code)); lobby.setData('host', transport.selfId); lobby.setData('version', version);
    relay = hostRelay(transport, `ws://127.0.0.1:${gamePort()}`, { allow: peer => members().includes(peer), log });
    client.localplayer.setRichPresence('connect', '+connect_lobby ' + lobby.id);
    log('Steam: Lobby erstellt ' + lobby.id);
    return true;
  });
  ipcMain.handle('steam:invite', () => { if (lobby) { lobby.openInviteDialog(); return true; } return false; });
  ipcMain.handle('steam:leave', () => { leave(); return true; });

  async function join(lobbyId) {
    try {
      leave();
      lobby = await client.matchmaking.joinLobby(BigInt(lobbyId));
      role = 'member';
      host = lobby.getData('host'); const code = lobby.getData('code'), ver = lobby.getData('version');
      if (!host || !code) throw new Error('Lobby ohne Spielinformationen');
      if (ver && ver !== version) { getWin()?.webContents.send('steam:error', `Der Gastgeber nutzt Version ${ver}, du ${version}. Bitte beide aktualisieren.`); leave(); return; }
      relay = joinRelay(transport, host, { log });
      const port = await relay.ready;
      log(`Steam: Lobby ${lobbyId} beigetreten, Gastgeber ${host}, Raum ${code}`);
      getWin()?.webContents.send('steam:join', { port, code });
    } catch (e) {
      log('Steam: Beitritt fehlgeschlagen – ' + e.message);
      getWin()?.webContents.send('steam:error', 'Beitritt über Steam fehlgeschlagen.');
      leave();
    }
  }
  return {
    // Start über eine Einladung, während das Spiel noch nicht lief: Steam übergibt +connect_lobby <id>
    joinFromArgs(argv) { const i = argv.indexOf('+connect_lobby'); if (i >= 0 && argv[i + 1]) join(argv[i + 1]); },
    shutdown() { leave(); transport.close(); },
  };
}
