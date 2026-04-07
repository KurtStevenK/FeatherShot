const { ipcRenderer } = require('electron');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dimLabel = document.getElementById('dimensions');
const instructions = document.getElementById('instructions');
let windowOrigin=null, displayBounds=null, globalBounds=null;
let selecting=false, gsx=0,gsy=0,gex=0,gey=0;

// Pull init data from main (safe, no did-finish-load race)
(async()=>{
  const data = await ipcRenderer.invoke('sel-init-request');
  if(!data)return;
  windowOrigin=data.windowOrigin;
  displayBounds=data.displayBounds;
  globalBounds=data.globalBounds;
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  render();
})();
window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;render();});

ipcRenderer.on('sel-update',(event,data)=>{
  if(data.type==='down'){selecting=true;if(instructions)instructions.style.display='none';gsx=gex=data.gx;gsy=gey=data.gy;}
  else if(data.type==='move'&&selecting){gex=data.gx;gey=data.gy;render();showDim(data.gx,data.gy);}
  else if(data.type==='up'&&selecting){selecting=false;gex=data.gx;gey=data.gy;dimLabel.style.display='none';
    const x=Math.min(gsx,gex),y=Math.min(gsy,gey),w=Math.abs(gex-gsx),h=Math.abs(gey-gsy);
    if(w>=10&&h>=10)ipcRenderer.send('sel-done',{x,y,width:w,height:h});}
});

// Pointer capture = cross-monitor dragging
canvas.addEventListener('pointerdown',(e)=>{
  canvas.setPointerCapture(e.pointerId);
  ipcRenderer.send('sel-mouse',{type:'down',gx:windowOrigin.x+e.clientX,gy:windowOrigin.y+e.clientY});
});
canvas.addEventListener('pointermove',(e)=>{
  if(!selecting)return;
  ipcRenderer.send('sel-mouse',{type:'move',gx:windowOrigin.x+e.clientX,gy:windowOrigin.y+e.clientY});
});
canvas.addEventListener('pointerup',(e)=>{
  if(!selecting)return;
  canvas.releasePointerCapture(e.pointerId);
  ipcRenderer.send('sel-mouse',{type:'up',gx:windowOrigin.x+e.clientX,gy:windowOrigin.y+e.clientY});
});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')ipcRenderer.send('sel-cancel');});

function render(){
  if(!windowOrigin)return;
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,W,H);
  if(!selecting&&gsx===gex)return;
  const sx=Math.min(gsx,gex),sy=Math.min(gsy,gey),sw=Math.abs(gex-gsx),sh=Math.abs(gey-gsy);
  const lx=sx-windowOrigin.x,ly=sy-windowOrigin.y;
  const cx=Math.max(0,lx),cy=Math.max(0,ly),cr=Math.min(W,lx+sw),cb=Math.min(H,ly+sh);
  if(cr>cx&&cb>cy){
    ctx.clearRect(cx,cy,cr-cx,cb-cy);
    ctx.strokeStyle='#0a84ff';ctx.lineWidth=2;ctx.setLineDash([6,3]);
    ctx.strokeRect(lx,ly,sw,sh);ctx.setLineDash([]);
  }
}

function showDim(gx,gy){
  const lx=gx-windowOrigin.x,ly=gy-windowOrigin.y;
  if(lx<0||lx>canvas.width||ly<0||ly>canvas.height){dimLabel.style.display='none';return;}
  dimLabel.textContent=`${Math.round(Math.abs(gex-gsx))} × ${Math.round(Math.abs(gey-gsy))}`;
  dimLabel.style.display='block';dimLabel.style.left=(lx+14)+'px';dimLabel.style.top=(ly+14)+'px';
}
