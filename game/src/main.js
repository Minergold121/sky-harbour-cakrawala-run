// Boot + main loop. ?shot=<name>&seed=<n> renders one staged
// scene once and sets window.__shotReady for the screenshot tool;
// normal play runs the requestAnimationFrame loop.
import { createGame, startFlight, stepGame } from './state.js';
import { render } from './render.js';
import { attachInput, consumeFlags, createInput, readFrame } from './input.js';
import { ensureAudio, engineSound, playEvent, setMuted } from './audio.js';
import { buildShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : undefined;

if (shotName) {
  const state = buildShot(shotName, seed);
  render(ctx, state, 1.25);
  window.__shotReady = true;
  window.__shotState = state;
} else {
  const state = createGame(seed);
  const input = createInput();
  attachInput(input, canvas, (kind, value) => {
    if (kind === 'mute') {
      setMuted(value);
      document.getElementById('mute-note').textContent = value ? 'Suara: mati (M)' : 'Suara: hidup (M)';
    }
  });
  document.getElementById('start-btn').addEventListener('click', () => {
    ensureAudio();
    startFlight(state);
  });
  canvas.addEventListener('pointerdown', ensureAudio, { once: false });
  window.addEventListener('keydown', ensureAudio, { once: false });

  let last = performance.now();
  let shownMute = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const flags = consumeFlags(input);
    if (flags.start && (state.screen === 'title' || state.screen === 'win' || state.screen === 'over')) {
      ensureAudio();
      startFlight(state);
    }
    if (flags.restart && state.screen !== 'title') {
      startFlight(state);
    }
    if (flags.pause && (state.screen === 'play' || state.screen === 'pause')) {
      state.screen = state.screen === 'play' ? 'pause' : 'play';
    }
    if (state.screen === 'play') {
      const before = state.events.length;
      stepGame(state, readFrame(input), dt);
      for (let i = before; i < state.events.length; i += 1) playEvent(state.events[i].kind);
      state.events.length = 0;
      engineSound(state.plane.throttle, state.plane.speed, true);
    } else {
      engineSound(0, 0, false);
    }
    if (!shownMute) {
      shownMute = true;
      setMuted(input.muted);
    }
    render(ctx, state, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
