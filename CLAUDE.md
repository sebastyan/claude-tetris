# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas + CSS). No dependencies, no `package.json`, no build, no linter, no tests.

## Run

Open `index.html` directly, or serve statically (preferred):

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

## Architecture

Three files: `index.html` (DOM, `#board` 300×600 canvas, `#next-canvas`, HUD, overlay), `style.css` (dark/retro theme), `game.js` (all logic, global script with `'use strict'`, no modules).

Key points in `game.js`:

- **State** is module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`…), all reset by `init()`. Restart button calls `init()`.
- **Cell value = piece type = color index.** `PIECES[i]` matrices are filled with `i`, so merged board cells store the type and `COLORS[i]` renders them. Index 0 is empty/null in both arrays — keep `PIECES` and `COLORS` aligned.
- **Pieces** are square matrices; rotation is `rotateCW` (transpose + reverse) with wall kicks `[0,-1,1,-2,2]` in `tryRotate`. No SRS.
- **Collision** (`collide`) allows `y < 0` (above the board) but not past sides/bottom. Spawn collision → `endGame()`.
- **Loop**: `requestAnimationFrame(loop)` accumulates `dt` into `dropAccum`; gravity step when ≥ `dropInterval`. Pause cancels the RAF and restarts it on resume.
- **Lock flow**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/speed) → `spawn()` (promotes `next`, redraws preview).
- **Scoring**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- Rendering redraws everything each frame: grid → board → ghost (`alpha 0.2`) → current piece.

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating `#board` `width`/`height` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`).
- UI text and README are in Spanish (e.g. `'PAUSA'`, `Puntuación`); keep that language for user-facing strings.
