// SKY HARBOUR — Cakrawala Run: shared tuning constants.
// Light, bright chase-view flight game over an island archipelago.
export const VIEW = { w: 1280, h: 720, horizon: 292, camBack: 26, camLift: 7, focal: 230 };

export const PLANE = {
  minSpeed: 60,
  maxSpeed: 245,
  cruiseSpeed: 150,
  lateralMax: 58,
  altMin: 60,
  altMax: 3000,
  climbRate: 520,
  turnRate: 46,
  accel: 55,
  drag: 22,
};

export const WORLD = {
  seed: 20261126,
  ringSpacing: 130,
  ringsPerLeg: 14,
  legGap: 90,
  ringRadius: 16,
  perfectRadius: 6.5,
  stormRadius: 13,
  fuelDrain: 0.42,
  climbFuel: 0.25,
  burstSeconds: 6,
  ribbonCharge: 34,
  startFuel: 100,
  startHull: 3,
  timeLimit: 300,
};

export const LEGS = [
  { from: 'TELUK BARA', to: 'PULAU API', sky: 'Pagi cerah' },
  { from: 'PULAU API', to: 'TANJUNG ANGIN', sky: 'Angin sore' },
  { from: 'TANJUNG ANGIN', to: 'BANDARA CAKRAWALA', sky: 'Senja emas' },
];

export const PILOT = 'KAPTEN LINTANG';
export const GAME_TITLE = 'SKY HARBOUR';
export const GAME_SUBTITLE = 'Cakrawala Run — Terbang Kepulauan Nusantara';

export const BUTTONS = {
  start: { x: 490, y: 560, w: 300, h: 62 },
  again: { x: 490, y: 566, w: 300, h: 62 },
  pause: { x: 1212, y: 12, w: 56, h: 34 },
  sound: { x: 1148, y: 12, w: 56, h: 34 },
};
