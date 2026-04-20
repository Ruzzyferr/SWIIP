const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const loopback = require('application-loopback');

// WASAPI ProcessLoopback wrapper around the `application-loopback` npm package
// (which spawns bundled Windows x64 .exe binaries and pipes raw PCM over stdout).
//
// Captured PCM format — verified by disassembling ApplicationLoopback.exe v1.2.7
// (mov instructions that initialize the WAVEFORMATEX struct):
//   wFormatTag      = WAVE_FORMAT_PCM (int16)
//   nChannels       = 2 (stereo, interleaved)
//   nSamplesPerSec  = 48000
//   wBitsPerSample  = 16
//   => 192000 bytes/sec, 4 bytes per frame
const PCM_FORMAT = Object.freeze({
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16,
  bytesPerFrame: 4,
  bytesPerSecond: 192000,
});

// Windows 10 2004 = 10.0.19041 — the first build shipping ProcessLoopback API.
const MIN_WIN_BUILD = 19041;

let rootInitialized = false;
let activeCapture = null; // { pid: string, onEnd: fn }

function isSupported() {
  if (process.platform !== 'win32') return false;
  if (process.arch !== 'x64') return false;
  const release = os.release();
  const build = Number(release.split('.')[2]);
  return Number.isFinite(build) && build >= MIN_WIN_BUILD;
}

function initRoot() {
  if (rootInitialized) return;
  // In packaged builds the module lives inside app.asar but the .exe binaries
  // must be on disk to be spawn-able, so they're asarUnpack'd into
  // resources/app.asar.unpacked/. Point the package at the unpacked location.
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

async function listWindows() {
  if (!isSupported()) return [];
  initRoot();
  return loopback.getActiveWindowProcessIds();
}

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
  activeCapture = { pid: pidStr, onEnd };
}

function stop() {
  if (!activeCapture) return false;
  const { pid, onEnd } = activeCapture;
  activeCapture = null;
  const stopped = loopback.stopAudioCapture(pid);
  if (onEnd) {
    try {
      onEnd();
    } catch {
      // ignore
    }
  }
  return stopped;
}

function getActivePid() {
  return activeCapture?.pid ?? null;
}

// Safety net: ensure the spawned .exe doesn't outlive the Electron process.
app.on('before-quit', () => {
  stop();
});

module.exports = {
  PCM_FORMAT,
  isSupported,
  listWindows,
  start,
  stop,
  getActivePid,
};
