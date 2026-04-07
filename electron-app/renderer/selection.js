const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');
const instructions = document.getElementById('instructions');

let displayBounds = null, globalBounds = null;
let selecting = false;
let globalStartX = 0, globalStartY = 0, globalEndX = 0, globalEndY = 0;

// Use window.innerWidth/Height for canvas so it always matches actual window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
}

ipcRenderer.on('sel-init', (event, { displayBounds: db, globalBounds: gb }) => {
  displayBounds = db;
  globalBounds = gb;
  resizeCanvas();
});

window.addEventListener('resize', resizeCanvas);

// Receive broadcast from main — update selection state and render
ipcRenderer.on('sel-update', (event, data) => {
  if (data.type === 'down') {
    selecting = true;
    if (instructions) instructions.style.display = 'none';
    globalStartX = globalEndX = data.gx;
    globalStartY = globalEndY = data.gy;
  } else if (data.type === 'move' && selecting) {
    globalEndX = data.gx;
    globalEndY = data.gy;
    render();
    showDimensions(data.gx, data.gy);
  } else if (data.type === 'up' && selecting) {
    selecting = false;
    globalEndX = data.gx;
    globalEndY = data.gy;
    dimLabel.style.display = 'none';
    const x = Math.min(globalStartX, globalEndX), y = Math.min(globalStartY, globalEndY);
    const w = Math.abs(globalEndX - globalStartX), h = Math.abs(globalEndY - globalStartY);
    if (w >= 10 && h >= 10) ipcRenderer.send('sel-done', { x, y, width: w, height: h });
  }
});

// *** KEY FIX: Use pointer events + setPointerCapture ***
// This ensures the window that received pointerdown keeps getting events
// even when the pointer moves to another monitor/window.
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('sel-mouse', { type: 'down', gx, gy });
});

canvas.addEventListener('pointermove', (e) => {
  if (!selecting) return;
  // With pointer capture, e.clientX/Y can be outside window bounds
  // (negative or > window size) when pointer is on another monitor.
  // Adding displayBounds origin gives correct global DIP coordinates.
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('sel-mouse', { type: 'move', gx, gy });
});

canvas.addEventListener('pointerup', (e) => {
  if (!selecting) return;
  canvas.releasePointerCapture(e.pointerId);
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('sel-mouse', { type: 'up', gx, gy });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ipcRenderer.send('sel-cancel');
});

function render() {
  if (!displayBounds) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Semi-transparent dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, W, H);

  if (!selecting && globalStartX === globalEndX) return;

  // Selection rect in global CSS pixels
  const selX = Math.min(globalStartX, globalEndX);
  const selY = Math.min(globalStartY, globalEndY);
  const selW = Math.abs(globalEndX - globalStartX);
  const selH = Math.abs(globalEndY - globalStartY);

  // Convert to this display's local canvas coordinates
  // Canvas pixel = CSS pixel (1:1) because canvas.width = window.innerWidth
  const lx = selX - displayBounds.x;
  const ly = selY - displayBounds.y;

  // Clip to this display
  const cx = Math.max(0, lx), cy = Math.max(0, ly);
  const cr = Math.min(W, lx + selW), cb = Math.min(H, ly + selH);
  const cw = cr - cx, ch = cb - cy;

  if (cw > 0 && ch > 0) {
    // Clear the selection area — shows live desktop through transparent window
    ctx.clearRect(cx, cy, cw, ch);

    // Selection border (draw at full local coords, it clips naturally)
    ctx.strokeStyle = '#0a84ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(lx, ly, selW, selH);
    ctx.setLineDash([]);
  }
}

function showDimensions(gx, gy) {
  // Only show label if cursor is on this display
  const lx = gx - displayBounds.x, ly = gy - displayBounds.y;
  if (lx < 0 || lx > displayBounds.width || ly < 0 || ly > displayBounds.height) {
    dimLabel.style.display = 'none';
    return;
  }
  const w = Math.abs(globalEndX - globalStartX), h = Math.abs(globalEndY - globalStartY);
  dimLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  dimLabel.style.display = 'block';
  dimLabel.style.left = (lx + 14) + 'px';
  dimLabel.style.top = (ly + 14) + 'px';
}
