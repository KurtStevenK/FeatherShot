const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = null, tool = 'arrow', color = '#FF3B30', lw = 4;
let drawings = [], current = null, dragging = false, stepN = 0;

// Load screenshot
chrome.storage.local.get('screenshotData', (data) => {
  if (!data.screenshotData) return;
  const i = new Image();
  i.onload = () => { img = i; canvas.width = i.width; canvas.height = i.height; render(); };
  i.src = data.screenshotData;
  chrome.storage.local.remove('screenshotData');
});

// Tools
document.getElementById('tool-arrow').onclick = () => setTool('arrow');
document.getElementById('tool-step').onclick = () => setTool('step');
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
    render();
  }
};
document.getElementById('clear').onclick = () => { drawings = []; stepN = 0; render(); };
document.getElementById('save').onclick = saveAndDownload;

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const id = t === 'step' ? 'tool-step' : t === 'rect' ? 'tool-rect' : 'tool-arrow';
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
  let s = 0;
  drawings.forEach(d => {
    if (d.tool === 'step') { s++; drawStep(d.x1,d.y1,d.x2,d.y2,d.color,d.lw,s); }
    else if (d.tool === 'arrow') drawArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
    else drawR(d.x1,d.y1,d.x2,d.y2,d.color,d.lw);
  });
  if (current) {
    if (current.tool === 'step') drawStep(current.x1,current.y1,current.x2,current.y2,current.color,current.lw,stepN+1);
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
