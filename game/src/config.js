// TIDEGLASS — every tuning number, colour and level in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const BOARD = {
  cols: 8,
  rows: 8,
  /** Pixels per cell; the board is cols*cell wide and rows*cell tall. */
  cell: 68,
  x: 72,
  y: 104,
};

/** The right-hand panel: score, target, moves, tide and hints live here. */
export const PANEL = { x: 672, width: 536, y: 104, height: 544 };

/** The five shard kinds, each a colour and a shape, so a shard reads by colour and by form. */
export const SHARD_TYPES = 5;
export const PEARL = 5;
export const SHARDS = [
  { name: 'coral', color: '#ff6b6b', shape: 'circle' },
  { name: 'sun', color: '#ffd166', shape: 'diamond' },
  { name: 'kelp', color: '#7dd069', shape: 'triangle' },
  { name: 'tide', color: '#4fc3f7', shape: 'square' },
  { name: 'shell', color: '#c77dff', shape: 'hexagon' },
];
export const PEARL_COLOR = '#fff6d8';
export const PEARL_SHAPE = 'star';

/** Points for one cleared shard, before the cascade multiplier. */
export const POINTS_PER_SHARD = 10;
/** Points for clearing a barnacle; a pearl created by a four-match is worth this too. */
export const BONUS_POINTS = 50;
/** Tide the meter gains per cleared shard; 100 fills it. */
export const TIDE_PER_SHARD = 3;
/** Bonus points per move left when a level is cleared. */
export const MOVE_BONUS = 25;
/** How deep a cascade may run before the board is declared settled. */
export const MAX_CASCADE = 20;

export const MOVES_PER_LEVEL = 24;

/** The five reefs: target score for the level and how many barnacles block it. */
export const LEVELS = [
  { name: 'Coral Shallows', target: 700, barnacles: 0 },
  { name: 'Kelp Forest', target: 1000, barnacles: 3 },
  { name: 'Pearl Deep', target: 1400, barnacles: 4 },
  { name: 'Ink Caves', target: 1900, barnacles: 5 },
  { name: 'The Bright Reef', target: 2500, barnacles: 6 },
];

export const PALETTE = {
  backdrop: '#0a1a24',
  deep: '#0d2431',
  board: '#122e3d',
  boardEdge: '#1d4a61',
  panel: '#10242f',
  panelEdge: '#1d4a61',
  text: '#eef7f5',
  muted: '#8fb3b8',
  gold: '#ffd166',
  tide: '#4fc3f7',
  danger: '#ff6b6b',
  barnacle: '#4a3f35',
  barnacleRim: '#8a7a68',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best campaign score is kept between visits (this browser only). */
export const BEST_KEY = 'tideglass.best';
