const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

let tray = null, editorWindow = null, selectionWindows = [], globalBounds = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createTray();
  setupIPC();
});

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray.setToolTip('FeatherShot — Click to capture');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Take Screenshot', click: () => startSelection(), accelerator: 'CmdOrCtrl+Shift+S' },
    { type: 'separator' },
    { label: 'Quit FeatherShot', click: () => app.quit(), accelerator: 'CmdOrCtrl+Q' }
  ]));
  tray.on('click', () => startSelection());
}

function setupIPC() {
  // Broadcast mouse events from any overlay to ALL overlays
  ipcMain.on('sel-mouse', (event, data) => {
    for (const win of selectionWindows) {
      try { if (win && !win.isDestroyed() && win.webContents) win.webContents.send('sel-update', data); }
      catch (e) { /* window closing */ }
    }
  });

  // Selection done — close overlays, wait, capture, crop, open editor
  ipcMain.on('sel-done', async (event, crop) => {
    await closeOverlaysAndWait();
    try {
      const displays = screen.getAllDisplays();
      // Find display containing the selection center
      const cx = crop.x + crop.width / 2, cy = crop.y + crop.height / 2;
      let target = screen.getPrimaryDisplay();
      for (const d of displays) {
        if (cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width &&
            cy >= d.bounds.y && cy < d.bounds.y + d.bounds.height) { target = d; break; }
      }
      const sf = target.scaleFactor || 1;
      // Capture just this display at native resolution
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: target.bounds.width * sf, height: target.bounds.height * sf }
      });
      let src = sources.find(s => s.display_id === target.id.toString());
      if (!src) src = sources[0];
      if (!src) return;

      const img = src.thumbnail, imgSz = img.getSize();
      const px = Math.max(0, Math.round((crop.x - target.bounds.x) * sf));
      const py = Math.max(0, Math.round((crop.y - target.bounds.y) * sf));
      const pw = Math.min(Math.round(crop.width * sf), imgSz.width - px);
      const ph = Math.min(Math.round(crop.height * sf), imgSz.height - py);
      if (pw > 0 && ph > 0) openEditor(img.crop({ x: px, y: py, width: pw, height: ph }));
    } catch (e) { console.error('Capture failed:', e); }
  });

  ipcMain.on('sel-cancel', () => closeOverlays());
}

function closeOverlays() {
  for (const w of selectionWindows) { try { if (w && !w.isDestroyed()) w.close(); } catch(e){} }
  selectionWindows = [];
}

function closeOverlaysAndWait() {
  return new Promise(resolve => {
    const wins = selectionWindows.filter(w => w && !w.isDestroyed());
    selectionWindows = [];
    if (wins.length === 0) return setTimeout(resolve, 150);
    let closed = 0;
    for (const w of wins) {
      w.on('closed', () => { if (++closed >= wins.length) setTimeout(resolve, 200); });
      w.close();
    }
  });
}

function startSelection() {
  closeOverlays();
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x); minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width); maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  globalBounds = { minX, minY, maxX, maxY };

  for (const display of displays) {
    const win = new BrowserWindow({
      x: display.bounds.x, y: display.bounds.y,
      width: display.bounds.width, height: display.bounds.height,
      frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
      resizable: false, movable: false, hasShadow: false, focusable: true,
      enableLargerThanScreen: true, fullscreenable: false,
      backgroundColor: '#00000000',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    if (process.platform === 'darwin') win.setSimpleFullScreen(true);
    else win.setAlwaysOnTop(true, 'screen-saver');

    win.loadFile(path.join(__dirname, 'renderer', 'selection.html'));
    win.webContents.once('did-finish-load', () => {
      try {
        if (win && !win.isDestroyed() && win.webContents) {
          win.webContents.send('sel-init', { displayBounds: display.bounds, globalBounds });
        }
      } catch(e) {}
    });
    win.on('closed', () => {
      const i = selectionWindows.indexOf(win);
      if (i !== -1) selectionWindows.splice(i, 1);
    });
    selectionWindows.push(win);
  }
}

function openEditor(screenshot) {
  if (editorWindow) editorWindow.close();
  const sz = screenshot.getSize(), wa = screen.getPrimaryDisplay().workAreaSize;
  editorWindow = new BrowserWindow({
    width: Math.min(Math.max(sz.width, 700), wa.width - 80),
    height: Math.min(Math.max(sz.height + 80, 400), wa.height - 80),
    title: 'FeatherShot Editor', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    show: false, autoHideMenuBar: true, resizable: true, minWidth: 600, minHeight: 360
  });
  editorWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow.webContents.send('load-screenshot', screenshot.toDataURL());
    editorWindow.show(); editorWindow.focus();
  });
  editorWindow.on('closed', () => { editorWindow = null; });
}

app.on('window-all-closed', (e) => e.preventDefault());
