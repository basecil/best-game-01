// TIDEGLASS — every sound is synthesized with WebAudio: short plucks, chimes
// that climb with the cascade, and small win/lose figures. No audio files.
// The context is made on the first player gesture and stays silent until then,
// so a screenshot run (no gesture) never touches audio at all.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, start, dur, type, gain) {
    const ctx = ensure();
    if (!ctx || muted || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0, ctx.currentTime + start);
    amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }

  /** Call from a real gesture (click or key) so the browser lets sound start. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function select() {
    tone(660, 0, 0.07, 'sine', 0.08);
  }

  function swap() {
    tone(440, 0, 0.06, 'triangle', 0.07);
    tone(587, 0.05, 0.06, 'triangle', 0.06);
  }

  function invalid() {
    tone(180, 0, 0.12, 'sawtooth', 0.05);
  }

  /** A match chimes an arpeggio; deeper cascades start higher. */
  function match(depth) {
    const base = 523 * (1 + (Math.min(depth, 5) - 1) * 0.12);
    tone(base, 0, 0.16, 'sine', 0.1);
    tone(base * 1.25, 0.07, 0.16, 'sine', 0.09);
    tone(base * 1.5, 0.14, 0.2, 'sine', 0.08);
  }

  function pearl() {
    tone(1047, 0, 0.2, 'sine', 0.09);
    tone(1319, 0.08, 0.2, 'sine', 0.08);
    tone(1568, 0.16, 0.28, 'sine', 0.07);
  }

  function surge() {
    tone(392, 0, 0.12, 'sine', 0.1);
    tone(523, 0.08, 0.12, 'sine', 0.1);
    tone(659, 0.16, 0.12, 'sine', 0.1);
    tone(784, 0.24, 0.22, 'sine', 0.09);
  }

  function clear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, index) => tone(freq, index * 0.09, 0.22, 'sine', 0.1));
  }

  function over() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, index) => tone(freq, index * 0.12, 0.24, 'triangle', 0.09));
  }

  function win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, index) => tone(freq, index * 0.1, 0.26, 'sine', 0.1));
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { unlock, select, swap, invalid, match, pearl, surge, clear, over, win, toggleMute, isMuted: () => muted };
}
