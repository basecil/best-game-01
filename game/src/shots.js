// The four screenshot scenes, staged deterministically from a seed: the
// title, a mid-game surge moment, a reef cleared, and a campaign lost.
// Each scene sets the world to a fixed state and names the screen to show.
import { BOARD_X, BOARD_Y, CELL } from './config.js';

function cellCenter(col, row) {
  return { x: BOARD_X + col * CELL + CELL / 2, y: BOARD_Y + row * CELL + CELL / 2 };
}

export function stageShot(name, world) {
  const s = world.state;
  if (name === 'start') {
    world.startCampaign();
    return { screen: 'title' };
  }
  if (name === 'play') {
    world.reset(2);
    s.levelScore = 550;
    s.banked = 0;
    s.totalScore = 550;
    s.moves = 19;
    s.tide = 100;
    s.surgeReady = true;
    s.best = 550;
    // A Pearl on the board and a frozen surge popup, mid-match.
    const pearl = s.grid[2][0];
    pearl.barnacle = false;
    pearl.type = 5;
    const at = cellCenter(2, 2);
    s.popups.push({ x: at.x, y: at.y, text: '+150', life: 1 });
    return { screen: 'play' };
  }
  if (name === 'clear') {
    world.reset(1);
    s.levelScore = 700;
    s.moves = 17;
    s.bonus = 425;
    s.totalScore = 1125;
    s.banked = 1125;
    s.best = 1125;
    s.tide = 64;
    s.surgeReady = false;
    return { screen: 'clear' };
  }
  world.reset(5);
  s.levelScore = 1020;
  s.moves = 0;
  s.totalScore = 1020;
  s.banked = 0;
  s.best = 1020;
  s.tide = 100;
  s.surgeReady = true;
  return { screen: 'over' };
}
