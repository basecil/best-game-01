// Drawing only: the board, the side panel, the overlays and the effects.
// Nothing here changes the game state; main.js owns the screens and the
// input, this module just paints what the world and the view describe.
import {
  COLS, ROWS, CELL, BOARD_X, BOARD_Y, FIELD_W, FIELD_H, LEVELS,
  PANEL, SURGE_BTN, SHARDS, PEARL_COLOR, BARNACLE_COLOR, TIDE_MAX,
} from './config.js';
import { createRandom } from './random.js';

const bubbles = (() => {
  const rng = createRandom(7);
  const list = [];
  for (let i = 0; i < 16; i += 1) {
    list.push({
      x: rng.next() * FIELD_W, y: rng.next() * FIELD_H,
      r: 8 + rng.next() * 34, phase: rng.next() * Math.PI * 2,
      speed: 0.00012 + rng.next() * 0.0002, alpha: 0.03 + rng.next() * 0.05,
    });
  }
  return list;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function glyph(ctx, shape, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.75);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.75);
    ctx.closePath();
  } else if (shape === 'square') {
    ctx.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i += 1) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill();
}

function drawTile(ctx, cell, x, y, selected, cursor) {
  const s = CELL - 8;
  roundRect(ctx, x, y, s, s, 13);
  if (cell.barnacle) {
    ctx.fillStyle = '#241d16';
    ctx.fill();
    ctx.strokeStyle = BARNACLE_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#5d5347';
    ctx.beginPath();
    ctx.arc(x + s * 0.32, y + s * 0.36, 6, 0, Math.PI * 2);
    ctx.arc(x + s * 0.66, y + s * 0.58, 8, 0, Math.PI * 2);
    ctx.arc(x + s * 0.55, y + s * 0.28, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const cx = x + s / 2;
  const cy = y + s / 2;
  if (cell.type === 5) {
    ctx.fillStyle = '#3a2f10';
    ctx.fill();
    ctx.strokeStyle = '#ffd968';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd968';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PEARL_COLOR;
    star(ctx, cx, cy, 19);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const shard = SHARDS[cell.type];
    ctx.fillStyle = '#0d2733';
    ctx.fill();
    ctx.strokeStyle = shard.glow;
    ctx.lineWidth = 2;
    ctx.shadowColor = shard.glow;
    ctx.shadowBlur = selected ? 18 : 7;
    ctx.stroke();
    ctx.shadowBlur = 0;
    glyph(ctx, shard.shape, cx, cy, 14, shard.glyph);
  }
  if (selected) {
    ctx.strokeStyle = '#ffd968';
    ctx.lineWidth = 3.5;
    roundRect(ctx, x - 2, y - 2, s + 4, s + 4, 15);
    ctx.stroke();
  }
  if (cursor) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    const L = 10;
    const corners = [
      [x - 4, y - 4, 1, 1], [x + s + 4, y - 4, -1, 1],
      [x - 4, y + s + 4, 1, -1], [x + s + 4, y + s + 4, -1, -1],
    ];
    for (const [px, py, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(px + L * sx, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + L * sy);
      ctx.stroke();
    }
  }
}

function drawBoard(ctx, world, view) {
  roundRect(ctx, BOARD_X - 16, BOARD_Y - 16, COLS * CELL + 32, ROWS * CELL + 32, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const grid = world.state.grid;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = grid[r][c];
      const selected = view.selected !== null && view.selected.col === c && view.selected.row === r;
      const cursor = view.screen === 'play' && view.cursor !== null && view.cursor.col === c && view.cursor.row === r;
      drawTile(ctx, cell, BOARD_X + c * CELL + 4, BOARD_Y + r * CELL + 4, selected, cursor);
    }
  }
}

function bar(ctx, x, y, w, h, frac, color, track = 'rgba(255,255,255,0.10)') {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = track;
  ctx.fill();
  if (frac > 0) {
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawPanel(ctx, world, view) {
  const s = world.state;
  const level = LEVELS[s.level - 1];
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const px = PANEL.x + 28;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('SCORE', px, PANEL.y + 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText(String(s.totalScore), px, PANEL.y + 104);

  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('TARGET', px, PANEL.y + 148);
  ctx.fillStyle = '#ffd968';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText(String(s.levelScore), px, PANEL.y + 186);
  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(`/ ${level.target}`, px + 118, PANEL.y + 186);
  bar(ctx, px, PANEL.y + 202, PANEL.w - 56, 12, s.levelScore / level.target, '#38bdf8');

  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('MOVES LEFT', px, PANEL.y + 262);
  ctx.fillStyle = s.moves <= 5 ? '#ff8a7a' : '#ffffff';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText(String(s.moves), px, PANEL.y + 324);

  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('TIDE', px, PANEL.y + 362);
  bar(ctx, px, PANEL.y + 376, PANEL.w - 56, 12, s.tide / TIDE_MAX, '#4ade80');

  // Surge button.
  const b = SURGE_BTN;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12);
  if (s.surgeReady) {
    ctx.fillStyle = '#f5c542';
    ctx.fill();
    ctx.fillStyle = '#1a1405';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.fillStyle = '#7d99a6';
  }
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    s.surgeReady ? 'SURGE READY — press SPACE' : `TIDE ${s.tide}% — fill it to surge`,
    b.x + b.w / 2, b.y + 35,
  );
  ctx.textAlign = 'left';

  // Reef dots.
  const dotsY = PANEL.y + PANEL.h - 30;
  for (let i = 0; i < LEVELS.length; i += 1) {
    const dx = px + i * 30;
    ctx.beginPath();
    ctx.arc(dx + 7, dotsY, 7, 0, Math.PI * 2);
    if (i < s.level - 1) {
      ctx.fillStyle = '#ffd968';
      ctx.fill();
    } else if (i === s.level - 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
  }
  ctx.fillStyle = '#8fb3c0';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(`${s.level} of 5 reefs`, px + LEVELS.length * 30 + 12, dotsY + 6);
}

function drawHeader(ctx, world) {
  const s = world.state;
  const level = LEVELS[s.level - 1];
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText('TIDEGLASS', BOARD_X, 72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fc6d4';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(`REEF ${s.level} · ${level.name}`, FIELD_W / 2, 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fb3c0';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(`BEST ${s.best}`, FIELD_W - BOARD_X, 70);
  ctx.textAlign = 'left';
}

function drawFooter(ctx, world) {
  ctx.fillStyle = '#7d99a6';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const mute = world.muted ? 'M: Unmute' : 'M: Sound';
  ctx.fillText(
    `Click two shards to swap · Match 3 or more · 4 in a row makes a Pearl · Space: Surge · P: Pause · R: Restart · ${mute}`,
    FIELD_W / 2, 712,
  );
  ctx.textAlign = 'left';
}

function drawPopups(ctx, world, now) {
  const s = world.state;
  ctx.textAlign = 'center';
  ctx.font = '800 26px system-ui, sans-serif';
  for (const p of s.popups) {
    const rise = (1 - p.life) * 44;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = '#ffd968';
    ctx.fillText(p.text, p.x, p.y - rise);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function overlayPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(4,18,28,0.72)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = '#0d2733';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function overlayText(ctx, cx, top, h, lines, prompt) {
  const y = top + 74;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(lines[0], cx, y);
  ctx.fillStyle = '#b8d4de';
  ctx.font = '18px system-ui, sans-serif';
  let ly = y + 38;
  for (const line of lines.slice(1)) {
    ctx.fillText(line, cx, ly);
    ly += 28;
  }
  if (prompt !== null) {
    ctx.fillStyle = '#ffd968';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(prompt, cx, top + h - 44);
  }
  ctx.textAlign = 'left';
}

// The panel geometry is shared by the four overlays; h is the panel height.
function panelFor(h) {
  return { x: BOARD_X, y: 150, w: COLS * CELL, h };
}

export function draw(ctx, world, view) {
  const s = world.state;
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  grad.addColorStop(0, '#0a2531');
  grad.addColorStop(1, '#06121c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  for (const b of bubbles) {
    const by = b.y + Math.sin(view.now * b.speed + b.phase) * 14;
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(b.x, by, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawHeader(ctx, world);
  drawBoard(ctx, world, view);
  drawPanel(ctx, world, view);
  drawFooter(ctx, world);
  drawPopups(ctx, world, view.now);

  const cx = BOARD_X + (COLS * CELL) / 2;
  if (view.screen === 'title') {
    const p = panelFor(420);
    overlayPanel(ctx, p.x, p.y, p.w, p.h);
    overlayText(ctx, cx, p.y, p.h, [
      'TIDEGLASS',
      'Restore the reef, one match at a time.',
      'Swap shards to match 3 or more.',
      'Four in a row makes a Pearl.',
      'Fill the Tide meter, then surge',
      'to sweep a row and a column.',
      `Clear ${LEVELS[0].target} points in 24 moves`,
      'to save the first reef.',
      '',
      `Best campaign: ${s.best}`,
    ], 'Press Space or click to start');
  } else if (view.screen === 'paused') {
    const p = panelFor(220);
    overlayPanel(ctx, p.x, p.y, p.w, p.h);
    overlayText(ctx, cx, p.y, p.h, ['Paused'], 'Press P or click to resume');
  } else if (view.screen === 'clear') {
    const p = panelFor(380);
    overlayPanel(ctx, p.x, p.y, p.w, p.h);
    const last = s.level >= LEVELS.length;
    overlayText(ctx, cx, p.y, p.h, [
      last ? 'Every Reef Restored!' : 'Reef Restored!',
      `Level score ${s.levelScore} · Move bonus +${s.bonus}`,
      `Total score ${s.totalScore}`,
      '',
      last ? 'The tide is yours. Campaign complete!' : `Next: ${LEVELS[s.level].name}`,
    ], last ? 'Press Space or click to celebrate' : 'Press Space or click for the next reef');
  } else if (view.screen === 'over') {
    const p = panelFor(360);
    overlayPanel(ctx, p.x, p.y, p.w, p.h);
    overlayText(ctx, cx, p.y, p.h, [
      'The Tide Went Out',
      `Score ${s.levelScore} · Target was ${LEVELS[s.level - 1].target}`,
      `Best campaign: ${s.best}`,
      '',
      'The reef still needs you.',
    ], 'Try again — press R or click');
  } else if (view.screen === 'win') {
    const p = panelFor(300);
    overlayPanel(ctx, p.x, p.y, p.w, p.h);
    overlayText(ctx, cx, p.y, p.h, [
      'Every Reef Restored!',
      `Final score ${s.totalScore}`,
      `Best campaign: ${s.best}`,
    ], 'Press Space or click for the title screen');
  }
}
