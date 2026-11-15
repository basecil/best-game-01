// TIDEGLASS — the screenshot scenes behind ?shot=start|play|clear|end.
// Each one plays the real rules forward from a fresh world for a fixed number
// of autopilot swaps, so the frame is what a real game looks like and the same
// seed always gives the same frame. The play scene stops mid-match: the last
// swap is applied but not cleared, and its shards are frozen mid-pop.

import { BOARD, LEVELS } from './config.js';
import { createRandom } from './random.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_SWAPS = 10;
/** The play scene stops well short of the level's target, so the frame is mid-game. */
const PLAY_SCORE_CAP = 550;
const CLEAR_SWAP_CAP = 200;
const PARTICLES_PER_SHARD = 5;

/** One autopilot swap: the best-scoring swap on the board, or null. */
function autoSwap(world) {
  const best = world.findBestSwap();
  if (!best) return null;
  return world.swapCells(best.a, best.b);
}

function playSwaps(world, count) {
  let last = null;
  for (let i = 0; i < count; i += 1) {
    if (world.state.levelScore >= PLAY_SCORE_CAP) break;
    last = autoSwap(world);
    if (!last) break;
    if (last.levelClear || last.gameOver) break;
  }
  return last;
}

/**
 * A weak player for the end scene: the first valid swap in scan order, never
 * cashing a pearl — the way a hurried player loses a level for real.
 */
function weakSwap(world) {
  const grid = world.state.grid;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = grid[row][col];
      if (cell.barnacle || cell.type < 0 || cell.type === 5) continue; // 5 is the Pearl type
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 8 || nr >= 8) continue;
        const next = grid[nr][nc];
        if (next.barnacle || next.type < 0 || next.type === 5) continue;
        const preview = world.previewSwap({ col, row }, { col: nc, row: nr });
        if (preview.ok) return world.swapCells({ col, row }, { col: nc, row: nr });
      }
    }
  }
  return null;
}

/** Frozen mid-flight particles for the play scene's popping shards. */
function popFx(runs, points, random) {
  const pops = [];
  const particles = [];
  const floaters = [];
  let cx = 0;
  let cy = 0;
  let count = 0;
  for (const run of runs) {
    for (const at of run) {
      pops.push({ col: at.col, row: at.row, progress: 0.5 });
      const x = BOARD.x + at.col * BOARD.cell + BOARD.cell / 2;
      const y = BOARD.y + at.row * BOARD.cell + BOARD.cell / 2;
      cx += x;
      cy += y;
      count += 1;
      for (let i = 0; i < PARTICLES_PER_SHARD; i += 1) {
        const angle = random() * Math.PI * 2;
        const speed = 40 + random() * 90;
        particles.push({
          x: x + Math.cos(angle) * speed * 0.25,
          y: y + Math.sin(angle) * speed * 0.25,
          color: '#ffd166',
          size: 2 + random() * 3,
          life: 1,
          maxLife: 1,
        });
      }
    }
  }
  if (count > 0) {
    floaters.push({
      x: cx / count,
      y: cy / count - 30,
      text: `+${points}`,
      color: '#ffd166',
      life: 1,
      maxLife: 1,
    });
  }
  return { pops, particles, floaters };
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * best score to show, the frozen effects and the overlay numbers.
 */
export function stageShot(name, world) {
  const random = createRandom(99);
  if (name === 'play') {
    world.reset(2);
    playSwaps(world, PLAY_SWAPS);
    const best = world.findBestSwap();
    if (best) {
      const preview = world.applySwap(best.a, best.b);
      if (preview.ok) {
        world.snap();
        return {
          screen: SCREEN_PLAY,
          best: world.state.totalScore,
          fx: popFx(preview.runs, preview.points, random),
          ui: {},
        };
      }
    }
    world.snap();
    return { screen: SCREEN_PLAY, best: world.state.totalScore, fx: { pops: [], particles: [], floaters: [] }, ui: {} };
  }
  if (name === 'clear') {
    world.startCampaign();
    let last = null;
    for (let i = 0; i < CLEAR_SWAP_CAP; i += 1) {
      last = autoSwap(world);
      if (!last || last.levelClear || last.gameOver) break;
    }
    world.snap();
    return {
      screen: SCREEN_CLEAR,
      best: world.state.totalScore,
      fx: { pops: [], particles: [], floaters: [] },
      ui: { clearScore: world.state.levelScore, clearBonus: last ? last.bonus : 0, totalScore: world.state.totalScore },
    };
  }
  if (name === 'end') {
    world.reset(LEVELS.length);
    let last = null;
    for (let i = 0; i < 40; i += 1) {
      if (world.state.moves <= 0) break;
      last = weakSwap(world);
      if (!last || last.levelClear || last.gameOver) break;
    }
    world.snap();
    return {
      screen: SCREEN_OVER,
      best: world.state.totalScore,
      fx: { pops: [], particles: [], floaters: [] },
      ui: { totalScore: world.state.totalScore, target: LEVELS[LEVELS.length - 1].target, best: world.state.totalScore },
    };
  }
  world.startCampaign();
  world.snap();
  return { screen: SCREEN_TITLE, best: 0, fx: { pops: [], particles: [], floaters: [] }, ui: {} };
}
