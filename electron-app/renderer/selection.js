const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');
const instructions = document.getElementById('instructions');

let displayBounds = null;  // This display's CSS pixel bounds { x, y, width, height }
let globalBounds = null;   // All displays combined { minX, minY, maxX, maxY }

// Selection state in GLOBAL CSS pixel coordinates
let selecting = false;
let globalStartX = 0, globalStartY = 0;
let globalEndX = 0, globalEndY = 0;

// Initialize — receive display bounds (no screenshot needed)
ipcRenderer.on('selection-init', (event, { displayBounds: db, globalBounds: gb }) => {
  displayBounds = db;
  globalBounds = gb;

  // Set canvas to match display CSS pixel dimensions
  canvas.width = db.width;
  canvas.height = db.height;
  render();
});

// Receive selection updates from main process (broadcast from any overlay)
ipcRenderer.on('selection-update', (event, data) => {
  if (data.type === 'down') {
    selecting = true;
    instructions.style.display = 'none';
    globalStartX = data.globalX;
    globalStartY = data.globalY;
    globalEndX = data.globalX;
    globalEndY = data.globalY;
  } else if (data.type === 'move' && selecting) {
    globalEndX = data.globalX;
    globalEndY = data.globalY;
    render();
    // Show dimension label near local mouse position
    const localX = data.globalX - displayBounds.x;
    const localY = data.globalY - displayBounds.y;
    if (localX >= 0 && localX <= displayBounds.width && localY >= 0 && localY <= displayBounds.height) {
      updateDimensions(localX, localY);
    } else {
      dimLabel.style.display = 'none';
    }
  } else if (data.type === 'up' && selecting) {
    selecting = false;
    dimLabel.style.display = 'none';
    globalEndX = data.globalX;
    globalEndY = data.globalY;

    const x = Math.min(globalStartX, globalEndX);
    const y = Math.min(globalStartY, globalEndY);
    const w = Math.abs(globalEndX - globalStartX);
    const h = Math.abs(globalEndY - globalStartY);

    // Minimum selection size
    if (w < 10 || h < 10) return;

    // Send global crop region to main process
    ipcRenderer.send('selection-complete', {
      x: x,
      y: y,
      width: w,
      height: h
    });
  }
});

// --- Mouse events — convert local to global and send to main ---
canvas.addEventListener('mousedown', (e) => {
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('selection-mouse-event', { type: 'down', globalX: gx, globalY: gy });
});

canvas.addEventListener('mousemove', (e) => {
  if (!selecting) return;
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('selection-mouse-event', { type: 'move', globalX: gx, globalY: gy });
});

canvas.addEventListener('mouseup', (e) => {
  if (!selecting) return;
  const gx = displayBounds.x + e.clientX;
  const gy = displayBounds.y + e.clientY;
  ipcRenderer.send('selection-mouse-event', { type: 'up', globalX: gx, globalY: gy });
});

// Escape to cancel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('selection-cancel');
  }
});

// --- Render ---
function render() {
  if (!displayBounds) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dark semi-transparent overlay over the live desktop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (selecting || globalEndX !== globalStartX || globalEndY !== globalStartY) {
    // Global selection rect in CSS pixels
    const selX = Math.min(globalStartX, globalEndX);
    const selY = Math.min(globalStartY, globalEndY);
    const selW = Math.abs(globalEndX - globalStartX);
    const selH = Math.abs(globalEndY - globalStartY);

    // Convert global selection to this display's local coordinates
    // Canvas pixels = display CSS pixels (1:1 mapping)
    const localX = selX - displayBounds.x;
    const localY = selY - displayBounds.y;
    const localW = selW;
    const localH = selH;

    // Clip to this display's canvas bounds
    const clipX = Math.max(0, localX);
    const clipY = Math.max(0, localY);
    const clipR = Math.min(canvas.width, localX + localW);
    const clipB = Math.min(canvas.height, localY + localH);
    const clipW = clipR - clipX;
    const clipH = clipB - clipY;

    if (clipW > 0 && clipH > 0) {
      // Clear the selected area to make it transparent — shows live desktop through
      ctx.clearRect(clipX, clipY, clipW, clipH);

      // Selection border
      ctx.strokeStyle = '#0a84ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(localX, localY, localW, localH);
      ctx.setLineDash([]);
    }
  }
}

function updateDimensions(mouseX, mouseY) {
  const w = Math.abs(globalEndX - globalStartX);
  const h = Math.abs(globalEndY - globalStartY);
  dimLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  dimLabel.style.display = 'block';
  dimLabel.style.left = (mouseX + 14) + 'px';
  dimLabel.style.top = (mouseY + 14) + 'px';
}
