const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
let tray=null, editorWindow=null, selectionWindows=[], globalBounds=null;
const windowData = new Map();
let displayCaptures = [];
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
  ipcMain.on('sel-done',(event,crop)=>{
    closeAll();
    // Crop from stored per-display capture (no post-capture needed)
    const cx=crop.x+crop.width/2, cy=crop.y+crop.height/2;
    let target=displayCaptures[0];
    for(const dc of displayCaptures){
      if(cx>=dc.bounds.x&&cx<dc.bounds.x+dc.bounds.width&&cy>=dc.bounds.y&&cy<dc.bounds.y+dc.bounds.height){target=dc;break;}
    }
    if(!target)return;
    const sf=target.scaleFactor, sz=target.thumbnail.getSize();
    const px=Math.max(0,Math.round((crop.x-target.bounds.x)*sf));
    const py=Math.max(0,Math.round((crop.y-target.bounds.y)*sf));
    const pw=Math.min(Math.round(crop.width*sf),sz.width-px);
    const ph=Math.min(Math.round(crop.height*sf),sz.height-py);
    if(pw>0&&ph>0) openEditor(target.thumbnail.crop({x:px,y:py,width:pw,height:ph}));
    displayCaptures=[];
  });
  ipcMain.on('sel-cancel',()=>{closeAll();displayCaptures=[];});
}

function closeAll(){windowData.clear();const w=selectionWindows;selectionWindows=[];for(const x of w){try{if(x&&!x.isDestroyed())x.close();}catch(e){}}}

async function startSelection() {
  closeAll();
  const displays=screen.getAllDisplays();
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  for(const d of displays){mnX=Math.min(mnX,d.bounds.x);mnY=Math.min(mnY,d.bounds.y);mxX=Math.max(mxX,d.bounds.x+d.bounds.width);mxY=Math.max(mxY,d.bounds.y+d.bounds.height);}
  globalBounds={minX:mnX,minY:mnY,maxX:mxX,maxY:mxY};

  // Capture each display individually (fast, no compositing)
  let maxPW=0,maxPH=0;
  for(const d of displays){const sf=d.scaleFactor||1;maxPW=Math.max(maxPW,d.bounds.width*sf);maxPH=Math.max(maxPH,d.bounds.height*sf);}
  const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:maxPW,height:maxPH}});
  displayCaptures=[];
  const captureUrls=new Map();

  for(const display of displays){
    const sf=display.scaleFactor||1;
    let src=sources.find(s=>s.display_id===display.id.toString());
    if(!src){const i=displays.indexOf(display);src=sources[i<sources.length?i:0];}
    if(src){
      displayCaptures.push({thumbnail:src.thumbnail,bounds:display.bounds,scaleFactor:sf});
      captureUrls.set(display.id,src.thumbnail.toDataURL());
    }
  }

  // Create one OPAQUE window per display (no transparency = no rendering bugs)
  for(const display of displays){
    const win=new BrowserWindow({
      x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,
      frame:false,transparent:false,alwaysOnTop:true,skipTaskbar:true,
      resizable:false,movable:false,hasShadow:false,focusable:true,
      enableLargerThanScreen:true,fullscreenable:false,
      backgroundColor:'#000000',show:false,
      webPreferences:{nodeIntegration:true,contextIsolation:false}
    });
    if(process.platform==='darwin')win.setSimpleFullScreen(true);
    else win.setAlwaysOnTop(true,'screen-saver');

    windowData.set(win.id,{
      displayBounds:display.bounds,globalBounds,
      screenshotDataUrl:captureUrls.get(display.id)||null
    });
    win.loadFile(path.join(__dirname,'renderer','selection.html'));
    win.once('ready-to-show',()=>{if(!win.isDestroyed()){win.show();win.focus();}});
    win.on('closed',()=>{selectionWindows.splice(selectionWindows.indexOf(win),1);windowData.delete(win.id);});
    selectionWindows.push(win);
  }
}

function openEditor(screenshot) {
  if(editorWindow){try{editorWindow.close();}catch(e){}}
  const sz=screenshot.getSize(),wa=screen.getPrimaryDisplay().workAreaSize;
  editorWindow=new BrowserWindow({
    width:Math.min(Math.max(sz.width,700),wa.width-80),
    height:Math.min(Math.max(sz.height+80,400),wa.height-80),
    title:'FeatherShot Editor',icon:path.join(__dirname,'assets','icon.png'),
    webPreferences:{nodeIntegration:true,contextIsolation:false},
    show:false,autoHideMenuBar:true,resizable:true,minWidth:600,minHeight:360
  });
  const dataUrl=screenshot.toDataURL();
  editorWindow.loadFile(path.join(__dirname,'renderer','index.html'));
  ipcMain.handleOnce('editor-screenshot-request',()=>dataUrl);
  editorWindow.once('ready-to-show',()=>{if(!editorWindow.isDestroyed()){editorWindow.show();editorWindow.focus();}});
  editorWindow.on('closed',()=>{editorWindow=null;});
}

app.on('window-all-closed',(e)=>e.preventDefault());
