// Tuning, colours, levels and layout for TIDEGLASS. Nothing here loads
// anything: it is plain data the board, the renderer and the input share.
export const COLS = 8;
export const ROWS = 8;
export const CELL = 68;
export const BOARD_X = 72;
export const BOARD_Y = 104;
export const FIELD_W = 1280;
export const FIELD_H = 720;
export const PEARL = 5;
export const TYPES = 5;

export const MOVES_PER_LEVEL = 24;
export const POINTS_PER_SHARD = 10;
export const TIDE_PER_SHARD = 3;
export const TIDE_MAX = 100;
export const BARNACLE_POINTS = 50;
export const BONUS_PER_MOVE = 25;

export const LEVELS = [
  { name: 'Coral Shallows', target: 700, barnacles: 0 },
  { name: 'Kelp Forest', target: 1000, barnacles: 6 },
  { name: 'Pearl Deep', target: 1400, barnacles: 9 },
  { name: 'Ink Caves', target: 1900, barnacles: 12 },
  { name: 'The Bright Reef', target: 2500, barnacles: 15 },
];

// Side panel and surge button, in field coordinates.
export const PANEL = { x: 790, y: 130, w: 418, h: 560 };
export const SURGE_BTN = { x: 814, y: 588, w: 370, h: 56 };

// One entry per shard type: tile glow, glyph colour, glyph shape.
export const SHARDS = [
  { name: 'coral', glow: '#ff6b5e', glyph: '#ff8a7a', shape: 'circle' },
  { name: 'sun', glow: '#ffc93c', glyph: '#ffd968', shape: 'diamond' },
  { name: 'kelp', glow: '#4ade80', glyph: '#6ee89b', shape: 'triangle' },
  { name: 'tide', glow: '#38bdf8', glyph: '#6ecdfb', shape: 'square' },
  { name: 'shell', glow: '#c084fc', glyph: '#d3a4fd', shape: 'hexagon' },
];
export const PEARL_COLOR = '#fff3c4';
export const BARNACLE_COLOR = '#8a7f70';
