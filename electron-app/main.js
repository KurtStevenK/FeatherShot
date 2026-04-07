const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, ipcMain } = require('electron');
const path = require('path');

let tray = null;
let editorWindow = null;
let selectionWindow = null;
let displayCaptures = [];
let globalBounds = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createTray();
  setupIPC();
});

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('FeatherShot — Click to capture');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Take Screenshot', click: () => captureScreen(), accelerator: 'CmdOrCtrl+Shift+S' },
    { type: 'separator' },
    { label: 'Quit FeatherShot', click: () => app.quit(), accelerator: 'CmdOrCtrl+Q' }
  ]));
  tray.on('click', () => captureScreen());
}

function setupIPC() {
  ipcMain.on('selection-ready', () => {
    if (selectionWindow && !selectionWindow.isDestroyed()) {
      selectionWindow.show();
      selectionWindow.focus();
    }
  });

  ipcMain.on('selection-complete', (event, crop) => {
    closeSelectionWindow();
    if (displayCaptures.length === 0) return;

    const gx = crop.x + globalBounds.minX;
    const gy = crop.y + globalBounds.minY;
    const cx = gx + crop.width / 2;
    const cy = gy + crop.height / 2;

    let target = displayCaptures[0];
    for (const dc of displayCaptures) {
      if (cx >= dc.bounds.x && cx < dc.bounds.x + dc.bounds.width &&
          cy >= dc.bounds.y && cy < dc.bounds.y + dc.bounds.height) {
        target = dc;
        break;
      }
    }

    const sf = target.scaleFactor;
    const imgSize = target.thumbnail.getSize();
    const px = Math.round((gx - target.bounds.x) * sf);
    const py = Math.round((gy - target.bounds.y) * sf);
    const pw = Math.round(crop.width * sf);
    const ph = Math.round(crop.height * sf);

    const pixelCrop = {
      x: Math.max(0, Math.min(px, imgSize.width - 1)),
      y: Math.max(0, Math.min(py, imgSize.height - 1)),
      width: Math.min(pw, imgSize.width - Math.max(0, px)),
      height: Math.min(ph, imgSize.height - Math.max(0, py))
    };

    if (pixelCrop.width > 0 && pixelCrop.height > 0) {
      openEditor(target.thumbnail.crop(pixelCrop));
    }
    displayCaptures = [];
  });

  ipcMain.on('selection-cancel', () => {
    closeSelectionWindow();
    displayCaptures = [];
  });
}

function closeSelectionWindow() {
  if (selectionWindow && !selectionWindow.isDestroyed()) selectionWindow.close();
  selectionWindow = null;
}

async function captureScreen() {
  try {
    const displays = screen.getAllDisplays();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of displays) {
      minX = Math.min(minX, d.bounds.x);
      minY = Math.min(minY, d.bounds.y);
      maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
      maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
    }
    globalBounds = { minX, minY, maxX, maxY };
    const totalW = maxX - minX;
    const totalH = maxY - minY;

    let maxPixW = 0, maxPixH = 0;
    for (const d of displays) {
      const sf = d.scaleFactor || 1;
      maxPixW = Math.max(maxPixW, d.bounds.width * sf);
      maxPixH = Math.max(maxPixH, d.bounds.height * sf);
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxPixW, height: maxPixH }
    });
    if (sources.length === 0) return;

    displayCaptures = [];
    const captureData = [];

    for (const display of displays) {
      const sf = display.scaleFactor || 1;
      let source = sources.find(s => s.display_id === display.id.toString());
      if (!source) {
        const idx = displays.indexOf(display);
        source = sources[idx < sources.length ? idx : 0];
      }
      if (source) {
        displayCaptures.push({ thumbnail: source.thumbnail, bounds: display.bounds, scaleFactor: sf });
        captureData.push({
          dataUrl: source.thumbnail.toDataURL(),
          x: display.bounds.x - minX,
          y: display.bounds.y - minY,
          width: display.bounds.width,
          height: display.bounds.height
        });
      }
    }
    if (displayCaptures.length === 0) return;

    closeSelectionWindow();
    selectionWindow = new BrowserWindow({
      x: minX, y: minY, width: totalW, height: totalH,
      frame: false, transparent: false, alwaysOnTop: true,
      skipTaskbar: true, resizable: false, movable: false,
      enableLargerThanScreen: true, hasShadow: false,
      fullscreenable: false, backgroundColor: '#000000', show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    selectionWindow.setAlwaysOnTop(true, 'screen-saver');
    selectionWindow.loadFile(path.join(__dirname, 'renderer', 'selection.html'));
    selectionWindow.webContents.once('did-finish-load', () => {
      if (selectionWindow && !selectionWindow.isDestroyed()) {
        selectionWindow.webContents.send('selection-init', {
          captures: captureData, totalWidth: totalW, totalHeight: totalH
        });
      }
    });
  } catch (err) {
    console.error('Capture error:', err);
  }
}

function openEditor(screenshot) {
  if (editorWindow) editorWindow.close();
  const imgSize = screenshot.getSize();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  editorWindow = new BrowserWindow({
    width: Math.min(Math.max(imgSize.width, 700), sw - 80),
    height: Math.min(Math.max(imgSize.height + 80, 400), sh - 80),
    title: 'FeatherShot Editor',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    show: false, autoHideMenuBar: true, resizable: true, minWidth: 600, minHeight: 360
  });
  editorWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow.webContents.send('load-screenshot', screenshot.toDataURL());
    editorWindow.show();
    editorWindow.focus();
  });
  editorWindow.on('closed', () => { editorWindow = null; });
}

app.on('window-all-closed', (e) => e.preventDefault());
