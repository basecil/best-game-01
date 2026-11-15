// TIDEGLASS rules: an 8x8 board, five shard types, Pearls, barnacles,
// the Tide meter and the Surge. Pure logic, no drawing, no sound: the
// browser shell (main.js) and the Node smoke tests drive the same world.
//
// A cell is { type, barnacle }. type -1 is an empty slot, 0..4 are the five
// shards, 5 is a Pearl. A barnacle cell has type -1 and barnacle true: it
// cannot be swapped or matched, and it pins its column's gravity in place
// until a match beside it scours it off (+50).
import {
  COLS, ROWS, LEVELS, MOVES_PER_LEVEL, POINTS_PER_SHARD,
  TIDE_PER_SHARD, TIDE_MAX, BARNACLE_POINTS, BONUS_PER_MOVE,
  PEARL, TYPES,
} from './config.js';

const keyOf = (col, row) => `${col},${row}`;

function blankGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r += 1) {
    const line = [];
    for (let c = 0; c < COLS; c += 1) line.push({ type: -1, barnacle: false });
    grid.push(line);
  }
  return grid;
}

export function createWorld(rng) {
  const state = {
    level: 1,
    moves: MOVES_PER_LEVEL,
    grid: blankGrid(),
    levelScore: 0,
    banked: 0,
    totalScore: 0,
    bonus: 0,
    levelDone: false,
    tide: 0,
    surgeReady: false,
    best: 0,
    popups: [],
  };

  const inBounds = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS;
  const cellAt = (col, row) => state.grid[row][col];
  // totalScore is updated incrementally next to levelScore: banked holds
  // the finished levels, so a clear bonus is added once and never again.
  const addScore = (gain) => {
    state.levelScore += gain;
    state.totalScore += gain;
  };

  // Types that would not complete a run if placed at (col, row): a type is
  // bad when two equal neighbours already sit on one side of it, or one
  // sits on each side. With five types there is always a safe one.
  function safeTypes(col, row) {
    const at = (c, r) => (inBounds(c, r) ? cellAt(c, r).type : -1);
    const bad = new Set();
    const axes = [
      [at(col - 1, row), at(col - 2, row), at(col + 1, row), at(col + 2, row)],
      [at(col, row - 1), at(col, row - 2), at(col, row + 1), at(col, row + 2)],
    ];
    for (const [a1, a2, b1, b2] of axes) {
      for (const t of [a1, a2, b1, b2]) {
        if (t < 0 || t >= PEARL) continue;
        if ((a1 === t && a2 === t) || (b1 === t && b2 === t) || (a1 === t && b1 === t)) bad.add(t);
      }
    }
    const out = [];
    for (let t = 0; t < TYPES; t += 1) if (!bad.has(t)) out.push(t);
    if (out.length > 0) return out;
    // Fallback: any type unlike all four direct neighbours (always exists).
    const near = new Set([at(col - 1, row), at(col + 1, row), at(col, row - 1), at(col, row + 1)]);
    for (let t = 0; t < TYPES; t += 1) if (!near.has(t)) out.push(t);
    return out;
  }

  // Runs of three or more equal shards, in rows and in columns. Pearls
  // and barnacles never match.
  function findMatches(grid = state.grid) {
    const groups = [];
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      while (c < COLS) {
        const t = grid[r][c].type;
        if (t < 0 || t >= PEARL) { c += 1; continue; }
        let end = c + 1;
        while (end < COLS && grid[r][end].type === t) end += 1;
        if (end - c >= 3) {
          const cells = [];
          for (let x = c; x < end; x += 1) cells.push({ col: x, row: r });
          groups.push({ cells, dir: 'h', type: t });
        }
        c = end;
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      let r = 0;
      while (r < ROWS) {
        const t = grid[r][c].type;
        if (t < 0 || t >= PEARL) { r += 1; continue; }
        let end = r + 1;
        while (end < ROWS && grid[end][c].type === t) end += 1;
        if (end - r >= 3) {
          const cells = [];
          for (let y = r; y < end; y += 1) cells.push({ col: c, row: y });
          groups.push({ cells, dir: 'v', type: t });
        }
        r = end;
      }
    }
    return groups;
  }

  // Fill every empty slot with a safe type, then re-roll any cell that is
  // still part of a match until the board is clean.
  function fillEmpty() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = cellAt(c, r);
        if (cell.barnacle || cell.type !== -1) continue;
        const ok = safeTypes(c, r);
        cell.type = ok[rng.int(ok.length)];
      }
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const groups = findMatches();
      if (groups.length === 0) return;
      for (const g of groups) {
        for (const p of g.cells) {
          const cell = cellAt(p.col, p.row);
          const ok = safeTypes(p.col, p.row);
          if (ok.length > 0) cell.type = ok[rng.int(ok.length)];
        }
      }
    }
  }

  // Gravity, one column at a time: barnacles split a column into segments
  // and each segment compacts to its own bottom, then refills safely.
  function settle() {
    for (let c = 0; c < COLS; c += 1) {
      let r = ROWS - 1;
      while (r >= 0) {
        if (cellAt(c, r).barnacle) { r -= 1; continue; }
        let top = r;
        while (top >= 0 && !cellAt(c, top).barnacle) top -= 1;
        top += 1;
        const stack = [];
        for (let y = r; y >= top; y -= 1) {
          const t = cellAt(c, y).type;
          if (t !== -1) stack.push(t);
        }
        let y = r;
        for (const t of stack) { cellAt(c, y).type = t; y -= 1; }
        for (; y >= top; y -= 1) cellAt(c, y).type = -1;
        r = top - 1;
      }
    }
    fillEmpty();
  }

  // Score a list of cleared cells at a cascade depth: 10 per shard, plus
  // 50 for every barnacle scoured off beside them. Returns the gain and
  // the barnacles cleared. The cells themselves are NOT emptied here.
  function scoreClear(list, depth) {
    let gain = POINTS_PER_SHARD * list.length * depth;
    const barnaclesCleared = [];
    for (const p of list) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = p.col + dc;
        const nr = p.row + dr;
        if (!inBounds(nc, nr)) continue;
        const nb = cellAt(nc, nr);
        if (nb.barnacle) {
          nb.barnacle = false;
          nb.type = -1;
          gain += BARNACLE_POINTS;
          barnaclesCleared.push({ col: nc, row: nr });
        }
      }
    }
    state.tide = Math.min(TIDE_MAX, state.tide + TIDE_PER_SHARD * list.length);
    if (state.tide >= TIDE_MAX) state.surgeReady = true;
    return { gain, barnaclesCleared };
  }

  // Clear every match on the board, round after round, until it is clean.
  // A run of four or more leaves a Pearl behind on one of its cells.
  // Returns the totals for the whole cascade.
  function resolve(swapped, startDepth = 1) {
    let scoreGain = 0;
    let clearedAll = [];
    let pearlsCreated = [];
    let barnaclesCleared = [];
    let depth = startDepth;
    let firstCleared = 0;
    for (;;) {
      const groups = findMatches();
      if (groups.length === 0) break;
      const pearlKeys = new Set();
      const pearlCells = [];
      for (const g of groups) {
        if (g.cells.length < 4) continue;
        const cand = g.cells.find((p) => swapped
          && ((p.col === swapped.a.col && p.row === swapped.a.row)
            || (p.col === swapped.b.col && p.row === swapped.b.row)))
          ?? g.cells[Math.floor(g.cells.length / 2)];
        pearlKeys.add(keyOf(cand.col, cand.row));
        pearlCells.push(cand);
      }
      const cleared = new Map();
      for (const g of groups) {
        for (const p of g.cells) {
          if (!pearlKeys.has(keyOf(p.col, p.row))) cleared.set(keyOf(p.col, p.row), p);
        }
      }
      const list = [...cleared.values()];
      if (depth === startDepth) firstCleared = list.length;
      const scored = scoreClear(list, depth);
      scoreGain += scored.gain;
      barnaclesCleared.push(...scored.barnaclesCleared);
      for (const p of list) cellAt(p.col, p.row).type = -1;
      for (const p of pearlCells) {
        cellAt(p.col, p.row).type = PEARL;
        pearlsCreated.push({ col: p.col, row: p.row });
      }
      clearedAll.push(...list);
      settle();
      depth += 1;
      if (depth > 50) break;
    }
    return {
      scoreGain, cleared: clearedAll, pearlsCreated, barnaclesCleared,
      depth: depth - startDepth, firstCleared,
    };
  }

  // The cells a Pearl sweep clears: a row and a column, or the whole board
  // when two Pearls meet.
  function sweepCells(target, wholeBoard) {
    const cells = [];
    const seen = new Set();
    const add = (col, row) => {
      if (!inBounds(col, row)) return;
      const cell = cellAt(col, row);
      if (cell.barnacle || cell.type === -1) return;
      const k = keyOf(col, row);
      if (seen.has(k)) return;
      seen.add(k);
      cells.push({ col, row });
    };
    if (wholeBoard) {
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) add(c, r);
    } else {
      for (let c = 0; c < COLS; c += 1) add(c, target.row);
      for (let r = 0; r < ROWS; r += 1) add(target.col, r);
    }
    return cells;
  }

  // Shared ending for a scoring action: bonus on a clear, game over when
  // the moves are spent below target.
  function finish(res, kind) {
    let levelClear = false;
    let gameOver = false;
    if (!state.levelDone && state.levelScore >= LEVELS[state.level - 1].target) {
      levelClear = true;
      state.levelDone = true;
      state.bonus = BONUS_PER_MOVE * state.moves;
      state.totalScore += state.bonus;
      state.banked = state.totalScore;
    } else if (!state.levelDone && state.moves <= 0) {
      gameOver = true;
    }
    return {
      ok: true, kind, scoreGain: res.scoreGain, cleared: res.cleared,
      depth: res.depth, pearlsCreated: res.pearlsCreated,
      barnaclesCleared: res.barnaclesCleared, levelClear, gameOver,
    };
  }

  const failEvent = (kind) => ({
    ok: false, kind, scoreGain: 0, cleared: [], depth: 0,
    pearlsCreated: [], barnaclesCleared: [], levelClear: false, gameOver: false,
  });

  function pearlSwap(a, b) {
    const ca = cellAt(a.col, a.row);
    const cb = cellAt(b.col, b.row);
    const both = ca.type === PEARL && cb.type === PEARL;
    const target = ca.type === PEARL ? b : a;
    const cells = sweepCells(target, both);
    const scored = scoreClear(cells, 1);
    for (const p of cells) cellAt(p.col, p.row).type = -1;
    settle();
    const casc = resolve(null, 2);
    const res = {
      scoreGain: scored.gain + casc.scoreGain,
      cleared: [...cells, ...casc.cleared],
      pearlsCreated: casc.pearlsCreated,
      barnaclesCleared: [...scored.barnaclesCleared, ...casc.barnaclesCleared],
      depth: Math.max(1, casc.depth + 1),
      firstCleared: cells.length,
    };
    addScore(res.scoreGain);
    state.moves -= 1;
    return finish(res, both ? 'pearl-board' : 'pearl');
  }

  function swapCells(a, b) {
    if (!inBounds(a.col, a.row) || !inBounds(b.col, b.row)) return failEvent('invalid');
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) return failEvent('invalid');
    const ca = cellAt(a.col, a.row);
    const cb = cellAt(b.col, b.row);
    if (ca.barnacle || cb.barnacle) return failEvent('invalid');
    if (ca.type === PEARL || cb.type === PEARL) return pearlSwap(a, b);
    const tmp = ca.type;
    ca.type = cb.type;
    cb.type = tmp;
    if (findMatches().length === 0) {
      const back = ca.type;
      ca.type = cb.type;
      cb.type = back;
      return failEvent('nomatch');
    }
    const res = resolve({ a, b });
    addScore(res.scoreGain);
    state.moves -= 1;
    return finish(res, 'match');
  }

  // The Surge: one random row and one random column, at no move cost.
  function surge() {
    if (!state.surgeReady || state.tide < TIDE_MAX) return failEvent('not-ready');
    const target = { col: rng.int(COLS), row: rng.int(ROWS) };
    const cells = sweepCells(target, false);
    const scored = scoreClear(cells, 1);
    for (const p of cells) cellAt(p.col, p.row).type = -1;
    settle();
    const casc = resolve(null, 2);
    const res = {
      scoreGain: scored.gain + casc.scoreGain,
      cleared: [...cells, ...casc.cleared],
      pearlsCreated: casc.pearlsCreated,
      barnaclesCleared: [...scored.barnaclesCleared, ...casc.barnaclesCleared],
      depth: Math.max(1, casc.depth + 1),
      firstCleared: cells.length,
    };
    addScore(res.scoreGain);
    state.tide = 0;
    state.surgeReady = false;
    return finish(res, 'surge');
  }

  // Simulate one swap on a scratch copy of the board and report what it
  // would score. The real board, tide and surge state are restored after.
  function simulateSwap(a, b) {
    const savedGrid = state.grid;
    const savedTide = state.tide;
    const savedSurge = state.surgeReady;
    state.grid = savedGrid.map((line) => line.map((c) => ({ type: c.type, barnacle: c.barnacle })));
    let out = null;
    try {
      const ca = cellAt(a.col, a.row);
      const cb = cellAt(b.col, b.row);
      if (ca.type === PEARL || cb.type === PEARL) {
        const both = ca.type === PEARL && cb.type === PEARL;
        const target = ca.type === PEARL ? b : a;
        const cells = sweepCells(target, both);
        const scored = scoreClear(cells, 1);
        for (const p of cells) cellAt(p.col, p.row).type = -1;
        settle();
        const casc = resolve(null, 2);
        out = { gain: scored.gain + casc.scoreGain, first: cells.length, pearls: casc.pearlsCreated.length };
      } else {
        const tmp = ca.type;
        ca.type = cb.type;
        cb.type = tmp;
        if (findMatches().length > 0) {
          const res = resolve({ a, b });
          out = { gain: res.scoreGain, first: res.firstCleared, pearls: res.pearlsCreated.length };
        }
      }
    } finally {
      state.grid = savedGrid;
      state.tide = savedTide;
      state.surgeReady = savedSurge;
    }
    return out;
  }

  // The best swap on the board by simulated score, or null when the board
  // is deadlocked. Used by the autopilot and by the deadlock check.
  function findBestSwap() {
    let best = null;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = cellAt(c, r);
        if (cell.barnacle) continue;
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const nc = c + dc;
          const nr = r + dr;
          if (!inBounds(nc, nr)) continue;
          const nb = cellAt(nc, nr);
          if (nb.barnacle) continue;
          const a = { col: c, row: r };
          const b = { col: nc, row: nr };
          const sim = simulateSwap(a, b);
          if (sim === null) continue;
          // A Pearl left on the board is worth about a row-and-column
          // sweep later, so creating one counts toward the swap's value
          // even though the points land on a later move.
          const value = sim.gain + 100 * sim.pearls;
          if (best === null || value > best.value
            || (value === best.value && sim.first > best.first)) {
            best = { a, b, matched: sim.first, value };
          }
        }
      }
    }
    return best === null ? null : { a: best.a, b: best.b, matched: best.matched };
  }

  function hasMoves() {
    return state.moves > 0 && findBestSwap() !== null;
  }

  // Shuffle the shards until a legal swap exists and nothing is matched.
  function reshuffle() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const types = [];
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const cell = cellAt(c, r);
          if (!cell.barnacle) types.push(cell.type);
        }
      }
      for (let i = types.length - 1; i > 0; i -= 1) {
        const j = rng.int(i + 1);
        [types[i], types[j]] = [types[j], types[i]];
      }
      let k = 0;
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const cell = cellAt(c, r);
          if (!cell.barnacle) cell.type = types[k++];
        }
      }
      fillEmpty();
      if (findMatches().length === 0 && findBestSwap() !== null) return true;
    }
    return false;
  }

  function reset(level) {
    state.level = level;
    state.levelScore = 0;
    state.moves = MOVES_PER_LEVEL;
    state.tide = 0;
    state.surgeReady = false;
    state.bonus = 0;
    state.levelDone = false;
    state.totalScore = state.banked;
    state.popups.length = 0;
    state.grid = blankGrid();
    const count = LEVELS[level - 1].barnacles;
    const spots = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) spots.push({ col: c, row: r });
    }
    for (let i = spots.length - 1; i > 0; i -= 1) {
      const j = rng.int(i + 1);
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let i = 0; i < count; i += 1) {
      const s = spots[i];
      cellAt(s.col, s.row).barnacle = true;
    }
    fillEmpty();
    if (findBestSwap() === null) reshuffle();
  }

  function startCampaign() {
    state.banked = 0;
    state.totalScore = 0;
    reset(1);
  }

  function nextLevel() {
    if (state.level >= LEVELS.length) return false;
    state.banked = state.totalScore;
    reset(state.level + 1);
    return true;
  }

  function retryLevel() {
    reset(state.level);
  }

  return {
    state,
    startCampaign,
    reset,
    nextLevel,
    retryLevel,
    hasMoves,
    findMatches,
    findBestSwap,
    swapCells,
    surge,
    reshuffle,
  };
}
