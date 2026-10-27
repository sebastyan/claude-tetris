'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLOR_SKINS = {
  retro: [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - pale blue
    '#ffb74d', // L - orange
  ],
  neon: [
    null,
    '#00f0ff', // I - cyan
    '#faff00', // O - yellow
    '#ff00f5', // T - magenta
    '#00ff6a', // S - green
    '#ff1744', // Z - red
    '#2979ff', // J - blue
    '#ff9100', // L - orange
  ],
  pastel: [
    null,
    '#a7e8e8', // I
    '#fff3b0', // O
    '#d7bde2', // T
    '#b9e3c6', // S
    '#f5b7b1', // Z
    '#bcd4f0', // J
    '#f8d3a0', // L
  ],
};
COLOR_SKINS.pixelart = COLOR_SKINS.retro;

let COLORS = COLOR_SKINS.retro;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const skinBtn = document.getElementById('skin-toggle');

const SKIN_NAMES = ['retro', 'neon', 'pastel', 'pixelart'];
const SKIN_LABELS = { retro: 'Retro', neon: 'Neon', pastel: 'Pastel', pixelart: 'Pixel art' };

let gridColor, highlightColor, ghostAlpha, currentSkin = 'retro';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c] && current.y + r >= 0)
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  context.globalAlpha = alpha ?? 1;

  if (currentSkin === 'neon') {
    context.save();
    context.shadowBlur = 12;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(px, py, w, w);
    context.restore();
    context.fillStyle = highlightColor;
    context.fillRect(px, py, w, 4);
  } else if (currentSkin === 'pastel') {
    const radius = Math.min(6, w / 2);
    context.fillStyle = color;
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(px, py, w, w, radius);
      context.fill();
    } else {
      context.fillRect(px, py, w, w);
    }
    context.fillStyle = highlightColor;
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(px, py, w, 4, [radius, radius, 0, 0]);
      context.fill();
    } else {
      context.fillRect(px, py, w, 4);
    }
  } else if (currentSkin === 'pixelart') {
    context.fillStyle = color;
    context.fillRect(px, py, w, w);
    context.fillStyle = highlightColor;
    context.fillRect(px, py, w, 4);
    // textura: puntos de contraste tipo pixel-art
    context.fillStyle = 'rgba(0, 0, 0, 0.18)';
    const step = Math.max(4, Math.floor(w / 4));
    for (let gy = step / 2; gy < w; gy += step) {
      for (let gx = step / 2; gx < w; gx += step) {
        context.fillRect(px + gx, py + gy, 2, 2);
      }
    }
  } else {
    // retro
    context.fillStyle = color;
    context.fillRect(px, py, w, w);
    context.fillStyle = highlightColor;
    context.fillRect(px, py, w, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function applyTheme(theme) {
  if (theme !== 'light') theme = 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  const light = theme === 'light';
  themeBtn.textContent = light ? 'Tema: claro' : 'Tema: oscuro';
  themeBtn.setAttribute('aria-pressed', String(light));
  const style = getComputedStyle(document.documentElement);
  gridColor = style.getPropertyValue('--grid').trim();
  highlightColor = style.getPropertyValue('--highlight').trim();
  ghostAlpha = parseFloat(style.getPropertyValue('--ghost-alpha'));
  // El RAF está cancelado en pausa/game over: repintar manualmente
  if (current && next) { draw(); drawNext(); }
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

function applySkin(skin) {
  if (!SKIN_NAMES.includes(skin)) skin = 'retro';
  currentSkin = skin;
  document.documentElement.dataset.skin = skin;
  COLORS = COLOR_SKINS[skin];
  try { localStorage.setItem('tetris-skin', skin); } catch (e) {}
  if (skinBtn) {
    skinBtn.textContent = `Skin: ${SKIN_LABELS[skin]}`;
    skinBtn.setAttribute('aria-pressed', 'true');
  }
  const style = getComputedStyle(document.documentElement);
  gridColor = style.getPropertyValue('--grid').trim();
  highlightColor = style.getPropertyValue('--highlight').trim();
  ghostAlpha = parseFloat(style.getPropertyValue('--ghost-alpha'));
  if (current && next) { draw(); drawNext(); }
}

function cycleSkin() {
  const idx = SKIN_NAMES.indexOf(currentSkin);
  const nextSkin = SKIN_NAMES[(idx + 1) % SKIN_NAMES.length];
  applySkin(nextSkin);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeBtn.addEventListener('click', () => { toggleTheme(); themeBtn.blur(); });
if (skinBtn) skinBtn.addEventListener('click', () => { cycleSkin(); skinBtn.blur(); });

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme);

let savedSkin = null;
try { savedSkin = localStorage.getItem('tetris-skin'); } catch (e) {}
applySkin(savedSkin);

init();
