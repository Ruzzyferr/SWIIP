const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('constchat', {
  platform: 'desktop',
  getVersion: () => ipcRenderer.invoke('get-version'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_, path) => callback(path));
  },
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('maximize-change', (_, maximized) => callback(maximized));
  },
});
