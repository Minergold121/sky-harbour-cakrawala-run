// Game state + rules. No DOM here, so Node can import this file
// and drive the whole flight for logic tests.
import { LEGS, PLANE, WORLD } from './config.js';
import { buildWorld, legEndZ, ribbonPoint, runwayZ } from './world.js';
import { clamp, lerp } from './random.js';

export function createGame(seed = WORLD.seed) {
  const world = buildWorld(seed);
  return {
    screen: 'title', // title | play | pause | leg | win | over
    seed,
    world,
    time: 0,
    timeLeft: WORLD.timeLimit,
    score: 0,
    bestCombo: 0,
    combo: 0,
    ringsHit: 0,
    ringsPerfect: 0,
    ribbonsFlown: 0,
    stormsHit: 0,
    fuelRings: 0,
    plane: {
      x: 0, z: 0, alt: 620, speed: PLANE.cruiseSpeed,
      throttle: 0.62, bank: 0, pitch: 0, heading: 90,
      prop: 0, invuln: 0, landed: false, flare: 0,
    },
    fuel: WORLD.startFuel,
    hull: WORLD.startHull,
    boost: 0, // 0..100 ribbon charge
    burst: 0, // seconds of Tailwind Burst left
    burstUsed: 0,
    nextRing: 0,
    leg: 0,
    legBanner: 0,
    message: 'Selamat datang di Cakrawala Run, Kapten Lintang.',
    messageT: 0,
    flash: null, // {text, good, t}
    events: [], // {kind, t} — read by audio in the browser, drained there
    finishedAt: 0,
    overReason: '',
    stats: null,
  };
}

export function currentLeg(state) {
  return Math.min(state.leg, LEGS.length - 1);
}

export function nextRingOf(state) {
  return state.world.rings[state.nextRing] || null;
}

export function ringDistance(state, ring) {
  if (!ring) return Infinity;
  const dx = state.plane.x - ring.x;
  // Altitude is stored in feet; 55 ft = 1 lateral unit, so the
  // ring hit test uses one consistent unit on both axes.
  const dy = (state.plane.alt - ring.alt) / 55;
  return Math.hypot(dx, dy);
}

function say(state, text, seconds = 3.2) {
  state.message = text;
  state.messageT = seconds;
}

function flash(state, text, good) {
  state.flash = { text, good, t: 1.4 };
}

function emit(state, kind) {
  state.events.push({ kind, t: state.time });
}

export function startFlight(state) {
  const fresh = createGame(state.seed);
  Object.assign(state, fresh);
  state.screen = 'play';
  say(state, `Leg 1: ${LEGS[0].from} → ${LEGS[0].to}. Terbang lewat ring emas!`, 4);
}

// Steering input: {left,right,up,down,throttleUp,throttleDown,boost,steerX,steerY}
// steerX/steerY are -1..1 pointer offsets (mouse drag), used when set.
export function stepGame(state, input, dt) {
  if (state.screen !== 'play') return;
  const p = state.plane;
  state.time += dt;
  state.timeLeft -= dt;
  p.prop += dt * (6 + p.throttle * 26);

  // Throttle + speed.
  if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.7, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.7, 0, 1);
  const targetSpeed = PLANE.minSpeed + p.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const burst = state.burst > 0;
  p.speed += clamp((targetSpeed + (burst ? 55 : 0)) - p.speed, -PLANE.drag * dt * 2, PLANE.accel * dt);
  p.speed = clamp(p.speed, 35, PLANE.maxSpeed + 60);

  // Steering: keyboard, then pointer drag overrides gently.
  let steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let climb = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  if (input.steerX !== null && input.steerX !== undefined) steer = clamp(input.steerX, -1, 1);
  if (input.steerY !== null && input.steerY !== undefined) climb = clamp(-input.steerY, -1, 1);
  p.bank = lerp(p.bank, steer * 0.62, Math.min(1, dt * 7));
  p.pitch = lerp(p.pitch, climb * 0.3, Math.min(1, dt * 6));
  p.x = clamp(p.x + steer * PLANE.turnRate * dt * (0.55 + p.speed / 300), -PLANE.lateralMax, PLANE.lateralMax);
  p.alt = clamp(p.alt + climb * PLANE.climbRate * dt, PLANE.altMin, PLANE.altMax);
  p.heading = (90 + p.bank * 26 + 360) % 360;

  // Forward motion.
  p.z += p.speed * 0.35 * dt;

  // Fuel: throttle + climbing burn it; running dry ends the run.
  state.fuel -= (WORLD.fuelDrain * (0.35 + p.throttle) + (climb > 0 ? WORLD.climbFuel : 0)) * dt;
  if (state.fuel <= 0) {
    state.fuel = 0;
    return endRun(state, 'Bahan bakar habis di tengah laut.');
  }
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    return endRun(state, 'Waktu habis sebelum mendarat.');
  }

  // Tailwind Burst trigger: Space with a full ribbon charge.
  if (input.boost && state.boost >= 100 && state.burst <= 0) {
    state.burst = WORLD.burstSeconds;
    state.boost = 0;
    state.burstUsed += 1;
    flash(state, 'TAILWIND BURST! Skor ring x2', true);
    say(state, 'Angin ekor penuh! Kecepatan dan skor berlipat.', 2.6);
    emit(state, 'burst');
  }
  if (state.burst > 0) state.burst -= dt;

  // Ribbon charging: inside a ribbon stream, charge rises fast.
  let inRibbon = false;
  for (const ribbon of state.world.ribbons) {
    if (p.z >= ribbon.z0 && p.z <= ribbon.z1) {
      const pt = ribbonPoint(ribbon, p.z);
      if (Math.abs(p.x - pt.x) < 13 && Math.abs(p.alt - pt.alt) < 190) {
        inRibbon = true;
        const wasFull = state.boost >= 100;
        state.boost = clamp(state.boost + WORLD.ribbonCharge * dt, 0, 100);
        if (!wasFull && state.boost >= 100) {
          flash(state, 'PITA ANGIN PENUH — tekan SPASI!', true);
          emit(state, 'ribbonReady');
        }
      }
    }
  }
  if (inRibbon) state.ribbonsFlown += dt;

  // Storm collision (once per cell, brief invulnerability after a hit).
  if (p.invuln > 0) p.invuln -= dt;
  for (const storm of state.world.storms) {
    if (storm.hit || Math.abs(p.z - storm.z) > 9) continue;
    const d = Math.hypot(p.x - storm.x, (p.alt - storm.alt) / 22);
    if (d < storm.r && p.invuln <= 0) {
      storm.hit = true;
      state.stormsHit += 1;
      state.hull -= 1;
      state.combo = 0;
      p.invuln = 2;
      p.speed = Math.max(70, p.speed - 45);
      flash(state, 'BADAI! Lambung -1', false);
      say(state, 'Hindari awan badai gelap — putar sedikit ke samping.', 3);
      emit(state, 'storm');
      if (state.hull <= 0) return endRun(state, 'Pesawat rusak diterjang badai.');
    }
  }

  // Ring gates: judge the moment the plane crosses the ring plane.
  const ring = nextRingOf(state);
  if (ring && p.z >= ring.z) {
    const d = ringDistance(state, ring);
    const perfect = d <= WORLD.perfectRadius;
    const hit = d <= WORLD.ringRadius;
    ring.passed = true;
    ring.result = hit ? (perfect ? 'perfect' : 'good') : 'miss';
    state.nextRing += 1;
    if (hit) {
      state.ringsHit += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const mult = burst ? 2 : 1;
      const comboMult = 1 + Math.min(2, (state.combo - 1) * 0.1);
      const base = perfect ? 250 : 100;
      if (perfect) state.ringsPerfect += 1;
      if (ring.fuel) {
        state.fuel = clamp(state.fuel + 25, 0, 100);
        state.fuelRings += 1;
      }
      state.score += Math.round(base * mult * comboMult);
      flash(state, perfect ? `SEMPURNA! +${Math.round(base * mult * comboMult)}` : `Ring! +${Math.round(base * mult * comboMult)}`, true);
      emit(state, perfect ? 'perfect' : 'ring');
      if (state.combo > 0 && state.combo % 7 === 0) say(state, `Kombo ${state.combo}! Terus jaga ritmenya, Kapten.`, 2.6);
    } else {
      state.combo = 0;
      flash(state, 'Ring terlewat — kombo putus', false);
      emit(state, 'miss');
    }
    // Leg finished when its last ring is judged.
    if (ring.index === WORLD.ringsPerLeg - 1) {
      const doneLeg = ring.leg;
      if (doneLeg < LEGS.length - 1) {
        state.leg = doneLeg + 1;
        state.legBanner = 3;
        say(state, `Leg ${doneLeg + 2}: ${LEGS[doneLeg + 1].from} → ${LEGS[doneLeg + 1].to}.`, 4);
        emit(state, 'leg');
      }
    }
  }
  if (state.legBanner > 0) state.legBanner -= dt;

  // Final approach: past the last ring, the runway is the target.
  // The window is deliberately generous: a fast plane covers the
  // last stretch quickly, so the pilot gets room to slow and sink.
  const rz = runwayZ();
  if (p.z >= rz - 420 && p.z < rz + 120) {
    // Landing window: low, slow, centred.
    const aligned = Math.abs(p.x) < 12 && p.alt < 420;
    if (p.z >= rz && aligned && p.speed < 200) {
      p.landed = true;
      return finishRun(state, true);
    }
    if (p.z >= rz + 120) {
      // Past the strip: a rough arrival still counts if the pilot
      // kept it low and near the centreline.
      p.landed = Math.abs(p.x) < 18 && p.alt < 650;
      return finishRun(state, p.landed);
    }
  }
  if (p.alt <= PLANE.altMin + 1 && p.z > 200 && p.z < rz - 260) {
    // Skimming the waves far from the runway: splash warning, bounce back up.
    p.alt = PLANE.altMin + 40;
    flash(state, 'Hati-hati ombak!', false);
  }

  if (state.messageT > 0) state.messageT -= dt;
  if (state.flash && (state.flash.t -= dt) <= 0) state.flash = null;
}

export function gradeFor(score, ringsHit, totalRings, landed) {
  if (!landed) return 'C';
  const rate = ringsHit / Math.max(1, totalRings);
  if (score >= 5200 && rate >= 0.85) return 'S';
  if (score >= 3800 && rate >= 0.7) return 'A';
  if (score >= 2200 && rate >= 0.5) return 'B';
  return 'C';
}

function finishRun(state, landed) {
  const total = state.world.rings.length;
  const bonus = landed ? 800 + Math.round(state.fuel * 4) + state.hull * 150 : 0;
  state.score += bonus;
  state.finishedAt = state.time;
  state.stats = {
    score: state.score, landingBonus: bonus, ringsHit: state.ringsHit,
    totalRings: total, perfect: state.ringsPerfect, bestCombo: state.bestCombo,
    burstUsed: state.burstUsed, stormsHit: state.stormsHit, fuelLeft: Math.round(state.fuel),
    hull: state.hull, time: Math.round(state.time), landed,
    grade: gradeFor(state.score, state.ringsHit, total, landed),
  };
  state.screen = 'win';
  say(state, landed ? 'Mendarat mulus di Bandara Cakrawala!' : 'Mendarat darurat di ujung landasan.', 4);
  emit(state, landed ? 'land' : 'landHard');
}

function endRun(state, reason) {
  state.overReason = reason;
  state.finishedAt = state.time;
  state.stats = {
    score: state.score, landingBonus: 0, ringsHit: state.ringsHit,
    totalRings: state.world.rings.length, perfect: state.ringsPerfect,
    bestCombo: state.bestCombo, burstUsed: state.burstUsed,
    stormsHit: state.stormsHit, fuelLeft: Math.round(state.fuel),
    hull: state.hull, time: Math.round(state.time), landed: false,
    grade: 'C',
  };
  state.screen = 'over';
  emit(state, 'over');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatHeading(deg) {
  return String(Math.round(((deg % 360) + 360) % 360)).padStart(3, '0');
}
