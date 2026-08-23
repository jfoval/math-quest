// Tiny synth so we need no audio files. All sounds are generated with WebAudio.
let ctx = null, enabled = true;
function ac() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
function tone(freq, t0, dur, type = 'sine', vol = 0.18) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
}
export const sound = {
  setEnabled(v) { enabled = v; },
  unlock() { try { ac(); } catch {} },
  tap() { if (!enabled) return; try { tone(600, 0, 0.05, 'square', 0.05); } catch {} },
  correct(combo = 0) { if (!enabled) return; try {
    const base = 523 + Math.min(combo, 8) * 40;
    tone(base, 0, 0.12, 'triangle'); tone(base * 1.25, 0.08, 0.14, 'triangle'); tone(base * 1.5, 0.16, 0.2, 'triangle');
  } catch {} },
  fast() { if (!enabled) return; try { tone(1200, 0.25, 0.08, 'sine', 0.12); tone(1600, 0.32, 0.12, 'sine', 0.12); } catch {} },
  wrong() { if (!enabled) return; try { tone(220, 0, 0.18, 'sawtooth', 0.12); tone(180, 0.15, 0.25, 'sawtooth', 0.12); } catch {} },
  combo() { if (!enabled) return; try { [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.06, 0.12, 'square', 0.08)); } catch {} },
  fanfare() { if (!enabled) return; try { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.16)); } catch {} },
  tick() { if (!enabled) return; try { tone(900, 0, 0.03, 'square', 0.04); } catch {} },
  unlockOp() { if (!enabled) return; try { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.4, 'sine', 0.15)); } catch {} },
};
