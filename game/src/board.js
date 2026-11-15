// TIDEGLASS — the game's rules and state, with no drawing and no browser in it:
// the board, swaps, matches, cascades, pearls, barnacles, the tide surge, levels
// and score. step-like calls return what happened as plain data, so the caller can
// react (particles, sound, screens) without the board knowing about any of it.
// Nothing here allocates after createWorld returns, except the small event lists.

import {
  BOARD, BONUS_POINTS, LEVELS, MAX_CASCADE, MOVES_PER_LEVEL, MOVE_BONUS,
  PEARL, POINTS_PER_SHARD, SHARD_TYPES, TIDE_PER_SHARD,
} from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function key(col, row) {
  return `${col},${row}`;
}

export function createWorld(random) {
  const { cols, rows, cell, x: boardX, y: boardY } = BOARD;
  const grid = [];
  for (let row = 0; row < rows; row += 1) {
    const line = [];
    for (let col = 0; col < cols; col += 1) {
      line.push({ type: -1, barnacle: false, py: boardY + row * cell });
    }
    grid.push(line);
  }

  const state = {
    level: 1,
    levelScore: 0,
    totalScore: 0,
    moves: MOVES_PER_LEVEL,
    tide: 0,
    surgeReady: false,
    levelStartTotal: 0,
    grid,
  };

  function inBounds(col, row) {
    return col >= 0 && col < cols && row >= 0 && row < rows;
  }

  function cellAt(col, row) {
    return inBounds(col, row) ? grid[row][col] : null;
  }

  /** The pixel y a shard in `row` rests at; new shards fall in from above it. */
  function restY(row) {
    return boardY + row * cell;
  }

  /** Runs of three or more equal types on a raw type grid; barnacles are -1 and never match. */
  function findMatchesOn(types) {
    const runs = [];
    for (let row = 0; row < rows; row += 1) {
      let run = 1;
      for (let col = 1; col <= cols; col += 1) {
        const same = col < cols && types[row][col] >= 0 && types[row][col] === types[row][col - 1];
        if (same) run += 1;
        else {
          if (run >= 3) {
            const cells = [];
            for (let c = col - run; c < col; c += 1) cells.push({ col: c, row });
            runs.push(cells);
          }
          run = 1;
        }
      }
    }
    for (let col = 0; col < cols; col += 1) {
      let run = 1;
      for (let row = 1; row <= rows; row += 1) {
        const same = row < rows && types[row][col] >= 0 && types[row][col] === types[row - 1][col];
        if (same) run += 1;
        else {
          if (run >= 3) {
            const cells = [];
            for (let r = row - run; r < row; r += 1) cells.push({ col, row: r });
            runs.push(cells);
          }
          run = 1;
        }
      }
    }
    return runs;
  }

  function typesGrid() {
    return grid.map((line) => line.map((c) => (c.barnacle ? -1 : c.type)));
  }

  function findMatches() {
    return findMatchesOn(typesGrid());
  }

  /** A type for (col, row) that starts no match with what is already placed. */
  function safeType(col, row, types) {
    for (let tries = 0; tries < 20; tries += 1) {
      const type = Math.floor(random() * SHARD_TYPES);
      const left = col >= 2 && types[row][col - 1] === type && types[row][col - 2] === type;
      const up = row >= 2 && types[row - 1][col] === type && types[row - 2][col] === type;
      if (!left && !up) return type;
    }
    return Math.floor(random() * SHARD_TYPES);
  }

  function fillFresh() {
    const types = [];
    for (let row = 0; row < rows; row += 1) {
      types.push(new Array(cols).fill(-1));
      for (let col = 0; col < cols; col += 1) types[row][col] = safeType(col, row, types);
    }
    return types;
  }

  function placeBarnacles(count) {
    const spots = [];
    let guard = 0;
    while (spots.length < count && guard < 500) {
      guard += 1;
      const col = Math.floor(random() * cols);
      const row = Math.floor(random() * rows);
      if (spots.some((s) => s.col === col && s.row === row)) continue;
      spots.push({ col, row });
    }
    return spots;
  }

  /**
   * The cells a pearl sweeps when it lands on `at`: its row and its column.
   * The set is the same before and after the swap that moves it there.
   */
  function pearlCells(at) {
    const cells = [];
    for (let c = 0; c < cols; c += 1) {
      const cell = cellAt(c, at.row);
      if (cell && !cell.barnacle && cell.type >= 0) cells.push({ col: c, row: at.row });
    }
    for (let r = 0; r < rows; r += 1) {
      if (r === at.row) continue;
      const cell = cellAt(at.col, r);
      if (cell && !cell.barnacle && cell.type >= 0) cells.push({ col: at.col, row: r });
    }
    return cells;
  }

  function wholeBoardCells() {
    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = cellAt(c, r);
        if (cell && !cell.barnacle && cell.type >= 0) cells.push({ col: c, row: r });
      }
    }
    return cells;
  }

  /** True when some swap on the board as it stands would make a match (pearls count). */
  function findBestSwap() {
    const types = typesGrid();
    let best = null;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (types[row][col] < 0) continue;
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const nc = col + dc;
          const nr = row + dr;
          if (!inBounds(nc, nr) || types[nr][nc] < 0) continue;
          const a = types[row][col];
          const b = types[nr][nc];
          let matched = 0;
          if (a === PEARL && b === PEARL) matched = cols * rows;
          else if (a === PEARL || b === PEARL) {
            // The pearl lands on its neighbour's cell and sweeps that row and column.
            const landing = a === PEARL ? { col: nc, row: nr } : { col, row };
            matched = pearlCells(landing).length;
          } else {
            types[row][col] = b;
            types[nr][nc] = a;
            for (const run of findMatchesOn(types)) matched += run.length;
            types[row][col] = a;
            types[nr][nc] = b;
          }
          if (matched > 0 && (best === null || matched > best.matched)) {
            best = { a: { col, row }, b: { col: nc, row: nr }, matched };
          }
        }
      }
    }
    return best;
  }

  function hasMoves() {
    return findBestSwap() !== null;
  }

  /** Shuffle the shards (barnacles stay) until the board has a move and no match. */
  function reshuffle() {
    for (let tries = 0; tries < 60; tries += 1) {
      const types = fillFresh();
      let ok = true;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!grid[row][col].barnacle) grid[row][col].type = types[row][col];
        }
      }
      if (findMatches().length > 0) ok = false;
      if (ok && hasMoves()) {
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) grid[row][col].py = restY(row);
        }
        return true;
      }
    }
    return false;
  }

  function generate(level) {
    for (let tries = 0; tries < 60; tries += 1) {
      const types = fillFresh();
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          grid[row][col].type = types[row][col];
          grid[row][col].barnacle = false;
          grid[row][col].py = restY(row);
        }
      }
      for (const spot of placeBarnacles(LEVELS[level - 1].barnacles)) {
        grid[spot.row][spot.col].barnacle = true;
        grid[spot.row][spot.col].type = -1;
      }
      if (findMatches().length === 0 && hasMoves()) return;
    }
  }

  function reset(level) {
    state.level = level;
    state.levelScore = 0;
    state.moves = MOVES_PER_LEVEL;
    state.tide = 0;
    state.surgeReady = false;
    state.levelStartTotal = state.totalScore;
    generate(level);
  }

  function startCampaign() {
    state.totalScore = 0;
    reset(1);
  }

  function retryLevel() {
    state.totalScore = state.levelStartTotal;
    reset(state.level);
  }

  function nextLevel() {
    reset(state.level + 1);
  }

  /**
   * A refill type for (col, row) that starts no match with what is already
   * there: two to the left and two below are settled by the time a cell is
   * filled, so a fresh shard never lands already matched. Cascades still
   * happen — falling shards align as they land — but a refill never hands
   * the player a free chain.
   */
  function safeRefillType(col, row) {
    for (let tries = 0; tries < 20; tries += 1) {
      const type = Math.floor(random() * SHARD_TYPES);
      const left = col >= 2 && grid[row][col - 1].type === type && grid[row][col - 2].type === type;
      const below = row + 2 < rows && grid[row + 1][col].type === type && grid[row + 2][col].type === type;
      if (!left && !below) return type;
    }
    return Math.floor(random() * SHARD_TYPES);
  }

  /** Let shards fall: compact each column, refill the top with fresh shards. */
  function applyGravity() {
    for (let col = 0; col < cols; col += 1) {
      let write = rows - 1;
      for (let row = rows - 1; row >= 0; row -= 1) {
        const c = grid[row][col];
        if (c.type >= 0) {
          if (write !== row) {
            grid[write][col].type = c.type;
            grid[write][col].barnacle = false;
            grid[write][col].py = c.py;
            c.type = -1;
          }
          write -= 1;
        }
      }
      let fresh = 0;
      for (let row = write; row >= 0; row -= 1) {
        const c = grid[row][col];
        if (c.barnacle) continue;
        c.type = safeRefillType(col, row);
        fresh += 1;
        c.py = boardY + (row - fresh) * cell;
      }
    }
  }

  function addTide(clearedCount) {
    state.tide = Math.min(100, state.tide + clearedCount * TIDE_PER_SHARD);
    state.surgeReady = state.tide >= 100;
  }

  function addScore(points) {
    state.levelScore += points;
    state.totalScore += points;
  }

  /**
   * Clear waves until the board settles. `first` is an optional opening clear
   * (a pearl swap or a surge): { cells, rate } scores those cells at `rate`
   * each and creates no pearl from them. Without it the first wave is whatever
   * the board already matches, scored at POINTS_PER_SHARD times the wave's
   * depth, with a run of four or more leaving a pearl behind. Returns the
   * event data for the caller.
   */
  function resolve(first) {
    const cleared = [];
    const pearlsCreated = [];
    const barnaclesCleared = [];
    let scoreGain = 0;
    let depth = 0;
    let opening = first || null;
    for (let wave = 0; wave < MAX_CASCADE; wave += 1) {
      let runs;
      let rate;
      let makePearls;
      if (opening) {
        runs = [opening.cells];
        rate = opening.rate;
        makePearls = false;
        opening = null;
      } else {
        runs = findMatches();
        if (runs.length === 0) break;
        rate = POINTS_PER_SHARD * (wave + 1);
        makePearls = true;
      }
      depth = wave + 1;
      const waveCells = [];
      const pearlSpots = [];
      for (const run of runs) {
        for (const at of run) waveCells.push(at);
        if (makePearls && run.length >= 4) pearlSpots.push(run[Math.floor(run.length / 2)]);
      }
      const seen = new Set();
      const unique = [];
      for (const at of waveCells) {
        const k = key(at.col, at.row);
        if (!seen.has(k)) {
          seen.add(k);
          unique.push(at);
        }
      }
      const pearlKeys = new Set(pearlSpots.map((at) => key(at.col, at.row)));
      for (const at of unique) {
        const c = cellAt(at.col, at.row);
        if (!c || c.type < 0) continue;
        if (pearlKeys.has(key(at.col, at.row))) {
          c.type = PEARL;
          c.py = restY(at.row);
          pearlsCreated.push({ col: at.col, row: at.row });
          scoreGain += BONUS_POINTS;
          addScore(BONUS_POINTS);
          continue;
        }
        cleared.push({ col: at.col, row: at.row, type: c.type });
        scoreGain += rate;
        addScore(rate);
        c.type = -1;
      }
      addTide(unique.length);
      // A match beside a barnacle scours it off the board.
      for (const at of unique) {
        for (const [dc, dr] of DIRS) {
          const n = cellAt(at.col + dc, at.row + dr);
          if (n && n.barnacle) {
            n.barnacle = false;
            n.type = -1;
            barnaclesCleared.push({ col: at.col + dc, row: at.row + dr });
            scoreGain += BONUS_POINTS;
            addScore(BONUS_POINTS);
          }
        }
      }
      applyGravity();
    }
    let reshuffled = false;
    if (findMatches().length === 0 && !hasMoves()) reshuffled = reshuffle();
    return { cleared, pearlsCreated, barnaclesCleared, scoreGain, depth, reshuffled };
  }

  function levelStatus() {
    const target = LEVELS[state.level - 1].target;
    if (state.levelScore >= target) {
      const bonus = state.moves * MOVE_BONUS;
      state.totalScore += bonus;
      return { levelClear: true, bonus };
    }
    if (state.moves <= 0) return { gameOver: true, bonus: 0 };
    return { levelClear: false, gameOver: false, bonus: 0 };
  }

  function swapCells(a, b) {
    const fail = { ok: false, cleared: [], scoreGain: 0, depth: 0, pearlsCreated: [], barnaclesCleared: [], reshuffled: false, levelClear: false, gameOver: false, bonus: 0 };
    if (!inBounds(a.col, a.row) || !inBounds(b.col, b.row)) return fail;
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) return fail;
    const ca = cellAt(a.col, a.row);
    const cb = cellAt(b.col, b.row);
    if (!ca || !cb || ca.barnacle || cb.barnacle || ca.type < 0 || cb.type < 0) return fail;
    const ta = ca.type;
    const tb = cb.type;
    ca.type = tb;
    cb.type = ta;
    // A pearl sweeps the row and column it lands on; two pearls clear the board.
    if (ta === PEARL || tb === PEARL) {
      const bothPearls = ta === PEARL && tb === PEARL;
      const landing = ta === PEARL ? b : a;
      const cells = bothPearls ? wholeBoardCells() : pearlCells(landing);
      state.moves -= 1;
      const result = resolve({ cells, rate: POINTS_PER_SHARD });
      const status = levelStatus();
      return {
        ok: true, kind: 'pearl', cleared: result.cleared, scoreGain: result.scoreGain,
        depth: result.depth, pearlsCreated: result.pearlsCreated, barnaclesCleared: result.barnaclesCleared,
        reshuffled: result.reshuffled, levelClear: status.levelClear, gameOver: status.gameOver, bonus: status.bonus,
      };
    }
    if (findMatches().length === 0) {
      ca.type = ta;
      cb.type = tb;
      return fail;
    }
    state.moves -= 1;
    const result = resolve(null);
    const status = levelStatus();
    return {
      ok: true, kind: 'swap', cleared: result.cleared, scoreGain: result.scoreGain,
      depth: result.depth, pearlsCreated: result.pearlsCreated, barnaclesCleared: result.barnaclesCleared,
      reshuffled: result.reshuffled, levelClear: status.levelClear, gameOver: status.gameOver, bonus: status.bonus,
    };
  }

  /** Swap two cells and report the match it would make, without clearing anything. */
  function previewSwap(a, b) {
    if (!inBounds(a.col, a.row) || !inBounds(b.col, b.row)) return { ok: false, runs: [], points: 0 };
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) return { ok: false, runs: [], points: 0 };
    const ca = cellAt(a.col, a.row);
    const cb = cellAt(b.col, b.row);
    if (!ca || !cb || ca.barnacle || cb.barnacle || ca.type < 0 || cb.type < 0) return { ok: false, runs: [], points: 0 };
    const ta = ca.type;
    const tb = cb.type;
    if (ta === PEARL || tb === PEARL) {
      const bothPearls = ta === PEARL && tb === PEARL;
      const landing = ta === PEARL ? b : a;
      const run = bothPearls ? wholeBoardCells() : pearlCells(landing);
      return { ok: run.length > 0, runs: [run], points: run.length * POINTS_PER_SHARD };
    }
    ca.type = tb;
    cb.type = ta;
    const runs = findMatches();
    ca.type = ta;
    cb.type = tb;
    let points = 0;
    for (const run of runs) points += run.length * POINTS_PER_SHARD;
    return { ok: runs.length > 0, runs, points };
  }

  /**
   * The tide surge: when the meter is full, one random row and one random
   * column are swept clear, barnacles in their path included. Costs no move.
   */
  function surge() {
    const fail = { ok: false, cleared: [], scoreGain: 0, depth: 0, pearlsCreated: [], barnaclesCleared: [], reshuffled: false, levelClear: false, gameOver: false, bonus: 0 };
    if (!state.surgeReady) return fail;
    const row = Math.floor(random() * rows);
    const col = Math.floor(random() * cols);
    const cells = [];
    const pathBarnacles = [];
    for (let c = 0; c < cols; c += 1) {
      const at = cellAt(c, row);
      if (at && at.type >= 0) cells.push({ col: c, row });
    }
    for (let r = 0; r < rows; r += 1) {
      if (r === row) continue;
      const at = cellAt(col, r);
      if (at && at.type >= 0) cells.push({ col, row: r });
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const at = cellAt(c, r);
        if (at && at.barnacle && (r === row || c === col)) {
          pathBarnacles.push({ col: c, row: r });
          at.barnacle = false;
          at.type = -1;
        }
      }
    }
    state.tide = 0;
    state.surgeReady = false;
    const barnacleGain = pathBarnacles.length * BONUS_POINTS;
    addScore(barnacleGain);
    if (cells.length === 0) {
      const status = levelStatus();
      return { ok: true, kind: 'surge', cleared: [], scoreGain: barnacleGain, depth: 0, pearlsCreated: [], barnaclesCleared: pathBarnacles, reshuffled: false, levelClear: status.levelClear, gameOver: status.gameOver, bonus: status.bonus };
    }
    const result = resolve({ cells, rate: POINTS_PER_SHARD });
    const status = levelStatus();
    return {
      ok: true, kind: 'surge', cleared: result.cleared, scoreGain: result.scoreGain + barnacleGain,
      depth: result.depth, pearlsCreated: result.pearlsCreated, barnaclesCleared: [...result.barnaclesCleared, ...pathBarnacles],
      reshuffled: result.reshuffled, levelClear: status.levelClear, gameOver: status.gameOver, bonus: status.bonus,
    };
  }

  /**
   * Swap two cells and leave the swap in place, reporting the match it makes,
   * without clearing anything or spending a move. The screenshot scenes use it
   * to freeze a frame mid-match.
   */
  function applySwap(a, b) {
    if (!inBounds(a.col, a.row) || !inBounds(b.col, b.row)) return { ok: false, runs: [], points: 0 };
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) return { ok: false, runs: [], points: 0 };
    const ca = cellAt(a.col, a.row);
    const cb = cellAt(b.col, b.row);
    if (!ca || !cb || ca.barnacle || cb.barnacle || ca.type < 0 || cb.type < 0) return { ok: false, runs: [], points: 0 };
    const ta = ca.type;
    const tb = cb.type;
    if (ta === PEARL || tb === PEARL) {
      const bothPearls = ta === PEARL && tb === PEARL;
      const landing = ta === PEARL ? b : a;
      const run = bothPearls ? wholeBoardCells() : pearlCells(landing);
      ca.type = tb;
      cb.type = ta;
      return { ok: run.length > 0, runs: [run], points: run.length * POINTS_PER_SHARD };
    }
    ca.type = tb;
    cb.type = ta;
    const runs = findMatches();
    let points = 0;
    for (const run of runs) points += run.length * POINTS_PER_SHARD;
    return { ok: runs.length > 0, runs, points };
  }

  /** Snap every shard to its resting row (screenshot scenes paint settled boards). */
  function snap() {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) grid[row][col].py = restY(row);
    }
  }

  return {
    state,
    cellAt,
    inBounds,
    restY,
    reset,
    startCampaign,
    retryLevel,
    nextLevel,
    swapCells,
    previewSwap,
    applySwap,
    surge,
    findBestSwap,
    hasMoves,
    findMatches,
    snap,
  };
}
