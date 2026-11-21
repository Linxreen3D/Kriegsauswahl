// Schmale, sichere Brücke zwischen Spielfenster und Desktop-Programm
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('desktop:info'),
  setFullscreen: on => ipcRenderer.invoke('desktop:fullscreen', on),
  connect: addr => ipcRenderer.invoke('desktop:connect', addr),
  quit: () => ipcRenderer.invoke('desktop:quit'),
});
