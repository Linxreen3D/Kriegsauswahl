// Schmale, sichere Brücke zwischen Spielfenster und Desktop-Programm
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('desktop:info'),
  setFullscreen: on => ipcRenderer.invoke('desktop:fullscreen', on),
  connect: addr => ipcRenderer.invoke('desktop:connect', addr),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  openLogs: () => ipcRenderer.invoke('desktop:openLogs'),
  steam: {
    status: () => ipcRenderer.invoke('steam:status'),
    host: code => ipcRenderer.invoke('steam:host', code),
    invite: () => ipcRenderer.invoke('steam:invite'),
    leave: () => ipcRenderer.invoke('steam:leave'),
    achievement: id => ipcRenderer.invoke('steam:achievement', id),
    onJoin: cb => ipcRenderer.on('steam:join', (e, d) => cb(d)),
    onError: cb => ipcRenderer.on('steam:error', (e, t) => cb(t)),
  },
});
