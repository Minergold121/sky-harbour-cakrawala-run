// World generation: islands, clouds, rings, ribbons and storm cells.
// Everything is derived from one seed, so the route never changes
// between runs and the screenshots are reproducible.
import { LEGS, WORLD } from './config.js';
import { mulberry32, range, pick } from './random.js';

const ISLAND_KINDS = ['volcano', 'palms', 'lighthouse', 'village', 'terraces'];

export function ringZ(leg, index) {
  const legStart = leg * (WORLD.ringsPerLeg * WORLD.ringSpacing + WORLD.legGap);
  return 170 + legStart + index * WORLD.ringSpacing;
}

export function legEndZ(leg) {
  return ringZ(leg, WORLD.ringsPerLeg - 1) + WORLD.legGap + 60;
}

export function runwayZ() {
  return legEndZ(LEGS.length - 1) + 130;
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const islands = [];
  const clouds = [];
  const storms = [];
  const ribbons = [];
  const rings = [];
  const totalZ = runwayZ() + 420;

  // Islands: alternating sides, never on the flight line itself.
  for (let z = 240; z < totalZ; z += range(rng, 210, 300)) {
    const side = islands.length % 2 === 0 ? -1 : 1;
    islands.push({
      x: side * range(rng, 42, 78),
      z,
      r: range(rng, 16, 34),
      h: range(rng, 9, 26),
      kind: pick(rng, ISLAND_KINDS),
      palms: Math.floor(range(rng, 3, 8)),
      seed: Math.floor(rng() * 10000),
    });
  }
  // Home island with the departure strip, right under the start.
  islands.unshift({ x: -34, z: 60, r: 42, h: 8, kind: 'village', palms: 6, seed: 7 });

  // Clouds: high, soft, scattered across the whole route.
  for (let z = 120; z < totalZ; z += range(rng, 70, 130)) {
    clouds.push({
      x: range(rng, -95, 95),
      y: range(rng, 1500, 2900),
      z,
      s: range(rng, 18, 46),
      puff: 0.6 + rng() * 0.7,
    });
  }

  // Rings: one per gate, altitudes weave up and down; every 5th ring
  // on legs 2-3 is a blue fuel ring, the rest are gold score rings.
  for (let leg = 0; leg < LEGS.length; leg += 1) {
    let alt = 900;
    for (let i = 0; i < WORLD.ringsPerLeg; i += 1) {
      alt += range(rng, -260, 260);
      alt = Math.max(420, Math.min(2300, alt));
      const fuel = leg > 0 && i % 5 === 4;
      rings.push({
        leg,
        index: i,
        x: range(rng, -34, 34),
        alt: Math.round(alt),
        z: ringZ(leg, i),
        fuel,
        passed: false,
        result: null,
      });
    }
  }

  // Tailwind ribbons: golden wind streams between rings. Flying the
  // ribbon charges the boost; the charge is the game's one original
  // mechanic (see state.js: applyRibbon).
  for (let leg = 0; leg < LEGS.length; leg += 1) {
    for (let k = 0; k < 3; k += 1) {
      const z0 = ringZ(leg, 2 + k * 4) + 30;
      ribbons.push({
        leg,
        z0,
        z1: z0 + 190,
        x0: range(rng, -28, 28),
        x1: range(rng, -28, 28),
        a0: range(rng, 600, 1900),
        a1: range(rng, 600, 1900),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // Storm cells: only from leg 2 on, always off the ideal line so a
  // careful pilot can thread past them.
  for (let leg = 1; leg < LEGS.length; leg += 1) {
    for (let k = 0; k < 4; k += 1) {
      const near = rings[leg * WORLD.ringsPerLeg + 2 + k * 3];
      storms.push({
        x: near.x + (k % 2 === 0 ? 22 : -22),
        alt: near.alt + range(rng, -120, 160),
        z: near.z + 65,
        r: WORLD.stormRadius,
        hit: false,
      });
    }
  }

  return { islands, clouds, storms, ribbons, rings, totalZ, seed };
}

// Position along a ribbon at distance z (for rendering + collision).
export function ribbonPoint(ribbon, z) {
  const t = (z - ribbon.z0) / (ribbon.z1 - ribbon.z0);
  const wobble = Math.sin(t * Math.PI * 2 + ribbon.phase) * 7;
  return {
    x: ribbon.x0 + (ribbon.x1 - ribbon.x0) * t + wobble,
    alt: ribbon.a0 + (ribbon.a1 - ribbon.a0) * t,
  };
}
