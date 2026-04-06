const { ipcRenderer, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- State ---
let screenshotImage = null;
let tool = 'step-arrow'; // Default to counting arrows
let color = '#FF3B30';
let lineWidth = 4;
let drawings = [];
let currentDraw = null;
let stepArrowCount = 0;
let stepRectCount = 0;
let isDragging = false;

// --- DOM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Tool buttons (order: step-arrow, step-rect, arrow, rect)
document.getElementById('tool-step-arrow').addEventListener('click', () => setTool('step-arrow'));
document.getElementById('tool-step-rect').addEventListener('click', () => setTool('step-rect'));
document.getElementById('tool-arrow').addEventListener('click', () => setTool('arrow'));
document.getElementById('tool-rect').addEventListener('click', () => setTool('rect'));

// Controls
document.getElementById('color-picker').addEventListener('input', (e) => { color = e.target.value; });
document.getElementById('line-width').addEventListener('input', (e) => {
  lineWidth = parseInt(e.target.value);
  document.getElementById('width-label').textContent = lineWidth + 'px';
});

// Actions
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-clear').addEventListener('click', clearAll);
document.getElementById('btn-save').addEventListener('click', saveAndCopy);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === '1') setTool('step-arrow');
  if (e.key === '2') setTool('step-rect');
  if (e.key === '3' || e.key === 'a') setTool('arrow');
  if (e.key === '4' || e.key === 'r') setTool('rect');
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAndCopy(); }
});

// --- IPC ---
ipcRenderer.on('load-screenshot', (event, dataUrl) => {
  const img = new Image();
  img.onload = () => {
    screenshotImage = img;
    canvas.width = img.width;
    canvas.height = img.height;
    render();
  };
  img.src = dataUrl;
});

// --- Drawing ---
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  currentDraw = { tool, color, lineWidth, startX: x, startY: y, endX: x, endY: y };
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging || !currentDraw) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  currentDraw.endX = (e.clientX - rect.left) * scaleX;
  currentDraw.endY = (e.clientY - rect.top) * scaleY;
  render();
});

canvas.addEventListener('mouseup', () => {
  if (currentDraw) {
    if (currentDraw.tool === 'step-arrow') {
      stepArrowCount++;
      currentDraw.stepNumber = stepArrowCount;
    } else if (currentDraw.tool === 'step-rect') {
      stepRectCount++;
      currentDraw.stepNumber = stepRectCount;
    }
    drawings.push(currentDraw);
    currentDraw = null;
  }
  isDragging = false;
  render();
  updateUndoState();
});

// --- Render ---
function render() {
  if (!screenshotImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(screenshotImage, 0, 0);

  // Draw completed
  let stepA = 0, stepR = 0;
  drawings.forEach(d => {
    if (d.tool === 'step-arrow') {
      stepA++;
      drawStepArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, stepA);
    } else if (d.tool === 'step-rect') {
      stepR++;
      drawStepRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, stepR);
    } else if (d.tool === 'arrow') {
      drawArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else {
      drawRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    }
  });

  // Draw active
  if (currentDraw) {
    if (currentDraw.tool === 'step-arrow') {
      drawStepArrow(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth, stepArrowCount + 1);
    } else if (currentDraw.tool === 'step-rect') {
      drawStepRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth, stepRectCount + 1);
    } else if (currentDraw.tool === 'arrow') {
      drawArrow(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else {
      drawRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    }
  }
}

function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
  const headLength = 12 + lw * 1.5;
  const headAngle = Math.PI / 9; // 20 degrees
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Barb point
  const barbX = x2 - headLength * 0.8 * Math.cos(angle);
  const barbY = y2 - headLength * 0.8 * Math.sin(angle);

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(barbX, barbY);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrowhead
  const p1x = x2 - headLength * Math.cos(angle + headAngle);
  const p1y = y2 - headLength * Math.sin(angle + headAngle);
  const p2x = x2 - headLength * Math.cos(angle - headAngle);
  const p2y = y2 - headLength * Math.sin(angle - headAngle);

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(barbX, barbY);
  ctx.lineTo(p2x, p2y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawStepArrow(ctx, x1, y1, x2, y2, color, lw, num) {
  drawArrow(ctx, x1, y1, x2, y2, color, lw);

  const radius = Math.max(12, lw * 3);

  // Circle
  ctx.beginPath();
  ctx.arc(x1, y1, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Number
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${radius * 1.2}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num.toString(), x1, y1);
}

function drawRect(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawStepRect(ctx, x1, y1, x2, y2, color, lw, num) {
  drawRect(ctx, x1, y1, x2, y2, color, lw);

  const radius = Math.max(12, lw * 3);
  const cx = Math.min(x1, x2);
  const cy = Math.min(y1, y2);

  // Circle at top-left corner
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Number
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${radius * 1.2}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num.toString(), cx, cy);
}

// --- Actions ---
function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + t).classList.add('active');
}

function undo() {
  if (drawings.length > 0) {
    const removed = drawings.pop();
    if (removed.tool === 'step-arrow') stepArrowCount = Math.max(0, stepArrowCount - 1);
    if (removed.tool === 'step-rect') stepRectCount = Math.max(0, stepRectCount - 1);
    render();
    updateUndoState();
  }
}

function clearAll() {
  drawings = [];
  stepArrowCount = 0;
  stepRectCount = 0;
  render();
  updateUndoState();
}

function updateUndoState() {
  document.getElementById('btn-undo').disabled = drawings.length === 0;
}

function saveAndCopy() {
  const dataUrl = canvas.toDataURL('image/png');
  const img = nativeImage.createFromDataURL(dataUrl);
  clipboard.writeImage(img);

  // Save to Downloads
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = path.join(downloadsDir, `FeatherShot_${timestamp}.png`);

  const buffer = img.toPNG();
  fs.writeFileSync(filePath, buffer);

  // Flash the save button briefly
  const btn = document.getElementById('btn-save');
  btn.textContent = '✓ Saved & Copied!';
  btn.style.background = '#30d158';
  setTimeout(() => {
    btn.textContent = '💾 Save & Copy';
    btn.style.background = '';
  }, 1500);
}

// Initial state
updateUndoState();
