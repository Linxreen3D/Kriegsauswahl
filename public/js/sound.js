// Kleine synthetische Soundeffekte (keine Audiodateien nötig)
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('fl_sound') !== '0'; } catch { /* egal */ }

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.1, freq = 800) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start();
}

export const sfx = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; try { localStorage.setItem('fl_sound', enabled ? '1' : '0'); } catch { /* egal */ } return enabled; },
  unlock() { if (enabled) ac(); },
  click() { if (enabled) tone(660, 0.06, 'triangle', 0.04); },
  send() { if (enabled) tone(320, 0.12, 'triangle', 0.05, 180); },
  capture() { if (enabled) { tone(520, 0.12, 'triangle', 0.06); tone(780, 0.18, 'triangle', 0.06, 0, 0.08); } },
  lost() { if (enabled) { tone(300, 0.25, 'sawtooth', 0.04, -140); } },
  build() { if (enabled) { tone(440, 0.08, 'square', 0.03); tone(660, 0.1, 'square', 0.03, 0, 0.07); } },
  strike() { if (enabled) { noise(0.5, 0.18, 600); tone(120, 0.4, 'sine', 0.1, -60); } },
  alert() { if (enabled) { tone(880, 0.1, 'sine', 0.05); tone(880, 0.1, 'sine', 0.05, 0, 0.15); } },
  command() { if (enabled) tone(520, 0.05, 'triangle', 0.035); },
  error() { if (enabled) tone(180, 0.15, 'square', 0.04); },
  shot(c) { if (enabled) { if (c === 2) noise(0.08, 0.06, 2500); else if (c === 1) noise(0.25, 0.08, 400); else tone(900, 0.05, 'triangle', 0.015, -400); } },
  crash() { if (enabled) noise(0.6, 0.12, 500); },
  win() { if (enabled) [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.12)); },
};
