const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = null, tool = 'step', color = '#FF3B30', lw = 4;
let drawings = [], current = null, dragging = false, stepN = 0, stepRN = 0;

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

// Tools (order: step arrow, step rect, arrow, rect)
document.getElementById('tool-step').onclick = () => setTool('step');
document.getElementById('tool-step-rect').onclick = () => setTool('step-rect');
document.getElementById('tool-arrow').onclick = () => setTool('arrow');
document.getElementById('tool-rect').onclick = () => setTool('rect');

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
    render();
  }
};
document.getElementById('clear').onclick = () => { drawings = []; stepN = 0; stepRN = 0; render(); };
document.getElementById('save').onclick = saveAndDownload;

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const id = t === 'step' ? 'tool-step' : t === 'step-rect' ? 'tool-step-rect' : t === 'rect' ? 'tool-rect' : 'tool-arrow';
  document.getElementById(id).classList.add('active');
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
  let sA = 0, sR = 0;
  drawings.forEach(d => {
    if (d.tool === 'step') { sA++; drawStep(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,sA); }
    else if (d.tool === 'step-rect') { sR++; drawStepR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,sR); }
    else if (d.tool === 'arrow') drawArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else drawR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
  });
  if (current) {
    if (current.tool === 'step') drawStep(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepN+1);
    else if (current.tool === 'step-rect') drawStepR(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepRN+1);
    else if (current.tool === 'arrow') drawArrow(current.x1,current.y1,current.x2,current.y2,current.color,current.lw);
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

function drawStep(x1,y1,x2,y2,c,w,n) {
  drawArrow(x1,y1,x2,y2,c,w);
  const r=Math.max(12,w*3);
  ctx.beginPath(); ctx.arc(x1,y1,r,0,Math.PI*2); ctx.fillStyle=c; ctx.fill();
  ctx.fillStyle='#fff'; ctx.font=`bold ${r*1.2}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(n+'',x1,y1);
}

function drawR(x1,y1,x2,y2,c,w) {
  ctx.beginPath(); ctx.rect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.stroke();
}

function drawStepR(x1,y1,x2,y2,c,w,n) {
  drawR(x1,y1,x2,y2,c,w);
  const r=Math.max(12,w*3);
  const cx=Math.min(x1,x2), cy=Math.min(y1,y2);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=c; ctx.fill();
  ctx.fillStyle='#fff'; ctx.font=`bold ${r*1.2}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(n+'',cx,cy);
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
