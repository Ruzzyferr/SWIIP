const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, session, dialog, desktopCapturer } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Move userData out of OneDrive to avoid cache permission errors on Windows
app.setPath('userData', path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Swiip'));

const Store = require('electron-store');

const store = new Store({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    maximized: false,
    minimizeToTray: true,
    startMinimized: false,
    serverUrl: '',
  },
});

const isDev = process.argv.includes('--dev');
const DEFAULT_PROD_URL = 'https://swiip.app';
const PERSIST_PARTITION = 'persist:swiip';
const WEB_URL = isDev
  ? 'http://localhost:3000'
  : (store.get('serverUrl') || process.env.SWIIP_WEB_URL || DEFAULT_PROD_URL);

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  const { width, height } = store.get('windowBounds');
  const maximized = store.get('maximized');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 940,
    minHeight: 600,
    title: 'Swiip',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      partition: PERSIST_PARTITION,
    },
    show: false,
  });

  // Show when ready to prevent flicker
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow.show();
      if (maximized) mainWindow.maximize();
    }
  });

  // Load the web app
  mainWindow.loadURL(WEB_URL);

  // Handle external links — open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  mainWindow.on('maximize', () => {
    store.set('maximized', true);
    mainWindow.webContents.send('maximize-change', true);
  });
  mainWindow.on('unmaximize', () => {
    store.set('maximized', false);
    mainWindow.webContents.send('maximize-change', false);
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  // Create a simple tray icon (16x16 blue circle)
  const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: create a simple icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createFromDataURL(createTrayIconDataURL()) : trayIcon);
  tray.setToolTip('Swiip');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Swiip',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createTrayIconDataURL() {
  // 16x16 blue circle as a data URL for the tray icon
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
    'AXNSR0IArs4c6QAAAMNJREFUOBFjYBhowIgswMTIxPAfSv8H0YwMTEzMjExMzCBx' +
    'BhDNABJgBNEgPhMLCzMTCwszEzMLkA8SI6mBkYmJkYmZiYmZhYWRkYkRpJmBgYGB' +
    'gQEoD3IBsgBYHJkNtwEkAHIBSAAkDhKH0XAbQGpAYuguwGoD2GYYn2AXIC0lKBqQ' +
    'XYDNBcgG4HQBuhiGAcQkI1wugAH0KERx0AxA10xSF0TriswY0IEBxIKdEQRweACk' +
    'BuxZH9UAAD8VPKOKM7I5AAAAAElFTkSuQmCC';
}

function setupAppMenu() {
  if (isDev) {
    // Dev: show menu bar for DevTools access
    const template = [
      {
        label: 'Swiip',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    // Production: no menu bar — Discord-style clean look
    Menu.setApplicationMenu(null);
  }
}

// ── Auto-updater (Discord-style: silent download + in-app notification) ───
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    // Notify renderer — it will show a small banner
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes ?? '',
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No update available');
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
  });

  // Check for updates on launch and every 30 minutes
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// App lifecycle
app.on('ready', () => {
  // Set custom user agent to identify desktop app
  const appSession = session.fromPartition(PERSIST_PARTITION);
  appSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['X-Swiip-Client'] = 'desktop';
    callback({ requestHeaders: details.requestHeaders });
  });

  setupAppMenu();
  createWindow();
  createTray();

  // Set up screen capture handler for LiveKit screen sharing
  appSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      // If a specific source was selected via our custom picker, use it
      if (selectedSourceId) {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
        const chosen = sources.find((s) => s.id === selectedSourceId);
        selectedSourceId = null; // Reset after use
        if (chosen) {
          callback({ video: chosen, audio: screenShareAudioEnabled ? 'loopback' : undefined });
          return;
        }
      }
      // Fallback: auto-select primary screen
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources.length > 0) {
        callback({ video: sources[0], audio: screenShareAudioEnabled ? 'loopback' : undefined });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[ScreenCapture] Error:', err);
      callback({});
    }
  });

  if (!isDev) {
    setupAutoUpdater();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// IPC handlers
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-setting', (_, key) => store.get(key));
ipcMain.handle('set-setting', (_, key, value) => store.set(key, value));

// ── Screen capture ──────────────────────────────────────────────────────
// Track whether user wants screen share audio (set from renderer via IPC)
let screenShareAudioEnabled = false;
// Track the selected source ID (set from renderer via custom picker)
let selectedSourceId = null;

ipcMain.handle('set-screen-share-audio', (_, enabled) => {
  screenShareAudioEnabled = !!enabled;
});

ipcMain.handle('set-selected-source', (_, sourceId) => {
  selectedSourceId = sourceId;
});

ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 300, height: 200 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
    display_id: s.display_id,
  }));
});

// Window control handlers
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('restart-for-update', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
});
