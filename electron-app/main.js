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
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { initUpdater, checkForUpdatesInteractive } = require('./updater');
const { captureAllDisplays, cropCaptures, previewDataUrl } = require('./capture');
const { saveAndCopy, defaultFileName } = require('./save-and-copy');
const logger = require('./log');
const { log } = logger;

// The tray menu is still fading out when "Take Screenshot" is clicked; capturing at once puts it in the shot.
const MENU_CLOSE_SETTLE_MS = 120;

let tray=null, editorWindow=null, selectionWindows=[], globalBounds=null;
// Frozen captures of every display, taken before the overlay opened; the selection is cropped from them.
let pendingCaptures = null, pendingDisplays = null, capturing = false, dragStart = null;
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
  logger.init(app.getPath('userData'));
  log(`FeatherShot ${app.getVersion()} starting on ${process.platform} ${process.getSystemVersion()}, Electron ${process.versions.electron}`);
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
    { label: 'Show Log File', click: () => showLogFile() },
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

function showLogFile() {
  const logPath = logger.getLogPath();
  if (!logPath) return;
  try {
    if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '');
    shell.showItemInFolder(logPath);
  } catch (e) {
    dialog.showErrorBox('FeatherShot', `The log file is at:\n${logPath}`);
  }
}

function setupIPC() {
  ipcMain.handle('sel-init-request',(event)=>{
    try{const w=BrowserWindow.fromWebContents(event.sender);return w?windowData.get(w.id):null;}catch(e){return null;}
  });
  // Every overlay mirrors the drag; the main process finishes the selection on 'up' itself, so one
  // release ends it exactly once, however many overlays there are and whichever one saw the release.
  ipcMain.on('sel-mouse',(event,data)=>{
    for(const w of [...selectionWindows]){try{if(w&&!w.isDestroyed()&&w.webContents)w.webContents.send('sel-update',data);}catch(e){}}
    if (data.type === 'down') {
      dragStart = { gx: data.gx, gy: data.gy };
      log('Selection down at', data.gx, data.gy);
    } else if (data.type === 'up') {
      if (!dragStart) return;
      const start = dragStart;
      dragStart = null;
      const crop = {
        x: Math.min(start.gx, data.gx), y: Math.min(start.gy, data.gy),
        width: Math.abs(data.gx - start.gx), height: Math.abs(data.gy - start.gy),
      };
      log('Selection up at', data.gx, data.gy, data.via ? `via ${data.via}` : '', '->', crop);
      if (crop.width >= 10 && crop.height >= 10) finishSelection(crop);
    }
  });
  ipcMain.on('sel-log', (event, ...parts) => log('[overlay]', ...parts));
  ipcMain.on('sel-cancel', () => cancelSelection());

  // Returns { ok, error? } — ok closes the editor; on any failure it stays open so annotations are not lost.
  ipcMain.handle('save-and-copy', async (event, pngBytes) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await saveAndCopy(pngBytes, {
        downloadsDir: () => app.getPath('downloads'),
        clipboard,
        ClipboardItem,
      });
      if (result.saveError) {
        log('Save to Downloads failed:', result.saveError);
        const savedAs = await offerSaveAs(win, result);
        return savedAs ? { ok: true } : { ok: false, error: `Could not save to Downloads: ${result.saveError}` };
      }
      if (result.copyError) {
        log('Copy to clipboard failed:', result.copyError, 'saved', result.filePath);
        await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'FeatherShot',
          message: 'Could not copy to the clipboard',
          detail: `${result.copyError}\n\nThe screenshot was saved as ${path.basename(result.filePath)} in Downloads.`,
        });
        return { ok: false, error: `Saved to Downloads, but the clipboard failed: ${result.copyError}` };
      }
      log('Saved and copied', result.filePath);
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      log('Save & Copy failed:', e);
      const message = e instanceof Error ? e.message : String(e);
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'FeatherShot',
        message: 'Save & Copy failed',
        detail: message,
      });
      return { ok: false, error: message };
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
    log('Saved as', filePath);
    return true;
  } catch (e) {
    log('Save As failed:', e);
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'FeatherShot',
      message: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

function describeDisplays(displays) {
  return displays.map((d) => `${d.id}: ${JSON.stringify(d.bounds)} x${d.scaleFactor}`).join('\n');
}

function reportCaptureFailure(reason, crop, displays) {
  log('Capture failed:', reason, 'selection', crop || '-', 'displays', displays.map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
  const where = crop ? `Selection: ${JSON.stringify(crop)}\n` : '';
  dialog.showErrorBox(
    'FeatherShot could not capture the screenshot',
    `${reason}\n\n${where}Displays:\n${describeDisplays(displays)}\n\nLog file: ${logger.getLogPath()}`
  );
}

function cancelSelection() {
  closeAll();
  dragStart = null;
  pendingCaptures = null;
  pendingDisplays = null;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startSelection() {
  if (capturing) return;
  capturing = true;
  cancelSelection();
  const displays = screen.getAllDisplays();
  try {
    await delay(MENU_CLOSE_SETTLE_MS);
    log('Capturing displays:', displays.map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
    const started = Date.now();
    const captures = await captureAllDisplays(displays, desktopCapturer, { log });
    log(`Captured ${captures.length} of ${displays.length} display(s) in ${Date.now() - started} ms`);
    pendingCaptures = captures;
    pendingDisplays = displays;
    openSelectionOverlays(displays, captures);
  } catch (e) {
    reportCaptureFailure(e instanceof Error ? e.message : String(e), null, displays);
  } finally {
    capturing = false;
  }
}

function openSelectionOverlays(displays, captures) {
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  for(const d of displays){mnX=Math.min(mnX,d.bounds.x);mnY=Math.min(mnY,d.bounds.y);mxX=Math.max(mxX,d.bounds.x+d.bounds.width);mxY=Math.max(mxY,d.bounds.y+d.bounds.height);}
  globalBounds={minX:mnX,minY:mnY,maxX:mxX,maxY:mxY};

  for(const display of displays){
    const capture = captures.find((c) => c.display.id === display.id);
    // Opaque: the overlay shows the frozen capture, so nothing depends on window transparency.
    const win=new BrowserWindow({
      x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,
      frame:false,transparent:false,alwaysOnTop:true,skipTaskbar:true,
      resizable:false,movable:false,hasShadow:false,focusable:true,
      fullscreenable:true,backgroundColor:'#000000',show:false,
      webPreferences:{nodeIntegration:true,contextIsolation:false}
    });
    windowData.set(win.id,{displayBounds:display.bounds,globalBounds,preview:capture?previewDataUrl(capture):null});
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

function finishSelection(crop) {
  closeAll();
  dragStart = null;
  const captures = pendingCaptures;
  const displays = pendingDisplays || screen.getAllDisplays();
  pendingCaptures = null;
  pendingDisplays = null;
  if (!captures) {
    reportCaptureFailure('The selection ended without a screen capture to crop from. Please try again.', crop, displays);
    return null;
  }
  try {
    const payload = cropCaptures(crop, captures, displays);
    if (!payload) {
      reportCaptureFailure('No captured display covers the selected area.', crop, displays);
      return null;
    }
    log('Selection', crop, '->', typeof payload === 'string' ? `${payload.length} chars data URL` : `composite ${payload.width}x${payload.height}`);
    return openEditor(payload);
  } catch (e) {
    reportCaptureFailure(e instanceof Error ? e.message : String(e), crop, displays);
    return null;
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
  const win = editorWindow;
  win.loadFile(path.join(__dirname,'renderer','index.html'));

  // Simple, reliable: send data after page loads, then show window
  win.webContents.once('did-finish-load',()=>{
    if(win.isDestroyed()) return;
    win.webContents.send('load-screenshot', screenshotData);
    win.show();
    win.focus();
  });
  win.webContents.once('did-fail-load', (event, code, description, url) => {
    log('Editor page failed to load:', code, description, url);
    dialog.showErrorBox('FeatherShot could not open the editor', `${description} (${code})\n${url}\n\nLog file: ${logger.getLogPath()}`);
  });
  win.on('closed',()=>{ if (editorWindow === win) editorWindow=null; });
  return win;
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

// Test hooks for the real-Electron smoke tests (electron-app/test/*.js).
module.exports = {
  startSelection,
  finishSelection,
  getSelectionWindows: () => selectionWindows,
  getEditorWindow: () => editorWindow,
};
