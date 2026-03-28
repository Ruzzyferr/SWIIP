const { contextBridge, ipcRenderer } = require('electron');

// Helper: register an IPC listener and return a cleanup function.
// This prevents listener accumulation on component remount (logout/login cycles).
function createIPCListener(channel, handler) {
  const wrapped = (_, ...args) => handler(...args);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('constchat', {
  platform: 'desktop',
  getVersion: () => ipcRenderer.invoke('get-version'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  onNavigate: (callback) => {
    return createIPCListener('navigate', callback);
  },
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    return createIPCListener('maximize-change', callback);
  },
  // Screen capture
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  setScreenShareAudio: (enabled) => ipcRenderer.invoke('set-screen-share-audio', enabled),
  setSelectedSource: (sourceId) => ipcRenderer.invoke('set-selected-source', sourceId),
  // Global keyboard shortcuts
  registerGlobalShortcut: (accelerator) => ipcRenderer.invoke('register-global-shortcut', accelerator),
  unregisterGlobalShortcut: (accelerator) => ipcRenderer.invoke('unregister-global-shortcut', accelerator),
  onGlobalShortcut: (callback) => {
    return createIPCListener('global-shortcut', callback);
  },
  // Window focus tracking
  onWindowFocusChange: (callback) => {
    const cleanupFocus = createIPCListener('window-focus', () => callback(true));
    const cleanupBlur = createIPCListener('window-blur', () => callback(false));
    return () => {
      cleanupFocus();
      cleanupBlur();
    };
  },
  // Unread badge on taskbar
  setBadgeCount: (count) => ipcRenderer.invoke('set-badge-count', count),
  // Voice status for tray menu
  setVoiceStatus: (status) => ipcRenderer.invoke('set-voice-status', status),
  onTrayVoiceAction: (callback) => {
    return createIPCListener('tray-voice-action', callback);
  },
  // System resume (wake from sleep)
  onSystemResume: (callback) => {
    return createIPCListener('system-resume', () => callback());
  },
  // Auto-update
  onUpdateAvailable: (callback) => {
    return createIPCListener('update-available', callback);
  },
  onUpdateDownloadProgress: (callback) => {
    return createIPCListener('update-download-progress', callback);
  },
  onUpdateDownloaded: (callback) => {
    return createIPCListener('update-downloaded', callback);
  },
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
});
