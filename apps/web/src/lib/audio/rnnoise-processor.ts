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

export class RnnoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'rnnoise-noise-suppressor';
  processedTrack?: MediaStreamTrack;

  private sourceNode?: MediaStreamAudioSourceNode;
  private rnnoiseNode?: AudioWorkletNode;
  private destinationNode?: MediaStreamAudioDestinationNode;
  private ownAudioContext?: AudioContext;

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

    // Build audio graph
    this.sourceNode = audioContext.createMediaStreamSource(mediaStream);
    this.rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
      maxChannels: 1,
      wasmBinary,
    });
    this.destinationNode = audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.rnnoiseNode);
    this.rnnoiseNode.connect(this.destinationNode);

    this.processedTrack = this.destinationNode.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    try {
      this.sourceNode?.disconnect();
      this.rnnoiseNode?.disconnect();
      (this.rnnoiseNode as any)?.destroy?.();
    } catch {
      // Ignore disconnect errors during cleanup
    }

    if (this.ownAudioContext?.state !== 'closed') {
      await this.ownAudioContext?.close().catch(() => {});
    }

    this.sourceNode = undefined;
    this.rnnoiseNode = undefined;
    this.destinationNode = undefined;
    this.ownAudioContext = undefined;
    this.processedTrack = undefined;
  }
}
