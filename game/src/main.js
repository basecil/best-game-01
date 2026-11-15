// TIDEGLASS boot and shell: the screen machine, the frame loop, the
// debug handle the play-test reads, and the screenshot staging. The rules
// live in board.js; this file only wires input, sound and drawing to them.
import { createRandom } from './random.js';
import { createWorld } from './board.js';
import { BOARD_X, BOARD_Y, CELL } from './config.js';
import { draw } from './render.js';
import { bindInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const rng = createRandom(
  Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647),
);
const world = createWorld(rng);
const audio = createAudio();
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

let screen = 'title';
let cursor = { col: 3, row: 3 };
let selected = null;
let best = Number.parseInt(window.localStorage.getItem('tideglass.best') ?? '0', 10) || 0;
world.state.best = best;

const handle = {
  state: world.state,
  get screen() { return screen; },
};
window.__tideglass = handle;

function saveBest() {
  if (world.state.totalScore > best) {
    best = world.state.totalScore;
    world.state.best = best;
    try {
      window.localStorage.setItem('tideglass.best', String(best));
    } catch {
      // A private window still plays; the best just does not persist.
    }
  }
}

function cellCenter(cell) {
  return { x: BOARD_X + cell.col * CELL + CELL / 2, y: BOARD_Y + cell.row * CELL + CELL / 2 };
}

function agePopups(dt) {
  const popups = world.state.popups;
  for (let i = popups.length - 1; i >= 0; i -= 1) {
    popups[i].life -= dt / 1200;
    if (popups[i].life <= 0) popups.splice(i, 1);
  }
}

function afterScore(ev, at) {
  if (ev.scoreGain > 0) {
    const atCell = at ?? { col: 3, row: 3 };
    const c = cellCenter(atCell);
    world.state.popups.push({ x: c.x, y: c.y, text: `+${ev.scoreGain}`, life: 1 });
  }
  if (ev.pearlsCreated.length > 0) audio.pearl();
  else if (ev.scoreGain > 0) audio.match(ev.depth);
  if (ev.levelClear) {
    saveBest();
    screen = 'clear';
    audio.clear();
  } else if (ev.gameOver) {
    saveBest();
    screen = 'over';
    audio.over();
  } else if (screen === 'play' && world.state.moves > 0 && !world.hasMoves()) {
    world.reshuffle();
    world.state.popups.push({ x: 344, y: 360, text: 'Shuffled!', life: 1 });
  }
}

function doSwap(a, b) {
  const ev = world.swapCells(a, b);
  if (!ev.ok) {
    if (ev.kind === 'nomatch') audio.swap();
    return;
  }
  audio.swap();
  afterScore(ev, b);
}

function doSurge() {
  const ev = world.surge();
  if (!ev.ok) return;
  audio.surge();
  afterScore(ev, { col: 3, row: 3 });
}

function startPlay() {
  world.startCampaign();
  screen = 'play';
  selected = null;
  cursor = { col: 3, row: 3 };
}

function advance() {
  if (screen === 'title') {
    startPlay();
  } else if (screen === 'clear') {
    if (world.nextLevel()) screen = 'play';
    else screen = 'win';
    selected = null;
  } else if (screen === 'over') {
    world.retryLevel();
    screen = 'play';
    selected = null;
  } else if (screen === 'win') {
    world.startCampaign();
    screen = 'title';
  } else if (screen === 'paused') {
    screen = 'play';
  }
}

function onKey(code) {
  if (code === 'Space') {
    if (screen === 'play') {
      if (world.state.surgeReady) doSurge();
    } else {
      advance();
    }
    return;
  }
  if (code === 'KeyM') {
    audio.toggleMute();
    world.muted = audio.muted;
    return;
  }
  if (code === 'KeyR') {
    if (screen === 'over') {
      world.retryLevel();
      screen = 'play';
    } else {
      startPlay();
    }
    selected = null;
    return;
  }
  if (code === 'KeyP') {
    if (screen === 'play') screen = 'paused';
    else if (screen === 'paused') screen = 'play';
    return;
  }
  if (screen !== 'play') return;
  if (code === 'ArrowUp') cursor.row = Math.max(0, cursor.row - 1);
  else if (code === 'ArrowDown') cursor.row = Math.min(7, cursor.row + 1);
  else if (code === 'ArrowLeft') cursor.col = Math.max(0, cursor.col - 1);
  else if (code === 'ArrowRight') cursor.col = Math.min(7, cursor.col + 1);
  else if (code === 'Enter' || code === 'NumpadEnter') {
    if (selected === null) {
      selected = { ...cursor };
      audio.select();
    } else if (selected.col === cursor.col && selected.row === cursor.row) {
      selected = null;
    } else if (Math.abs(selected.col - cursor.col) + Math.abs(selected.row - cursor.row) === 1) {
      const a = selected;
      selected = null;
      doSwap(a, { ...cursor });
    } else {
      selected = { ...cursor };
      audio.select();
    }
  }
}

function pickCell(cell) {
  if (screen !== 'play') {
    advance();
    return;
  }
  cursor = { ...cell };
  if (selected === null) {
    selected = { ...cell };
    audio.select();
    return;
  }
  if (selected.col === cell.col && selected.row === cell.row) {
    selected = null;
    return;
  }
  if (Math.abs(selected.col - cell.col) + Math.abs(selected.row - cell.row) === 1) {
    const a = selected;
    selected = null;
    doSwap(a, cell);
  } else {
    selected = { ...cell };
    audio.select();
  }
}

bindInput(canvas, {
  pickCell,
  dragSwap: (a, b) => {
    if (screen !== 'play') return;
    cursor = { ...b };
    selected = null;
    doSwap(a, b);
  },
  surgeButton: () => {
    if (screen === 'play') doSurge();
  },
  overlayClick: () => {
    if (screen !== 'play') advance();
    else if (screen === 'paused') screen = 'play';
  },
  key: onKey,
});

world.startCampaign();

const shot = params.get('shot');
if (shot !== null) {
  const scene = stageShot(shot, world);
  screen = scene.screen;
  if (shot === 'start') world.state.best = 0;
}

let last = 0;
let paints = 0;
function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  agePopups(dt);
  draw(ctx, world, { screen, cursor, selected, now });
  if (shot !== null) {
    paints += 1;
    if (paints >= 2) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
