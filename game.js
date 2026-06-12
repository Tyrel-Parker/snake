const errorLog = document.getElementById('error-log');
function logError(msg) {
  errorLog.style.display = 'block';
  errorLog.textContent += msg + '\n';
}
window.addEventListener('error', e => logError('ERR: ' + e.message + ' (' + e.lineno + ')'));
window.addEventListener('unhandledrejection', e => logError('REJ: ' + e.reason));

// Canvas
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const COLS = 20, ROWS = 20, CELL = 20;
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

function resizeCanvas() {
  const maxW = window.innerWidth - 16;
  const maxH = window.innerHeight - 110;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  canvas.style.width  = (canvas.width  * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);

// HUD
const scoreVal = document.getElementById('score-val');
const lenVal   = document.getElementById('len-val');
const lvlVal   = document.getElementById('lvl-val');
const msgEl    = document.getElementById('message');
function setMessage(t) { msgEl.textContent = t; }

// Controls
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let controlMode = isMobile ? 'swipe' : 'keys';

const modeBtn         = document.getElementById('mode-btn');
const helpBtn         = document.getElementById('help-btn');
const helpOverlay     = document.getElementById('help-overlay');
const helpModeHintBtn = document.getElementById('mode-hint-btn');

// Swipe
let swipeStart = null;
document.addEventListener('touchstart', e => {
  if (helpOverlay.contains(e.target)) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });

document.addEventListener('touchend', e => {
  if (helpOverlay.contains(e.target)) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  if (helpOpen) return;
  if (!swipeStart) return;
  const dx = e.changedTouches[0].clientX - swipeStart.x;
  const dy = e.changedTouches[0].clientY - swipeStart.y;
  swipeStart = null;

  if (gameState === 'nameentry') {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { advanceNameCursor(1); }
    else if (Math.abs(dy) > Math.abs(dx)) { cycleNameChar(dy > 0 ? 1 : -1); }
    else { advanceNameCursor(dx > 0 ? 1 : -1); }
    return;
  }

  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { handleStart(); return; }
  if (controlMode !== 'swipe') return;

  if (Math.abs(dx) > Math.abs(dy)) {
    setDir(dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 });
  } else {
    setDir(dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 });
  }
}, { passive: false });

// Keys
document.addEventListener('keydown', e => {
  if (helpOpen) {
    if (e.code === 'Escape') { closeHelp(); e.preventDefault(); }
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); handleStart(); return; }
  if (gameState === 'nameentry') {
    e.preventDefault();
    if (e.code === 'ArrowUp'    || e.code === 'KeyW') cycleNameChar(-1);
    if (e.code === 'ArrowDown'  || e.code === 'KeyS') cycleNameChar(1);
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') advanceNameCursor(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') advanceNameCursor(1);
    if (e.code === 'Enter') confirmName();
    return;
  }
  if (controlMode !== 'keys') return;
  if (e.code === 'ArrowUp'    || e.code === 'KeyW') { e.preventDefault(); setDir({ dx: 0,  dy: -1 }); }
  if (e.code === 'ArrowDown'  || e.code === 'KeyS') { e.preventDefault(); setDir({ dx: 0,  dy:  1 }); }
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { e.preventDefault(); setDir({ dx: -1, dy:  0 }); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); setDir({ dx:  1, dy:  0 }); }
});

// Tilt
let tiltPermissionGranted = false;
let tiltEventReceived = false, tiltCheckTimer = null;
const tiltIndicator = document.getElementById('tilt-indicator');
let lastTiltMove = 0;

async function requestTiltPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { return (await DeviceOrientationEvent.requestPermission()) === 'granted'; }
    catch { return false; }
  }
  return true;
}

function handleOrientation(e) {
  if (controlMode !== 'tilt') return;
  tiltEventReceived = true;
  const beta = e.beta ?? 0, gamma = e.gamma ?? 0;
  tiltIndicator.textContent = `b${beta.toFixed(0)} g${gamma.toFixed(0)}`;
  if (gameState !== 'playing') return;
  const now = Date.now();
  if (now - lastTiltMove < 250) return;
  const THRESH = 10;
  if (Math.abs(gamma) > Math.abs(beta)) {
    if (gamma >  THRESH) { setDir({ dx:  1, dy: 0 }); lastTiltMove = now; }
    if (gamma < -THRESH) { setDir({ dx: -1, dy: 0 }); lastTiltMove = now; }
  } else {
    if (beta  >  THRESH) { setDir({ dx: 0, dy:  1 }); lastTiltMove = now; }
    if (beta  < -THRESH) { setDir({ dx: 0, dy: -1 }); lastTiltMove = now; }
  }
}
window.addEventListener('deviceorientation', handleOrientation);
window.addEventListener('deviceorientationabsolute', handleOrientation);

// Mode button
const MODES = ['keys', 'swipe', 'tilt'];
const MODE_LABELS = { keys: '⌨ KEYS', swipe: '👆 SWIPE', tilt: '📱 TILT' };
modeBtn.textContent = MODE_LABELS[controlMode];

modeBtn.addEventListener('click', async () => {
  const next = MODES[(MODES.indexOf(controlMode) + 1) % MODES.length];
  if (next === 'tilt' && !tiltPermissionGranted) {
    tiltPermissionGranted = await requestTiltPermission();
    if (!tiltPermissionGranted) { setMessage('TILT NOT AVAILABLE'); return; }
  }
  controlMode = next;
  modeBtn.textContent = MODE_LABELS[controlMode];
  modeBtn.classList.toggle('tilt-active', controlMode === 'tilt');
  tiltIndicator.textContent = controlMode === 'tilt' ? 'TILT ACTIVE' : '';
  clearTimeout(tiltCheckTimer);
  if (controlMode === 'tilt') {
    tiltEventReceived = false;
    tiltCheckTimer = setTimeout(() => {
      if (controlMode === 'tilt' && !tiltEventReceived)
        tiltIndicator.textContent = 'TILT BLOCKED - CHECK BROWSER SETTINGS';
    }, 2000);
  }
});

// Help modal
let helpOpen = false;
function openHelp() {
  helpOpen = true;
  helpModeHintBtn.textContent = modeBtn.textContent;
  modeBtn.classList.add('help-highlight');
  helpOverlay.classList.add('open');
}
function closeHelp() {
  helpOpen = false;
  modeBtn.classList.remove('help-highlight');
  helpOverlay.classList.remove('open');
}
helpBtn.addEventListener('click', openHelp);
document.getElementById('help-close').addEventListener('click', closeHelp);
helpOverlay.addEventListener('click', e => { if (e.target === helpOverlay) closeHelp(); });

// Leaderboard
let leaderboard = JSON.parse(localStorage.getItem('snake-leaderboard') || '[]');
let lastScore = 0;
const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
let nameChars = ['A', 'A', 'A'], nameCursor = 0;

function saveLeaderboard() { localStorage.setItem('snake-leaderboard', JSON.stringify(leaderboard)); }
function qualifiesForLeaderboard(s) {
  return s > 0 && (leaderboard.length < 10 || s > leaderboard[leaderboard.length - 1].score);
}
function addToLeaderboard(name, s) {
  leaderboard.push({ name, score: s });
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 10) leaderboard.length = 10;
  saveLeaderboard();
}
function cycleNameChar(dir) {
  const i = NAME_CHARS.indexOf(nameChars[nameCursor]);
  nameChars[nameCursor] = NAME_CHARS[(i + dir + NAME_CHARS.length) % NAME_CHARS.length];
}
function advanceNameCursor(dir) {
  if (dir > 0 && nameCursor === 2) { confirmName(); return; }
  nameCursor = Math.max(0, Math.min(2, nameCursor + dir));
}
function confirmName() {
  const name = nameChars.join('').trimEnd() || '???';
  localStorage.setItem('snake-last-name', name);
  addToLeaderboard(name, lastScore);
  gameState = 'highscore';
}

// Game state
let gameState = 'highscore';
let snake, dir, pendingDir, food;
let score, snakeLen, level;
let tickAccum = 0;
let dyingTimer = 0;
let flashOn = true;

const BASE_INTERVAL = 200;
const MIN_INTERVAL  = 60;

function getTickInterval() {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * 15);
}

function setDir(d) {
  if (d.dx === -dir.dx && d.dy === -dir.dy) return;
  if (pendingDir && d.dx === -pendingDir.dx && d.dy === -pendingDir.dy) return;
  pendingDir = d;
}

function placeFood() {
  const occupied = new Set(snake.map(s => s.x + ',' + s.y));
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * COLS);
    fy = Math.floor(Math.random() * ROWS);
  } while (occupied.has(fx + ',' + fy));
  food = { x: fx, y: fy };
}

function initGame() {
  const sx = Math.floor(COLS / 2), sy = Math.floor(ROWS / 2);
  snake = [{ x: sx, y: sy }, { x: sx - 1, y: sy }, { x: sx - 2, y: sy }];
  dir = { dx: 1, dy: 0 };
  pendingDir = null;
  score = 0;
  snakeLen = 3;
  level = 1;
  tickAccum = 0;
  updateHUD();
  placeFood();
}

function updateHUD() {
  scoreVal.textContent = score;
  lenVal.textContent   = snakeLen;
  lvlVal.textContent   = level;
}

function handleStart() {
  if (gameState === 'highscore' || gameState === 'gameover') {
    initGame();
    gameState = 'playing';
    setMessage('');
  }
}

function update(dt) {
  if (gameState === 'dying') {
    dyingTimer -= dt;
    flashOn = Math.floor(dyingTimer / 80) % 2 === 0;
    if (dyingTimer <= 0) {
      lastScore = score;
      if (qualifiesForLeaderboard(score)) {
        const lastName = localStorage.getItem('snake-last-name') || 'AAA';
        nameChars = lastName.padEnd(3, ' ').split('').slice(0, 3);
        nameCursor = 0;
        gameState = 'nameentry';
      } else {
        gameState = 'highscore';
      }
    }
    return;
  }

  if (gameState !== 'playing') return;

  tickAccum += dt;
  if (tickAccum < getTickInterval()) return;
  tickAccum -= getTickInterval();

  if (pendingDir) { dir = pendingDir; pendingDir = null; }

  const head = { x: snake[0].x + dir.dx, y: snake[0].y + dir.dy };

  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    startDying(); return;
  }

  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      startDying(); return;
    }
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    snakeLen++;
    const newLevel = Math.floor(score / 50) + 1;
    if (newLevel > level) level = newLevel;
    updateHUD();
    placeFood();
  } else {
    snake.pop();
  }
}

function startDying() {
  gameState = 'dying';
  dyingTimer = 600;
  flashOn = true;
}

// Rendering
function render() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid
  ctx.strokeStyle = '#111118';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
  }

  if (gameState === 'playing' || gameState === 'dying') {
    renderGame();
  } else if (gameState === 'nameentry') {
    renderNameEntry();
  } else {
    renderHighscore();
  }

  // Wall border
  const dying = gameState === 'dying';
  ctx.strokeStyle = dying && !flashOn ? 'transparent' : dying ? '#FF4444' : '#00FF44';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
}

function renderGame() {
  // Food
  const foodBlink = Math.floor(Date.now() / 250) % 2 === 0;
  ctx.fillStyle = foodBlink ? '#FF0000' : '#CC0000';
  ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);
  if (foodBlink) {
    ctx.fillStyle = '#FF8888';
    ctx.fillRect(food.x * CELL + 4, food.y * CELL + 4, 4, 4);
  }

  // Snake
  const dying = gameState === 'dying';
  snake.forEach((seg, i) => {
    if (dying && !flashOn) return;
    const t = i / snake.length;
    if (i === 0) {
      ctx.fillStyle = dying ? '#FF4444' : '#00FF44';
    } else {
      ctx.fillStyle = dying
        ? `rgb(${180 - Math.floor(t * 60)},30,30)`
        : `rgb(0,${Math.floor(200 - t * 100)},30)`;
    }
    ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);

    if (i === 0 && !dying) {
      ctx.fillStyle = '#000';
      const ex = seg.x * CELL, ey = seg.y * CELL;
      if      (dir.dx ===  1) { ctx.fillRect(ex+14, ey+3,  3, 3); ctx.fillRect(ex+14, ey+14, 3, 3); }
      else if (dir.dx === -1) { ctx.fillRect(ex+3,  ey+3,  3, 3); ctx.fillRect(ex+3,  ey+14, 3, 3); }
      else if (dir.dy === -1) { ctx.fillRect(ex+3,  ey+3,  3, 3); ctx.fillRect(ex+14, ey+3,  3, 3); }
      else                    { ctx.fillRect(ex+3,  ey+14, 3, 3); ctx.fillRect(ex+14, ey+14, 3, 3); }
    }
  });
}

function renderHighscore() {
  const cx = canvas.width / 2;
  let y = 30;

  ctx.textAlign = 'center';

  if (lastScore > 0) {
    ctx.fillStyle = '#FF4444';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('GAME OVER', cx, y);
    y += 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('SCORE: ' + lastScore, cx, y);
    y += 24;
  } else {
    y += 10;
  }

  ctx.fillStyle = '#00FFFF';
  ctx.font = '9px "Press Start 2P"';
  ctx.fillText('HIGH SCORES', cx, y);
  y += 18;

  ctx.font = '7px "Press Start 2P"';
  if (leaderboard.length === 0) {
    ctx.fillStyle = '#444466';
    ctx.fillText('NO SCORES YET', cx, y);
    y += 14;
  } else {
    leaderboard.slice(0, 8).forEach((entry, i) => {
      ctx.fillStyle = i === 0 ? '#FFD700' : '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText((i + 1) + '.', cx - 80, y);
      ctx.fillText(entry.name, cx - 56, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(entry.score).padStart(5, ' '), cx + 80, y);
      y += 14;
    });
  }

  y += 12;
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('PRESS SPACE TO PLAY', cx, y);
  }
}

function renderNameEntry() {
  const cx = canvas.width / 2;
  let y = 50;

  ctx.textAlign = 'center';

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('NEW HIGH SCORE!', cx, y);
  y += 24;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText('SCORE: ' + lastScore, cx, y);
  y += 28;

  ctx.fillStyle = '#00FFFF';
  ctx.fillText('ENTER YOUR NAME', cx, y);
  y += 24;

  const charW = 22, spacing = 10;
  const totalW = 3 * charW + 2 * spacing;
  const startX = cx - totalW / 2;

  for (let i = 0; i < 3; i++) {
    const bx = startX + i * (charW + spacing);
    const active = i === nameCursor;
    const blink = active && Math.floor(Date.now() / 300) % 2 === 0;

    ctx.fillStyle = active ? '#FFD700' : '#333355';
    ctx.fillRect(bx, y, charW, 24);

    if (!blink) {
      ctx.fillStyle = active ? '#000' : '#FFFFFF';
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(nameChars[i], bx + charW / 2, y + 17);
    }
  }

  y += 40;
  ctx.fillStyle = '#666688';
  ctx.font = '6px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('UP/DOWN: CHANGE  LEFT/RIGHT: MOVE', cx, y);
  y += 14;
  ctx.fillText('ENTER OR RIGHT AT END: CONFIRM', cx, y);
}

// Game loop
let lastTime = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = ts - lastTime;
  if (dt < 14) return;
  lastTime = ts;
  if ((gameState === 'playing' || gameState === 'dying') && !helpOpen) update(dt);
  render();
}

document.fonts.ready.then(() => {
  try { resizeCanvas(); initGame(); requestAnimationFrame(loop); }
  catch (e) { logError('BOOT: ' + e.message); }
}).catch(e => logError('FONTS: ' + e.message));
