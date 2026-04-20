// Renderer-side helper for Windows per-process audio capture via Electron
// ProcessLoopback IPC. Builds an AudioContext → PcmFeeder worklet →
// MediaStreamAudioDestinationNode chain, exposes the resulting audio track to
// be published to LiveKit as ScreenShareAudio.
//
// Two capture modes are exposed:
//
// - include (createProcessLoopbackTrack): capture the window's process tree
//   only. Clean per-app audio. Used when user picks a specific window.
//
// - exclude (createExcludeLoopbackTrack): capture all system audio EXCEPT a
//   target process tree. We pass Electron's own PID so Swiip's voice-chat
//   playback is stripped from the mix. Used for full-screen shares with
//   "share audio" enabled — the Discord-parity path.
//
// PCM format delivered by the main process: int16LE, 48kHz, stereo interleaved.

export interface ProcessLoopbackWindow {
  processId: string;
  hwnd: string;
  title: string;
}

export interface ProcessLoopbackTrack {
  track: MediaStreamTrack;
  dispose: () => Promise<void>;
}

interface ConstchatProcessLoopback {
  isSupported: () => Promise<boolean>;
  isExcludeSupported?: () => Promise<boolean>;
  getOwnPid?: () => Promise<number>;
  listWindows: () => Promise<ProcessLoopbackWindow[]>;
  start: (pid: string) => Promise<{ ok: true; format: unknown } | { ok: false; error: string }>;
  startExclude?: (pid: string) => Promise<{ ok: true; format: unknown } | { ok: false; error: string }>;
  stop: () => Promise<boolean>;
  onChunk: (cb: (chunk: Uint8Array) => void) => () => void;
  onEnd: (cb: () => void) => () => void;
}

function bridge(): ConstchatProcessLoopback | null {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { constchat?: { processLoopback?: ConstchatProcessLoopback } }).constchat;
  return c?.processLoopback ?? null;
}

export async function isProcessLoopbackSupported(): Promise<boolean> {
  const pl = bridge();
  if (!pl) return false;
  try {
    return await pl.isSupported();
  } catch {
    return false;
  }
}

export async function isExcludeLoopbackSupported(): Promise<boolean> {
  const pl = bridge();
  if (!pl?.isExcludeSupported) return false;
  try {
    return await pl.isExcludeSupported();
  } catch {
    return false;
  }
}

export async function getSwiipOwnPid(): Promise<number | null> {
  const pl = bridge();
  if (!pl?.getOwnPid) return null;
  try {
    const pid = await pl.getOwnPid();
    return typeof pid === 'number' && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export async function listProcessLoopbackWindows(): Promise<ProcessLoopbackWindow[]> {
  const pl = bridge();
  if (!pl) return [];
  return pl.listWindows();
}

// Shared construction for both include and exclude modes. The only difference
// is which IPC starter we call; the AudioContext → worklet → destination chain
// is identical.
async function buildTrackFromLoopback(
  pl: ConstchatProcessLoopback,
  starter: () => Promise<{ ok: true; format: unknown } | { ok: false; error: string }>,
  modeLabel: string,
): Promise<ProcessLoopbackTrack> {
  // Force 48kHz so the int16 PCM we receive doesn't need resampling.
  const ctx = new AudioContext({ sampleRate: 48000 });
  await ctx.audioWorklet.addModule('/audio-worklets/pcm-feeder.js');

  const node = new AudioWorkletNode(ctx, 'pcm-feeder', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const dest = ctx.createMediaStreamDestination();
  node.connect(dest);

  const result = await starter();
  if (!result.ok) {
    try { node.disconnect(); } catch { /* noop */ }
    try { dest.disconnect(); } catch { /* noop */ }
    try { await ctx.close(); } catch { /* noop */ }
    throw new Error(`ProcessLoopback ${modeLabel} start failed: ${result.error}`);
  }

  const cleanupChunk = pl.onChunk((chunk) => {
    // IPC gives us a Uint8Array. The worklet expects an ArrayBuffer. Slice
    // (zero-copy semantics for the renderer since we own this chunk) so we
    // can post it as a transferable.
    const ab = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
    node.port.postMessage(ab, [ab]);
  });

  let ended = false;
  const cleanupEnd = pl.onEnd(() => {
    ended = true;
  });

  const track = dest.stream.getAudioTracks()[0];
  if (!track) {
    cleanupChunk();
    cleanupEnd();
    try { await pl.stop(); } catch { /* noop */ }
    try { await ctx.close(); } catch { /* noop */ }
    throw new Error('MediaStreamDestination produced no audio track');
  }

  const dispose = async () => {
    cleanupChunk();
    cleanupEnd();
    if (!ended) {
      try { await pl.stop(); } catch { /* noop */ }
    }
    try { node.port.postMessage({ type: 'reset' }); } catch { /* noop */ }
    try { node.disconnect(); } catch { /* noop */ }
    try { dest.disconnect(); } catch { /* noop */ }
    try { track.stop(); } catch { /* noop */ }
    try { await ctx.close(); } catch { /* noop */ }
  };

  return { track, dispose };
}

export async function createProcessLoopbackTrack(pid: string): Promise<ProcessLoopbackTrack> {
  const pl = bridge();
  if (!pl) throw new Error('ProcessLoopback bridge unavailable');
  return buildTrackFromLoopback(pl, () => pl.start(pid), 'include');
}

export async function createExcludeLoopbackTrack(pid: string): Promise<ProcessLoopbackTrack> {
  const pl = bridge();
  if (!pl) throw new Error('ProcessLoopback bridge unavailable');
  if (!pl.startExclude) throw new Error('ProcessLoopback exclude mode not available');
  return buildTrackFromLoopback(pl, () => pl.startExclude!(pid), 'exclude');
}
