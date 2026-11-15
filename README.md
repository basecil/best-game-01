# TIDEGLASS

A match-3 puzzle for the make.fun best-game-01 bounty. Swap glowing
sea-glass shards to match three or more and restore five reefs, one level at
a time, before the moves run out.

## The game

- **Goal:** reach each reef's target score within 24 moves. Clear all five
  reefs to win the campaign.
- **Swap:** click two adjacent shards, drag one onto its neighbour, or move
  the keyboard cursor with the arrow keys and press Enter. A swap that makes
  no match swaps back and costs nothing.
- **Matches:** three or more in a row or column clear, score 10 points each,
  and the shards above fall in. Cascades multiply the points.
- **Pearls:** four in a row leaves a Pearl behind. Swap a Pearl with any
  shard to sweep that shard's row and column clear; two Pearls clear the
  whole board.
- **Barnacles:** from the second reef, barnacles block cells. A match beside
  one scours it off.
- **Tide:** every cleared shard fills the Tide meter. When it is full, press
  Space (or the Surge button) to sweep one row and one column clear.
- **Lose:** the moves run out before the target and the tide goes out.
  Retry the reef with R or a click.
- **Controls:** mouse to swap, arrow keys + Enter, Space for the Surge,
  P to pause, R to restart the campaign, M to mute. Sounds are synthesized
  in the browser; there are no audio files and no network requests.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's vendored `vendor/makefun-game.ts`.

## Screenshots

`shots.json` lists the four shots and the query that stages each one;
`?shot=start|play|clear|end&seed=1` renders a deterministic scene from the
game's own rules, so the same seed always gives the same frame.

## Layout

- `game/index.html` — the page: canvas, status line, module script.
- `game/src/config.js` — tuning, colours, levels, layout.
- `game/src/random.js` — seeded random (mulberry32).
- `game/src/board.js` — the rules: board, swaps, matches, cascades,
  pearls, barnacles, surge, levels, score.
- `game/src/input.js` — mouse and keyboard, queued per frame.
- `game/src/render.js` — drawing only: board, HUD, panels, effects.
- `game/src/audio.js` — synthesized sounds (WebAudio, no files).
- `game/src/shots.js` — the four screenshot scenes.
- `game/src/main.js` — boot, loop, screens, events into sound and effects.
- `main.ts` — the hand-in program. `serve.ts` — a local static server.
- `vendor/makefun-game.ts` — the kit's copy, unchanged.

## License

MIT. See `LICENSE`.
