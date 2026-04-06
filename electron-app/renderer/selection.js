const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');
const instructions = document.getElementById('instructions');

let screenshot = null;
let selecting = false;
let startX = 0, startY = 0, endX = 0, endY = 0;
let scaleFactor = 1;

// Receive the screenshot from main process
ipcRenderer.on('selection-screenshot', (event, { dataUrl, scale }) => {
  scaleFactor = scale;
  const img = new Image();
  img.onload = () => {
    screenshot = img;
    canvas.width = img.width;
    canvas.height = img.height;
    render();
  };
  img.src = dataUrl;
});

// --- Mouse events ---
canvas.addEventListener('mousedown', (e) => {
  selecting = true;
  instructions.style.display = 'none';
  const rect = canvas.getBoundingClientRect();
  startX = (e.clientX - rect.left) * (canvas.width / rect.width);
  startY = (e.clientY - rect.top) * (canvas.height / rect.height);
  endX = startX;
  endY = startY;
});

canvas.addEventListener('mousemove', (e) => {
  if (!selecting) return;
  const rect = canvas.getBoundingClientRect();
  endX = (e.clientX - rect.left) * (canvas.width / rect.width);
  endY = (e.clientY - rect.top) * (canvas.height / rect.height);
  render();
  updateDimensions(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
  if (!selecting) return;
  selecting = false;
  dimLabel.style.display = 'none';

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  // Minimum selection size — 10px
  if (w < 10 || h < 10) return;

  // Send crop region back to main process
  ipcRenderer.send('selection-complete', {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(w),
    height: Math.round(h)
  });
});

// Escape to cancel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('selection-cancel');
  }
});

// --- Render ---
function render() {
  if (!screenshot) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the screenshot
  ctx.drawImage(screenshot, 0, 0);

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (selecting) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    // Clear the selected area to reveal the screenshot
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(screenshot, 0, 0);
    ctx.restore();

    // Selection border
    ctx.strokeStyle = '#0a84ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

function updateDimensions(mouseX, mouseY) {
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  dimLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  dimLabel.style.display = 'block';
  dimLabel.style.left = (mouseX + 14) + 'px';
  dimLabel.style.top = (mouseY + 14) + 'px';
}
