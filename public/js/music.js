// Erzeugte Hintergrundmusik (Web Audio, ohne Audiodateien): ruhige Flächen in einer modalen Akkordfolge,
// gelegentliche Glockentöne; bei Gefahr tiefer, mit Pulsschlag. Lautstärke getrennt von den Effekten.
let ctx = null, master = null, filter = null, timer = null, step = 0, tension = 0, tensionUntil = 0;
let volume = 0.35, enabled = true;
try { const v = parseFloat(localStorage.getItem('fl_music')); if (Number.isFinite(v)) volume = v; enabled = localStorage.getItem('fl_music_on') !== '0'; } catch { /* egal */ }

// D-dorisch: Dm – F – C – G – Dm – Bb – C – Am (Halbtöne über D2)
const ROOT = 73.42;
const PROG = [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [5, 9, 12], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [7, 10, 14]];
const hz = semi => ROOT * Math.pow(2, semi / 12);

function init() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  master = ctx.createGain(); master.gain.value = 0;
  filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 0.4;
  // kleiner Hall aus zwei Verzögerungen
  const d1 = ctx.createDelay(1), d2 = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
  d1.delayTime.value = 0.37; d2.delayTime.value = 0.53; fb.gain.value = 0.35; wet.gain.value = 0.3;
  filter.connect(master); filter.connect(d1); d1.connect(d2); d2.connect(fb); fb.connect(d1); d2.connect(wet); wet.connect(master);
  master.connect(ctx.destination);
  return ctx;
}
function pad(freq, t, dur, vol) {
  for (const det of [-4, 4]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(filter); o.start(t); o.stop(t + dur + 0.1);
  }
}
function bell(freq, t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
  o.connect(g).connect(filter); o.start(t); o.stop(t + 3.1);
}
function drum(t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.5);
}
// ein Takt (8 s ruhig, 6 s bei Gefahr)
function bar() {
  if (!ctx || !enabled) return;
  const now = ctx.currentTime + 0.05, tense = tension > 0.5, len = tense ? 6 : 8;
  const chord = PROG[step % PROG.length], shift = tense ? -5 : 0;
  for (const n of chord) pad(hz(n + 12 + shift), now, len + 1.5, 0.05);
  pad(hz(chord[0] + shift), now, len + 1.5, 0.06);
  if (!tense && Math.random() < 0.6) bell(hz(chord[Math.floor(Math.random() * 3)] + 36), now + 2 + Math.random() * 4, 0.025);
  if (tense) for (let b = 0; b < len; b += 1) drum(now + b, 0.12 * (b % 2 ? 0.6 : 1));
  filter.frequency.setTargetAtTime(tense ? 600 : 900, now, 2);
  step++;
  if (tensionUntil < performance.now()) tension = Math.max(0, tension - 0.5);
  timer = setTimeout(bar, len * 1000);
}
function fade(to) { if (master) master.gain.setTargetAtTime(to, ctx.currentTime, 1.5); }

export const music = {
  get volume() { return volume; },
  get enabled() { return enabled; },
  // nach einer Nutzeraktion starten (Browser verlangen das)
  start() { if (!enabled || !init()) return; if (ctx.state === 'suspended') ctx.resume(); fade(volume * 0.5); if (!timer) bar(); },
  stop() { fade(0); clearTimeout(timer); timer = null; },
  setVolume(v) { volume = Math.max(0, Math.min(1, v)); try { localStorage.setItem('fl_music', String(volume)); } catch { /* egal */ } if (timer) fade(volume * 0.5); },
  setEnabled(on) { enabled = !!on; try { localStorage.setItem('fl_music_on', on ? '1' : '0'); } catch { /* egal */ } if (on) this.start(); else this.stop(); },
  // Gefahr (Angriff, Atomwarnung): für eine Weile angespannter
  alarm() { tension = 1; tensionUntil = performance.now() + 45000; },
};
