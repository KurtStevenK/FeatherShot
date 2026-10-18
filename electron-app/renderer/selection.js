const { ipcRenderer } = require('electron');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');
const instructions = document.getElementById('instructions');
let displayBounds=null, globalBounds=null, preview=null;
let selecting=false, gsx=0,gsy=0,gex=0,gey=0;
// True between this window's own pointerdown and the release it reported to the main process.
let dragging=false;

function note(...parts){ try{ ipcRenderer.send('sel-log', ...parts); }catch(e){} }

(async()=>{
  const data = await ipcRenderer.invoke('sel-init-request');
  if(!data)return;
  displayBounds=data.displayBounds;
  globalBounds=data.globalBounds;
  setupCanvas(); render();
  // The overlay shows the frozen capture of this display; the selection is cropped from the same image.
  if(data.preview){
    const img=new Image();
    img.onload=()=>{preview=img;render();};
    img.src=data.preview;
  }
})();

function setupCanvas(){
  const dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(window.innerWidth*dpr);
  canvas.height=Math.round(window.innerHeight*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',()=>{setupCanvas();render();});

// The main process mirrors every drag to all overlays and finishes the selection on 'up' itself.
ipcRenderer.on('sel-update',(event,data)=>{
  if(data.type==='down'){selecting=true;if(instructions)instructions.style.display='none';gsx=gex=data.gx;gsy=gey=data.gy;render();}
  else if(data.type==='move'&&selecting){gex=data.gx;gey=data.gy;render();showDim(data.gx,data.gy);}
  else if(data.type==='up'&&selecting){selecting=false;gex=data.gx;gey=data.gy;dimLabel.style.display='none';render();}
});

function globalPoint(e){ return {gx:displayBounds.x+e.clientX, gy:displayBounds.y+e.clientY}; }

// Reports the release once. Windows does not always deliver pointerup to a capturing canvas, so the
// release is also taken from a document-level mouseup, or from the first pointer event after the
// buttons went up; `via` says which path fired, for the log.
function sendUp(point, via){
  if(!dragging)return;
  dragging=false;
  ipcRenderer.send('sel-mouse',{type:'up',gx:point.gx,gy:point.gy,via});
}

canvas.addEventListener('pointerdown',(e)=>{
  if(!displayBounds||e.button!==0)return;
  try{canvas.setPointerCapture(e.pointerId);}catch(err){note('setPointerCapture failed:',String(err));}
  dragging=true;
  ipcRenderer.send('sel-mouse',{type:'down',...globalPoint(e)});
});
canvas.addEventListener('pointermove',(e)=>{
  if(!dragging)return;
  if(e.buttons===0){sendUp(globalPoint(e),'pointermove without buttons');return;}
  ipcRenderer.send('sel-mouse',{type:'move',...globalPoint(e)});
});
canvas.addEventListener('pointerup',(e)=>{
  try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
  sendUp(globalPoint(e),'pointerup');
});
canvas.addEventListener('pointercancel',(e)=>{ if(dragging)note('pointercancel while dragging'); });
canvas.addEventListener('lostpointercapture',(e)=>{ if(dragging)note('lostpointercapture while dragging'); });
document.addEventListener('mouseup',(e)=>{ if(dragging)sendUp({gx:displayBounds.x+e.clientX,gy:displayBounds.y+e.clientY},'document mouseup'); },true);
window.addEventListener('blur',()=>{ if(dragging)note('window blur while dragging'); });
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')ipcRenderer.send('sel-cancel');});

// Draws the part of the frozen capture under the window rect (x, y, w, h) in CSS pixels.
function drawPreview(x,y,w,h){
  if(!preview){ctx.fillStyle='#000';ctx.fillRect(x,y,w,h);return;}
  const W=window.innerWidth,H=window.innerHeight;
  const rx=preview.width/W,ry=preview.height/H;
  ctx.drawImage(preview,x*rx,y*ry,w*rx,h*ry,x,y,w,h);
}

function render(){
  if(!displayBounds)return;
  const W=window.innerWidth,H=window.innerHeight;
  const dpr=window.devicePixelRatio||1;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawPreview(0,0,W,H);
  // Dim the frozen capture; the selection shows it undimmed.
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,W,H);
  if(!selecting)return;
  const sx=Math.min(gsx,gex),sy=Math.min(gsy,gey),sw=Math.abs(gex-gsx),sh=Math.abs(gey-gsy);
  const lx=sx-displayBounds.x,ly=sy-displayBounds.y;
  const cx=Math.max(0,lx),cy=Math.max(0,ly),cr=Math.min(W,lx+sw),cb=Math.min(H,ly+sh);
  if(cr>cx&&cb>cy){
    drawPreview(cx,cy,cr-cx,cb-cy);
    ctx.strokeStyle='#0a84ff';ctx.lineWidth=2;ctx.setLineDash([6,3]);
    ctx.strokeRect(lx,ly,sw,sh);ctx.setLineDash([]);
  }
}

function showDim(gx,gy){
  const lx=gx-displayBounds.x,ly=gy-displayBounds.y;
  if(lx<0||lx>window.innerWidth||ly<0||ly>window.innerHeight){dimLabel.style.display='none';return;}
  dimLabel.textContent=`${Math.round(Math.abs(gex-gsx))} × ${Math.round(Math.abs(gey-gsy))}`;
  dimLabel.style.display='block';dimLabel.style.left=(lx+14)+'px';dimLabel.style.top=(ly+14)+'px';
}
