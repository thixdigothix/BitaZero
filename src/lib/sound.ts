let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  return audioCtx;
}

function playTone(freq: number, durationMs: number, type: OscillatorType, gainVal = 0.04) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Ignore audio errors if blocked
  }
}

export const soundFx = {
  pick: () => {
    playTone(523.25, 90, 'triangle', 0.05);
    setTimeout(() => playTone(659.25, 130, 'triangle', 0.05), 60);
  },
  skip: () => {
    playTone(340, 100, 'sine', 0.035);
  },
  goal: () => {
    playTone(587.33, 100, 'triangle', 0.06);
    setTimeout(() => playTone(783.99, 120, 'triangle', 0.06), 90);
    setTimeout(() => playTone(1046.5, 220, 'triangle', 0.06), 190);
  },
  whistle: () => {
    playTone(880, 120, 'sine', 0.04);
    setTimeout(() => playTone(987.77, 160, 'sine', 0.04), 140);
  },
};
