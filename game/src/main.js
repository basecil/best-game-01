// TIDEGLASS — boot and the one loop: input is read every frame, shards fall
// toward their rows, particles and floating scores age, and the renderer paints
// what is there. The board itself is turn-based: a swap resolves at once, in
// the world, and this file turns its events into sound, particles and screens.
// The game moves between six screens: title, play, paused, level clear,
// game over and campaign win.
//
// ?seed=N fixes the board. ?shot=start|play|clear|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, BOARD, LEVELS, MOVES_PER_LEVEL, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './board.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  SURGE_BUTTON, createRenderer, pointToCell,
} from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

const state = world.state;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = {
    best: scene.best,
    muted: false,
    selection: null,
    cursor: null,
    hoverCell: null,
    message: null,
    clearScore: scene.ui.clearScore ?? 0,
    clearBonus: scene.ui.clearBonus ?? 0,
    totalScore: scene.ui.totalScore ?? state.totalScore,
    target: scene.ui.target ?? LEVELS[state.level - 1].target,
  };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, ui, scene.fx, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  renderer.resize();
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let selection = null;
  let cursor = null;
  let message = null;
  let messageUntil = 0;
  let clearScore = 0;
  let clearBonus = 0;
  const fx = { pops: [], particles: [], floaters: [] };

  function ui() {
    return {
      best,
      muted: audio.isMuted(),
      selection,
      cursor,
      hoverCell: pointToCellForHover(),
      message: message && performance.now() < messageUntil ? message : null,
      clearScore,
      clearBonus,
      totalScore: state.totalScore,
      target: LEVELS[state.level - 1].target,
    };
  }

  function pointToCellForHover() {
    const hover = input.currentHover();
    if (!hover) return null;
    return pointToCell(hover.x, hover.y);
  }

  function announce(text) {
    status.textContent = text;
  }

  function toast(text) {
    message = text;
    messageUntil = performance.now() + 1800;
  }

  function noteBest() {
    if (state.totalScore > best) {
      best = state.totalScore;
      saveBest(best);
    }
  }

  // The resting centre of a cell: events arrive after the board has already
  // refilled, so the live shard position would point at the wrong place.
  function cellCenter(at) {
    return {
      x: BOARD.x + at.col * BOARD.cell + BOARD.cell / 2,
      y: BOARD.y + at.row * BOARD.cell + BOARD.cell / 2,
    };
  }

  function shardColor(type) {
    const colors = ['#ff6b6b', '#ffd166', '#7dd069', '#4fc3f7', '#c77dff'];
    return type >= 0 && type < colors.length ? colors[type] : '#fff6d8';
  }

  function burst(cells, color) {
    for (const at of cells) {
      const center = cellCenter(at);
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 160;
        fx.particles.push({
          x: center.x,
          y: center.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          color: color || shardColor(at.type !== undefined ? at.type : state.grid[at.row][at.col].type),
          size: 2 + Math.random() * 3,
          life: 0.5,
          maxLife: 0.5,
        });
      }
    }
  }

  function floater(cells, text, color) {
    if (cells.length === 0) return;
    let x = 0;
    let y = 0;
    for (const at of cells) {
      const center = cellCenter(at);
      x += center.x;
      y += center.y;
    }
    fx.floaters.push({ x: x / cells.length, y: y / cells.length - 24, text, color, life: 0.9, maxLife: 0.9 });
  }

  function applyEvent(event) {
    if (!event.ok) return;
    if (event.cleared.length > 0) {
      burst(event.cleared);
      floater(event.cleared, `+${event.scoreGain}`, '#ffd166');
      if (event.depth > 1) audio.match(event.depth);
      else audio.match(1);
    }
    if (event.pearlsCreated.length > 0) {
      audio.pearl();
      floater(event.pearlsCreated, 'Pearl!', '#fff6d8');
    }
    if (event.barnaclesCleared.length > 0) {
      burst(event.barnaclesCleared, '#8a7a68');
    }
    if (event.reshuffled) toast('No moves — the board reshuffled!');
    if (event.levelClear) {
      clearScore = state.levelScore;
      clearBonus = event.bonus;
      noteBest();
      if (state.level >= LEVELS.length) {
        screen = SCREEN_WIN;
        audio.win();
        announce(`You restored all five reefs! Total score ${state.totalScore}. Best ${best}.`);
      } else {
        screen = SCREEN_CLEAR;
        audio.clear();
        announce(`Reef ${state.level} restored! Level score ${clearScore}, bonus ${clearBonus}. Total ${state.totalScore}.`);
      }
    } else if (event.gameOver) {
      noteBest();
      screen = SCREEN_OVER;
      audio.over();
      announce(`Game over. Score ${state.totalScore}. Best ${best}.`);
    }
  }

  function trySwap(a, b) {
    audio.unlock();
    const event = world.swapCells(a, b);
    if (!event.ok) {
      audio.invalid();
      return;
    }
    audio.swap();
    selection = null;
    applyEvent(event);
  }

  function startCampaign() {
    world.startCampaign();
    selection = null;
    cursor = null;
    fx.particles.length = 0;
    fx.floaters.length = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Reef 1, ${LEVELS[0].name}. ${MOVES_PER_LEVEL} moves.`);
  }

  function nextLevel() {
    world.nextLevel();
    selection = null;
    cursor = null;
    screen = SCREEN_PLAY;
    announce(`Playing. Reef ${state.level}, ${LEVELS[state.level - 1].name}. ${MOVES_PER_LEVEL} moves.`);
  }

  function retryLevel() {
    world.retryLevel();
    selection = null;
    cursor = null;
    fx.particles.length = 0;
    fx.floaters.length = 0;
    screen = SCREEN_PLAY;
    announce(`Retrying reef ${state.level}. ${MOVES_PER_LEVEL} moves.`);
  }

  function doSurge() {
    audio.unlock();
    if (!state.surgeReady) {
      audio.invalid();
      return;
    }
    const event = world.surge();
    if (!event.ok) return;
    audio.surge();
    if (event.cleared.length > 0) {
      burst(event.cleared, '#4fc3f7');
      floater(event.cleared, `SURGE +${event.scoreGain}`, '#4fc3f7');
    }
    applyEvent(event);
  }

  function confirm() {
    audio.unlock();
    if (screen === SCREEN_TITLE) startCampaign();
    else if (screen === SCREEN_CLEAR) nextLevel();
    else if (screen === SCREEN_OVER) retryLevel();
    else if (screen === SCREEN_WIN) startCampaign();
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }

  function selectCell(at) {
    const cell = state.grid[at.row][at.col];
    if (cell.barnacle || cell.type < 0) return;
    if (selection && selection.col === at.col && selection.row === at.row) {
      selection = null;
      return;
    }
    if (selection) {
      const adjacent = Math.abs(selection.col - at.col) + Math.abs(selection.row - at.row) === 1;
      if (adjacent) {
        trySwap(selection, at);
        return;
      }
    }
    selection = at;
    audio.select();
  }

  function handleKeys() {
    for (const code of input.takeKeys()) {
      if (code === 'KeyM') {
        audio.toggleMute();
        continue;
      }
      if (code === 'KeyR') {
        startCampaign();
        continue;
      }
      if (code === 'Space') {
        if (screen === SCREEN_PLAY) doSurge();
        else confirm();
        continue;
      }
      if (code === 'KeyP') {
        if (screen === SCREEN_PLAY) {
          screen = SCREEN_PAUSED;
          announce('Paused.');
        } else if (screen === SCREEN_PAUSED) {
          screen = SCREEN_PLAY;
          announce('Playing.');
        }
        continue;
      }
      if (code === 'Escape') {
        if (screen === SCREEN_PLAY) {
          if (selection) selection = null;
          else {
            screen = SCREEN_PAUSED;
            announce('Paused.');
          }
        } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
        continue;
      }
      if (code === 'Enter') {
        if (screen === SCREEN_PLAY) {
          if (!cursor) cursor = { col: 3, row: 3 };
          else selectCell(cursor);
        } else confirm();
        continue;
      }
      if (code.startsWith('Arrow') && screen === SCREEN_PLAY) {
        if (!cursor) cursor = { col: 3, row: 3 };
        const dcol = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0;
        const drow = code === 'ArrowUp' ? -1 : code === 'ArrowDown' ? 1 : 0;
        if (selection) {
          const to = { col: selection.col + dcol, row: selection.row + drow };
          if (to.col >= 0 && to.col < BOARD.cols && to.row >= 0 && to.row < BOARD.rows) {
            trySwap(selection, to);
          }
        } else {
          cursor = {
            col: Math.min(BOARD.cols - 1, Math.max(0, cursor.col + dcol)),
            row: Math.min(BOARD.rows - 1, Math.max(0, cursor.row + drow)),
          };
        }
      }
    }
  }

  function handlePointer() {
    for (const click of input.takeClicks()) {
      audio.unlock();
      if (screen !== SCREEN_PLAY) {
        confirm();
        continue;
      }
      if (state.surgeReady
        && click.x >= SURGE_BUTTON.x && click.x <= SURGE_BUTTON.x + SURGE_BUTTON.width
        && click.y >= SURGE_BUTTON.y && click.y <= SURGE_BUTTON.y + SURGE_BUTTON.height) {
        doSurge();
        continue;
      }
      const at = pointToCell(click.x, click.y);
      if (at) selectCell(at);
    }
    for (const drag of input.takeDrags()) {
      if (screen !== SCREEN_PLAY) continue;
      const from = pointToCell(drag.from.x, drag.from.y);
      const to = pointToCell(drag.to.x, drag.to.y);
      if (from && to && (Math.abs(from.col - to.col) + Math.abs(from.row - to.row) === 1)) {
        trySwap(from, to);
      }
    }
  }

  function stepAnimations(dt) {
    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        const cell = state.grid[row][col];
        const target = BOARD.y + row * BOARD.cell;
        if (cell.type >= 0 && Math.abs(cell.py - target) > 0.5) {
          cell.py += (target - cell.py) * Math.min(1, dt * 14);
          if (Math.abs(cell.py - target) < 0.5) cell.py = target;
        } else if (cell.type >= 0) {
          cell.py = target;
        }
      }
    }
    for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
      const p = fx.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.life <= 0) fx.particles.splice(i, 1);
    }
    for (let i = fx.floaters.length - 1; i >= 0; i -= 1) {
      const f = fx.floaters[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) fx.floaters.splice(i, 1);
    }
  }

  let last = performance.now();
  let elapsed = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    elapsed += dt;
    handleKeys();
    handlePointer();
    if (screen === SCREEN_PLAY) stepAnimations(dt);
    renderer.draw(state, screen, ui(), fx, elapsed);
  }

  world.startCampaign();
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // Read-only handle for automated play-testing (and anyone poking at the game
  // from the console): the board's state and the screen it is on.
  window.__tideglass = {
    get state() { return state; },
    get screen() { return screen; },
  };
  announce('Tideglass. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
