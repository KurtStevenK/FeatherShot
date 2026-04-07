const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
let tray = null, editorWindow = null, selectionWindows = [], globalBounds = null;
const windowData = new Map();
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
app.whenReady().then(() => { if (process.platform === 'darwin') app.dock.hide(); createTray(); setupIPC(); });

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray.setToolTip('FeatherShot');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Take Screenshot', click: () => startSelection() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
  tray.on('click', () => startSelection());
}

function setupIPC() {
  ipcMain.handle('sel-init-request', (event) => {
    try { const w = BrowserWindow.fromWebContents(event.sender); return w ? windowData.get(w.id) : null; } catch(e){ return null; }
  });
  ipcMain.on('sel-mouse', (event, data) => {
    for (const w of [...selectionWindows]) { try { if (w && !w.isDestroyed() && w.webContents) w.webContents.send('sel-update', data); } catch(e){} }
  });
  ipcMain.on('sel-done', async (event, crop) => {
    await closeWait();
    try {
      const cx = crop.x + crop.width/2, cy = crop.y + crop.height/2;
      let target = screen.getPrimaryDisplay();
      for (const d of screen.getAllDisplays()) { if (cx>=d.bounds.x && cx<d.bounds.x+d.bounds.width && cy>=d.bounds.y && cy<d.bounds.y+d.bounds.height) { target=d; break; } }
      const sf = target.scaleFactor||1;
      const sources = await desktopCapturer.getSources({ types:['screen'], thumbnailSize:{width:target.bounds.width*sf, height:target.bounds.height*sf} });
      let src = sources.find(s=>s.display_id===target.id.toString()) || sources[0];
      if (!src) return;
      const img=src.thumbnail, sz=img.getSize();
      const px=Math.max(0,Math.round((crop.x-target.bounds.x)*sf)), py=Math.max(0,Math.round((crop.y-target.bounds.y)*sf));
      const pw=Math.min(Math.round(crop.width*sf),sz.width-px), ph=Math.min(Math.round(crop.height*sf),sz.height-py);
      if (pw>0&&ph>0) openEditor(img.crop({x:px,y:py,width:pw,height:ph}));
    } catch(e){ console.error(e); }
  });
  ipcMain.on('sel-cancel', () => closeAll());
}

function closeAll() { windowData.clear(); const w=selectionWindows; selectionWindows=[]; for(const x of w){try{if(x&&!x.isDestroyed())x.close();}catch(e){}} }
function closeWait() { return new Promise(r=>{ windowData.clear(); const w=selectionWindows.filter(x=>x&&!x.isDestroyed()); selectionWindows=[]; if(!w.length)return setTimeout(r,150); let c=0; for(const x of w){x.on('closed',()=>{if(++c>=w.length)setTimeout(r,250);}); try{x.close();}catch(e){if(++c>=w.length)setTimeout(r,250);}} }); }

function startSelection() {
  closeAll();
  const displays=screen.getAllDisplays();
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  for(const d of displays){mnX=Math.min(mnX,d.bounds.x);mnY=Math.min(mnY,d.bounds.y);mxX=Math.max(mxX,d.bounds.x+d.bounds.width);mxY=Math.max(mxY,d.bounds.y+d.bounds.height);}
  globalBounds={minX:mnX,minY:mnY,maxX:mxX,maxY:mxY};
  const PAD=500;
  for(const display of displays){
    const wx=display.bounds.x-PAD, wy=display.bounds.y-PAD, ww=display.bounds.width+PAD*2, wh=display.bounds.height+PAD*2;
    const win=new BrowserWindow({x:wx,y:wy,width:ww,height:wh,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,movable:false,hasShadow:false,focusable:true,enableLargerThanScreen:true,fullscreenable:false,backgroundColor:'#00000000',webPreferences:{nodeIntegration:true,contextIsolation:false}});
    if(process.platform==='darwin')win.setSimpleFullScreen(true); else win.setAlwaysOnTop(true,'screen-saver');
    windowData.set(win.id,{windowOrigin:{x:wx,y:wy},displayBounds:display.bounds,globalBounds});
    win.loadFile(path.join(__dirname,'renderer','selection.html'));
    win.once('ready-to-show',()=>{if(!win.isDestroyed()){win.show();win.focus();}});
    win.on('closed',()=>{selectionWindows.splice(selectionWindows.indexOf(win),1);windowData.delete(win.id);});
    selectionWindows.push(win);
  }
}

function openEditor(screenshot) {
  if(editorWindow){try{editorWindow.close();}catch(e){}}
  const sz=screenshot.getSize(),wa=screen.getPrimaryDisplay().workAreaSize;
  editorWindow=new BrowserWindow({width:Math.min(Math.max(sz.width,700),wa.width-80),height:Math.min(Math.max(sz.height+80,400),wa.height-80),title:'FeatherShot Editor',icon:path.join(__dirname,'assets','icon.png'),webPreferences:{nodeIntegration:true,contextIsolation:false},show:false,autoHideMenuBar:true,resizable:true,minWidth:600,minHeight:360});
  const dataUrl=screenshot.toDataURL();
  editorWindow.loadFile(path.join(__dirname,'renderer','index.html'));
  ipcMain.handleOnce('editor-screenshot-request',()=>dataUrl);
  editorWindow.on('closed',()=>{editorWindow=null;});
}

app.on('window-all-closed',(e)=>e.preventDefault());
