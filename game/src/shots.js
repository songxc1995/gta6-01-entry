// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world, steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/** Drive the player's car forward, steering back toward the main avenue. */
function driveInput(world) {
  const car = world.state.car;
  if (!car) return { vector: () => ({ x: 0, y: 0 }), enter: false };
  const steer = clamp((1280 - car.x) / 120, -1, 1);
  return { vector: () => ({ x: steer, y: -1 }), enter: false };
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Get in the nearest parked car, turn up the heat, then drive up the main avenue
    // toward a pickup placed just ahead, so the marker, the chase and the HUD are all in frame.
    let car = null; let bestD = Infinity;
    for (const c of state.parked) {
      const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
      if (d < bestD) { bestD = d; car = c; }
    }
    if (car) {
      state.player.x = car.x; state.player.y = car.y;
      world.step(STEP, { vector: () => ({ x: 0, y: 0 }), enter: true }, false);
    }
    if (state.car) {
      state.car.x = 1280; state.car.y = state.player.y; state.car.angle = Math.PI / 2; state.car.speed = 0;
      state.player.x = 1280; state.player.angle = Math.PI / 2;
    }
    state.mission.pickup = { x: 1280, y: 1180 };
    state.mission.target = { x: 800, y: 1680 };
    state.wanted = 2;
    for (let i = 0; i < 2.2 / STEP; i += 1) {
      if (world.step(STEP, driveInput(world), false) & EVENT_OVER) break;
    }
    return { screen: state.player.health <= 0 || state.overReason ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  // End: wanted, nearly dead, and a cop already on top of the player on foot.
  state.wanted = 3;
  state.player.health = 12;
  const cop = state.police[0];
  cop.active = true; cop.x = state.player.x + 55; cop.y = state.player.y; cop.angle = Math.PI; cop.speed = 220;
  for (let i = 0; i < 30 / STEP; i += 1) {
    if (world.step(STEP, { vector: () => ({ x: 0, y: 0 }), enter: false }, false) & EVENT_OVER) break;
  }
  return { screen: state.player.health <= 0 || state.overReason ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
