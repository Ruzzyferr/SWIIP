# ConstChat Desktop — Build & Install Guide

## Pre-built Installers

Ready-to-use Windows installers are in:

```
apps/desktop/dist/
  ConstChat-Setup-0.1.0.exe     (79 MB) — NSIS installer with Start Menu shortcut
  ConstChat-Portable-0.1.0.exe  (79 MB) — Portable, no install needed
```

Send either `.exe` to friends. The portable version runs from any folder.

## Official Download URL

Users should always download the latest installer from:

- `https://swiip.app/downloads/Swiip-Setup-latest.exe`

Version-pinned files are also published and kept for rollback/debug:

- `https://swiip.app/downloads/Swiip-Setup-<version>.exe`

## How It Works

The desktop app is an Electron shell that loads the hosted ConstChat web app.
It connects to the deployed server URL — no local backend needed.

**Default server:** Set in `apps/desktop/src/main.js` → `DEFAULT_PROD_URL`

Users can also override the server URL via the `CONSTCHAT_WEB_URL` environment variable.

## Building From Source

### Prerequisites

- Node.js 20+
- npm or pnpm

### Important: Path Restriction (Windows)

electron-builder's NSIS target breaks on paths containing non-ASCII characters
(e.g., Turkish `Masaüstü`). **Build from a clean ASCII path:**

```bash
# Copy to a clean path
mkdir C:\constchat-build
cp -r apps/desktop/* C:\constchat-build/

# Install and build
cd C:\constchat-build
npm install
npx electron-builder --win --publish never
```

### Build Commands

```bash
cd apps/desktop

# Install dependencies
npm install

# Build both NSIS installer + portable
npx electron-builder --win --publish never

# Build NSIS installer only
npx electron-builder --win nsis --publish never

# Build portable only
npx electron-builder --win portable --publish never
```

Output appears in `apps/desktop/dist/`.

## Automated Production Publish

Installer publishing is automated via GitHub Actions:

- Workflow: `.github/workflows/desktop-release.yml`
- Trigger: pushes to `master` affecting `apps/desktop/**` (or manual dispatch)
- Flow:
  1. Build `Swiip-Setup-<version>.exe` on `windows-latest`
  2. Upload to production `/opt/ConstChat/infra/docker/downloads/`
  3. Promote atomically to `Swiip-Setup-latest.exe`
  4. Verify SHA256 and smoke-check latest URL

Required repository secrets:

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_SSH_PORT` (optional, defaults to `22`)

### Development Mode

```bash
# Start the web app first
cd apps/web && pnpm dev

# Then launch Electron in dev mode (points to localhost:3000)
cd apps/desktop && npm start -- --dev
```

## Changing the Server URL

Before building, edit `apps/desktop/src/main.js`:

```javascript
const DEFAULT_PROD_URL = 'https://your-app.ondigitalocean.app';
```

Then rebuild the installer.

## App Features

- System tray with minimize-to-tray
- Single instance lock (prevents duplicate windows)
- Window state persistence (size, position, maximized)
- Custom titlebar matching the app theme
- External links open in system browser
- Frameless window with native title bar overlay
- Spellcheck enabled

## File Locations

| File | Purpose |
|------|---------|
| `src/main.js` | Electron main process |
| `src/preload.js` | Context bridge for IPC |
| `build/icon.ico` | Windows app icon |
| `build/icon.png` | PNG icon (256x256) |
| `build/tray-icon.png` | System tray icon (16x16) |
| `package.json` | electron-builder config |

## Signing (Optional)

The current build is unsigned. Windows SmartScreen will show a warning on first run.
To sign:

1. Get a code signing certificate (e.g., from DigiCert, Sectigo)
2. Set environment variables:
   ```
   CSC_LINK=path/to/certificate.pfx
   CSC_KEY_PASSWORD=your-password
   ```
3. Rebuild — electron-builder will sign automatically
