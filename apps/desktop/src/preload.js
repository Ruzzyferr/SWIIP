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
  // ProcessLoopback (Windows 10 2004+ x64) — per-process audio capture that
  // excludes voice chat playback from the shared screen audio.
  //
  // isExcludeSupported / startExclude use a custom AppLoopbackEx.exe (see
  // apps/desktop/native/app-loopback-ex/) to run in EXCLUDE mode. The renderer
  // passes Electron's own PID via getOwnPid so Windows strips Swiip's process
  // tree from the system mix — that's what gives us echo-free full-screen
  // + system audio on Windows.
  processLoopback: {
    isSupported: () => ipcRenderer.invoke('process-loopback-supported'),
    isExcludeSupported: () => ipcRenderer.invoke('process-loopback-exclude-supported'),
    getOwnPid: () => ipcRenderer.invoke('process-loopback-own-pid'),
    listWindows: () => ipcRenderer.invoke('process-loopback-list-windows'),
    start: (pid) => ipcRenderer.invoke('process-loopback-start', pid),
    startExclude: (pid) => ipcRenderer.invoke('process-loopback-start-exclude', pid),
    stop: () => ipcRenderer.invoke('process-loopback-stop'),
    onChunk: (callback) => createIPCListener('process-loopback-chunk', callback),
    onEnd: (callback) => createIPCListener('process-loopback-end', callback),
  },
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
