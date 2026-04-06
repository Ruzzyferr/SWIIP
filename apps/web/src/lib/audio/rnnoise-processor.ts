/**
 * RnnoiseProcessor — LiveKit TrackProcessor implementation using RNNoise WASM.
 *
 * Pipes mic audio through RNNoise AudioWorklet for ML-based noise suppression.
 * Chain: MediaStreamSource → RnnoiseWorkletNode → MediaStreamDestination
 *
 * RNNoise expects 48kHz, 480 samples/frame (10ms). The worklet handles buffering.
 * WASM + worklet files are served from /rnnoise/ (public directory).
 */

import { Track, type AudioProcessorOptions, type TrackProcessor } from 'livekit-client';

/**
 * Default gain multiplier to compensate for RNNoise signal attenuation.
 * RNNoise suppresses noise by reducing overall amplitude — this restores it.
 */
const DEFAULT_RNNOISE_COMPENSATION_GAIN = 2.2;

export class RnnoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'rnnoise-noise-suppressor';
  processedTrack?: MediaStreamTrack;

  private sourceNode?: MediaStreamAudioSourceNode;
  private rnnoiseNode?: AudioWorkletNode;
  private limiterNode?: DynamicsCompressorNode;
  private gainNode?: GainNode;
  private destinationNode?: MediaStreamAudioDestinationNode;
  private ownAudioContext?: AudioContext;
  private compensationGain: number;

  constructor(compensationGain?: number) {
    this.compensationGain = Math.max(1.0, Math.min(4.0, compensationGain ?? DEFAULT_RNNOISE_COMPENSATION_GAIN));
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    const { track } = opts;
    const mediaStream = new MediaStream([track]);

    // Use LiveKit's AudioContext if 48kHz, otherwise create our own
    // RNNoise requires 48kHz sample rate
    let audioContext = opts.audioContext;
    if (audioContext.sampleRate !== 48000) {
      this.ownAudioContext = new AudioContext({ sampleRate: 48000 });
      audioContext = this.ownAudioContext;
    }

    // Load WASM binary and worklet from public directory
    const { RnnoiseWorkletNode, loadRnnoise } = await import(
      '@sapphi-red/web-noise-suppressor'
    );

    const wasmBinary = await loadRnnoise({
      url: '/rnnoise/rnnoise.wasm',
      simdUrl: '/rnnoise/rnnoise_simd.wasm',
    });

    // Register the worklet processor from public directory
    await audioContext.audioWorklet.addModule('/rnnoise/workletProcessor.js');

    // Build audio graph: source → limiter → rnnoise → gain (compensation) → destination
    this.sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // Soft limiter before RNNoise to prevent input distortion when volume > 100%
    this.limiterNode = audioContext.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1;   // dBFS
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;       // Hard limiting
    this.limiterNode.attack.value = 0.001;   // 1ms
    this.limiterNode.release.value = 0.01;   // 10ms

    this.rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
      maxChannels: 1,
      wasmBinary,
    });
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = this.compensationGain;
    this.destinationNode = audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.limiterNode);
    this.limiterNode.connect(this.rnnoiseNode);
    this.rnnoiseNode.connect(this.gainNode);
    this.gainNode.connect(this.destinationNode);

    this.processedTrack = this.destinationNode.stream.getAudioTracks()[0];
  }

  /**
   * Set the input gain multiplier (0–2 range from store's 0–100 inputVolume).
   * This is layered on top of the RNNoise compensation gain.
   */
  setInputGain(normalized: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.compensationGain * normalized;
    }
  }

  /**
   * Update the compensation gain at runtime (e.g. from settings change).
   */
  setCompensationGain(gain: number): void {
    this.compensationGain = Math.max(1.0, Math.min(4.0, gain));
    if (this.gainNode) {
      this.gainNode.gain.value = this.compensationGain;
    }
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    try {
      this.sourceNode?.disconnect();
      this.limiterNode?.disconnect();
      this.rnnoiseNode?.disconnect();
      this.gainNode?.disconnect();
      (this.rnnoiseNode as any)?.destroy?.();
    } catch {
      // Ignore disconnect errors during cleanup
    }

    if (this.ownAudioContext?.state !== 'closed') {
      await this.ownAudioContext?.close().catch(() => {});
    }

    this.sourceNode = undefined;
    this.limiterNode = undefined;
    this.rnnoiseNode = undefined;
    this.gainNode = undefined;
    this.destinationNode = undefined;
    this.ownAudioContext = undefined;
    this.processedTrack = undefined;
  }
}
