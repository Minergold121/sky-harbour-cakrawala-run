// Staged screenshot scenes (?shot=cover|title|ring|landing).
// Every scene is a real game state run through the same rules and
// the same renderer — nothing is drawn only for the screenshot.
import { LEGS, WORLD } from './config.js';
import { createGame } from './state.js';
import { ribbonPoint, runwayZ } from './world.js';

function busyMidFlight(state) {
  const ring = state.world.rings[16]; // leg 2, mid-route
  state.screen = 'play';
  state.score = 2480;
  state.combo = 6;
  state.bestCombo = 8;
  state.ringsHit = 16;
  state.ringsPerfect = 5;
  state.timeLeft = 196;
  state.fuel = 71;
  state.hull = 3;
  state.boost = 100;
  state.burst = 3.4;
  state.leg = 1;
  state.message = 'PITA ANGIN PENUH! TAILWIND BURST aktif — skor ring x2.';
  state.messageT = 99;
  state.flash = { text: 'SEMPURNA! +500', good: true, t: 99 };
  // Mark earlier rings judged, the next gate just ahead.
  for (let i = 0; i < 16; i += 1) {
    state.world.rings[i].passed = true;
    state.world.rings[i].result = i % 4 === 3 ? 'good' : 'perfect';
  }
  state.nextRing = 16;
  state.plane.z = ring.z - 46;
  state.plane.x = ring.x - 3;
  state.plane.alt = ring.alt - 20;
  state.plane.speed = 205;
  state.plane.throttle = 0.86;
  state.plane.bank = 0.28;
  state.plane.prop = 2.2;
  // Put a storm cell close on the right so the danger reads in-frame.
  const storm = state.world.storms[0];
  storm.x = state.plane.x + 24;
  storm.alt = state.plane.alt + 120;
  storm.z = state.plane.z + 120;
  return state;
}

export function buildShot(name, seed = WORLD.seed) {
  const state = createGame(seed);
  if (name === 'title') {
    state.screen = 'title';
    state.plane.prop = 1.4;
    return state;
  }
  if (name === 'ring') {
    busyMidFlight(state);
    const ring = state.world.rings[16];
    // Plane dead-centre in the gate at the moment of the pass.
    state.plane.z = ring.z - 2;
    state.plane.x = ring.x;
    state.plane.alt = ring.alt;
    state.flash = { text: 'SEMPURNA! +500', good: true, t: 99 };
    return state;
  }
  if (name === 'landing') {
    const rz = runwayZ();
    state.screen = 'play';
    state.score = 4860;
    state.combo = 4;
    state.ringsHit = 40;
    state.ringsPerfect = 18;
    state.timeLeft = 74;
    state.fuel = 34;
    state.hull = 2;
    state.leg = 2;
    state.message = 'Final: sejajarkan dengan landasan, turun perlahan, sentuh dengan lembut.';
    state.messageT = 99;
    for (const ring of state.world.rings) {
      ring.passed = true;
      ring.result = 'perfect';
    }
    state.world.rings[41].result = 'good';
    state.nextRing = state.world.rings.length;
    state.plane.z = rz - 55;
    state.plane.x = 1;
    state.plane.alt = 190;
    state.plane.speed = 132;
    state.plane.throttle = 0.34;
    state.plane.bank = 0;
    state.plane.pitch = -0.12;
    return state;
  }
  if (name === 'ribbon') {
    busyMidFlight(state);
    const ribbon = state.world.ribbons[3];
    const pt = ribbonPoint(ribbon, ribbon.z0 + 60);
    state.plane.z = ribbon.z0 + 60;
    state.plane.x = pt.x;
    state.plane.alt = pt.alt;
    state.boost = 62;
    state.burst = 0;
    state.flash = null;
    state.message = 'Terbang di dalam PITA ANGIN emas untuk mengisi boost.';
    return state;
  }
  // Default: cover = busy mid-flight.
  return busyMidFlight(state);
}

export const SHOT_NAMES = ['cover', 'title', 'ring', 'landing'];
