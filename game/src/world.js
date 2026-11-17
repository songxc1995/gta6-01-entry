// The game's rules and state, with no drawing and no browser in it: a top-down city, a player
// on foot who can enter/exit cars, driving with collision, two mission types, money, a wanted
// level with chasing police cars, health, score and levels. step() advances one fixed step and
// returns what happened as bit flags. The city is built from the seeded random, so the same seed
// always gives the same city.
import { CAR, CITY, MISSION, PLAYER, POLICE, ROADS_X, ROADS_Y, ROAD_W, WANTED } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION = 4;
export const EVENT_OVER = 8;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function turnToward(a, target, maxStep) {
  let d = target - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + clamp(d, -maxStep, maxStep);
}
// Push a circle (x,y,r) out of a rect; returns true when it overlapped.
function resolveCircleRect(p, r, rect) {
  const cx = clamp(p.x, rect.x, rect.x + rect.w);
  const cy = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - cx, dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r;
  } else {
    // Centre inside the rect: push out along the smallest penetration.
    const left = p.x - rect.x, right = rect.x + rect.w - p.x;
    const top = p.y - rect.y, bottom = rect.y + rect.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = rect.x - r; else if (m === right) p.x = rect.x + rect.w + r;
    else if (m === top) p.y = rect.y - r; else p.y = rect.y + rect.h + r;
  }
  return true;
}

export function createWorld(random) {
  const state = {
    player: { x: 0, y: 0, angle: -Math.PI / 2, health: PLAYER.health, inCar: false },
    car: null, // the car the player drives, when inCar
    parked: [], police: [], buildings: [], parks: [],
    money: 0, score: 0, level: 1, missionsDone: 0,
    wanted: 0, bustTimer: 0, overReason: '',
    mission: null, elapsed: 0, flash: '', flashTimer: 0,
    crashCooldown: 0, ramCooldown: 0,
  };
  for (let i = 0; i < 6; i += 1) state.police.push({ active: false, x: 0, y: 0, angle: 0, speed: 0 });

  function roadPoint() {
    const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
    return { x: rx + (random() - 0.5) * 40, y: ry + (random() - 0.5) * 40 };
  }
  function onRoad(x, y) {
    return ROADS_X.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 30) ||
      ROADS_Y.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 30);
  }

  function buildCity() {
    state.buildings = [];
    state.parks = [];
    const palette = ['#b5654a', '#7a6a9b', '#4a7a9b', '#9b8a4a', '#6a9b6a', '#a05a7a', '#5a6a7a', '#c08a4a'];
    // Blocks are the rectangles between neighbouring roads.
    const xs = [60, ...ROADS_X.map((r) => r + ROAD_W / 2 + 14), CITY.width - 40];
    const ys = [60, ...ROADS_Y.map((r) => r + ROAD_W / 2 + 14), CITY.height - 40];
    const xEdges = [60];
    for (const r of ROADS_X) { xEdges.push(r - ROAD_W / 2 - 14); xEdges.push(r + ROAD_W / 2 + 14); }
    xEdges.push(CITY.width - 40);
    const yEdges = [60];
    for (const r of ROADS_Y) { yEdges.push(r - ROAD_W / 2 - 14); yEdges.push(r + ROAD_W / 2 + 14); }
    yEdges.push(CITY.height - 40);
    void xs; void ys;
    let blockIndex = 0;
    for (let xi = 0; xi < xEdges.length - 1; xi += 2) {
      for (let yi = 0; yi < yEdges.length - 1; yi += 2) {
        const bx = xEdges[xi], by = yEdges[yi];
        const bw = xEdges[xi + 1] - bx, bh = yEdges[yi + 1] - by;
        blockIndex += 1;
        if (bw < 60 || bh < 60) continue;
        // One park block and one plaza block, the rest get 1-2 buildings.
        if (blockIndex === 8) { state.parks.push({ x: bx, y: by, w: bw, h: bh }); continue; }
        const n = random() < 0.5 ? 1 : 2;
        for (let k = 0; k < n; k += 1) {
          const w = Math.min(bw - 24, 90 + random() * 130);
          const h = Math.min(bh - 24, 70 + random() * 110);
          const x = bx + 12 + (n === 1 ? (bw - w) / 2 : k * (bw - w - 24) + random() * 10);
          const y = by + 12 + (bh - h) / 2 + (random() - 0.5) * 10;
          state.buildings.push({ x, y, w, h, color: palette[Math.floor(random() * palette.length)] });
        }
      }
    }
    // Parked cars along the roads.
    state.parked = [];
    const carColors = ['#e5534b', '#7ab8e5', '#f2c94c', '#9b7ad9', '#e5e5e5', '#37d67a', '#e58a3c'];
    for (let i = 0; i < 14; i += 1) {
      const p = roadPoint();
      const vertical = random() < 0.5;
      const cx = p.x + (vertical ? (random() < 0.5 ? -28 : 28) : 0);
      const cy = p.y + (vertical ? 0 : (random() < 0.5 ? -28 : 28));
      // Don't stack two parked cars on top of each other.
      if (state.parked.some((c) => Math.hypot(c.x - cx, c.y - cy) < 80)) continue;
      state.parked.push({
        x: cx, y: cy,
        angle: vertical ? Math.PI / 2 : 0, speed: 0,
        color: carColors[Math.floor(random() * carColors.length)],
      });
    }
  }

  function newMission() {
    const type = state.missionsDone % 2 === 0 ? 'deliver' : 'collect';
    if (type === 'deliver') {
      const a = roadPoint(); const b = roadPoint();
      state.mission = { type, stage: 0, pickup: a, target: b, timeLeft: MISSION.timeLimit, pickups: [], text: 'Pick up the package' };
    } else {
      const pickups = [];
      for (let i = 0; i < MISSION.collectCount; i += 1) { const p = roadPoint(); pickups.push({ x: p.x, y: p.y, taken: false }); }
      state.mission = { type, stage: 0, pickup: null, target: pickups[0], timeLeft: MISSION.timeLimit, pickups, text: 'Collect the cash drops (0/3)' };
    }
  }

  function reset() {
    buildCity();
    const spawn = { x: ROADS_X[2], y: ROADS_Y[1] + 120 };
    // A car parked right by the spawn, so the player can get driving immediately.
    state.parked.push({ x: spawn.x + 34, y: spawn.y, angle: -Math.PI / 2, speed: 0, color: '#e5534b' });
    state.player.x = spawn.x; state.player.y = spawn.y;
    state.player.angle = -Math.PI / 2; state.player.health = PLAYER.health; state.player.inCar = false;
    state.car = null;
    for (const p of state.police) p.active = false;
    state.money = 0; state.score = 0; state.level = 1; state.missionsDone = 0;
    state.wanted = 0; state.bustTimer = 0; state.overReason = '';
    state.elapsed = 0; state.flash = ''; state.flashTimer = 0;
    state.crashCooldown = 0; state.ramCooldown = 0;
    newMission();
  }

  function completeMission(reward) {
    state.money += reward; state.score += reward; state.missionsDone += 1;
    state.level = state.missionsDone + 1;
    state.wanted = Math.min(WANTED.max, state.wanted + 1);
    state.flash = reward > 0 ? `+ $${reward} — mission complete!` : 'Mission complete!';
    state.flashTimer = 2.5;
    newMission();
    return EVENT_MISSION;
  }

  function failMission() {
    state.money = Math.max(0, state.money - 50);
    state.flash = 'Mission failed — too slow! -$50';
    state.flashTimer = 2.5;
    newMission();
  }

  function collideBuildings(p, r) {
    let hit = false;
    for (const b of state.buildings) if (resolveCircleRect(p, r, b)) hit = true;
    return hit;
  }

  function stepCar(car, dt, throttle, steer) {
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
    car.speed -= car.speed * CAR.drag * dt;
    car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
    // Sharper at low speed (tight city turns), wider at high speed.
    const grip = clamp(1.2 - Math.abs(car.speed) / 600, 0.45, 1);
    car.angle += steer * CAR.turnRate * grip * dt * Math.sign(car.speed || 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(nx, 30, CITY.width - 30); car.y = clamp(ny, 30, CITY.height - 30);
    if (collideBuildings(car, 26)) {
      if (Math.abs(car.speed) > 220 && state.crashCooldown <= 0) {
        state.player.health -= 8; state.crashCooldown = 1;
        state.wanted = Math.min(WANTED.max, state.wanted + 0.5);
      }
      // Scrub speed and slide along the wall instead of bouncing back into it.
      car.speed *= 0.35;
    }
  }

  function step(dt, input, attract) {
    let events = 0;
    state.elapsed += dt;
    if (state.flashTimer > 0) state.flashTimer -= dt;
    if (state.crashCooldown > 0) state.crashCooldown -= dt;
    if (state.ramCooldown > 0) state.ramCooldown -= dt;

    if (attract) {
      // Title backdrop: the player cruises down the main avenue on autopilot.
      if (!state.player.inCar) {
        const near = state.parked[0];
        if (near) { state.car = near; state.parked.splice(0, 1); state.player.inCar = true; state.car.x = ROADS_X[2]; state.car.y = 200; state.car.angle = Math.PI / 2; state.car.speed = 200; }
      }
      if (state.car) {
        const steer = clamp((ROADS_X[2] - state.car.x) / 60, -1, 1);
        stepCar(state.car, dt, 1, steer);
        state.player.x = state.car.x; state.player.y = state.car.y; state.player.angle = state.car.angle;
        if (state.car.y > CITY.height - 120) { state.car.y = 200; state.car.x = ROADS_X[2]; }
      }
      return 0;
    }

    const m = state.mission;
    if (m) {
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) failMission();
    }

    const v = input && input.vector ? input.vector() : { x: 0, y: 0 };
    const enter = input && input.enter;

    if (state.player.inCar && state.car) {
      const throttle = v.y < 0 ? 1 : v.y > 0 ? -1 : 0;
      stepCar(state.car, dt, throttle, v.x);
      state.player.x = state.car.x; state.player.y = state.car.y; state.player.angle = state.car.angle;
      if (enter) {
        // Step out beside the car.
        state.parked.push({ x: state.car.x, y: state.car.y, angle: state.car.angle, speed: 0, color: state.car.color });
        state.player.x = state.car.x + Math.cos(state.car.angle + Math.PI / 2) * 40;
        state.player.y = state.car.y + Math.sin(state.car.angle + Math.PI / 2) * 40;
        state.player.inCar = false; state.car = null;
      }
    } else {
      const len = Math.hypot(v.x, v.y);
      if (len > 0) {
        const nx = state.player.x + (v.x / len) * PLAYER.walkSpeed * dt;
        const ny = state.player.y + (v.y / len) * PLAYER.walkSpeed * dt;
        state.player.angle = Math.atan2(v.y, v.x);
        const px = { x: nx, y: state.player.y };
        if (!collideBuildings(px, PLAYER.radius)) state.player.x = nx;
        const py = { x: state.player.x, y: ny };
        if (!collideBuildings(py, PLAYER.radius)) state.player.y = ny;
        state.player.x = clamp(state.player.x, 20, CITY.width - 20);
        state.player.y = clamp(state.player.y, 20, CITY.height - 20);
      }
      if (enter) {
        let best = null; let bestD = 60;
        for (const c of state.parked) {
          const d = dist(state.player.x, state.player.y, c.x, c.y);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (best) {
          state.parked.splice(state.parked.indexOf(best), 1);
          state.car = best; state.player.inCar = true;
          state.player.x = best.x; state.player.y = best.y; state.player.angle = best.angle;
        }
      }
    }

    // Mission markers.
    if (m) {
      const target = m.type === 'deliver' ? (m.stage === 0 ? m.pickup : m.target) : m.target;
      const px = state.player.x, py = state.player.y;
      if (target && dist(px, py, target.x, target.y) < 46) {
        if (m.type === 'deliver') {
          if (m.stage === 0) { m.stage = 1; m.text = 'Deliver the package — fast!'; state.flash = 'Package picked up!'; state.flashTimer = 1.5; events |= EVENT_PICKUP; }
          else { events |= completeMission(MISSION.deliverReward); }
        } else {
          const pk = m.pickups.find((p) => !p.taken && dist(px, py, p.x, p.y) < 46);
          if (pk) {
            pk.taken = true; state.money += MISSION.collectReward; state.score += MISSION.collectReward;
            events |= EVENT_PICKUP;
            const left = m.pickups.filter((p) => !p.taken);
            if (left.length === 0) { events |= completeMission(0); }
            else { m.target = left[0]; m.text = `Collect the cash drops (${MISSION.collectCount - left.length}/${MISSION.collectCount})`; }
          }
        }
      }
    }

    // Wanted level: police spawn to match it, decay when the heat is off.
    const wantedLevel = Math.floor(state.wanted);
    let activePolice = state.police.filter((p) => p.active).length;
    if (activePolice < wantedLevel) {
      for (const p of state.police) {
        if (activePolice >= wantedLevel) break;
        if (!p.active) {
          const spot = roadPoint();
          let tries = 0;
          while (dist(spot.x, spot.y, state.player.x, state.player.y) < 420 && tries < 8) { const s2 = roadPoint(); spot.x = s2.x; spot.y = s2.y; tries += 1; }
          p.active = true; p.x = spot.x; p.y = spot.y; p.angle = 0; p.speed = 0;
          activePolice += 1;
        }
      }
    }
    const nearestPolice = state.police.filter((p) => p.active).reduce((m, p) => Math.min(m, dist(p.x, p.y, state.player.x, state.player.y)), Infinity);
    if (nearestPolice > 500) state.wanted = Math.max(0, state.wanted - WANTED.decayPerSec * dt);
    if (wantedLevel === 0) { for (const p of state.police) p.active = false; }

    // Police chase.
    const playerSpeed = state.player.inCar && state.car ? Math.abs(state.car.speed) : 0;
    for (const p of state.police) {
      if (!p.active) continue;
      const desired = angleTo(p.x, p.y, state.player.x, state.player.y);
      p.angle = turnToward(p.angle, desired, POLICE.turnRate * dt);
      p.speed = Math.min(POLICE.maxSpeed, p.speed + POLICE.accel * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.x = clamp(p.x, 30, CITY.width - 30); p.y = clamp(p.y, 30, CITY.height - 30);
      if (collideBuildings(p, 26)) p.speed *= 0.4;
      const d = dist(p.x, p.y, state.player.x, state.player.y);
      if (d < 48 && state.ramCooldown <= 0) {
        state.player.health -= state.player.inCar ? 8 : POLICE.ramDamage;
        state.ramCooldown = 1;
        if (state.car) state.car.speed *= 0.5;
        events |= EVENT_HIT;
      }
    }
    // Busted: caught slow with police on top of you.
    if (wantedLevel > 0 && nearestPolice < 80 && playerSpeed < 70 && !state.player.inCar) {
      state.bustTimer += dt;
    } else if (wantedLevel > 0 && nearestPolice < 90 && playerSpeed < 70) {
      state.bustTimer += dt * 0.6;
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }
    if (state.bustTimer > WANTED.bustSeconds) {
      state.overReason = 'BUSTED by the LCPD';
      return events | EVENT_OVER;
    }
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.overReason = 'WASTED';
      return events | EVENT_OVER;
    }
    return events;
  }

  return { state, reset, step };
}
