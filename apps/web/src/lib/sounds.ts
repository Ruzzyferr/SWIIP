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

/** Short double-ping — new message notification (Discord-style) */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    // First ping
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.08);

    // Second ping (slightly higher, delayed)
    const gain2 = ctx.createGain();
    gain2.connect(ctx.destination);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, ctx.currentTime + 0.1);
    osc2.connect(gain2);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.18);
  } catch {
    // Audio not available
  }
}

/** Lower tone — mention notification */
export function playMentionSound() {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio not available
  }
}
