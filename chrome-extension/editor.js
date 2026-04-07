const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = null, tool = 'step', color = '#FF3B30', lw = 4;
let drawings = [], current = null, dragging = false, stepN = 0, stepRN = 0, abcAN = 0, abcRN = 0;

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

// Tools (order: step arrow, step rect, arrow, rect, line, question arrow, question rect, abc arrow, abc rect)
document.getElementById('tool-step').onclick = () => setTool('step');
document.getElementById('tool-step-rect').onclick = () => setTool('step-rect');
document.getElementById('tool-arrow').onclick = () => setTool('arrow');
document.getElementById('tool-rect').onclick = () => setTool('rect');
document.getElementById('tool-line').onclick = () => setTool('line');
document.getElementById('tool-question-arrow').onclick = () => setTool('question-arrow');
document.getElementById('tool-question-rect').onclick = () => setTool('question-rect');
document.getElementById('tool-abc-arrow').onclick = () => setTool('abc-arrow');
document.getElementById('tool-abc-rect').onclick = () => setTool('abc-rect');

document.getElementById('color').oninput = (e) => { color = e.target.value; };
document.getElementById('width').oninput = (e) => {
  lw = +e.target.value;
  document.getElementById('w-label').textContent = lw + 'px';
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
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const idMap = {
    'step': 'tool-step', 'step-rect': 'tool-step-rect',
    'arrow': 'tool-arrow', 'rect': 'tool-rect', 'line': 'tool-line',
    'question-arrow': 'tool-question-arrow', 'question-rect': 'tool-question-rect',
    'abc-arrow': 'tool-abc-arrow', 'abc-rect': 'tool-abc-rect'
  };
  document.getElementById(idMap[t]).classList.add('active');
}

canvas.onmousedown = (e) => {
  dragging = true;
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  current = { tool, color, lw, x1: (e.clientX-r.left)*sx, y1: (e.clientY-r.top)*sy, x2: 0, y2: 0 };
};
canvas.onmousemove = (e) => {
  if (!dragging || !current) return;
  const r = canvas.getBoundingClientRect();
  current.x2 = (e.clientX-r.left)*(canvas.width/r.width);
  current.y2 = (e.clientY-r.top)*(canvas.height/r.height);
  render();
};
canvas.onmouseup = () => {
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
    else if (d.tool === 'abc-arrow') { aA++; drawAbcArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,aA); }
    else if (d.tool === 'abc-rect') { aR++; drawAbcRect(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,aR); }
    else drawR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
  });
  if (current) {
    if (current.tool === 'step') drawStep(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepN+1);
    else if (current.tool === 'step-rect') drawStepR(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepRN+1);
    else if (current.tool === 'arrow') drawArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'line') drawLine(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'question-arrow') drawQArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'question-rect') drawQRect(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
    else if (current.tool === 'abc-arrow') drawAbcArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,abcAN+1);
    else if (current.tool === 'abc-rect') drawAbcRect(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,abcRN+1);
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

function drawAbcArrow(x1,y1,x2,y2,c,w,n) {
  drawArrow(x1,y1,x2,y2,c,w);
  circleLabel(x1,y1,c,w,letterLabel(n));
}

function drawAbcRect(x1,y1,x2,y2,c,w,n) {
  drawR(x1,y1,x2,y2,c,w);
  circleLabel(Math.min(x1,x2),Math.min(y1,y2),c,w,letterLabel(n));
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
