// Synthesized sounds: plain WebAudio oscillators, no audio files and no
// network. Everything is guarded, so a browser without audio still plays.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.1, delay = 0, slideTo = null) {
    if (muted) return;
    const ac = ensure();
    if (ac === null) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish; a failure never breaks the game.
    }
  }

  return {
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    click() { tone(520, 0.07, 'sine', 0.07); },
    select() { tone(660, 0.06, 'sine', 0.08); },
    swap() { tone(300, 0.12, 'triangle', 0.09, 0, 520); },
    match(depth) {
      const base = 520 + Math.min(depth, 4) * 60;
      tone(base, 0.12, 'sine', 0.1);
      tone(base * 1.25, 0.14, 'sine', 0.09, 0.06);
      tone(base * 1.5, 0.18, 'sine', 0.08, 0.12);
    },
    pearl() {
      tone(880, 0.1, 'sine', 0.09);
      tone(1174, 0.12, 'sine', 0.09, 0.07);
      tone(1568, 0.16, 'sine', 0.08, 0.14);
    },
    surge() {
      tone(220, 0.35, 'sawtooth', 0.06, 0, 880);
      tone(440, 0.3, 'sine', 0.08, 0.05, 1320);
    },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.09));
    },
    over() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.11));
    },
  };
}
