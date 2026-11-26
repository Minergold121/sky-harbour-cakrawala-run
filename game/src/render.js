// Rendering: pseudo-3D chase view on a 2D canvas. Sky, sea, islands,
// rings, ribbons, storms and the aircraft, then the dense lit HUD.
import { BUTTONS, GAME_SUBTITLE, GAME_TITLE, LEGS, PILOT, PLANE, VIEW, WORLD } from './config.js';
import { clamp, lerp, mulberry32 } from './random.js';
import { currentLeg, formatHeading, formatTime, nextRingOf } from './state.js';
import { legEndZ, ribbonPoint, runwayZ } from './world.js';

const W = VIEW.w;
const H = VIEW.h;
const HORIZON = VIEW.horizon;
const FT = 55; // feet per lateral unit

export function cameraOf(state) {
  return {
    x: state.plane.x * 0.72,
    z: state.plane.z - VIEW.camBack,
    y: state.plane.alt / FT + VIEW.camLift,
  };
}

export function project(x, yUnits, z, cam) {
  const dz = z - cam.z;
  if (dz < 3) return null;
  const scale = VIEW.focal / dz;
  return {
    sx: W / 2 + (x - cam.x) * scale,
    sy: HORIZON + (cam.y - yUnits) * scale,
    scale,
    dz,
  };
}

function sky(ctx, state, t) {
  const leg = currentLeg(state);
  const top = ['#7ec8f2', '#7ec8f2', '#f2a95c'][leg];
  const mid = ['#bfe6f7', '#cfe9f2', '#f7c98a'][leg];
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, top);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, '#fdf3d8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON + 30);
  // Sun with a soft halo, drifting slowly with the leg.
  const sunX = 1050 - leg * 120;
  const sunY = 78 + leg * 26;
  const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 110);
  halo.addColorStop(0, 'rgba(255,244,190,0.95)');
  halo.addColorStop(1, 'rgba(255,244,190,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
  ctx.fillStyle = '#fff7cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  void t;
}

function clouds(ctx, state, cam) {
  const list = state.world.clouds.filter((c) => c.z > cam.z + 8).sort((a, b) => b.z - a.z);
  for (const c of list) {
    const p = project(c.x, c.y / FT, c.z, cam);
    if (!p || p.dz < 25 || p.sx < -160 || p.sx > W + 160) continue;
    const r = Math.min(150, c.s * p.scale);
    if (r < 2) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [ox, oy, k] of [[-0.9, 0.1, 0.62], [0, -0.22, 0.85], [0.9, 0.08, 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(p.sx + ox * r, p.sy + oy * r, r * k, r * k * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy + r * 0.22, r * 1.15, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sea(ctx, cam) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, H);
  g.addColorStop(0, '#8fd0e8');
  g.addColorStop(0.25, '#3d9ec4');
  g.addColorStop(1, '#166e9e');
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  // Moving wave lines: projected parallels that rush toward the viewer.
  ctx.lineWidth = 2;
  for (let k = 0; k < 24; k += 1) {
    const z = cam.z + 26 + k * 42;
    const a = project(-95, 0, z, cam);
    const b = project(95, 0, z, cam);
    if (!a || !b) continue;
    const alpha = clamp(0.55 - k * 0.018, 0.06, 0.55);
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(Math.max(-20, a.sx), a.sy);
    ctx.lineTo(Math.min(W + 20, b.sx), b.sy);
    ctx.stroke();
  }
  // Glitter under the sun.
  const rng = mulberry32(99);
  ctx.fillStyle = 'rgba(255,250,205,0.5)';
  for (let i = 0; i < 26; i += 1) {
    const z = cam.z + 40 + rng() * 500;
    const x = 60 + rng() * 220 - 110;
    const p = project(x, 0, z, cam);
    if (!p) continue;
    ctx.fillRect(p.sx, p.sy, Math.min(46, 14 * p.scale + 2), 2);
  }
}

function island(ctx, isl, cam) {
  const base = project(isl.x, 0, isl.z, cam);
  if (!base || base.dz < 30 || base.sx < -260 || base.sx > W + 260) return;
  const rx = isl.r * base.scale;
  if (rx < 3) return;
  const top = project(isl.x, isl.h, isl.z, cam);
  const rng = mulberry32(isl.seed);
  // Beach ring.
  ctx.fillStyle = '#f2dd9e';
  ctx.beginPath();
  ctx.ellipse(base.sx, base.sy, rx * 1.12, rx * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Green mound.
  ctx.fillStyle = '#5da24a';
  ctx.beginPath();
  ctx.moveTo(base.sx - rx, base.sy);
  ctx.quadraticCurveTo(base.sx - rx * 0.6, top.sy - rx * 0.12, base.sx, top.sy);
  ctx.quadraticCurveTo(base.sx + rx * 0.6, top.sy - rx * 0.12, base.sx + rx, base.sy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6fb457';
  ctx.beginPath();
  ctx.ellipse(base.sx, top.sy + rx * 0.06, rx * 0.62, rx * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const s = base.scale;
  if (isl.kind === 'volcano') {
    ctx.fillStyle = '#7a5a44';
    ctx.beginPath();
    ctx.moveTo(base.sx - rx * 0.5, base.sy - rx * 0.1);
    ctx.lineTo(base.sx, top.sy - rx * 0.28);
    ctx.lineTo(base.sx + rx * 0.5, base.sy - rx * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.arc(base.sx, top.sy - rx * 0.28, Math.max(2, 5 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,240,240,0.7)';
    ctx.beginPath();
    ctx.arc(base.sx + 8 * s, top.sy - rx * 0.28 - 14 * s, Math.max(2, 4 * s), 0, Math.PI * 2);
    ctx.fill();
  } else if (isl.kind === 'lighthouse') {
    const lw = Math.max(3, 5 * s);
    ctx.fillStyle = '#f6f2e8';
    ctx.fillRect(base.sx - lw / 2, top.sy - 26 * s, lw, 26 * s);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(base.sx - lw / 2, top.sy - 26 * s, lw, 7 * s);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(base.sx, top.sy - 28 * s, Math.max(2, 3.4 * s), 0, Math.PI * 2);
    ctx.fill();
  } else if (isl.kind === 'village') {
    for (let i = 0; i < 4; i += 1) {
      const hx = base.sx + (rng() - 0.5) * rx * 1.1;
      const hy = base.sy - rng() * rx * 0.18;
      const hw = Math.max(3, 7 * s);
      ctx.fillStyle = '#fdf6e3';
      ctx.fillRect(hx - hw / 2, hy - hw, hw, hw);
      ctx.fillStyle = '#c65a3c';
      ctx.beginPath();
      ctx.moveTo(hx - hw * 0.7, hy - hw);
      ctx.lineTo(hx, hy - hw * 1.6);
      ctx.lineTo(hx + hw * 0.7, hy - hw);
      ctx.closePath();
      ctx.fill();
    }
  } else if (isl.kind === 'terraces') {
    ctx.strokeStyle = '#8fce6a';
    ctx.lineWidth = Math.max(1, 2 * s);
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(base.sx, base.sy - (rx * 0.3 * i) / 3.4, rx * (1 - i * 0.18), rx * 0.1, 0, 0, Math.PI);
      ctx.stroke();
    }
  }
  // Palms.
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = Math.max(1, 1.6 * s);
  for (let i = 0; i < isl.palms; i += 1) {
    const px = base.sx + (rng() - 0.5) * rx * 1.5;
    const py = base.sy - rng() * rx * 0.22;
    const ph = 12 * s + rng() * 6 * s;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 2 * s, py - ph);
    ctx.stroke();
    ctx.strokeStyle = '#3f8f3a';
    for (let f = 0; f < 4; f += 1) {
      const ang = -Math.PI / 2 + (f - 1.5) * 0.55;
      ctx.beginPath();
      ctx.moveTo(px + 2 * s, py - ph);
      ctx.lineTo(px + 2 * s + Math.cos(ang) * 9 * s, py - ph + Math.sin(ang) * 9 * s);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6b4a2b';
  }
}

function runway(ctx, cam, z0, z1, label) {
  const hw = 8;
  // The near edge may sit behind the camera: clamp it just ahead so
  // the strip still draws instead of vanishing entirely.
  const nearZ = Math.max(z0, cam.z + 4);
  if (z1 <= nearZ) return;
  const corners = [project(-hw, 0.3, nearZ, cam), project(hw, 0.3, nearZ, cam), project(hw, 0.3, z1, cam), project(-hw, 0.3, z1, cam)];
  if (corners.some((c) => !c)) return;
  ctx.fillStyle = '#4a4a52';
  ctx.beginPath();
  ctx.moveTo(corners[0].sx, corners[0].sy);
  for (const c of corners.slice(1)) ctx.lineTo(c.sx, c.sy);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes + edge lights.
  for (let z = nearZ; z < z1; z += 34) {
    const a = project(0, 0.35, z, cam);
    const b = project(0, 0.35, z + 16, cam);
    if (!a || !b) continue;
    ctx.strokeStyle = '#f7e98a';
    ctx.lineWidth = Math.min(6, Math.max(1, 2.4 * a.scale));
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const e = project(side * hw, 0.35, z, cam);
      if (!e) continue;
      ctx.fillStyle = '#7dffb0';
      ctx.beginPath();
      ctx.arc(e.sx, e.sy, Math.min(5, Math.max(1.5, 2.2 * e.scale)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const near = project(0, 0.4, Math.min(z1, Math.max(nearZ, cam.z + 40)), cam);
  // Name the strip only once it is close enough to read as a
  // runway, not a caption floating on the horizon.
  if (near && label && near.dz < 280) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, near.sx, near.sy - 10);
  }
  // Approach lights: a dotted centreline on the water before the
  // strip, so the pilot can find the runway from a distance.
  // Lights closer than 40 units are skipped: at that range the
  // perspective scale would blow one dot up into a solid disc.
  for (let z = z0 - 240; z < z0; z += 30) {
    const a = project(0, 0.35, z, cam);
    if (!a || a.dz < 40) continue;
    ctx.fillStyle = 'rgba(255,233,140,0.9)';
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, Math.min(6, Math.max(1.5, 2.4 * a.scale)), 0, Math.PI * 2);
    ctx.fill();
  }
}

function rings(ctx, state, cam, t) {
  const list = state.world.rings.filter((r) => r.z > cam.z + 2 && r.z < cam.z + 760).sort((a, b) => b.z - a.z);
  for (const ring of list) {
    const p = project(ring.x, ring.alt / FT, ring.z, cam);
    if (!p || p.sx < -120 || p.sx > W + 120) continue;
    const rx = WORLD.ringRadius * p.scale;
    const ry = rx * 0.6;
    const isNext = state.world.rings[state.nextRing] === ring;
    const pulse = isNext ? 1 + Math.sin(t * 5) * 0.08 : 1;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.scale(pulse, pulse);
    if (isNext) {
      ctx.strokeStyle = 'rgba(255,215,80,0.35)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = ring.passed
      ? (ring.result === 'miss' ? 'rgba(160,160,160,0.5)' : 'rgba(125,255,176,0.75)')
      : ring.fuel ? '#4db8ff' : '#ffc93d';
    ctx.lineWidth = Math.max(2, 4.5 * p.scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Only label a distant gate: up close the ring itself fills
    // the view and the label would sit behind clouds.
    if (p.dz > 55) {
      const dist = Math.max(0, Math.round(ring.z - state.plane.z));
      ctx.fillText(isNext ? `${ring.fuel ? 'BBM · ' : ''}${dist}m` : ring.fuel ? 'BBM' : '', 0, -ry - 8);
    }
    if (ring.passed && ring.result !== 'miss') {
      ctx.fillStyle = '#7dffb0';
      ctx.font = `700 ${Math.max(12, Math.round(20 * p.scale))}px system-ui, sans-serif`;
      ctx.fillText('✓', 0, 8);
    }
    ctx.restore();
  }
}

function ribbons(ctx, state, cam, t) {
  for (const ribbon of state.world.ribbons) {
    if (ribbon.z1 < cam.z + 4 || ribbon.z0 > cam.z + 700) continue;
    for (let z = ribbon.z0; z <= ribbon.z1; z += 14) {
      const pt = ribbonPoint(ribbon, z);
      const p = project(pt.x, pt.alt / FT, z, cam);
      if (!p) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * 6 + z * 0.2);
      ctx.fillStyle = `rgba(255,205,70,${(0.55 * tw).toFixed(2)})`;
      const r = Math.min(9, Math.max(1.5, 5 * p.scale));
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function storms(ctx, state, cam, t) {
  for (const storm of state.world.storms) {
    if (storm.z < cam.z + 4 || storm.z > cam.z + 700) continue;
    const p = project(storm.x, storm.alt / FT, storm.z, cam);
    if (!p) continue;
    const r = storm.r * p.scale * 1.4;
    ctx.fillStyle = storm.hit ? 'rgba(90,90,110,0.45)' : 'rgba(52,52,72,0.88)';
    for (const [ox, oy, k] of [[-0.8, 0, 0.7], [0, -0.25, 0.95], [0.8, 0.05, 0.7]]) {
      ctx.beginPath();
      ctx.ellipse(p.sx + ox * r, p.sy + oy * r, r * k, r * k * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!storm.hit && Math.sin(t * 2 + storm.z) > 0.86) {
      ctx.strokeStyle = '#ffe94d';
      ctx.lineWidth = Math.max(1.5, 2.5 * p.scale);
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy + r * 0.3);
      ctx.lineTo(p.sx - 6 * p.scale, p.sy + r * 0.9);
      ctx.lineTo(p.sx + 2 * p.scale, p.sy + r * 0.9);
      ctx.lineTo(p.sx - 4 * p.scale, p.sy + r * 1.5);
      ctx.stroke();
    }
    if (!storm.hit && p.dz < 130) {
      ctx.fillStyle = '#ff6b5e';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ BADAI', p.sx, p.sy - r - 8);
    }
  }
}

function planeShadow(ctx, state, cam) {
  const p = project(state.plane.x, 0, state.plane.z + 4, cam);
  if (!p) return;
  // Fixed screen size: a perspective-scaled shadow would balloon
  // into a dark disc and hide the runway below the plane.
  ctx.fillStyle = 'rgba(10,40,60,0.22)';
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, 58, 13, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlane(ctx, state, t) {
  const p = state.plane;
  const cx = W / 2;
  const cy = 468 - p.pitch * 130 + Math.sin(t * 2.2) * 3;
  const burstGlow = state.burst > 0;
  if (burstGlow) {
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
    g.addColorStop(0, 'rgba(255,215,80,0.4)');
    g.addColorStop(1, 'rgba(255,215,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 190, cy - 190, 380, 380);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.bank * 0.55);
  // Wings, rooted into the fuselage (no sky gap at the wing roots).
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.lineTo(-12, -8);
  ctx.lineTo(-10, 10);
  ctx.lineTo(-112, 18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(118, 6);
  ctx.lineTo(12, -8);
  ctx.lineTo(10, 10);
  ctx.lineTo(112, 18);
  ctx.closePath();
  ctx.fill();
  // Wingtip lights, lit.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-116, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08b';
  ctx.beginPath();
  ctx.arc(116, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  // Tail.
  ctx.fillStyle = '#c94a28';
  ctx.beginPath();
  ctx.moveTo(-6, 26);
  ctx.lineTo(-20, 52);
  ctx.lineTo(-8, 54);
  ctx.lineTo(0, 34);
  ctx.lineTo(8, 54);
  ctx.lineTo(20, 52);
  ctx.lineTo(6, 26);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  const body = ctx.createLinearGradient(0, -14, 0, 30);
  body.addColorStop(0, '#fff6e0');
  body.addColorStop(0.5, '#f4b942');
  body.addColorStop(1, '#d98a1f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.quadraticCurveTo(15, -20, 14, 12);
  ctx.quadraticCurveTo(12, 32, 0, 36);
  ctx.quadraticCurveTo(-12, 32, -14, 12);
  ctx.quadraticCurveTo(-15, -20, 0, -46);
  ctx.fill();
  // Canopy, lit blue.
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath();
  ctx.ellipse(0, -16, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-2.5, -21, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose + spinning propeller (kept small so the airframe reads).
  ctx.fillStyle = '#33414f';
  ctx.beginPath();
  ctx.arc(0, -48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -48);
  ctx.rotate(p.prop);
  ctx.fillStyle = 'rgba(230,235,240,0.7)';
  ctx.fillRect(-2, -26, 4, 52);
  ctx.fillRect(-26, -2, 52, 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,235,240,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -48, 27, 0, Math.PI * 2);
  ctx.stroke();
  // Livery text.
  ctx.fillStyle = '#7a3b12';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAKRAWALA', 0, 22);
  ctx.restore();
  // Burst trail: short streaks behind the wings, never long stilts.
  if (burstGlow) {
    ctx.strokeStyle = 'rgba(255,215,80,0.55)';
    ctx.lineWidth = 3;
    for (const off of [-26, 26]) {
      ctx.beginPath();
      ctx.moveTo(cx + off, cy + 36);
      ctx.lineTo(cx + off * 0.72, cy + 58);
      ctx.stroke();
    }
  }
}

function dial(ctx, x, y, r, label, value, unit) {
  ctx.fillStyle = '#0e2233';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eaf7ff';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(value), x, y + 5);
  ctx.fillStyle = '#9fc6dd';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillText(label, x, y + 30);
  ctx.fillText(unit, x, y - r + 15);
}

function hud(ctx, state, t) {
  const p = state.plane;
  // Top bar.
  ctx.fillStyle = 'rgba(10,28,44,0.88)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(0, 46, W, 3);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const leg = currentLeg(state);
  ctx.fillText(`${PILOT} · LEG ${leg + 1}/3`, 16, 29);
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = '#bfe3f5';
  ctx.fillText(`${LEGS[leg].from} → ${LEGS[leg].to}`, 340, 29);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(`SKOR ${state.score.toLocaleString('id-ID')}`, 870, 30);
  ctx.fillStyle = state.combo >= 5 ? '#ffd94d' : '#bfe3f5';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(state.combo > 1 ? `KOMBO x${state.combo}` : 'KOMBO —', 1030, 30);
  ctx.textAlign = 'left';
  // Ring progress dots, grouped by leg.
  for (let i = 0; i < state.world.rings.length; i += 1) {
    const ring = state.world.rings[i];
    const dx = 16 + i * 13;
    const dy = 58;
    ctx.fillStyle = ring.passed ? (ring.result === 'miss' ? '#7d8894' : '#37e08b') : i === state.nextRing ? '#ffd94d' : 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(dx, dy, i === state.nextRing ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (i % WORLD.ringsPerLeg === WORLD.ringsPerLeg - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(dx + 8, 52, 2, 12);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`WAKTU ${formatTime(state.timeLeft)}`, W - 84, 62);
  // Message banner.
  if (state.messageT > 0) {
    ctx.fillStyle = 'rgba(10,28,44,0.82)';
    const mw = 760;
    ctx.fillRect((W - mw) / 2, 74, mw, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, W / 2, 95);
  }
  // Flash centre text.
  if (state.flash) {
    ctx.fillStyle = state.flash.good ? '#7dffb0' : '#ff8a7a';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.flash.text, W / 2, 168);
  }
  // Leg banner.
  if (state.legBanner > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`LEG ${leg + 1} — ${LEGS[leg].to}`, W / 2, 220);
  }
  // Bottom instrument panel.
  const py = 556;
  ctx.fillStyle = 'rgba(10,24,38,0.92)';
  ctx.fillRect(0, py, W, H - py);
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(0, py, W, 3);
  // Artificial horizon.
  const hx = 92;
  const hy = py + 82;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, 52, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#6db9e8';
  ctx.fillRect(hx - 52, hy - 52, 104, 52);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(hx - 52, hy, 104, 52);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.bank * 0.55);
  ctx.translate(0, p.pitch * 60);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-52, 0);
  ctx.lineTo(52, 0);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', hx, py + 158);
  // Dials: speed, altitude, heading, vertical speed.
  dial(ctx, 210, hy, 46, 'KECEPATAN', Math.round(p.speed), 'KT');
  dial(ctx, 330, hy, 46, 'KETINGGIAN', Math.round(p.alt), 'KAKI');
  dial(ctx, 450, hy, 46, 'ARAH', formatHeading(p.heading), 'DERAJAT');
  // Compass strip.
  ctx.fillStyle = '#0e2233';
  ctx.fillRect(510, py + 22, 250, 44);
  ctx.strokeStyle = '#ffd94d';
  ctx.strokeRect(510, py + 22, 250, 44);
  ctx.fillStyle = '#9fc6dd';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const headings = [[0, 'U'], [45, 'TL'], [90, 'T'], [135, 'TG'], [180, 'S'], [225, 'BD'], [270, 'B'], [315, 'BL']];
  for (const [deg, name] of headings) {
    let diff = ((deg - p.heading + 540) % 360) - 180;
    const x = 635 + diff * 1.5;
    if (x < 516 || x > 754) continue;
    ctx.fillStyle = Math.abs(diff) < 8 ? '#ffd94d' : '#eaf7ff';
    ctx.fillText(name, x, py + 50);
  }
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(635, py + 18);
  ctx.lineTo(629, py + 8);
  ctx.lineTo(641, py + 8);
  ctx.closePath();
  ctx.fill();
  // Throttle bar.
  ctx.fillStyle = '#0e2233';
  ctx.fillRect(786, py + 22, 26, 120);
  ctx.fillStyle = '#37b6e0';
  const th = p.throttle * 116;
  ctx.fillRect(788, py + 140 - th, 22, th);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText('GAS', 799, py + 158);
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, 799, py + 14);
  // Fuel + hull.
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BBM', 836, py + 34);
  ctx.fillStyle = '#22384c';
  ctx.fillRect(836, py + 42, 170, 16);
  ctx.fillStyle = state.fuel < 25 ? '#ff6b5e' : '#37e08b';
  ctx.fillRect(836, py + 42, 170 * clamp(state.fuel / 100, 0, 1), 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(state.fuel)}%`, 1012, py + 55);
  ctx.fillText('LAMBUNG', 836, py + 84);
  for (let i = 0; i < WORLD.startHull; i += 1) {
    ctx.fillStyle = i < state.hull ? '#ff6b7a' : 'rgba(255,255,255,0.25)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('♥', 836 + i * 28, py + 108);
  }
  // Tailwind ribbon meter (the original mechanic, always visible).
  ctx.fillText('PITA ANGIN · TAILWIND', 836, py + 134);
  ctx.fillStyle = '#22384c';
  ctx.fillRect(836, py + 140, 170, 14);
  ctx.fillStyle = state.boost >= 100 ? '#ffd94d' : '#e0a83a';
  ctx.fillRect(836, py + 140, 170 * clamp(state.boost / 100, 0, 1), 14);
  if (state.boost >= 100) {
    ctx.fillStyle = '#123247';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SIAP! SPASI', 921, py + 151);
  }
  if (state.burst > 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`BURST ${state.burst.toFixed(1)}s · SKOR x2`, W - 16, py + 20);
  } else {
    ctx.fillStyle = '#9fc6dd';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD/Panah · W/S gas · SPASI burst · P jeda · M suara · Seret mouse', W - 16, py + 20);
  }
  // Pause / sound buttons (top-right, above the bar).
  for (const [key, label] of [['pause', 'II'], ['sound', '♪']]) {
    const b = BUTTONS[key];
    ctx.fillStyle = 'rgba(10,28,44,0.88)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffd94d';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + 23);
  }
  void t;
}

function panel(ctx, title, lines, buttonLabel) {
  ctx.fillStyle = 'rgba(8,20,32,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fdf6e0';
  ctx.fillRect(190, 96, 900, 528);
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 4;
  ctx.strokeRect(190, 96, 900, 528);
  ctx.fillStyle = '#123247';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 168);
  ctx.fillStyle = '#4a6a7e';
  ctx.font = '600 16px system-ui, sans-serif';
  let y = 214;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 30;
  }
  if (buttonLabel) {
    const b = BUTTONS.start;
    ctx.fillStyle = '#e8542f';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(buttonLabel, W / 2, b.y + 40);
    ctx.fillStyle = '#4a6a7e';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('atau tekan ENTER', W / 2, b.y + 88);
  }
}

function titleScreen(ctx, state, t) {
  const cam = cameraOf(state);
  sky(ctx, state, t);
  clouds(ctx, state, cam);
  sea(ctx, cam);
  const isl = state.world.islands[1] || state.world.islands[0];
  if (isl) island(ctx, isl, cam);
  runway(ctx, cam, -40, 170, 'LANDASAN 09 · TELUK BARA');
  drawPlane(ctx, state, t);
  ctx.fillStyle = 'rgba(8,20,32,0.45)';
  ctx.fillRect(0, 0, W, 240);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(GAME_TITLE, W / 2, 96);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(GAME_SUBTITLE, W / 2, 136);
  ctx.fillStyle = '#eaf7ff';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText(`${PILOT} · 3 leg · 42 ring · 1 landasan terakhir`, W / 2, 172);
  ctx.fillText('Terbang lewat ring emas, ikuti PITA ANGIN untuk mengisi boost,', W / 2, 204);
  ctx.fillText('lalu tekan SPASI: Tailwind Burst menggandakan skor ring.', W / 2, 228);
  const b = BUTTONS.start;
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#e8542f' : '#d14a28';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('✈  MULAI TERBANG', W / 2, b.y + 41);
  ctx.fillStyle = '#eaf7ff';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('WASD / Panah: kemudi · W/S: gas · SPASI: burst · P: jeda · M: suara · Mouse: seret untuk mengemudi', W / 2, 660);
  ctx.fillText('Hindari badai, kejar ring biru saat BBM menipis, mendaratlah di Bandara Cakrawala.', W / 2, 686);
}

function endScreen(ctx, state, won) {
  const s = state.stats || { score: 0, grade: 'C', ringsHit: 0, totalRings: 0, perfect: 0, bestCombo: 0, landingBonus: 0, time: 0, fuelLeft: 0, hull: 0 };
  const title = won ? `MENDARAT! GRADE ${s.grade}` : 'PENERBANGAN BERAKHIR';
  const lines = won
    ? [
        state.overReason || `${PILOT} mendarat di Bandara Cakrawala.`,
        `Skor akhir: ${s.score.toLocaleString('id-ID')} (bonus mendarat +${s.landingBonus})`,
        `Ring: ${s.ringsHit}/${s.totalRings} · Sempurna: ${s.perfect} · Kombo terbaik: ${s.bestCombo}`,
        `Waktu: ${formatTime(s.time)} · BBM tersisa: ${s.fuelLeft}% · Lambung: ${s.hull}/3`,
        'Terima kasih sudah terbang bersama Cakrawala Air.',
      ]
    : [
        state.overReason || 'Penerbangan berakhir.',
        `Skor: ${s.score.toLocaleString('id-ID')} · Ring: ${s.ringsHit}/${s.totalRings} · Sempurna: ${s.perfect}`,
        'Coba lagi: ikuti pita angin, jaga BBM, dan hindari badai.',
      ];
  panel(ctx, title, lines, won ? 'TERBANG LAGI' : 'COBA LAGI');
  if (!won) {
    const b = BUTTONS.start;
    void b;
  }
}

export function render(ctx, state, t) {
  ctx.clearRect(0, 0, W, H);
  if (state.screen === 'title') {
    titleScreen(ctx, state, t);
    return;
  }
  if (state.screen === 'win') {
    // Keep the world behind the panel: frozen final approach view.
    const cam = cameraOf(state);
    sky(ctx, state, t);
    clouds(ctx, state, cam);
    sea(ctx, cam);
    runway(ctx, cam, runwayZ() - 40, runwayZ() + 420, 'BANDARA CAKRAWALA');
    drawPlane(ctx, state, t);
    endScreen(ctx, state, true);
    return;
  }
  if (state.screen === 'over') {
    const cam = cameraOf(state);
    sky(ctx, state, t);
    clouds(ctx, state, cam);
    sea(ctx, cam);
    drawPlane(ctx, state, t);
    endScreen(ctx, state, false);
    return;
  }
  const cam = cameraOf(state);
  sky(ctx, state, t);
  clouds(ctx, state, cam);
  sea(ctx, cam);
  const sortedIslands = [...state.world.islands].sort((a, b) => b.z - a.z);
  for (const isl of sortedIslands) island(ctx, isl, cam);
  // Departure strip at the start, arrival strip at the end.
  runway(ctx, cam, -40, 170, state.plane.z < 220 ? 'LANDASAN 09 · TELUK BARA' : '');
  runway(ctx, cam, runwayZ() - 40, runwayZ() + 420, 'BANDARA CAKRAWALA');
  ribbons(ctx, state, cam, t);
  rings(ctx, state, cam, t);
  storms(ctx, state, cam, t);
  planeShadow(ctx, state, cam);
  drawPlane(ctx, state, t);
  if (state.screen === 'pause') {
    ctx.fillStyle = 'rgba(8,20,32,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEDA', W / 2, 330);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText('Tekan P atau klik II untuk lanjut terbang.', W / 2, 368);
  }
  hud(ctx, state, t);
  // Next-ring guide arrow when the gate is far ahead.
  const ring = nextRingOf(state);
  if (ring && state.screen === 'play') {
    const dz = ring.z - state.plane.z;
    if (dz > 200) {
      const dir = ring.x > state.plane.x ? '→' : ring.x < state.plane.x ? '←' : '↑';
      ctx.fillStyle = '#ffe9a8';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${dir} Ring berikutnya ${Math.round(dz)}m ${dir}`, W / 2, 132);
    }
  }
  void legEndZ;
}
