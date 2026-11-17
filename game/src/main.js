// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city layout. ?shot=start|play|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_MISSION, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage can be off */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingEnter = false;

  function announce(message) { status.textContent = message; }

  function startGame() {
    world.reset();
    accumulator = 0; pendingEnter = false;
    screen = SCREEN_PLAY;
    announce('Playing. Get in a car with E and follow the marker.');
  }
  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    announce(`Game over. ${world.state.overReason}. Score ${world.state.score}. Best ${best}.`);
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    if (actions & ACTION_ENTER && screen === SCREEN_PLAY) pendingEnter = true;
  }
  function step() {
    if (screen === SCREEN_TITLE) { world.step(STEP, null, true); return; }
    const stepInput = { vector: () => input.vector(), enter: pendingEnter };
    pendingEnter = false;
    const events = world.step(STEP, stepInput, false);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION) announce(`Mission complete! $${world.state.money}. Level ${world.state.level}.`);
    else if (events & EVENT_HIT) announce(`Hit by the police! Health ${Math.ceil(world.state.player.health)}.`);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Leonida Nights. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
