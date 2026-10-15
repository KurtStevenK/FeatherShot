const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  screen,
  desktopCapturer,
  nativeImage,
  ipcMain,
  session,
  globalShortcut,
  clipboard,
  ClipboardItem,
  dialog,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { initUpdater, checkForUpdatesInteractive } = require('./updater');
const { buildScreenshotFromCrop } = require('./capture');
const { saveAndCopy, defaultFileName } = require('./save-and-copy');
let tray=null, editorWindow=null, selectionWindows=[], globalBounds=null;
const windowData = new Map();
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (selectionWindows.length > 0) {
      const win = selectionWindows.find((w) => w && !w.isDestroyed());
      if (win) {
        win.show();
        win.focus();
      }
      return;
    }
    if (editorWindow && !editorWindow.isDestroyed()) {
      editorWindow.show();
      editorWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!gotTheLock) return;
  if (process.platform === 'darwin') app.dock.hide();
  setupSecurity();
  initUpdater(refreshTrayMenu);
  createTray();
  setupIPC();
});

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Take Screenshot', click: () => startSelection() },
    { type: 'separator' },
    { label: 'Check for Updates…', click: () => checkForUpdatesInteractive() },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function refreshTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(path.join(__dirname,'assets','tray-icon.png'));
  tray.setToolTip('FeatherShot');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click',()=>startSelection());
}

function setupIPC() {
  ipcMain.handle('sel-init-request',(event)=>{
    try{const w=BrowserWindow.fromWebContents(event.sender);return w?windowData.get(w.id):null;}catch(e){return null;}
  });
  ipcMain.on('sel-mouse',(event,data)=>{
    for(const w of [...selectionWindows]){try{if(w&&!w.isDestroyed()&&w.webContents)w.webContents.send('sel-update',data);}catch(e){}}
  });

  ipcMain.on('sel-done', async (event, crop) => {
    closeAll();
    try {
      const displays = screen.getAllDisplays();
      const payload = await buildScreenshotFromCrop(crop, displays, desktopCapturer);
      if (payload) openEditor(payload);
      else reportCaptureFailure('No screen image was returned for the selected area.', crop, displays);
    } catch (e) {
      console.error('Capture failed:', e);
      reportCaptureFailure(e instanceof Error ? e.message : String(e), crop, displays);
    }
  });
  ipcMain.on('sel-cancel', () => cancelSelection());

  // Returns { ok } — ok closes the editor; on any failure it stays open so annotations are not lost.
  ipcMain.handle('save-and-copy', async (event, pngBytes) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await saveAndCopy(pngBytes, {
        downloadsDir: () => app.getPath('downloads'),
        clipboard,
        ClipboardItem,
      });
      if (result.saveError) {
        console.error('Save to Downloads failed:', result.saveError);
        const savedAs = await offerSaveAs(win, result);
        return { ok: savedAs };
      }
      if (result.copyError) {
        console.error('Copy to clipboard failed:', result.copyError);
        await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'FeatherShot',
          message: 'Could not copy to the clipboard',
          detail: `${result.copyError}\n\nThe screenshot was saved as ${path.basename(result.filePath)} in Downloads.`,
        });
        return { ok: false };
      }
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      console.error('Save & Copy failed:', e);
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'FeatherShot',
        message: 'Save & Copy failed',
        detail: e instanceof Error ? e.message : String(e),
      });
      return { ok: false };
    }
  });
}

async function offerSaveAs(win, result) {
  const copyNote = result.copyError
    ? `It could not be copied to the clipboard either: ${result.copyError}`
    : 'The screenshot was copied to the clipboard.';
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'FeatherShot',
    message: 'Could not save to Downloads',
    detail: `${result.saveError}\n\n${copyNote}`,
    buttons: ['Save As…', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return false;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultFileName(new Date()),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return false;
  try {
    await fs.promises.writeFile(filePath, result.buffer);
    return true;
  } catch (e) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'FeatherShot',
      message: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

function reportCaptureFailure(reason, crop, displays) {
  const layout = displays.map((d) => `${d.id}: ${JSON.stringify(d.bounds)} x${d.scaleFactor}`).join('\n');
  dialog.showErrorBox(
    'FeatherShot could not capture the screenshot',
    `${reason}\n\nSelection: ${JSON.stringify(crop)}\nDisplays:\n${layout}`
  );
}

function cancelSelection() {
  closeAll();
}

function registerSelectionEscapeShortcut() {
  if (globalShortcut.isRegistered('Escape')) return;
  globalShortcut.register('Escape', () => cancelSelection());
}

function unregisterSelectionEscapeShortcut() {
  if (globalShortcut.isRegistered('Escape')) {
    globalShortcut.unregister('Escape');
  }
}

function closeAll() {
  unregisterSelectionEscapeShortcut();
  windowData.clear();
  const w = selectionWindows;
  selectionWindows = [];
  for (const x of w) {
    try {
      if (x && !x.isDestroyed()) {
        if (x.isFullScreen()) x.setFullScreen(false);
        x.close();
      }
    } catch (e) {}
  }
}

function startSelection() {
  closeAll();
  const displays=screen.getAllDisplays();
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  for(const d of displays){mnX=Math.min(mnX,d.bounds.x);mnY=Math.min(mnY,d.bounds.y);mxX=Math.max(mxX,d.bounds.x+d.bounds.width);mxY=Math.max(mxY,d.bounds.y+d.bounds.height);}
  globalBounds={minX:mnX,minY:mnY,maxX:mxX,maxY:mxY};

  // Overlays first; capture only overlapped displays after selection (see capture.js)
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
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      if (process.platform === 'darwin') {
        win.setSimpleFullScreen(true);
      }
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.show();
      win.focus();
      if (process.platform === 'win32') {
        // Windows can clamp a new window to the work area; pin it to the full display and
        // raise it above the taskbar, which is topmost too.
        win.setBounds(display.bounds);
        win.moveTop();
      }
    });
    win.on('closed', () => {
      selectionWindows.splice(selectionWindows.indexOf(win), 1);
      windowData.delete(win.id);
      if (selectionWindows.length === 0) unregisterSelectionEscapeShortcut();
    });
    selectionWindows.push(win);
  }
  registerSelectionEscapeShortcut();
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
  editorWindow.loadFile(path.join(__dirname,'renderer','index.html'));

  // Simple, reliable: send data after page loads, then show window
  editorWindow.webContents.once('did-finish-load',()=>{
    if(!editorWindow||editorWindow.isDestroyed()) return;
    editorWindow.webContents.send('load-screenshot', screenshotData);
    editorWindow.show();
    editorWindow.focus();
  });
  editorWindow.on('closed',()=>{editorWindow=null;});
}

function setupSecurity() {
  // Deny all permission requests (camera, microphone, etc.)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(false));
  app.on('session-created', (session) => {
    session.setPermissionRequestHandler((webContents, permission, callback) => callback(false));
  });

  // Harden webContents (block unauthorized navigation and window creation)
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol !== 'file:') {
        console.warn('Blocked unauthorized navigation to:', navigationUrl);
        event.preventDefault();
      }
    });

    contents.setWindowOpenHandler(() => {
      console.warn('Blocked unauthorized window creation');
      return { action: 'deny' };
    });

    // Block attachment of <webview> tags to prevent renderer privilege escalation
    contents.on('will-attach-webview', (event) => {
      console.warn('Blocked unauthorized webview attachment');
      event.preventDefault();
    });
  });
}

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
