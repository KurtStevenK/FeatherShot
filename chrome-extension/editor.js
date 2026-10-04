const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = null, tool = 'step', color = '#FF3B30', lw = 4, zoomLevel = 2.0;
let drawings = [], current = null, dragging = false, stepN = 0, stepRN = 0, abcAN = 0, abcRN = 0;
let editingTextId = null, draggingTextId = null, textPlaceStart = null, cachedRect = null, scaleX = 1, scaleY = 1;
const widthSlider = document.getElementById('width');
const wLabel = document.getElementById('w-label');
const textEditor = document.getElementById('text-editor');

// letterLabel — loaded from letterLabel.js (synced from shared/letterLabel.js)

// Load screenshot and apply crop if available
chrome.storage.local.get(['screenshotData', 'cropRegion'], (data) => {
  if (!data.screenshotData) return;

  const i = new Image();
  i.onload = () => {
    const crop = data.cropRegion;

    if (crop) {
      // Crop the image using the selection coordinates
      // The capture is at device pixel ratio, but crop coords are CSS pixels
      const dpr = crop.dpr || 1;
      const sx = crop.x * dpr;
      const sy = crop.y * dpr;
      const sw = crop.width * dpr;
      const sh = crop.height * dpr;

      // Create a cropped canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sw;
      tempCanvas.height = sh;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(i, sx, sy, sw, sh, 0, 0, sw, sh);

      // Create cropped image
      const croppedImg = new Image();
      croppedImg.onload = () => {
        img = croppedImg;
        canvas.width = croppedImg.width;
        canvas.height = croppedImg.height;
        render();
      };
      croppedImg.src = tempCanvas.toDataURL('image/png');
    } else {
      img = i;
      canvas.width = i.width;
      canvas.height = i.height;
      render();
    }
  };
  i.src = data.screenshotData;

  // Clean up stored data
  chrome.storage.local.remove(['screenshotData', 'cropRegion']);
});

// Tools (reordered: step, step-rect, arrow, rect, circle, line, question-arrow, question-rect, abc-arrow, abc-rect, magnifier)
document.getElementById('tool-step').onclick = () => setTool('step');
document.getElementById('tool-step-rect').onclick = () => setTool('step-rect');
document.getElementById('tool-arrow').onclick = () => setTool('arrow');
document.getElementById('tool-rect').onclick = () => setTool('rect');
document.getElementById('tool-circle').onclick = () => setTool('circle');
document.getElementById('tool-line').onclick = () => setTool('line');
document.getElementById('tool-question-arrow').onclick = () => setTool('question-arrow');
document.getElementById('tool-question-rect').onclick = () => setTool('question-rect');
document.getElementById('tool-exclamation-arrow').onclick = () => setTool('exclamation-arrow');
document.getElementById('tool-exclamation-rect').onclick = () => setTool('exclamation-rect');
document.getElementById('tool-text').onclick = () => setTool('text');
document.getElementById('tool-abc-arrow').onclick = () => setTool('abc-arrow');
document.getElementById('tool-abc-rect').onclick = () => setTool('abc-rect');
document.getElementById('tool-magnifier').onclick = () => setTool('magnifier');

document.getElementById('color').oninput = (e) => { color = e.target.value; };
widthSlider.oninput = (e) => {
  if (tool === 'magnifier') {
    zoomLevel = parseFloat(e.target.value);
    wLabel.textContent = zoomLevel.toFixed(1) + '×';
  } else {
    lw = +e.target.value;
    wLabel.textContent = lw + 'px';
  }
};
document.getElementById('undo').onclick = () => {
  if (drawings.length) {
    const r = drawings.pop();
    if (r.tool === 'step') stepN--;
    if (r.tool === 'step-rect') stepRN--;
    if (r.tool === 'abc-arrow') abcAN--;
    if (r.tool === 'abc-rect') abcRN--;
    render();
  }
};
document.getElementById('clear').onclick = () => { drawings = []; stepN = 0; stepRN = 0; abcAN = 0; abcRN = 0; render(); };
document.getElementById('save').onclick = saveAndDownload;

function setTool(t) {
  if (tool === 'text' && t !== 'text') commitTextEdit();
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const idMap = {
    'step': 'tool-step', 'step-rect': 'tool-step-rect',
    'arrow': 'tool-arrow', 'rect': 'tool-rect', 'circle': 'tool-circle',
    'line': 'tool-line',
    'question-arrow': 'tool-question-arrow', 'question-rect': 'tool-question-rect',
    'exclamation-arrow': 'tool-exclamation-arrow', 'exclamation-rect': 'tool-exclamation-rect',
    'text': 'tool-text',
    'abc-arrow': 'tool-abc-arrow', 'abc-rect': 'tool-abc-rect',
    'magnifier': 'tool-magnifier'
  };
  document.getElementById(idMap[t]).classList.add('active');

  // Switch slider between line-width mode and zoom mode
  if (t === 'magnifier') {
    widthSlider.min = '1.5';
    widthSlider.max = '5';
    widthSlider.step = '0.5';
    widthSlider.value = zoomLevel.toString();
    wLabel.textContent = zoomLevel.toFixed(1) + '×';
  } else {
    widthSlider.min = '2';
    widthSlider.max = '15';
    widthSlider.step = '1';
    widthSlider.value = lw.toString();
    wLabel.textContent = lw + 'px';
  }
}

canvas.onmousedown = (e) => {
  if (tool === 'text') {
    commitTextEdit();
    const r = canvas.getBoundingClientRect();
    scaleX = canvas.width / r.width; scaleY = canvas.height / r.height;
    cachedRect = r;
    const x = (e.clientX - r.left) * scaleX, y = (e.clientY - r.top) * scaleY;
    textPlaceStart = { x, y };
    const hit = textHitAt(x, y);
    draggingTextId = hit ? hit.id : null;
    dragging = !!hit;
    return;
  }
  dragging = true;
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  current = { tool, color, lw, x1: (e.clientX-r.left)*sx, y1: (e.clientY-r.top)*sy, x2: 0, y2: 0 };
  if (tool === 'magnifier') current.zoom = zoomLevel;
};
canvas.onmousemove = (e) => {
  if (tool === 'text' && draggingTextId) {
    const r = cachedRect || canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * scaleX, y = (e.clientY - r.top) * scaleY;
    const d = drawings.find(item => item.id === draggingTextId);
    if (d) { d.x1 = x; d.y1 = y; if (editingTextId === d.id) positionTextEditor(d); render(); }
    return;
  }
  if (!dragging || !current) return;
  const r = canvas.getBoundingClientRect();
  current.x2 = (e.clientX-r.left)*(canvas.width/r.width);
  current.y2 = (e.clientY-r.top)*(canvas.height/r.height);
  render();
};
canvas.onmouseup = (e) => {
  if (tool === 'text') {
    if (draggingTextId) { draggingTextId = null; dragging = false; textPlaceStart = null; render(); return; }
    if (textPlaceStart) {
      const r = canvas.getBoundingClientRect();
      scaleX = canvas.width / r.width; scaleY = canvas.height / r.height;
      const x = (e.clientX - r.left) * scaleX, y = (e.clientY - r.top) * scaleY;
      const dist = Math.hypot(x - textPlaceStart.x, y - textPlaceStart.y);
      const hit = textHitAt(textPlaceStart.x, textPlaceStart.y);
      if (dist < 6 && hit) beginTextEdit(hit);
      else if (dist < 6) {
        const entry = { id: 'text-' + Date.now(), tool: 'text', color, lw, x1: x, y1: y, x2: x, y2: y, text: 'Text', fontSize: Math.max(18, lw * 5) };
        drawings.push(entry);
        beginTextEdit(entry);
        render();
      }
      textPlaceStart = null;
    }
    return;
  }
  if (current) {
    if (current.tool === 'step') { stepN++; current.n = stepN; }
    if (current.tool === 'step-rect') { stepRN++; current.n = stepRN; }
    if (current.tool === 'abc-arrow') { abcAN++; current.n = abcAN; }
    if (current.tool === 'abc-rect') { abcRN++; current.n = abcRN; }
    drawings.push(current);
    current = null;
  }
  dragging = false;
  render();
};

function render() {
  if (!img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  let sA = 0, sR = 0, aA = 0, aR = 0;
  drawings.forEach(d => {
    if (d.tool === 'step') { sA++; drawStep(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,sA); }
    else if (d.tool === 'step-rect') { sR++; drawStepR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,sR); }
    else if (d.tool === 'arrow') drawArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'line') drawLine(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'question-arrow') drawQArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'question-rect') drawQRect(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'exclamation-arrow') drawExArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'exclamation-rect') drawExRect(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'text') drawTextAnn(d);
    else if (d.tool === 'abc-arrow') { aA++; drawAbcArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,aA); }
    else if (d.tool === 'abc-rect') { aR++; drawAbcRect(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,aR); }
    else if (d.tool === 'circle') drawEllipse(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else if (d.tool === 'magnifier') drawMagnifier(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,d.zoom||2.0);
    else drawR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
  });
  if (current) {
    if (current.tool === 'step') drawStep(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepN+1);
    else if (current.tool === 'step-rect') drawStepR(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepRN+1);
    else if (current.tool === 'arrow') drawArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'line') drawLine(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'question-arrow') drawQArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'question-rect') drawQRect(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'exclamation-arrow') drawExArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'exclamation-rect') drawExRect(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'abc-arrow') drawAbcArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,abcAN+1);
    else if (current.tool === 'abc-rect') drawAbcRect(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,abcRN+1);
    else if (current.tool === 'circle') drawEllipse(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'magnifier') drawMagnifier(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,current.zoom||2.0);
    else drawR(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
  }
}

function drawArrow(x1,y1,x2,y2,c,w) {
  const hl=12+w*1.5, ha=Math.PI/9, a=Math.atan2(y2-y1,x2-x1);
  const bx=x2-hl*.8*Math.cos(a), by=y2-hl*.8*Math.sin(a);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(bx,by);
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.lineCap='round'; ctx.stroke();
  const p1x=x2-hl*Math.cos(a+ha), p1y=y2-hl*Math.sin(a+ha);
  const p2x=x2-hl*Math.cos(a-ha), p2y=y2-hl*Math.sin(a-ha);
  ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(p1x,p1y); ctx.lineTo(bx,by); ctx.lineTo(p2x,p2y);
  ctx.closePath(); ctx.fillStyle=c; ctx.fill();
}

function drawLine(x1,y1,x2,y2,c,w) {
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.lineCap='round'; ctx.stroke();
}

function circleLabel(x,y,c,w,label) {
  const r=Math.max(12,w*3);
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=c; ctx.fill();
  const fs = label.length > 1 ? r*0.9 : r*1.2;
  ctx.fillStyle='#fff'; ctx.font=`bold ${fs}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(label,x,y);
}

function drawStep(x1,y1,x2,y2,c,w,n) {
  drawArrow(x1,y1,x2,y2,c,w);
  circleLabel(x1,y1,c,w,n+'');
}

function drawR(x1,y1,x2,y2,c,w) {
  ctx.beginPath(); ctx.rect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.stroke();
}

function drawStepR(x1,y1,x2,y2,c,w,n) {
  drawR(x1,y1,x2,y2,c,w);
  circleLabel(Math.min(x1,x2),Math.min(y1,y2),c,w,n+'');
}

function drawQArrow(x1,y1,x2,y2,c,w) {
  drawArrow(x1,y1,x2,y2,c,w);
  circleLabel(x1,y1,c,w,'?');
}

function drawQRect(x1,y1,x2,y2,c,w) {
  drawR(x1,y1,x2,y2,c,w);
  circleLabel(Math.min(x1,x2),Math.min(y1,y2),c,w,'?');
}

function drawExArrow(x1,y1,x2,y2,c,w) {
  drawArrow(x1,y1,x2,y2,c,w);
  circleLabel(x1,y1,c,w,'!');
}
function drawExRect(x1,y1,x2,y2,c,w) {
  drawR(x1,y1,x2,y2,c,w);
  circleLabel(Math.min(x1,x2),Math.min(y1,y2),c,w,'!');
}
function drawTextAnn(d) {
  if (editingTextId === d.id) return;
  const fs = d.fontSize || 24;
  ctx.fillStyle = d.color;
  ctx.font = `600 ${fs}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.text || '', d.x1, d.y1);
}
function textHitAt(x,y) {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (d.tool !== 'text') continue;
    const fs = d.fontSize || 24;
    const w = Math.max(80, (d.text || '').length * fs * 0.55);
    const h = fs * 1.4;
    if (x >= d.x1 - w/2 && x <= d.x1 + w/2 && y >= d.y1 - h/2 && y <= d.y1 + h/2) return d;
  }
  return null;
}
function positionTextEditor(d) {
  if (!textEditor || !cachedRect) return;
  const left = cachedRect.left + d.x1 / scaleX;
  const top = cachedRect.top + d.y1 / scaleY;
  textEditor.style.left = left + 'px';
  textEditor.style.top = top + 'px';
  textEditor.style.transform = 'translate(-50%, -50%)';
  textEditor.style.color = d.color;
}
function beginTextEdit(d) {
  editingTextId = d.id;
  cachedRect = canvas.getBoundingClientRect();
  scaleX = canvas.width / cachedRect.width;
  scaleY = canvas.height / cachedRect.height;
  textEditor.classList.remove('text-editor-hidden');
  textEditor.value = d.text || '';
  positionTextEditor(d);
  textEditor.focus();
  textEditor.select();
}
function commitTextEdit() {
  if (!editingTextId) return;
  const idx = drawings.findIndex(d => d.id === editingTextId);
  if (idx < 0) { hideTextEditor(); return; }
  const trimmed = (textEditor.value || '').trim();
  if (!trimmed) drawings.splice(idx, 1);
  else drawings[idx].text = trimmed;
  hideTextEditor();
  render();
}
function hideTextEditor() {
  editingTextId = null;
  if (textEditor) { textEditor.classList.add('text-editor-hidden'); textEditor.blur(); }
}
if (textEditor) {
  textEditor.addEventListener('blur', () => commitTextEdit());
  textEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
  });
}

function drawAbcArrow(x1,y1,x2,y2,c,w,n) {
  drawArrow(x1,y1,x2,y2,c,w);
  circleLabel(x1,y1,c,w,letterLabel(n));
}

function drawAbcRect(x1,y1,x2,y2,c,w,n) {
  drawR(x1,y1,x2,y2,c,w);
  circleLabel(Math.min(x1,x2),Math.min(y1,y2),c,w,letterLabel(n));
}

function drawEllipse(x1,y1,x2,y2,c,w) {
  const cx=(x1+x2)/2, cy=(y1+y2)/2;
  const rx=Math.abs(x2-x1)/2, ry=Math.abs(y2-y1)/2;
  if (rx<1||ry<1) return;
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.lineCap='round'; ctx.stroke();
}

// Magnifier tool — draws a circular zoom lens showing magnified screenshot content
function drawMagnifier(x1,y1,x2,y2,c,w,zoom) {
  if (!img) return;
  const dx = x2 - x1, dy = y2 - y1;
  const radius = Math.sqrt(dx*dx + dy*dy);
  if (radius < 5) return;

  const centerX = x1, centerY = y1;
  // Account for image vs canvas size difference
  const scaleX = img.width / canvas.width;
  const scaleY = img.height / canvas.height;
  const imgCX = centerX * scaleX, imgCY = centerY * scaleY;
  const srcRX = (radius / zoom) * scaleX, srcRY = (radius / zoom) * scaleY;
  const srcX = Math.round(imgCX - srcRX), srcY = Math.round(imgCY - srcRY);
  const srcW = Math.round(srcRX * 2), srcH = Math.round(srcRY * 2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, srcX, srcY, srcW, srcH, centerX - radius, centerY - radius, radius * 2, radius * 2);
  ctx.restore();

  // Border ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = c;
  ctx.lineWidth = Math.max(3, w);
  ctx.stroke();

  // Crosshair
  const cs = 6;
  ctx.beginPath();
  ctx.moveTo(centerX - cs, centerY); ctx.lineTo(centerX + cs, centerY);
  ctx.moveTo(centerX, centerY - cs); ctx.lineTo(centerX, centerY + cs);
  ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
}

function saveAndDownload() {
  const link = document.createElement('a');
  link.download = `FeatherShot_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  const btn = document.getElementById('save');
  btn.textContent = '✓ Downloaded!';
  btn.style.background = '#30d158';
  setTimeout(() => { btn.textContent = '💾 Save & Download'; btn.style.background = ''; }, 1500);
}
