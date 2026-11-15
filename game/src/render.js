// TIDEGLASS — drawing only: the world's state and the current screen in,
// pixels out. The 1280x720 playfield is scaled to fit the window and centred,
// the margin filled with the backdrop colour. Glass shards are drawn as tiles
// with a coloured shape inside, so each kind reads by colour and by form.
// Text that holds a number is rebuilt only when the number changes, so a frame
// allocates nothing.
import { BOARD, FIELD, FONT, LEVELS, MOVES_PER_LEVEL, PANEL, PALETTE, PEARL, PEARL_COLOR, SHARDS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The surge button, in field coordinates; main.js hit-tests clicks against it. */
export const SURGE_BUTTON = { x: 700, y: 528, width: 480, height: 48 };

const TILE_INSET = 6;
const SHAPE_RADIUS = 17;

/** Fixed bubbles for the backdrop: same positions on every load, so shots are stable. */
const BUBBLES = (() => {
  let a = 1234567;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const list = [];
  for (let i = 0; i < 26; i += 1) {
    list.push({ x: next() * FIELD.width, y: next() * FIELD.height, r: 3 + next() * 14, speed: 6 + next() * 14, phase: next() * 6.28 });
  }
  return list;
})();

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawShape(context, shape, x, y, r, color) {
  context.fillStyle = color;
  context.beginPath();
  if (shape === 'circle') {
    context.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    context.moveTo(x, y - r);
    context.lineTo(x + r, y);
    context.lineTo(x, y + r);
    context.lineTo(x - r, y);
    context.closePath();
  } else if (shape === 'triangle') {
    context.moveTo(x, y - r);
    context.lineTo(x + r * 0.95, y + r * 0.75);
    context.lineTo(x - r * 0.95, y + r * 0.75);
    context.closePath();
  } else if (shape === 'square') {
    context.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(angle);
      const py = y + r * Math.sin(angle);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + rad * Math.cos(angle);
      const py = y + rad * Math.sin(angle);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }
  context.fill();
}

export function pointToCell(x, y) {
  const col = Math.floor((x - BOARD.x) / BOARD.cell);
  const row = Math.floor((y - BOARD.y) / BOARD.cell);
  if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return null;
  return { col, row };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('');
  const levelScoreLabel = cachedLabel('');
  const movesLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const totalLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function toField(wx, wy) {
    return { x: (wx - view.x) / view.scale, y: (wy - view.y) / view.scale };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.deep);
    gradient.addColorStop(1, PALETTE.backdrop);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = 'rgba(79, 195, 247, 0.10)';
    for (const bubble of BUBBLES) {
      const rise = (time * bubble.speed + bubble.phase * 40) % (FIELD.height + 80);
      const y = FIELD.height + 40 - rise;
      context.beginPath();
      context.arc(bubble.x, y, bubble.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawShard(col, row, type, py, scale, alpha) {
    const cx = BOARD.x + col * BOARD.cell + BOARD.cell / 2;
    const cy = py + BOARD.cell / 2;
    const half = BOARD.cell / 2 - TILE_INSET;
    context.save();
    context.globalAlpha = alpha;
    context.translate(cx, cy);
    context.scale(scale, scale);
    context.translate(-cx, -cy);
    if (type === PEARL) {
      context.shadowColor = PEARL_COLOR;
      context.shadowBlur = 18;
      context.fillStyle = 'rgba(255, 246, 216, 0.35)';
      roundRect(context, cx - half, cy - half, half * 2, half * 2, 12);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = PEARL_COLOR;
      context.lineWidth = 2.5;
      roundRect(context, cx - half, cy - half, half * 2, half * 2, 12);
      context.stroke();
      drawShape(context, 'star', cx, cy, SHAPE_RADIUS + 2, '#ffd166');
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(cx, cy, 4, 0, Math.PI * 2);
      context.fill();
    } else {
      const shard = SHARDS[type];
      context.fillStyle = shard.color;
      context.globalAlpha = alpha * 0.30;
      roundRect(context, cx - half, cy - half, half * 2, half * 2, 12);
      context.fill();
      context.globalAlpha = alpha;
      context.strokeStyle = shard.color;
      context.lineWidth = 2.5;
      roundRect(context, cx - half, cy - half, half * 2, half * 2, 12);
      context.stroke();
      drawShape(context, shard.shape, cx, cy, SHAPE_RADIUS, shard.color);
      context.fillStyle = 'rgba(255, 255, 255, 0.85)';
      context.beginPath();
      context.arc(cx, cy, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawBarnacle(col, row) {
    const cx = BOARD.x + col * BOARD.cell + BOARD.cell / 2;
    const cy = BOARD.y + row * BOARD.cell + BOARD.cell / 2;
    context.fillStyle = PALETTE.barnacle;
    context.beginPath();
    context.arc(cx - 12, cy + 6, 13, 0, Math.PI * 2);
    context.arc(cx + 11, cy + 8, 11, 0, Math.PI * 2);
    context.arc(cx, cy - 10, 12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.barnacleRim;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, 20, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255, 255, 255, 0.25)';
    context.beginPath();
    context.arc(cx - 8, cy - 8, 3, 0, Math.PI * 2);
    context.arc(cx + 9, cy - 2, 2, 0, Math.PI * 2);
    context.fill();
  }

  function drawBoard(state, ui, fx) {
    context.fillStyle = PALETTE.board;
    roundRect(context, BOARD.x - 10, BOARD.y - 10, BOARD.cols * BOARD.cell + 20, BOARD.rows * BOARD.cell + 20, 16);
    context.fill();
    context.strokeStyle = PALETTE.boardEdge;
    context.lineWidth = 2;
    roundRect(context, BOARD.x - 10, BOARD.y - 10, BOARD.cols * BOARD.cell + 20, BOARD.rows * BOARD.cell + 20, 16);
    context.stroke();
    const popKeys = new Map();
    for (const pop of fx.pops || []) popKeys.set(`${pop.col},${pop.row}`, pop);
    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        const cell = state.grid[row][col];
        if (cell.barnacle) {
          drawBarnacle(col, row);
          continue;
        }
        if (cell.type < 0) continue;
        const pop = popKeys.get(`${col},${row}`);
        if (pop) {
          drawShard(col, row, cell.type, cell.py, 1 - 0.55 * pop.progress, 1 - 0.45 * pop.progress);
        } else {
          drawShard(col, row, cell.type, cell.py, 1, 1);
        }
      }
    }
    // Selection, keyboard cursor and hover rings, drawn over the shards.
    if (ui.selection) {
      const cx = BOARD.x + ui.selection.col * BOARD.cell + BOARD.cell / 2;
      const cy = BOARD.y + ui.selection.row * BOARD.cell + BOARD.cell / 2;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 4;
      roundRect(context, cx - 30, cy - 30, 60, 60, 12);
      context.stroke();
    }
    if (ui.cursor) {
      const cx = BOARD.x + ui.cursor.col * BOARD.cell + BOARD.cell / 2;
      const cy = BOARD.y + ui.cursor.row * BOARD.cell + BOARD.cell / 2;
      context.strokeStyle = 'rgba(238, 247, 245, 0.8)';
      context.lineWidth = 2;
      context.setLineDash([6, 5]);
      roundRect(context, cx - 30, cy - 30, 60, 60, 12);
      context.stroke();
      context.setLineDash([]);
    }
    if (ui.hoverCell && !ui.selection) {
      const cx = BOARD.x + ui.hoverCell.col * BOARD.cell + BOARD.cell / 2;
      const cy = BOARD.y + ui.hoverCell.row * BOARD.cell + BOARD.cell / 2;
      context.strokeStyle = 'rgba(238, 247, 245, 0.25)';
      context.lineWidth = 2;
      roundRect(context, cx - 30, cy - 30, 60, 60, 12);
      context.stroke();
    }
  }

  function drawParticles(fx) {
    for (const p of fx.particles || []) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(fx) {
    for (const f of fx.floaters || []) {
      context.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, 26, f.color, 'center', '700');
    }
    context.globalAlpha = 1;
  }

  function drawTopBar(state, ui) {
    context.textBaseline = 'alphabetic';
    text('TIDEGLASS', BOARD.x, 46, 34, PALETTE.text, 'left', '800');
    const level = LEVELS[state.level - 1];
    text(`REEF ${state.level} · ${level.name}`, FIELD.width / 2, 44, 24, PALETTE.muted, 'center', '600');
    text(bestLabel(ui.best), FIELD.width - BOARD.x, 44, 24, PALETTE.muted, 'right', '600');
  }

  function drawPanel(state, ui, time) {
    context.fillStyle = PALETTE.panel;
    roundRect(context, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 16);
    context.stroke();
    const px = PANEL.x + 28;
    text('SCORE', px, 150, 20, PALETTE.muted, 'left', '600');
    text(scoreLabel(state.totalScore), px, 200, 54, PALETTE.text, 'left', '800');
    const level = LEVELS[state.level - 1];
    text('TARGET', px, 246, 20, PALETTE.muted, 'left', '600');
    text(levelScoreLabel(state.levelScore), px, 282, 34, state.levelScore >= level.target ? PALETTE.gold : PALETTE.text, 'left', '700');
    text(`/ ${level.target}`, px + 150, 282, 24, PALETTE.muted, 'left', '600');
    const barW = PANEL.width - 56;
    const ratio = Math.min(1, state.levelScore / level.target);
    context.fillStyle = PALETTE.board;
    roundRect(context, px, 296, barW, 16, 8);
    context.fill();
    context.fillStyle = ratio >= 1 ? PALETTE.gold : PALETTE.tide;
    if (ratio > 0) {
      roundRect(context, px, 296, Math.max(16, barW * ratio), 16, 8);
      context.fill();
    }
    text('MOVES LEFT', px, 372, 20, PALETTE.muted, 'left', '600');
    text(movesLabel(state.moves), px, 424, 56, state.moves <= 5 ? PALETTE.danger : PALETTE.text, 'left', '800');
    text('TIDE', px, 474, 20, PALETTE.muted, 'left', '600');
    context.fillStyle = PALETTE.board;
    roundRect(context, px, 486, barW, 16, 8);
    context.fill();
    if (state.tide > 0) {
      context.fillStyle = PALETTE.tide;
      roundRect(context, px, 486, Math.max(16, barW * (state.tide / 100)), 16, 8);
      context.fill();
    }
    const ready = state.surgeReady;
    const pulse = ready ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
    context.globalAlpha = pulse;
    context.fillStyle = ready ? PALETTE.gold : PALETTE.boardEdge;
    roundRect(context, SURGE_BUTTON.x, SURGE_BUTTON.y, SURGE_BUTTON.width, SURGE_BUTTON.height, 12);
    context.fill();
    context.globalAlpha = 1;
    text(ready ? 'SURGE READY — press SPACE' : `TIDE ${state.tide}% — fill it to surge`, SURGE_BUTTON.x + SURGE_BUTTON.width / 2, SURGE_BUTTON.y + 32, 22, ready ? '#0a1a24' : PALETTE.muted, 'center', '700');
    // Five reef dots: filled for cleared reefs, ringed for the one being played.
    for (let i = 0; i < LEVELS.length; i += 1) {
      const cx = px + 12 + i * 34;
      const cy = 612;
      if (i < state.level - 1) {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(cx, cy, 8, 0, Math.PI * 2);
        context.fill();
      } else if (i === state.level - 1) {
        context.strokeStyle = PALETTE.tide;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cx, cy, 8, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.fillStyle = PALETTE.boardEdge;
        context.beginPath();
        context.arc(cx, cy, 6, 0, Math.PI * 2);
        context.fill();
      }
    }
    text(`${state.level} of 5 reefs`, px + 12 + 5 * 34 + 8, 620, 18, PALETTE.muted, 'left', '600');
  }

  function drawBottomHint() {
    text('Click two shards to swap · Match 3 or more · 4 in a row makes a Pearl · Space: Surge · P: Pause · R: Restart · M: Sound', FIELD.width / 2, 700, 19, PALETTE.muted, 'center', '400');
  }

  function drawToast(ui) {
    if (!ui.message) return;
    text(ui.message, FIELD.width / 2, 92, 24, PALETTE.gold, 'center', '700');
  }

  function drawOverlay(title, lines, prompt) {
    context.fillStyle = 'rgba(6, 18, 26, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Centred on the board, so the overlay never covers the side panel's score.
    const width = 600;
    const height = 150 + lines.length * 36 + 70;
    const x = BOARD.x + (BOARD.cols * BOARD.cell) / 2 - width / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 18);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 18);
    context.stroke();
    text(title, x + width / 2, y + 76, 46, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], x + width / 2, y + 128 + i * 36, 22, PALETTE.muted, 'center', '400');
    }
    text(prompt, x + width / 2, y + height - 38, 24, PALETTE.gold, 'center', '700');
  }

  /** Paint one frame: background, board, HUD, panel, effects, then the screen's overlay. */
  function draw(state, screen, ui, fx, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackground(time);
    drawBoard(state, ui, fx);
    drawParticles(fx);
    drawFloaters(fx);
    drawTopBar(state, ui);
    drawPanel(state, ui, time);
    drawBottomHint();
    drawToast(ui);
    if (screen === SCREEN_TITLE) {
      drawOverlay('TIDEGLASS', [
        'Restore the reef, one match at a time.',
        'Swap shards to match 3 or more.',
        'Four in a row makes a Pearl.',
        'Fill the Tide meter, then surge',
        'to sweep a row and a column.',
        `Clear ${LEVELS[0].target} points in ${MOVES_PER_LEVEL} moves`,
        'to save the first reef.',
        '',
        `Best campaign: ${ui.best}`,
      ], 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay('Paused', ['The reef waits for you.'], 'Press P or click to keep playing');
    } else if (screen === SCREEN_CLEAR) {
      drawOverlay('Reef Restored!', [
        `Level score ${ui.clearScore}  ·  Move bonus +${ui.clearBonus}`,
        `Total score ${ui.totalScore}`,
        '',
        state.level < LEVELS.length ? `Next: ${LEVELS[state.level].name}` : '',
      ], state.level < LEVELS.length ? 'Press Space or click for the next reef' : 'Press Space or click');
    } else if (screen === SCREEN_OVER) {
      drawOverlay('The Tide Went Out', [
        `Score ${ui.totalScore}  ·  Target was ${ui.target}`,
        `Best campaign: ${ui.best}`,
        '',
        'The reef still needs you.',
      ], 'Try again — press R or click');
    } else if (screen === SCREEN_WIN) {
      drawOverlay('The Reef Glows Again', [
        'All five reefs restored.',
        `Total score ${ui.totalScore}`,
        `Best campaign: ${ui.best}`,
      ], 'Play again — press R or click');
    }
    if (ui.muted) {
      text('Muted', FIELD.width - BOARD.x, 84, 18, PALETTE.muted, 'right', '600');
    }
  }

  return { resize, draw, toField };
}
