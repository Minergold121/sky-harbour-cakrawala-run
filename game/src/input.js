// Keyboard + mouse input. Pointer drag steers the plane; clicks
// hit the on-screen buttons (start / pause / sound / again).
import { BUTTONS } from './config.js';

export function createInput() {
  return {
    keys: new Set(),
    steerX: null,
    steerY: null,
    dragging: false,
    dragStart: null,
    boostPressed: false,
    muted: false,
    pausePressed: false,
    startPressed: false,
    restartPressed: false,
  };
}

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function attachInput(input, canvas, onAction) {
  const keymap = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      input.boostPressed = true;
      e.preventDefault();
    }
    if (e.code === 'KeyP') input.pausePressed = true;
    if (e.code === 'Enter') input.startPressed = true;
    if (e.code === 'KeyR') input.restartPressed = true;
    if (e.code === 'KeyM') {
      input.muted = !input.muted;
      onAction('mute', input.muted);
    }
    if (keymap[e.code]) {
      input.keys.add(keymap[e.code]);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (keymap[e.code]) input.keys.delete(keymap[e.code]);
  });
  window.addEventListener('blur', () => input.keys.clear());

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1280,
      y: ((e.clientY - rect.top) / rect.height) * 720,
    };
  }
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    if (inRect(p.x, p.y, BUTTONS.pause)) {
      input.pausePressed = true;
      return;
    }
    if (inRect(p.x, p.y, BUTTONS.sound)) {
      input.muted = !input.muted;
      onAction('mute', input.muted);
      return;
    }
    if (inRect(p.x, p.y, BUTTONS.start)) {
      input.startPressed = true;
      return;
    }
    input.dragging = true;
    input.dragStart = p;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.dragging || !input.dragStart) return;
    const p = pos(e);
    input.steerX = Math.max(-1, Math.min(1, (p.x - input.dragStart.x) / 220));
    input.steerY = Math.max(-1, Math.min(1, (p.y - input.dragStart.y) / 220));
  });
  function endDrag() {
    input.dragging = false;
    input.dragStart = null;
    input.steerX = null;
    input.steerY = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// Build the per-frame steering object stepGame consumes, then clear
// the one-shot flags so a held key cannot retrigger them.
export function readFrame(input) {
  const frame = {
    left: input.keys.has('left'),
    right: input.keys.has('right'),
    up: input.keys.has('up'),
    down: input.keys.has('down'),
    // W climbs and adds power; S descends and eases the throttle —
    // one stick, arcade feel, no extra keys to learn.
    throttleUp: input.keys.has('up'),
    throttleDown: input.keys.has('down'),
    boost: input.boostPressed,
    steerX: input.steerX,
    steerY: input.steerY,
  };
  input.boostPressed = false;
  return frame;
}

export function consumeFlags(input) {
  const flags = {
    pause: input.pausePressed,
    start: input.startPressed,
    restart: input.restartPressed,
  };
  input.pausePressed = false;
  input.startPressed = false;
  input.restartPressed = false;
  return flags;
}
