/**
 * Desktop Standard DSP Processor — AudioWorkletProcessor
 *
 * Conservative chain (no noise gate in v1):
 *   Input → 80Hz High-Pass Filter → [optional Expander] → Hard Limiter → Output
 *
 * The expander is present but DISABLED by default. Activate via:
 *   port.postMessage({ enableExpander: true })
 *
 * All DSP runs in a single process() call on 128-sample buffers @ 48kHz.
 */

class DesktopStandardProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // --- 80Hz 2nd-order Butterworth High-Pass Filter ---
    // Pre-computed coefficients for 80Hz @ 48kHz sample rate
    // These remove AC hum, desk vibration, wind rumble
    this._computeHPFCoefficients(80, sampleRate);

    // HPF state (per-channel, but we only process channel 0)
    this._hpf_x1 = 0;
    this._hpf_x2 = 0;
    this._hpf_y1 = 0;
    this._hpf_y2 = 0;

    // --- Expander (disabled by default) ---
    this._expanderEnabled = false;
    this._expanderThreshold = 0.00316; // -50dBFS in linear
    this._expanderRatio = 1.5;         // Gentle: 1.5:1
    this._expanderEnvelope = 0;
    // Attack/release in samples (10ms / 100ms @ 48kHz)
    this._expanderAttack = 1.0 - Math.exp(-1.0 / (0.010 * sampleRate));
    this._expanderRelease = 1.0 - Math.exp(-1.0 / (0.100 * sampleRate));

    // --- Soft Limiter at -3dBFS ---
    // Use a softer threshold with a gradual knee to avoid hard-clipping pops.
    // Samples above the threshold are smoothly attenuated using tanh soft-clip.
    this._limiterThreshold = 0.708; // -3dBFS in linear ≈ 10^(-3/20)

    // --- Latency reporting ---
    this._reportedLatency = false;

    // --- Message handling ---
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data.enableExpander !== undefined) {
        this._expanderEnabled = !!data.enableExpander;
      }
      if (data.expanderThreshold !== undefined) {
        this._expanderThreshold = data.expanderThreshold;
      }
      if (data.expanderRatio !== undefined) {
        this._expanderRatio = data.expanderRatio;
      }
      if (data.limiterThreshold !== undefined) {
        this._limiterThreshold = data.limiterThreshold;
      }
      if (data.bypass !== undefined) {
        this._bypass = !!data.bypass;
      }
    };

    this._bypass = false;
  }

  /**
   * Compute 2nd-order Butterworth HPF coefficients.
   * Standard bilinear transform from analog prototype.
   */
  _computeHPFCoefficients(freq, sr) {
    const w0 = 2 * Math.PI * freq / sr;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    // Q = 1/sqrt(2) for Butterworth
    const alpha = sinW0 / (2 * 0.7071067811865476);

    const a0 = 1 + alpha;
    this._hpf_b0 = ((1 + cosW0) / 2) / a0;
    this._hpf_b1 = (-(1 + cosW0)) / a0;
    this._hpf_b2 = ((1 + cosW0) / 2) / a0;
    this._hpf_a1 = (-2 * cosW0) / a0;
    this._hpf_a2 = (1 - alpha) / a0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];
    const len = inputChannel.length;

    // Report latency once (128 samples / sampleRate * 1000 = ms)
    if (!this._reportedLatency) {
      this._reportedLatency = true;
      const latencyMs = (len / sampleRate) * 1000;
      this.port.postMessage({ type: 'latency', latencyMs });
    }

    // Bypass mode — straight copy
    if (this._bypass) {
      outputChannel.set(inputChannel);
      return true;
    }

    for (let i = 0; i < len; i++) {
      let sample = inputChannel[i];

      // --- Stage 1: 80Hz HPF (2nd-order Butterworth) ---
      const hpfOut =
        this._hpf_b0 * sample +
        this._hpf_b1 * this._hpf_x1 +
        this._hpf_b2 * this._hpf_x2 -
        this._hpf_a1 * this._hpf_y1 -
        this._hpf_a2 * this._hpf_y2;

      this._hpf_x2 = this._hpf_x1;
      this._hpf_x1 = sample;
      this._hpf_y2 = this._hpf_y1;
      this._hpf_y1 = hpfOut;

      sample = hpfOut;

      // --- Stage 2: Expander (optional, disabled by default) ---
      if (this._expanderEnabled) {
        const absSample = Math.abs(sample);

        // Envelope follower
        if (absSample > this._expanderEnvelope) {
          this._expanderEnvelope += this._expanderAttack * (absSample - this._expanderEnvelope);
        } else {
          this._expanderEnvelope += this._expanderRelease * (absSample - this._expanderEnvelope);
        }

        // Apply expansion below threshold
        if (this._expanderEnvelope < this._expanderThreshold && this._expanderThreshold > 0) {
          const ratio = this._expanderEnvelope / this._expanderThreshold;
          const gain = Math.pow(ratio, this._expanderRatio - 1);
          sample *= gain;
        }
      }

      // --- Stage 3: Soft Limiter (tanh soft-clip) ---
      // Uses tanh curve above threshold for smooth limiting without audible pops.
      // Below threshold: passthrough. Above: gradual compression.
      if (sample > this._limiterThreshold) {
        const excess = (sample - this._limiterThreshold) / (1.0 - this._limiterThreshold);
        sample = this._limiterThreshold + (1.0 - this._limiterThreshold) * Math.tanh(excess);
      } else if (sample < -this._limiterThreshold) {
        const excess = (-sample - this._limiterThreshold) / (1.0 - this._limiterThreshold);
        sample = -(this._limiterThreshold + (1.0 - this._limiterThreshold) * Math.tanh(excess));
      }

      outputChannel[i] = sample;
    }

    return true;
  }
}

registerProcessor('desktop-standard-processor', DesktopStandardProcessor);
