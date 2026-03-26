const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, session } = require('electron');
const path = require('path');

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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#a0a0b0',
      height: 32,
    },
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
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

  mainWindow.on('maximize', () => store.set('maximized', true));
  mainWindow.on('unmaximize', () => store.set('maximized', false));

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
  const template = [
    {
      label: 'Swiip',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('navigate', '/settings');
          },
        },
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
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['X-Swiip-Client'] = 'desktop';
    callback({ requestHeaders: details.requestHeaders });
  });

  setupAppMenu();
  createWindow();
  createTray();
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
