// Tuning numbers and colours for Leonida Nights, a top-down open-world crime game.
// The canvas is a fixed 1280x720 logical area; the camera follows the player around a
// 2560x1920 city, so no rule below depends on the screen size.
export const VIEW = { width: 1280, height: 720 };
export const CITY = { width: 2560, height: 1920 };
export const STEP = 1 / 60;

export const PLAYER = { radius: 13, walkSpeed: 230, health: 100 };
export const CAR = { length: 54, width: 28, accel: 520, brake: 900, maxSpeed: 470, reverseMax: 160, turnRate: 3.0, drag: 0.55 };
export const POLICE = { length: 54, width: 28, maxSpeed: 430, accel: 480, turnRate: 2.9, ramDamage: 14 };

export const MISSION = { deliverReward: 250, collectReward: 120, timeLimit: 75, collectCount: 3 };
export const WANTED = { decayPerSec: 0.06, bustSeconds: 1.6, max: 5 };

// Roads: verticals and horizontals; each road is a band with a centre line.
export const ROADS_X = [320, 800, 1280, 1760, 2240];
export const ROADS_Y = [300, 780, 1260, 1680];
export const ROAD_W = 96;

export const PALETTE = {
  grass: '#3d7a3a', grass2: '#356b33', park: '#2f8f4e', water: '#2b6cb0',
  road: '#33363d', roadEdge: '#4a4e57', lane: '#d8c84a', sidewalk: '#8a8d94',
  building: ['#b5654a', '#7a6a9b', '#4a7a9b', '#9b8a4a', '#6a9b6a', '#a05a7a', '#5a6a7a', '#c08a4a'],
  roof: '#00000033', player: '#f2c94c', playerCar: '#e5534b', parkedCar: '#7ab8e5',
  police: '#22262e', policeLight: '#ff2d2d', policeLight2: '#2d7dff',
  cash: '#37d67a', marker: '#ffdd33', text: '#eef1f5', muted: '#c8ccd4',
  panel: '#14181fdd', hud: '#f5f5f5', star: '#ffd23f', health: '#3ddc5f', danger: '#e5534b',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'leonida-nights.best';
