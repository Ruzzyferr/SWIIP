const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { app } = require('electron');
const loopback = require('application-loopback');

// WASAPI ProcessLoopback wrapper.
//
// Two modes exist:
//
// 1. INCLUDE — capture audio produced by <pid> and its descendants. Used when
//    the user picks a specific window to share; the resulting audio is clean
//    (zero bleed from Swiip itself). Backed by the `application-loopback` npm
//    package, which spawns Microsoft's sample ApplicationLoopback.exe.
//
// 2. EXCLUDE — capture everything BUT <pid> (and its tree). Used for
//    full-screen share on Windows: we pass Electron's own PID so system audio
//    flows to the remote peer without looping our own voice-chat output back
//    (Discord parity). Backed by our custom AppLoopbackEx.exe, built from
//    apps/desktop/native/app-loopback-ex/ — see build.ps1 in that folder.
//
// Only one capture can be active at a time. PCM format on stdout (both modes):
//   int16 little-endian, 48 kHz, 2 channels interleaved (192000 bytes/sec).
const PCM_FORMAT = Object.freeze({
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16,
  bytesPerFrame: 4,
  bytesPerSecond: 192000,
});

// Windows 10 2004 = 10.0.19041 — first build shipping ProcessLoopback API.
const MIN_WIN_BUILD = 19041;

let rootInitialized = false;
let activeCapture = null; // { pid, mode: 'include'|'exclude', onEnd, stop }

function isSupported() {
  if (process.platform !== 'win32') return false;
  if (process.arch !== 'x64') return false;
  const release = os.release();
  const build = Number(release.split('.')[2]);
  return Number.isFinite(build) && build >= MIN_WIN_BUILD;
}

function initRoot() {
  if (rootInitialized) return;
  if (app.isPackaged) {
    const unpackedRoot = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'application-loopback',
      'bin',
    );
    loopback.setExecutablesRoot(unpackedRoot);
  }
  rootInitialized = true;
}

// Path to AppLoopbackEx.exe (exclude-mode binary). In dev it lives alongside
// the source tree; in packaged builds it's asar-unpacked into resources/.
function appLoopbackExPath() {
  if (process.platform !== 'win32') return null;
  if (app.isPackaged) {
    // electron-builder packs from apps/desktop, so "bin/**" lands directly
    // under resources/app.asar.unpacked/bin/... (not nested under apps/desktop).
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'bin',
      'win32-x64',
      'AppLoopbackEx.exe',
    );
  }
  // Dev: process-loopback.js is at apps/desktop/src/audio/
  return path.join(__dirname, '..', '..', 'bin', 'win32-x64', 'AppLoopbackEx.exe');
}

function isExcludeSupported() {
  if (!isSupported()) return false;
  const p = appLoopbackExPath();
  if (!p) return false;
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function listWindows() {
  if (!isSupported()) return [];
  initRoot();
  return loopback.getActiveWindowProcessIds();
}

// INCLUDE mode: capture audio produced by a target window's process tree.
function start(pid, onChunk, onEnd) {
  if (!isSupported()) {
    throw new Error('ProcessLoopback is only supported on Windows 10 2004+ x64');
  }
  if (activeCapture) {
    throw new Error(`Another capture is already active (pid=${activeCapture.pid})`);
  }
  initRoot();
  const pidStr = String(pid);
  loopback.startAudioCapture(pidStr, { onData: onChunk });
  activeCapture = {
    pid: pidStr,
    mode: 'include',
    onEnd,
    stop: () => loopback.stopAudioCapture(pidStr),
  };
}

// EXCLUDE mode: capture system audio EXCLUDING the target process tree.
// Used to share full-screen + system audio without echoing Swiip's own mix.
function startExclude(pid, onChunk, onEnd) {
  if (!isExcludeSupported()) {
    throw new Error('AppLoopbackEx.exe not available — build it via apps/desktop/native/app-loopback-ex/build.ps1');
  }
  if (activeCapture) {
    throw new Error(`Another capture is already active (pid=${activeCapture.pid})`);
  }
  const exe = appLoopbackExPath();
  const pidStr = String(pid);
  const child = spawn(exe, [pidStr, 'exclude'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let ended = false;
  const signalEnd = (reason) => {
    if (ended) return;
    ended = true;
    // Surface a short diagnostic if the child errored out.
    if (reason && typeof reason === 'string') {
      console.warn(`[ProcessLoopback exclude] ${reason}`);
    }
    if (onEnd) {
      try { onEnd(); } catch { /* ignore */ }
    }
  };

  child.stdout.on('data', (chunk) => {
    try { onChunk(chunk); } catch { /* ignore renderer errors */ }
  });
  // Buffer stderr for diagnostics; only log if we actually exit non-zero.
  let stderrBuf = '';
  child.stderr.on('data', (buf) => {
    stderrBuf += buf.toString('utf8');
    if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
  });
  child.on('error', (err) => signalEnd(`spawn error: ${err.message}`));
  child.on('close', (code) => {
    if (code !== 0 && stderrBuf) {
      signalEnd(`exited with code=${code}, stderr=${stderrBuf.trim()}`);
    } else {
      signalEnd();
    }
    if (activeCapture && activeCapture.mode === 'exclude' && activeCapture.child === child) {
      activeCapture = null;
    }
  });

  activeCapture = {
    pid: pidStr,
    mode: 'exclude',
    onEnd,
    child,
    stop: () => {
      // kill() sends SIGTERM on Windows, which Electron maps to TerminateProcess.
      // The binary watches its stdout pipe (closed by us) + SetConsoleCtrlHandler,
      // but TerminateProcess is the reliable path for a child with no console.
      try { child.kill(); } catch { /* ignore */ }
    },
  };
}

function stop() {
  if (!activeCapture) return false;
  const { onEnd, stop: stopFn } = activeCapture;
  activeCapture = null;
  let stopped = false;
  try {
    const rv = stopFn();
    stopped = rv !== false;
  } catch {
    stopped = false;
  }
  if (onEnd) {
    try { onEnd(); } catch { /* ignore */ }
  }
  return stopped;
}

function getActivePid() {
  return activeCapture?.pid ?? null;
}

function getActiveMode() {
  return activeCapture?.mode ?? null;
}

// Safety net: ensure the spawned .exe doesn't outlive the Electron process.
app.on('before-quit', () => {
  stop();
});

module.exports = {
  PCM_FORMAT,
  isSupported,
  isExcludeSupported,
  listWindows,
  start,
  startExclude,
  stop,
  getActivePid,
  getActiveMode,
};
