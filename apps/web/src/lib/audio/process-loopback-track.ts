// Renderer-side helper for Windows per-process audio capture via Electron
// ProcessLoopback IPC. Builds an AudioContext → PcmFeeder worklet →
// MediaStreamAudioDestinationNode chain, exposes the resulting audio track to
// be published to LiveKit as ScreenShareAudio.
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
  listWindows: () => Promise<ProcessLoopbackWindow[]>;
  start: (pid: string) => Promise<{ ok: true; format: unknown } | { ok: false; error: string }>;
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

export async function listProcessLoopbackWindows(): Promise<ProcessLoopbackWindow[]> {
  const pl = bridge();
  if (!pl) return [];
  return pl.listWindows();
}

export async function createProcessLoopbackTrack(pid: string): Promise<ProcessLoopbackTrack> {
  const pl = bridge();
  if (!pl) throw new Error('ProcessLoopback bridge unavailable');

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

  const result = await pl.start(pid);
  if (!result.ok) {
    try { node.disconnect(); } catch { /* noop */ }
    try { dest.disconnect(); } catch { /* noop */ }
    try { await ctx.close(); } catch { /* noop */ }
    throw new Error(`ProcessLoopback start failed: ${result.error}`);
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
