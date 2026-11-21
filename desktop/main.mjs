// Frontlinien als Desktop-Programm (Electron): startet den Spielserver im selben Prozess
// (der Gastgeber ist selbst Server) und öffnet das Spiel in einem Fenster.
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { initSteam, setupSteam, loadSteamConfig } from './steam.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PREFERRED_PORT = 3456; // fester Port, damit Freunde im LAN die Adresse kennen

if (!app.requestSingleInstanceLock()) app.quit();

// Spielstände und Einstellungen in den Benutzerordner (nicht in den Programmordner)
const USER = app.getPath('userData');
process.env.FL_SAVES = join(USER, 'saves');
mkdirSync(process.env.FL_SAVES, { recursive: true });
const PREFS_FILE = join(USER, 'desktop.json');
const prefs = (() => { try { return JSON.parse(readFileSync(PREFS_FILE, 'utf8')); } catch { return { fullscreen: true }; } })();
const savePrefs = () => { try { writeFileSync(PREFS_FILE, JSON.stringify(prefs)); } catch { /* egal */ } };

let server = null, win = null;
const log = msg => console.log('[Frontlinien] ' + msg);
// Steam vor dem Start der Fenster einrichten (Overlay). App-ID in desktop/steam.json; 480 = Valves Test-App „Spacewar“.
const STEAM_CFG = loadSteamConfig(join(HERE, 'steam.json'));
const steam = initSteam({ app, appId: STEAM_CFG.appId, log });
let steamApi = null;

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

async function boot() {
  const { startServer } = await import('../server/index.js');
  try { server = await startServer({ port: PREFERRED_PORT, host: '0.0.0.0', quiet: true }); }
  catch { server = await startServer({ port: 0, host: '0.0.0.0', quiet: true }); } // Port belegt: beliebiger freier Port
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640, show: false, backgroundColor: '#0d0e0f', title: 'Frontlinien',
    autoHideMenuBar: true, fullscreen: !!prefs.fullscreen, icon: join(HERE, '..', 'build', 'icon.png'),
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  // Externe Links im Browser öffnen, nicht im Spielfenster
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!/^http:\/\/[\d.]+:\d+\//.test(url) && !url.startsWith('http://localhost')) { e.preventDefault(); shell.openExternal(url); } });
  win.on('enter-full-screen', () => { prefs.fullscreen = true; savePrefs(); });
  win.on('leave-full-screen', () => { prefs.fullscreen = false; savePrefs(); });
  win.on('closed', () => { win = null; });
  await win.loadURL(`http://127.0.0.1:${server.port}/`);
  steamApi.joinFromArgs(process.argv);
}
steamApi = setupSteam({ steam, ipcMain, getWin: () => win, gamePort: () => (server ? server.port : 0), version: app.getVersion(), log });

ipcMain.handle('desktop:info', () => ({ port: server ? server.port : 0, lan: lanAddresses(), fullscreen: win ? win.isFullScreen() : false, version: app.getVersion() }));
ipcMain.handle('desktop:fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); return !!on; });
ipcMain.handle('desktop:quit', () => app.quit());
// Zu einem anderen Gastgeber im LAN wechseln bzw. zurück zum eigenen Server
ipcMain.handle('desktop:connect', (e, addr) => {
  if (!win) return false;
  if (!addr) { win.loadURL(`http://127.0.0.1:${server.port}/`); return true; }
  const m = String(addr).trim().match(/^([\w.-]+)(?::(\d{2,5}))?$/);
  if (!m) return false;
  win.loadURL(`http://${m[1]}:${m[2] || PREFERRED_PORT}/`);
  return true;
});

app.on('second-instance', (e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } steamApi.joinFromArgs(argv); });
app.whenReady().then(boot);
app.on('window-all-closed', async () => { if (steamApi.shutdown) steamApi.shutdown(); if (server) await server.close(); app.quit(); });
