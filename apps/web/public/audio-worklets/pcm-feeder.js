/**
 * PCM Feeder — AudioWorkletProcessor
 *
 * Consumes int16LE stereo-interleaved PCM @ 48kHz arriving from the Electron
 * main process (ProcessLoopback → IPC → renderer → this worklet) and produces
 * Float32 audio frames suitable for a MediaStreamAudioDestinationNode.
 *
 * Buffering strategy: fixed ring buffer per channel. On underrun emit silence.
 * On overrun drop oldest samples to let realtime playback catch up.
 */

const RING_CAPACITY = 48000; // 1 second of headroom per channel @ 48kHz
const QUANTUM = 128;

class PcmFeederProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // One ring per output channel (stereo). Float32 samples, normalized -1..1.
    this._ringL = new Float32Array(RING_CAPACITY);
    this._ringR = new Float32Array(RING_CAPACITY);
    this._writeIdx = 0;
    this._readIdx = 0;
    this._available = 0;

    // Stats for occasional logging.
    this._underrunCount = 0;
    this._overrunDrops = 0;
    this._lastStatAt = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) {
        this._ingest(new Uint8Array(data));
      } else if (data && data.type === 'reset') {
        this._writeIdx = 0;
        this._readIdx = 0;
        this._available = 0;
      }
    };
  }

  _ingest(bytes) {
    // int16LE stereo interleaved → 4 bytes per frame
    const frameCount = bytes.byteLength >> 2;
    if (frameCount === 0) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // If the incoming batch would overflow the ring, drop enough oldest samples
    // to make room. This keeps realtime playback fresh under IPC bursts.
    if (this._available + frameCount > RING_CAPACITY) {
      const drop = this._available + frameCount - RING_CAPACITY;
      this._readIdx = (this._readIdx + drop) % RING_CAPACITY;
      this._available -= drop;
      this._overrunDrops += drop;
    }

    let w = this._writeIdx;
    for (let i = 0; i < frameCount; i++) {
      const l = view.getInt16(i * 4, true);
      const r = view.getInt16(i * 4 + 2, true);
      this._ringL[w] = l / 32768;
      this._ringR[w] = r / 32768;
      w++;
      if (w === RING_CAPACITY) w = 0;
    }
    this._writeIdx = w;
    this._available += frameCount;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const outL = out[0];
    const outR = out.length > 1 ? out[1] : out[0];

    if (this._available >= QUANTUM) {
      let r = this._readIdx;
      for (let i = 0; i < QUANTUM; i++) {
        outL[i] = this._ringL[r];
        outR[i] = this._ringR[r];
        r++;
        if (r === RING_CAPACITY) r = 0;
      }
      this._readIdx = r;
      this._available -= QUANTUM;
    } else {
      // Underrun — silence.
      for (let i = 0; i < QUANTUM; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
      this._underrunCount++;
    }

    // Throttled stat dump (~every 5s) so we can diagnose drift without spam.
    if (currentTime - this._lastStatAt > 5) {
      if (this._underrunCount > 0 || this._overrunDrops > 0) {
        this.port.postMessage({
          type: 'stats',
          underruns: this._underrunCount,
          overrunDrops: this._overrunDrops,
          buffered: this._available,
        });
        this._underrunCount = 0;
        this._overrunDrops = 0;
      }
      this._lastStatAt = currentTime;
    }

    return true;
  }
}

registerProcessor('pcm-feeder', PcmFeederProcessor);
