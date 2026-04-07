const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, ipcMain } = require('electron');
const path = require('path');
let tray=null, editorWindow=null, selectionWindows=[], globalBounds=null;
const windowData = new Map();
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
app.whenReady().then(()=>{ if(process.platform==='darwin')app.dock.hide(); createTray(); setupIPC(); });

function createTray() {
  tray = new Tray(path.join(__dirname,'assets','tray-icon.png'));
  tray.setToolTip('FeatherShot');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Take Screenshot',click:()=>startSelection()},{type:'separator'},
    {label:'Quit',click:()=>app.quit()}
  ]));
  tray.on('click',()=>startSelection());
}

function setupIPC() {
  ipcMain.handle('sel-init-request',(event)=>{
    try{const w=BrowserWindow.fromWebContents(event.sender);return w?windowData.get(w.id):null;}catch(e){return null;}
  });
  ipcMain.on('sel-mouse',(event,data)=>{
    for(const w of [...selectionWindows]){try{if(w&&!w.isDestroyed()&&w.webContents)w.webContents.send('sel-update',data);}catch(e){}}
  });
  ipcMain.on('sel-done', async(event,crop)=>{
    await closeAndWait();
    try {
      // Capture all displays, find which overlap with the selection
      const displays = screen.getAllDisplays();
      let maxPW=0,maxPH=0;
      for(const d of displays){const sf=d.scaleFactor||1;maxPW=Math.max(maxPW,d.bounds.width*sf);maxPH=Math.max(maxPH,d.bounds.height*sf);}
      const sources = await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:maxPW,height:maxPH}});

      const overlaps = [];
      for(const d of displays){
        const ox1=Math.max(crop.x,d.bounds.x),oy1=Math.max(crop.y,d.bounds.y);
        const ox2=Math.min(crop.x+crop.width,d.bounds.x+d.bounds.width);
        const oy2=Math.min(crop.y+crop.height,d.bounds.y+d.bounds.height);
        if(ox2>ox1&&oy2>oy1){
          let src=sources.find(s=>s.display_id===d.id.toString());
          if(!src){const i=displays.indexOf(d);src=sources[i<sources.length?i:0];}
          if(src) overlaps.push({display:d,thumbnail:src.thumbnail,ox1,oy1,ox2,oy2});
        }
      }
      if(overlaps.length===0) return;

      if(overlaps.length===1){
        // Single display — simple crop
        const o=overlaps[0], sf=o.display.scaleFactor||1, sz=o.thumbnail.getSize();
        const px=Math.max(0,Math.round((crop.x-o.display.bounds.x)*sf));
        const py=Math.max(0,Math.round((crop.y-o.display.bounds.y)*sf));
        const pw=Math.min(Math.round(crop.width*sf),sz.width-px);
        const ph=Math.min(Math.round(crop.height*sf),sz.height-py);
        if(pw>0&&ph>0) openEditor(o.thumbnail.crop({x:px,y:py,width:pw,height:ph}).toDataURL());
      } else {
        // Multi-display — send pieces to editor for compositing
        const primarySF = screen.getPrimaryDisplay().scaleFactor||1;
        const pieces = [];
        for(const o of overlaps){
          const sf=o.display.scaleFactor||1, sz=o.thumbnail.getSize();
          const sx=Math.max(0,Math.round((o.ox1-o.display.bounds.x)*sf));
          const sy=Math.max(0,Math.round((o.oy1-o.display.bounds.y)*sf));
          const sw=Math.min(Math.round((o.ox2-o.ox1)*sf),sz.width-sx);
          const sh=Math.min(Math.round((o.oy2-o.oy1)*sf),sz.height-sy);
          if(sw>0&&sh>0){
            const piece=o.thumbnail.crop({x:sx,y:sy,width:sw,height:sh});
            pieces.push({
              dataUrl:piece.toDataURL(),
              destX:Math.round((o.ox1-crop.x)*primarySF),
              destY:Math.round((o.oy1-crop.y)*primarySF),
              destW:Math.round((o.ox2-o.ox1)*primarySF),
              destH:Math.round((o.oy2-o.oy1)*primarySF)
            });
          }
        }
        openEditor({type:'composite',width:Math.round(crop.width*primarySF),height:Math.round(crop.height*primarySF),pieces});
      }
    } catch(e){ console.error('Capture failed:',e); }
  });
  ipcMain.on('sel-cancel',()=>closeAll());
}

function closeAll(){windowData.clear();const w=selectionWindows;selectionWindows=[];for(const x of w){try{if(x&&!x.isDestroyed()){if(x.isFullScreen())x.setFullScreen(false);x.close();}}catch(e){}}}
function closeAndWait(){return new Promise(r=>{const w=selectionWindows.filter(x=>x&&!x.isDestroyed());selectionWindows=[];windowData.clear();if(!w.length)return setTimeout(r,150);let done=false;const finish=()=>{if(done)return;done=true;setTimeout(r,300);};let c=0;for(const x of w){x.on('closed',()=>{if(++c>=w.length)finish();});try{if(x.isFullScreen())x.setFullScreen(false);x.close();}catch(e){if(++c>=w.length)finish();}}setTimeout(finish,2000);});}

function startSelection() {
  closeAll();
  const displays=screen.getAllDisplays();
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  for(const d of displays){mnX=Math.min(mnX,d.bounds.x);mnY=Math.min(mnY,d.bounds.y);mxX=Math.max(mxX,d.bounds.x+d.bounds.width);mxY=Math.max(mxY,d.bounds.y+d.bounds.height);}
  globalBounds={minX:mnX,minY:mnY,maxX:mxX,maxY:mxY};

  for(const display of displays){
    const win=new BrowserWindow({
      x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,
      frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,
      resizable:false,movable:false,hasShadow:false,focusable:true,
      fullscreenable:true,backgroundColor:'#00000000',show:false,
      webPreferences:{nodeIntegration:true,contextIsolation:false}
    });
    windowData.set(win.id,{displayBounds:display.bounds,globalBounds});
    win.loadFile(path.join(__dirname,'renderer','selection.html'));
    win.once('ready-to-show',()=>{
      if(win.isDestroyed()) return;
      if(process.platform==='darwin') win.setSimpleFullScreen(true);
      else win.setFullScreen(true);
      win.setAlwaysOnTop(true,'screen-saver');
      win.show(); win.focus();
    });
    win.on('closed',()=>{selectionWindows.splice(selectionWindows.indexOf(win),1);windowData.delete(win.id);});
    selectionWindows.push(win);
  }
}

function openEditor(screenshotData) {
  if(editorWindow){try{editorWindow.close();}catch(e){}}
  const wa=screen.getPrimaryDisplay().workAreaSize;
  let w=700,h=400;
  if(typeof screenshotData==='string'){
    const img=nativeImage.createFromDataURL(screenshotData);
    const sz=img.getSize(); w=Math.min(Math.max(sz.width,700),wa.width-80); h=Math.min(Math.max(sz.height+80,400),wa.height-80);
  } else { w=Math.min(Math.max(screenshotData.width,700),wa.width-80); h=Math.min(Math.max(screenshotData.height+80,400),wa.height-80); }
  editorWindow=new BrowserWindow({width:w,height:h,title:'FeatherShot Editor',icon:path.join(__dirname,'assets','icon.png'),
    webPreferences:{nodeIntegration:true,contextIsolation:false},show:false,autoHideMenuBar:true,resizable:true,minWidth:600,minHeight:360});
  // Clear any stale handler, then register fresh one
  try{ipcMain.removeHandler('editor-screenshot-request');}catch(e){}
  ipcMain.handleOnce('editor-screenshot-request',()=>screenshotData);
  editorWindow.loadFile(path.join(__dirname,'renderer','index.html'));
  // Show via ready-to-show AND did-finish-load (belt and suspenders)
  editorWindow.once('ready-to-show',()=>{if(editorWindow&&!editorWindow.isDestroyed()){editorWindow.show();editorWindow.focus();}});
  editorWindow.webContents.once('did-finish-load',()=>{if(editorWindow&&!editorWindow.isDestroyed()&&!editorWindow.isVisible()){editorWindow.show();editorWindow.focus();}});
  editorWindow.on('closed',()=>{editorWindow=null;});
}

app.on('window-all-closed',(e)=>e.preventDefault());
