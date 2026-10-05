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
let cachedRect = null;
let cachedScaleX = 1;
let cachedScaleY = 1;
let renderRequested = false;
let editingTextId = null;
let draggingTextId = null;
let textDragStart = null;
let textPlaceStart = null;

// letterLabel from ../shared/letterLabel.js (synced via npm run sync:shared)

// --- DOM ---
const canvas = document.getElementById('canvas');
const textEditor = document.getElementById('text-editor');
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
document.getElementById('tool-exclamation-arrow').addEventListener('click', () => setTool('exclamation-arrow'));
document.getElementById('tool-exclamation-rect').addEventListener('click', () => setTool('exclamation-rect'));
document.getElementById('tool-text').addEventListener('click', () => setTool('text'));
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
  if (e.key === '-' || e.key === '_') setTool('exclamation-arrow');
  if (e.key === '=' || e.key === '+') setTool('exclamation-rect');
  if (e.key === 't' || e.key === 'T') setTool('text');
  if (e.key === '9') setTool('abc-arrow');
  if (e.key === '0') setTool('abc-rect');
  if (e.key === 'm' || e.key === 'M') setTool('magnifier');
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAndCopy(); }
});

// --- IPC ---
ipcRenderer.on('load-screenshot', (event, data) => {
  if (typeof data === 'string') {
    loadScreenshot(data);
  } else if (data && data.type === 'composite') {
    // Cross-monitor: composite multiple pieces onto canvas, then load as single image
    canvas.width = data.width;
    canvas.height = data.height;
    let loaded = 0;
    data.pieces.forEach(p => {
      const img = new Image();
      img.onload = () => {
        const ctx2 = canvas.getContext('2d');
        ctx2.drawImage(img, 0, 0, img.width, img.height, p.destX, p.destY, p.destW, p.destH);
        loaded++;
        if (loaded === data.pieces.length) loadScreenshot(canvas.toDataURL('image/png'));
      };
      img.src = p.dataUrl;
    });
  }
});

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
  if (tool === 'text') {
    commitTextEdit();
    cachedRect = canvas.getBoundingClientRect();
    cachedScaleX = canvas.width / cachedRect.width;
    cachedScaleY = canvas.height / cachedRect.height;
    const x = (e.clientX - cachedRect.left) * cachedScaleX;
    const y = (e.clientY - cachedRect.top) * cachedScaleY;
    textPlaceStart = { x, y };
    const hit = textHitAt(x, y);
    if (hit) {
      draggingTextId = hit.id;
      isDragging = true;
    } else {
      isDragging = false;
    }
    return;
  }
  isDragging = true;
  cachedRect = canvas.getBoundingClientRect();
  cachedScaleX = canvas.width / cachedRect.width;
  cachedScaleY = canvas.height / cachedRect.height;

  const x = (e.clientX - cachedRect.left) * cachedScaleX;
  const y = (e.clientY - cachedRect.top) * cachedScaleY;
  currentDraw = { tool, color, lineWidth, startX: x, startY: y, endX: x, endY: y };
  if (tool === 'magnifier') {
    currentDraw.zoom = zoomLevel;
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (tool === 'text' && draggingTextId) {
    const x = (e.clientX - cachedRect.left) * cachedScaleX;
    const y = (e.clientY - cachedRect.top) * cachedScaleY;
    const d = drawings.find((item) => item.id === draggingTextId);
    if (d) {
      d.startX = x;
      d.startY = y;
      if (editingTextId === draggingTextId) positionTextEditor(d);
      render();
    }
    return;
  }
  if (!isDragging || !currentDraw) return;

  currentDraw.endX = (e.clientX - cachedRect.left) * cachedScaleX;
  currentDraw.endY = (e.clientY - cachedRect.top) * cachedScaleY;

  // Performance: Throttle render calls to requestAnimationFrame to prevent "frame piling"
  if (!renderRequested) {
    renderRequested = true;
    requestAnimationFrame(() => {
      render();
      renderRequested = false;
    });
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (tool === 'text') {
    if (draggingTextId) {
      draggingTextId = null;
      textPlaceStart = null;
      isDragging = false;
      render();
      return;
    }
    if (textPlaceStart) {
      cachedRect = canvas.getBoundingClientRect();
      cachedScaleX = canvas.width / cachedRect.width;
      cachedScaleY = canvas.height / cachedRect.height;
      const x = (e.clientX - cachedRect.left) * cachedScaleX;
      const y = (e.clientY - cachedRect.top) * cachedScaleY;
      const dist = Math.hypot(x - textPlaceStart.x, y - textPlaceStart.y);
      const hit = textHitAt(textPlaceStart.x, textPlaceStart.y);
      if (dist < 6 && hit) {
        beginTextEdit(hit);
      } else if (dist < 6) {
        const id = `text-${Date.now()}`;
        const fontSize = Math.max(18, lineWidth * 5);
        const entry = { id, tool: 'text', color, lineWidth, startX: x, startY: y, endX: x, endY: y, text: 'Text', fontSize };
        drawings.push(entry);
        beginTextEdit(entry);
        render();
      }
      textPlaceStart = null;
    }
    return;
  }
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
  updateActionStates();
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
    } else if (d.tool === 'exclamation-arrow') {
      drawExclamationArrow(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'exclamation-rect') {
      drawExclamationRect(ctx, d.startX, d.startY, d.endX, d.endY, d.color, d.lineWidth);
    } else if (d.tool === 'text') {
      drawTextAnnotation(ctx, d);
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
    } else if (currentDraw.tool === 'exclamation-arrow') {
      drawExclamationArrow(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
    } else if (currentDraw.tool === 'exclamation-rect') {
      drawExclamationRect(ctx, currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY, currentDraw.color, currentDraw.lineWidth);
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

function drawExclamationArrow(ctx, x1, y1, x2, y2, color, lw) {
  drawArrow(ctx, x1, y1, x2, y2, color, lw);
  drawCircleLabel(ctx, x1, y1, color, lw, '!');
}

function drawExclamationRect(ctx, x1, y1, x2, y2, color, lw) {
  drawRect(ctx, x1, y1, x2, y2, color, lw);
  const cx = Math.min(x1, x2);
  const cy = Math.min(y1, y2);
  drawCircleLabel(ctx, cx, cy, color, lw, '!');
}

function drawTextAnnotation(ctx, d) {
  if (editingTextId === d.id) return;
  ctx.font = `600 ${d.fontSize || 24}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = d.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.text || '', d.startX, d.startY);
}

function textHitAt(x, y) {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (d.tool !== 'text') continue;
    const fs = d.fontSize || 24;
    const w = Math.max(80, (d.text || '').length * fs * 0.55);
    const h = fs * 1.4;
    if (x >= d.startX - w / 2 && x <= d.startX + w / 2 && y >= d.startY - h / 2 && y <= d.startY + h / 2) {
      return d;
    }
  }
  return null;
}

function positionTextEditor(d) {
  if (!textEditor || !cachedRect) return;
  const left = cachedRect.left + (d.startX / cachedScaleX);
  const top = cachedRect.top + (d.startY / cachedScaleY);
  textEditor.style.left = `${left}px`;
  textEditor.style.top = `${top}px`;
  textEditor.style.transform = 'translate(-50%, -50%)';
  textEditor.style.color = d.color;
  textEditor.style.fontSize = `${(d.fontSize || 24) / cachedScaleX}px`;
}

function beginTextEdit(d) {
  editingTextId = d.id;
  textEditor.classList.remove('text-editor-hidden');
  textEditor.value = d.text || '';
  positionTextEditor(d);
  textEditor.focus();
  textEditor.select();
}

function commitTextEdit() {
  if (!editingTextId) return;
  const idx = drawings.findIndex((d) => d.id === editingTextId);
  if (idx === -1) {
    hideTextEditor();
    return;
  }
  const trimmed = (textEditor.value || '').trim();
  if (!trimmed) {
    drawings.splice(idx, 1);
  } else {
    drawings[idx].text = trimmed;
  }
  hideTextEditor();
  render();
}

function hideTextEditor() {
  editingTextId = null;
  if (textEditor) {
    textEditor.classList.add('text-editor-hidden');
    textEditor.blur();
  }
}

textEditor.addEventListener('blur', () => commitTextEdit());
textEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitTextEdit();
  }
});

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
  if (tool === 'text' && t !== 'text') commitTextEdit();
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => {
    const isActive = b.id === 'tool-' + t;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive);
  });

  // Switch slider between line-width mode and zoom mode
  if (t === 'magnifier') {
    lineWidthSlider.min = '1.5';
    lineWidthSlider.max = '5';
    lineWidthSlider.step = '0.5';
    lineWidthSlider.value = zoomLevel.toString();
    lineWidthSlider.title = 'Zoom Level';
    lineWidthSlider.setAttribute('aria-label', 'Zoom Level');
    widthLabel.textContent = zoomLevel.toFixed(1) + '×';
  } else {
    lineWidthSlider.min = '2';
    lineWidthSlider.max = '15';
    lineWidthSlider.step = '1';
    lineWidthSlider.value = lineWidth.toString();
    lineWidthSlider.title = 'Line Width';
    lineWidthSlider.setAttribute('aria-label', 'Line Width');
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
    updateActionStates();
  }
}

function clearAll() {
  if (drawings.length === 0) return;
  if (!confirm('Are you sure you want to clear all annotations?')) return;

  drawings = [];
  stepArrowCount = 0;
  stepRectCount = 0;
  abcArrowCount = 0;
  abcRectCount = 0;
  render();
  updateActionStates();
}

function updateActionStates() {
  const hasDrawings = drawings.length > 0;
  document.getElementById('btn-undo').disabled = !hasDrawings;
  document.getElementById('btn-clear').disabled = !hasDrawings;
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
updateActionStates();
