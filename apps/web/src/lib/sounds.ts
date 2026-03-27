let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  frequencies: number[],
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
) {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const stepDuration = duration / frequencies.length;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * stepDuration);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * stepDuration);
      osc.stop(ctx.currentTime + (i + 1) * stepDuration);
    });
  } catch {
    // Audio not available
  }
}

/** Short rising tone — someone joined the voice channel */
export function playJoinSound() {
  playTone([440, 580], 0.15, 'sine', 0.12);
}

/** Short falling tone — someone left the voice channel */
export function playLeaveSound() {
  playTone([580, 440], 0.15, 'sine', 0.12);
}

/** Longer falling tone — you disconnected from voice */
export function playDisconnectSound() {
  playTone([520, 400, 300], 0.3, 'sine', 0.15);
}
