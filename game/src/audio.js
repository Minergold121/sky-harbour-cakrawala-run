// Synthesised sound: no audio files, everything is WebAudio
// oscillators started on the first user gesture.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (engineGain) engineGain.gain.value = 0;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 68;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOsc.start();
}

export function engineSound(throttle, speed, active) {
  if (!ctx || !engineOsc || muted) return;
  const target = active ? 0.028 + throttle * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
  engineOsc.frequency.setTargetAtTime(58 + throttle * 70 + speed * 0.12, ctx.currentTime, 0.1);
}

function tone(freq, dur, type = 'sine', vol = 0.16, slideTo = null) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function playEvent(kind) {
  if (!ctx || muted) return;
  if (kind === 'ring') {
    tone(880, 0.14, 'sine', 0.18);
    setTimeout(() => tone(1320, 0.18, 'sine', 0.14), 70);
  } else if (kind === 'perfect') {
    tone(880, 0.12, 'sine', 0.18);
    setTimeout(() => tone(1108, 0.12, 'sine', 0.16), 80);
    setTimeout(() => tone(1760, 0.22, 'sine', 0.15), 160);
  } else if (kind === 'ribbonReady') {
    tone(660, 0.3, 'triangle', 0.14, 1320);
  } else if (kind === 'burst') {
    tone(220, 0.5, 'sawtooth', 0.12, 660);
  } else if (kind === 'storm') {
    tone(120, 0.4, 'square', 0.16, 55);
  } else if (kind === 'miss') {
    tone(330, 0.25, 'sine', 0.12, 220);
  } else if (kind === 'leg') {
    tone(523, 0.15, 'triangle', 0.14);
    setTimeout(() => tone(784, 0.2, 'triangle', 0.14), 110);
  } else if (kind === 'land' || kind === 'landHard') {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.15), i * 130));
  } else if (kind === 'over') {
    tone(392, 0.3, 'sine', 0.14, 196);
  }
}
