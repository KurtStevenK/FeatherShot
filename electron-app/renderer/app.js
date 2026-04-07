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
let abcArrowCount = 0;
let abcRectCount = 0;
let isDragging = false;

// Convert 1-based number to letter label: 1→a, 2→b, …, 26→z, 27→aa, 28→ab, …
function letterLabel(n) {
  let num = n - 1;
  let result = '';
  do {
    result = String.fromCharCode(97 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);
  return result;
}

// --- DOM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Tool buttons (order: step-arrow, step-rect, arrow, rect, line, question-arrow, question-rect, abc-arrow, abc-rect)
document.getElementById('tool-step-arrow').addEventListener('click', () => setTool('step-arrow'));
document.getElementById('tool-step-rect').addEventListener('click', () => setTool('step-rect'));
document.getElementById('tool-arrow').addEventListener('click', () => setTool('arrow'));
document.getElementById('tool-rect').addEventListener('click', () => setTool('rect'));
document.getElementById('tool-line').addEventListener('click', () => setTool('line'));
document.getElementById('tool-question-arrow').addEventListener('click', () => setTool('question-arrow'));
document.getElementById('tool-question-rect').addEventListener('click', () => setTool('question-rect'));
document.getElementById('tool-abc-arrow').addEventListener('click', () => setTool('abc-arrow'));
document.getElementById('tool-abc-rect').addEventListener('click', () => setTool('abc-rect'));
document.getElementById('tool-circle').addEventListener('click', () => setTool('circle'));

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
  if (e.key === '5' || e.key === 'l') setTool('line');
  if (e.key === '6') setTool('question-arrow');
  if (e.key === '7') setTool('question-rect');
  if (e.key === '8') setTool('abc-arrow');
  if (e.key === '9') setTool('abc-rect');
  if (e.key === '0') setTool('circle');
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
    } else if (currentDraw.tool === 'abc-arrow') {
      abcArrowCount++;
      currentDraw.stepNumber = abcArrowCount;
    } else if (currentDraw.tool === 'abc-rect') {
      abcRectCount++;
      currentDraw.stepNumber = abcRectCount;
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
  let stepA = 0, stepR = 0, abcA = 0, abcR = 0;
  drawings.forEach(d => {
    if (d.tool === 'step-arrow') {
      stepA++;
      drawStepArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, stepA);
    } else if (d.tool === 'step-rect') {
      stepR++;
      drawStepRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, stepR);
    } else if (d.tool === 'arrow') {
      drawArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'line') {
      drawLine(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'question-arrow') {
      drawQuestionArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'question-rect') {
      drawQuestionRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'abc-arrow') {
      abcA++;
      drawAbcArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, abcA);
    } else if (d.tool === 'abc-rect') {
      abcR++;
      drawAbcRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, abcR);
    } else if (d.tool === 'circle') {
      drawEllipse(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
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
    } else if (currentDraw.tool === 'line') {
      drawLine(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else if (currentDraw.tool === 'question-arrow') {
      drawQuestionArrow(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else if (currentDraw.tool === 'question-rect') {
      drawQuestionRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else if (currentDraw.tool === 'abc-arrow') {
      drawAbcArrow(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth, abcArrowCount + 1);
    } else if (currentDraw.tool === 'abc-rect') {
      drawAbcRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth, abcRectCount + 1);
    } else if (currentDraw.tool === 'circle') {
      drawEllipse(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else {
      drawRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    }
  }
}

// --- Drawing Functions ---

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

function drawLine(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawStepArrow(ctx, x1, y1, x2, y2, color, lw, num) {
  drawArrow(ctx, x1, y1, x2, y2, color, lw);
  drawCircleLabel(ctx, x1, y1, color, lw, num.toString());
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
  const cx = Math.min(x1, x2);
  const cy = Math.min(y1, y2);
  drawCircleLabel(ctx, cx, cy, color, lw, num.toString());
}

function drawQuestionArrow(ctx, x1, y1, x2, y2, color, lw) {
  drawArrow(ctx, x1, y1, x2, y2, color, lw);
  drawCircleLabel(ctx, x1, y1, color, lw, '?');
}

function drawQuestionRect(ctx, x1, y1, x2, y2, color, lw) {
  drawRect(ctx, x1, y1, x2, y2, color, lw);
  const cx = Math.min(x1, x2);
  const cy = Math.min(y1, y2);
  drawCircleLabel(ctx, cx, cy, color, lw, '?');
}

function drawAbcArrow(ctx, x1, y1, x2, y2, color, lw, num) {
  drawArrow(ctx, x1, y1, x2, y2, color, lw);
  drawCircleLabel(ctx, x1, y1, color, lw, letterLabel(num));
}

function drawAbcRect(ctx, x1, y1, x2, y2, color, lw, num) {
  drawRect(ctx, x1, y1, x2, y2, color, lw);
  const cx = Math.min(x1, x2);
  const cy = Math.min(y1, y2);
  drawCircleLabel(ctx, cx, cy, color, lw, letterLabel(num));
}

function drawEllipse(ctx, x1, y1, x2, y2, color, lw) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  if (rx < 1 || ry < 1) return;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Shared helper: draw a filled circle with a text label at (x, y)
function drawCircleLabel(ctx, x, y, color, lw, label) {
  const radius = Math.max(12, lw * 3);

  // Circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Label text — shrink font for multi-char labels
  const fontSize = label.length > 1 ? radius * 0.9 : radius * 1.2;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
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
    if (removed.tool === 'abc-arrow') abcArrowCount = Math.max(0, abcArrowCount - 1);
    if (removed.tool === 'abc-rect') abcRectCount = Math.max(0, abcRectCount - 1);
    render();
    updateUndoState();
  }
}

function clearAll() {
  drawings = [];
  stepArrowCount = 0;
  stepRectCount = 0;
  abcArrowCount = 0;
  abcRectCount = 0;
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
