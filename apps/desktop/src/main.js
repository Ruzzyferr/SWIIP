const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, session, dialog, desktopCapturer, globalShortcut, powerMonitor } = require('electron');
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

// --- Local Web Server for Production ---
// In production, we bundle the Next.js standalone output and run a local HTTP server.
// This makes the app load instantly, work offline (for UI), and feel native.
// In dev, we use localhost:3000 for hot reload.
let localServerPort = null;
let localServerProcess = null;

async function startLocalWebServer() {
  if (isDev) return 'http://localhost:3000';

  // Check if bundled web server exists (monorepo standalone preserves directory structure)
  const serverPath = path.join(__dirname, '..', 'web-bundle', 'apps', 'web', 'server.js');
  const fs = require('fs');
  if (!fs.existsSync(serverPath)) {
    // No local bundle — fall back to remote URL
    console.info('[Desktop] No local web bundle found, using remote URL');
    return store.get('serverUrl') || process.env.SWIIP_WEB_URL || DEFAULT_PROD_URL;
  }

  // Find a free port
  const net = require('net');
  localServerPort = await new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });

  // Start the Next.js standalone server
  const { fork } = require('child_process');
  localServerProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(localServerPort),
      HOSTNAME: '127.0.0.1',
      // Pass the API URL so the web app can reach the backend
      NEXT_PUBLIC_API_URL: store.get('serverUrl') || process.env.SWIIP_API_URL || 'https://api.swiip.app',
      NEXT_PUBLIC_GATEWAY_URL: store.get('gatewayUrl') || process.env.SWIIP_GATEWAY_URL || 'wss://api.swiip.app/gateway',
    },
    stdio: 'pipe',
  });

  localServerProcess.stdout?.on('data', (d) => console.log('[WebServer]', d.toString().trim()));
  localServerProcess.stderr?.on('data', (d) => console.error('[WebServer]', d.toString().trim()));

  // Wait for server to be ready (max 15 seconds to prevent infinite hang)
  const SERVER_START_TIMEOUT_MS = 15000;
  await new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (Date.now() - startTime > SERVER_START_TIMEOUT_MS) {
        reject(new Error('Local web server failed to start within 15 seconds'));
        return;
      }
      const http = require('http');
      http.get(`http://127.0.0.1:${localServerPort}`, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        setTimeout(check, 100);
      });
    };
    setTimeout(check, 300);
  });

  console.info(`[Desktop] Local web server started on port ${localServerPort}`);
  return `http://127.0.0.1:${localServerPort}`;
}

let WEB_URL = isDev
  ? 'http://localhost:3000'
  : (store.get('serverUrl') || process.env.SWIIP_WEB_URL || DEFAULT_PROD_URL);

let mainWindow = null;
let splashWindow = null;
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
    // Use a near-black background to minimize flash on both dark and light themes
    backgroundColor: '#090B0B',
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

// ── Splash Screen (Discord-style update check on startup) ────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    transparent: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #090B0B;
    color: #F5F7F6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    border-radius: 12px;
    overflow: hidden;
    -webkit-app-region: drag;
    user-select: none;
  }
  .logo {
    width: 80px; height: 80px;
    margin-bottom: 24px;
    border-radius: 20px;
    background: linear-gradient(135deg, #10B981, #34D399);
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 700; color: #fff;
    box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
  }
  .app-name {
    font-size: 22px; font-weight: 700;
    margin-bottom: 32px;
    background: linear-gradient(135deg, #6EE7B7, #34D399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .status {
    font-size: 12px;
    color: #788682;
    margin-bottom: 16px;
    min-height: 16px;
    transition: opacity 0.3s;
  }
  .progress-container {
    width: 200px; height: 4px;
    background: #181E1D;
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #10B981, #34D399);
    border-radius: 2px;
    width: 0%;
    transition: width 0.3s ease;
  }
  .progress-bar.indeterminate {
    width: 40%;
    animation: indeterminate 1.5s ease-in-out infinite;
  }
  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(500%); }
  }
  .spinner {
    width: 24px; height: 24px;
    border: 2.5px solid #181E1D;
    border-top: 2.5px solid #34D399;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body>
  <div class="logo">S</div>
  <div class="app-name">Swiip</div>
  <div class="spinner" id="spinner"></div>
  <div class="status" id="status">Checking for updates...</div>
  <div class="progress-container">
    <div class="progress-bar indeterminate" id="progress"></div>
  </div>
  <script>
    window.updateSplash = function(data) {
      const status = document.getElementById('status');
      const progress = document.getElementById('progress');
      const spinner = document.getElementById('spinner');
      if (data.status) status.textContent = data.status;
      if (data.percent !== undefined) {
        progress.classList.remove('indeterminate');
        progress.style.width = data.percent + '%';
      }
      if (data.hideSpinner) spinner.style.display = 'none';
    };
  </script>
</body></html>`;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHTML));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

function sendToSplash(data) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `if(window.updateSplash) window.updateSplash(${JSON.stringify(data)})`
    ).catch(() => {});
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// Run update check on startup with splash screen. Returns a promise that resolves
// when the app should continue loading (either no update or timeout).
function checkForUpdatesOnStartup() {
  return new Promise((resolve) => {
    const STARTUP_UPDATE_TIMEOUT_MS = 15000;
    let resolved = false;
    let updateFound = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    // Timeout: if update check takes too long, proceed normally
    const timeout = setTimeout(() => {
      console.log('[AutoUpdater] Startup check timed out, proceeding...');
      sendToSplash({ status: 'Starting...', hideSpinner: true });
      finish();
    }, STARTUP_UPDATE_TIMEOUT_MS);

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      updateFound = true;
      console.log('[AutoUpdater] Startup: update available:', info.version);
      sendToSplash({ status: `Downloading v${info.version}...` });
    });

    autoUpdater.on('download-progress', (progress) => {
      const pct = Math.round(progress.percent);
      sendToSplash({ status: `Downloading update... ${pct}%`, percent: pct });
    });

    autoUpdater.on('update-downloaded', (info) => {
      clearTimeout(timeout);
      console.log('[AutoUpdater] Startup: update downloaded, installing...');
      sendToSplash({ status: 'Installing update...', percent: 100, hideSpinner: true });
      // Brief delay so user sees "Installing..." before restart
      setTimeout(() => {
        isQuitting = true;
        autoUpdater.quitAndInstall(true, true);
      }, 1500);
    });

    autoUpdater.on('update-not-available', () => {
      clearTimeout(timeout);
      console.log('[AutoUpdater] Startup: no update available');
      sendToSplash({ status: 'Up to date!', hideSpinner: true });
      // Brief pause so user sees the status
      setTimeout(finish, 800);
    });

    autoUpdater.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[AutoUpdater] Startup error:', err.message);
      sendToSplash({ status: 'Starting...', hideSpinner: true });
      setTimeout(finish, 500);
    });

    autoUpdater.checkForUpdates().catch((err) => {
      clearTimeout(timeout);
      console.error('[AutoUpdater] Startup check failed:', err.message);
      finish();
    });
  });
}

// ── Auto-updater (background: in-app notification while running) ─────────
function setupBackgroundAutoUpdater() {
  // Remove startup-only listeners and set up background listeners
  autoUpdater.removeAllListeners('update-available');
  autoUpdater.removeAllListeners('download-progress');
  autoUpdater.removeAllListeners('update-downloaded');
  autoUpdater.removeAllListeners('update-not-available');
  autoUpdater.removeAllListeners('error');

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Background: checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Background: update available:', info.version);
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
    console.log('[AutoUpdater] Background: update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Background: no update available');
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Background error:', err.message);
  });

  // Check every 30 minutes
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
app.on('ready', async () => {
  // In production, show splash screen and check for updates before main window
  if (!isDev) {
    createSplashWindow();
    // Run update check and web server startup in parallel
    const [/* updateResult */] = await Promise.all([
      checkForUpdatesOnStartup(),
      startLocalWebServer().then((url) => { WEB_URL = url; }).catch((err) => {
        console.error('[Desktop] Failed to start local server, using remote URL:', err);
      }),
    ]);
    closeSplash();
    // Switch to background updater for periodic checks while app is running
    setupBackgroundAutoUpdater();
  } else {
    // Dev mode: no splash, just start the web server
    try {
      WEB_URL = await startLocalWebServer();
    } catch (err) {
      console.error('[Desktop] Failed to start local server, using remote URL:', err);
    }
  }

  // Set custom user agent to identify desktop app
  const appSession = session.fromPartition(PERSIST_PARTITION);
  appSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['X-Swiip-Client'] = 'desktop';
    callback({ requestHeaders: details.requestHeaders });
  });

  // Content Security Policy — defense-in-depth against XSS (Discord pattern)
  appSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https: http:",
            "media-src 'self' blob: https: http: mediastream:",
            "connect-src 'self' ws: wss: https: http:",
            "font-src 'self' data:",
            "worker-src 'self' blob:",
          ].join('; '),
        ],
      },
    });
  });

  setupAppMenu();
  createWindow();
  createTray();

  // Set up screen capture handler for LiveKit screen sharing
  appSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      if (selectedSourceId) {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
        const chosen = sources.find((s) => s.id === selectedSourceId);
        const sourceId = selectedSourceId;
        selectedSourceId = null;
        if (chosen) {
          const isWindowCapture = sourceId.startsWith('window:');
          const includeAudio = !isWindowCapture && screenShareAudioEnabled;
          callback({ video: chosen, audio: includeAudio ? 'loopback' : undefined });
          return;
        }
      }
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources.length > 0) {
        callback({ video: sources[0], audio: undefined });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[ScreenCapture] Error:', err);
      callback({});
    }
  });
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
  // Kill local web server if running
  if (localServerProcess) {
    localServerProcess.kill();
    localServerProcess = null;
  }
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

// --- Unread Badge ---
ipcMain.handle('set-badge-count', (_, count) => {
  // Windows: overlay badge on taskbar icon
  if (mainWindow) {
    if (count > 0) {
      mainWindow.setOverlayIcon(
        nativeImage.createFromDataURL(createBadgeDataURL(count)),
        `${count} unread`
      );
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  // Also update tray tooltip
  if (tray) {
    const voicePrefix = voiceConnected
      ? `Voice ${voiceDeafened ? 'Deafened' : voiceMuted ? 'Muted' : 'Connected'} · `
      : '';
    tray.setToolTip(count > 0 ? `Swiip — ${voicePrefix}${count} unread` : `Swiip${voicePrefix ? ` — ${voicePrefix.slice(0, -3)}` : ''}`);
  }
});

function createBadgeDataURL(count) {
  // 16x16 red circle with number — simple badge
  const text = count > 99 ? '99+' : String(count);
  // Use a canvas-free data URL approach: simple SVG to data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="8" fill="#ed4245"/>
    <text x="8" y="12" text-anchor="middle" fill="white" font-size="${text.length > 2 ? 7 : 9}" font-family="sans-serif" font-weight="bold">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// --- Global Keyboard Shortcuts ---
const registeredShortcuts = new Set();

ipcMain.handle('register-global-shortcut', (_, accelerator) => {
  if (registeredShortcuts.has(accelerator)) return true;
  try {
    const success = globalShortcut.register(accelerator, () => {
      mainWindow?.webContents.send('global-shortcut', accelerator);
    });
    if (success) registeredShortcuts.add(accelerator);
    return success;
  } catch (err) {
    console.warn('[GlobalShortcut] Failed to register:', accelerator, err);
    return false;
  }
});

ipcMain.handle('unregister-global-shortcut', (_, accelerator) => {
  if (registeredShortcuts.has(accelerator)) {
    globalShortcut.unregister(accelerator);
    registeredShortcuts.delete(accelerator);
  }
});

// Unregister all global shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- Voice Status for Tray ---
let voiceConnected = false;
let voiceMuted = false;
let voiceDeafened = false;

ipcMain.handle('set-voice-status', (_, status) => {
  voiceConnected = status.connected ?? false;
  voiceMuted = status.muted ?? false;
  voiceDeafened = status.deafened ?? false;
  updateTrayMenu();
});

function updateTrayMenu() {
  if (!tray) return;

  const menuItems = [
    {
      label: 'Open Swiip',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
  ];

  if (voiceConnected) {
    menuItems.push(
      { type: 'separator' },
      {
        label: voiceMuted ? '🔇 Unmute' : '🎤 Mute',
        click: () => {
          mainWindow?.webContents.send('tray-voice-action', 'toggle-mute');
        },
      },
      {
        label: voiceDeafened ? '🔊 Undeafen' : '🔈 Deafen',
        click: () => {
          mainWindow?.webContents.send('tray-voice-action', 'toggle-deafen');
        },
      },
      {
        label: '🔌 Disconnect',
        click: () => {
          mainWindow?.webContents.send('tray-voice-action', 'disconnect');
        },
      }
    );
  }

  menuItems.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(menuItems));

  // Update tray tooltip
  if (voiceConnected) {
    const state = voiceDeafened ? 'Deafened' : voiceMuted ? 'Muted' : 'Connected';
    tray.setToolTip(`Swiip — Voice ${state}`);
  } else {
    tray.setToolTip('Swiip');
  }
}

// --- Window Focus Events ---
// Send focus/blur events to renderer for platform provider
app.on('browser-window-focus', () => {
  mainWindow?.webContents.send('window-focus');
});
app.on('browser-window-blur', () => {
  mainWindow?.webContents.send('window-blur');
});

// --- System Resume Detection ---
// When system wakes from sleep, notify renderer to reconnect immediately
powerMonitor.on('resume', () => {
  console.debug('[PowerMonitor] System resumed — notifying renderer');
  mainWindow?.webContents.send('system-resume');
});

