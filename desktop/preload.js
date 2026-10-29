const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  onHotkey: cb => ipcRenderer.on('hotkey', (_e, action) => cb(action)),
  onClickThrough: cb => ipcRenderer.on('clickthrough', (_e, on) => cb(on)),
  setKeys: keys => ipcRenderer.send('set-keys', keys),
  setMode: mode => ipcRenderer.send('set-mode', mode),        // 'overlay' | 'full'
  win: action => ipcRenderer.send('win', action),             // 'minimize' | 'close'
});
