// Sound design with WebAudio only (no files): a small synth kit + gentle generative music.
let ctx = null, master = null, musicGain = null, enabled = true, musicOn = true, musicTimer = null, noiseBuf = null;
function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noise() {
  if (noiseBuf) return noiseBuf;
  const c = ac(), b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf = b;
}
// A plucked note: fast attack, exponential decay, optional lowpass sweep for warmth.
function pluck(freq, t0 = 0, { dur = 0.35, type = 'triangle', vol = 0.22, cutoff = 3200, detune = 0, dest } = {}) {
  const c = ac(), t = c.currentTime + t0;
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff / 6), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
function hit(t0 = 0, { dur = 0.25, vol = 0.3, from = 1800, to = 120, q = 1 } = {}) { // filtered noise burst
  const c = ac(), t = c.currentTime + t0, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
}
const N = { C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
const PENTA = [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5, N.D5, N.E5, N.G5, N.A5];

export const sound = {
  setEnabled(v) { enabled = v; if (!v) this.stopMusic(); },
  setMusic(v) { musicOn = v; v ? this.startMusic() : this.stopMusic(); },
  unlock() { try { ac(); } catch {} },
  tap() { if (!enabled) return; try { pluck(1400, 0, { dur: 0.05, type: 'sine', vol: 0.05 }); } catch {} },
  correct(combo = 0) { if (!enabled) return; try {
    const step = Math.min(combo, 9), base = PENTA[step % PENTA.length];
    pluck(base, 0, { vol: 0.2 }); pluck(base * 1.5, 0.07, { vol: 0.16 }); pluck(base * 2, 0.14, { dur: 0.45, vol: 0.14 });
  } catch {} },
  fast() { if (!enabled) return; try { pluck(N.C6, 0.2, { dur: 0.12, type: 'sine', vol: 0.1 }); pluck(N.G6, 0.27, { dur: 0.25, type: 'sine', vol: 0.1 }); } catch {} },
  wrong() { if (!enabled) return; try { pluck(180, 0, { dur: 0.3, type: 'sawtooth', vol: 0.12, cutoff: 600 }); pluck(140, 0.12, { dur: 0.4, type: 'sawtooth', vol: 0.1, cutoff: 500 }); hit(0, { dur: 0.12, vol: 0.08, from: 400, to: 100 }); } catch {} },
  combo() { if (!enabled) return; try { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => pluck(f, i * 0.06, { dur: 0.3, vol: 0.14 })); } catch {} },
  fanfare() { if (!enabled) return; try { [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6, N.E6].forEach((f, i) => pluck(f, i * 0.11, { dur: 0.5, vol: 0.18 })); pluck(N.C4, 0.66, { dur: 1.2, type: 'sine', vol: 0.12 }); } catch {} },
  levelUp() { if (!enabled) return; try { [N.G4, N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => pluck(f, i * 0.08, { dur: 0.6, vol: 0.16, type: 'sine' })); hit(0.5, { dur: 0.6, vol: 0.12, from: 3000, to: 8000 }); } catch {} },
  coin() { if (!enabled) return; try { pluck(N.E6, 0, { dur: 0.1, type: 'square', vol: 0.08 }); pluck(N.G6 * 1.26, 0.08, { dur: 0.35, type: 'square', vol: 0.08 }); } catch {} },
  unlockOp() { if (!enabled) return; try { [N.C4, N.G4, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => pluck(f, i * 0.1, { dur: 0.9, type: 'sine', vol: 0.15 })); } catch {} },
  explode() { if (!enabled) return; try { hit(0, { dur: 0.45, vol: 0.35, from: 900, to: 60, q: 0.7 }); pluck(90, 0, { dur: 0.3, type: 'sine', vol: 0.2 }); } catch {} },
  laser() { if (!enabled) return; try { const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1600, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.18); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g).connect(master); o.start(t); o.stop(t + 0.22); } catch {} },
  whoosh() { if (!enabled) return; try { hit(0, { dur: 0.5, vol: 0.14, from: 300, to: 2500, q: 0.5 }); } catch {} },
  shield() { if (!enabled) return; try { pluck(240, 0, { dur: 0.5, type: 'square', vol: 0.1, cutoff: 900 }); hit(0, { dur: 0.3, vol: 0.15, from: 200, to: 80 }); } catch {} },
  blend() { if (!enabled) return; try { hit(0, { dur: 0.9, vol: 0.12, from: 200, to: 1200, q: 2 }); hit(0.3, { dur: 0.6, vol: 0.1, from: 1200, to: 300, q: 2 }); } catch {} },
  plant() { if (!enabled) return; try { pluck(520 + Math.random() * 200, 0, { dur: 0.08, type: 'sine', vol: 0.06 }); } catch {} },
  bingo() { if (!enabled) return; try { [N.C5, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => pluck(f, i * 0.09, { dur: 0.4, vol: 0.16 })); } catch {} },
  tick() { if (!enabled) return; try { pluck(900, 0, { dur: 0.03, type: 'square', vol: 0.04 }); } catch {} },

  // ---- soft generative music: slow pentatonic arpeggio with a pad, fades in/out ----
  startMusic() {
    if (!enabled || !musicOn || musicTimer) return;
    try {
      const c = ac(); musicGain.gain.cancelScheduledValues(c.currentTime); musicGain.gain.setTargetAtTime(0.28, c.currentTime, 1.5);
      const chords = [[N.C4, N.E4, N.G4], [N.A4 / 2, N.C4, N.E4], [N.G4 / 2, N.D4, N.G4], [N.E4 / 2 * 1.0, N.G4, N.D5 / 2]];
      let bar = 0, step = 0;
      const tickMusic = () => {
        if (!musicTimer) return;
        const chord = chords[bar % chords.length];
        if (step % 8 === 0) chord.forEach(f => pluck(f / 2, 0, { dur: 3.4, type: 'sine', vol: 0.05, cutoff: 800, dest: musicGain }));
        const note = chord[step % chord.length] * (step % 3 === 2 ? 2 : 1);
        if (Math.random() < 0.85) pluck(note, 0, { dur: 0.9, type: 'triangle', vol: 0.09, cutoff: 1800, detune: Math.random() * 6 - 3, dest: musicGain });
        step++; if (step % 8 === 0) bar++;
        musicTimer = setTimeout(tickMusic, 430);
      };
      musicTimer = setTimeout(tickMusic, 100);
    } catch {}
  },
  stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } try { if (musicGain) musicGain.gain.setTargetAtTime(0, ac().currentTime, 0.6); } catch {} },
  duckMusic(on) { try { if (musicGain && musicTimer) musicGain.gain.setTargetAtTime(on ? 0.12 : 0.28, ac().currentTime, 0.3); } catch {} },
};
