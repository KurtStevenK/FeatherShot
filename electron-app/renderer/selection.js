const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');

let screenshotCanvas = null;
let selecting = false;
let startX = 0, startY = 0, endX = 0, endY = 0;

ipcRenderer.on('selection-init', (event, { captures, totalWidth, totalHeight }) => {
  canvas.width = totalWidth;
  canvas.height = totalHeight;

  // Composite all display captures onto an offscreen canvas
  screenshotCanvas = document.createElement('canvas');
  screenshotCanvas.width = totalWidth;
  screenshotCanvas.height = totalHeight;
  const sctx = screenshotCanvas.getContext('2d');

  let loaded = 0;
  captures.forEach(cap => {
    const img = new Image();
    img.onload = () => {
      sctx.drawImage(img, cap.x, cap.y, cap.width, cap.height);
      loaded++;
      if (loaded === captures.length) {
        render();
        ipcRenderer.send('selection-ready');
      }
    };
    img.onerror = () => {
      loaded++;
      if (loaded === captures.length) {
        render();
        ipcRenderer.send('selection-ready');
      }
    };
    img.src = cap.dataUrl;
  });
});

// Mouse events — single window, coordinates map directly to canvas
canvas.addEventListener('mousedown', (e) => {
  selecting = true;
  startX = e.clientX;
  startY = e.clientY;
  endX = e.clientX;
  endY = e.clientY;
  const instr = document.getElementById('instructions');
  if (instr) instr.style.display = 'none';
});

canvas.addEventListener('mousemove', (e) => {
  if (!selecting) return;
  endX = e.clientX;
  endY = e.clientY;
  render();
  updateDimensions(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', (e) => {
  if (!selecting) return;
  selecting = false;
  endX = e.clientX;
  endY = e.clientY;
  dimLabel.style.display = 'none';

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  if (w < 10 || h < 10) return;
  ipcRenderer.send('selection-complete', { x, y, width: w, height: h });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ipcRenderer.send('selection-cancel');
});

function render() {
  if (!screenshotCanvas) return;

  // Draw composite screenshot
  ctx.drawImage(screenshotCanvas, 0, 0);

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (selecting) {
    const selX = Math.min(startX, endX);
    const selY = Math.min(startY, endY);
    const selW = Math.abs(endX - startX);
    const selH = Math.abs(endY - startY);

    if (selW > 0 && selH > 0) {
      // Reveal bright screenshot in the selection area
      ctx.save();
      ctx.beginPath();
      ctx.rect(selX, selY, selW, selH);
      ctx.clip();
      ctx.drawImage(screenshotCanvas, 0, 0);
      ctx.restore();

      // Selection border
      ctx.strokeStyle = '#0a84ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(selX, selY, selW, selH);
      ctx.setLineDash([]);
    }
  }
}

function updateDimensions(mx, my) {
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  dimLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  dimLabel.style.display = 'block';
  dimLabel.style.left = (mx + 14) + 'px';
  dimLabel.style.top = (my + 14) + 'px';
}
