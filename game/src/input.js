// Mouse and keyboard, queued per frame: clicks and drags become cell
// picks and swaps, keys become named actions. This module never touches
// the rules; main.js decides what each gesture means for the screen.
import { COLS, ROWS, CELL, BOARD_X, BOARD_Y, SURGE_BTN } from './config.js';

function cellFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor((x - BOARD_X) / CELL);
  const row = Math.floor((y - BOARD_Y) / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row, x, y };
}

function onSurgeButton(x, y) {
  return x >= SURGE_BTN.x && x <= SURGE_BTN.x + SURGE_BTN.w
    && y >= SURGE_BTN.y && y <= SURGE_BTN.y + SURGE_BTN.h;
}

export function bindInput(canvas, handlers) {
  let downCell = null;
  let downPos = null;

  canvas.addEventListener('mousedown', (event) => {
    const cell = cellFromEvent(canvas, event);
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    downCell = cell;
    downPos = { x, y };
    if (cell === null && onSurgeButton(x, y)) handlers.surgeButton();
  });

  canvas.addEventListener('mouseup', (event) => {
    const cell = cellFromEvent(canvas, event);
    if (downCell !== null && cell !== null) {
      if (cell.col === downCell.col && cell.row === downCell.row) {
        handlers.pickCell(cell);
      } else if (Math.abs(cell.col - downCell.col) + Math.abs(cell.row - downCell.row) === 1) {
        handlers.dragSwap(downCell, cell);
      } else {
        handlers.pickCell(cell);
      }
    } else if (downPos !== null && cell === null) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (!onSurgeButton(x, y) && !onSurgeButton(downPos.x, downPos.y)) {
        handlers.overlayClick();
      }
    }
    downCell = null;
    downPos = null;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    handlers.key(event.code);
  });
}
