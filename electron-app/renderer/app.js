const { ipcRenderer, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- State ---
let screenshotImage = null;
let tool = 'step-arrow'; // Default to counting arrows
let color = '#FF3B30';
let lineWidth = 4;
let zoomLevel = 2.0; // Magnifier zoom (1.5–5×)
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
const lineWidthSlider = document.getElementById('line-width');
const widthLabel = document.getElementById('width-label');

// Tool buttons
document.getElementById('tool-step-arrow').addEventListener('click', () => setTool('step-arrow'));
document.getElementById('tool-step-rect').addEventListener('click', () => setTool('step-rect'));
document.getElementById('tool-arrow').addEventListener('click', () => setTool('arrow'));
document.getElementById('tool-rect').addEventListener('click', () => setTool('rect'));
document.getElementById('tool-circle').addEventListener('click', () => setTool('circle'));
document.getElementById('tool-line').addEventListener('click', () => setTool('line'));
document.getElementById('tool-question-arrow').addEventListener('click', () => setTool('question-arrow'));
document.getElementById('tool-question-rect').addEventListener('click', () => setTool('question-rect'));
document.getElementById('tool-abc-arrow').addEventListener('click', () => setTool('abc-arrow'));
document.getElementById('tool-abc-rect').addEventListener('click', () => setTool('abc-rect'));
document.getElementById('tool-magnifier').addEventListener('click', () => setTool('magnifier'));

// Controls
document.getElementById('color-picker').addEventListener('input', (e) => { color = e.target.value; });
lineWidthSlider.addEventListener('input', (e) => {
  if (tool === 'magnifier') {
    zoomLevel = parseFloat(e.target.value);
    widthLabel.textContent = zoomLevel.toFixed(1) + '×';
  } else {
    lineWidth = parseInt(e.target.value);
    widthLabel.textContent = lineWidth + 'px';
  }
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
  if (e.key === '5') setTool('circle');
  if (e.key === '6' || e.key === 'l') setTool('line');
  if (e.key === '7') setTool('question-arrow');
  if (e.key === '8') setTool('question-rect');
  if (e.key === '9') setTool('abc-arrow');
  if (e.key === '0') setTool('abc-rect');
  if (e.key === 'm' || e.key === 'M') setTool('magnifier');
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAndCopy(); }
});

// --- IPC ---
ipcRenderer.on('load-screenshot', (event, dataUrl) => {
  loadScreenshot(dataUrl);
});

// Pull screenshot data from main (handles both single and composite)
(async () => {
  try {
    const data = await ipcRenderer.invoke('editor-screenshot-request');
    if (!data) return;
    if (typeof data === 'string') {
      loadScreenshot(data);
    } else if (data.type === 'composite') {
      // Cross-monitor: composite multiple pieces onto canvas
      canvas.width = data.width;
      canvas.height = data.height;
      let loaded = 0;
      data.pieces.forEach(p => {
        const img = new Image();
        img.onload = () => {
          const ctx2 = canvas.getContext('2d');
          ctx2.drawImage(img, 0, 0, img.width, img.height, p.destX, p.destY, p.destW, p.destH);
          loaded++;
          if (loaded === data.pieces.length) {
            // Convert composite to a single image for the editor
            loadScreenshot(canvas.toDataURL('image/png'));
          }
        };
        img.src = p.dataUrl;
      });
    }
  } catch(e) {}
})();

function loadScreenshot(dataUrl) {
  const img = new Image();
  img.onload = () => {
    screenshotImage = img;
    canvas.width = img.width;
    canvas.height = img.height;
    render();
  };
  img.src = dataUrl;
}

// --- Drawing ---
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  currentDraw = { tool, color, lineWidth, startX: x, startY: y, endX: x, endY: y };
  // Store zoom level for magnifier
  if (tool === 'magnifier') {
    currentDraw.zoom = zoomLevel;
  }
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
    } else if (d.tool === 'magnifier') {
      drawMagnifier(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth, d.zoom || 2.0);
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
    } else if (currentDraw.tool === 'magnifier') {
      drawMagnifier(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth, currentDraw.zoom || 2.0);
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

// Magnifier tool — draws a circular zoom lens showing magnified screenshot content
function drawMagnifier(ctx, x1, y1, x2, y2, color, lw, zoom) {
  if (!screenshotImage) return;
  
  // Center is start point, radius is distance to end point
  const dx = x2 - x1;
  const dy = y2 - y1;
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (radius < 5) return;

  const centerX = x1;
  const centerY = y1;

  // Source region from the original screenshot (before any annotations)
  // Account for possible difference between canvas size and image size
  const imgW = screenshotImage.width || screenshotImage.naturalWidth;
  const imgH = screenshotImage.height || screenshotImage.naturalHeight;
  const scaleImgX = imgW / canvas.width;
  const scaleImgY = imgH / canvas.height;
  
  // Map center from canvas coordinates to image coordinates
  const imgCenterX = centerX * scaleImgX;
  const imgCenterY = centerY * scaleImgY;
  
  // Source sample region in image coordinates
  const srcRadiusX = (radius / zoom) * scaleImgX;
  const srcRadiusY = (radius / zoom) * scaleImgY;
  const srcX = Math.round(imgCenterX - srcRadiusX);
  const srcY = Math.round(imgCenterY - srcRadiusY);
  const srcW = Math.round(srcRadiusX * 2);
  const srcH = Math.round(srcRadiusY * 2);

  ctx.save();

  // Clip to circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw the magnified portion of the ORIGINAL screenshot
  ctx.drawImage(
    screenshotImage,
    srcX, srcY, srcW, srcH,              // source rect from screenshot (image coords)
    centerX - radius, centerY - radius,  // dest position (canvas coords)
    radius * 2, radius * 2              // dest size (fills the circle)
  );

  ctx.restore();

  // Draw border ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, lw);
  ctx.stroke();

  // Draw crosshair at center
  const crossSize = 6;
  ctx.beginPath();
  ctx.moveTo(centerX - crossSize, centerY);
  ctx.lineTo(centerX + crossSize, centerY);
  ctx.moveTo(centerX, centerY - crossSize);
  ctx.lineTo(centerX, centerY + crossSize);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
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

  // Switch slider between line-width mode and zoom mode
  if (t === 'magnifier') {
    lineWidthSlider.min = '1.5';
    lineWidthSlider.max = '5';
    lineWidthSlider.step = '0.5';
    lineWidthSlider.value = zoomLevel.toString();
    widthLabel.textContent = zoomLevel.toFixed(1) + '×';
  } else {
    lineWidthSlider.min = '2';
    lineWidthSlider.max = '15';
    lineWidthSlider.step = '1';
    lineWidthSlider.value = lineWidth.toString();
    widthLabel.textContent = lineWidth + 'px';
  }
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

  // Flash the save button briefly then close on Windows/Linux
  const btn = document.getElementById('btn-save');
  btn.textContent = '✓ Saved & Copied!';
  btn.style.background = '#30d158';
  setTimeout(() => {
    window.close();
  }, 800);
}

// Initial state
updateUndoState();
