const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, ipcMain } = require('electron');
const path = require('path');

let tray = null;
let editorWindow = null;
let selectionWindows = []; // One per display
let globalBounds = null; // { minX, minY, maxX, maxY } in CSS pixels

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  createTray();
  setupIPC();
});

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('FeatherShot — Click to capture');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Take Screenshot',
      click: () => captureScreen(),
      accelerator: 'CmdOrCtrl+Shift+S'
    },
    { type: 'separator' },
    {
      label: 'Quit FeatherShot',
      click: () => app.quit(),
      accelerator: 'CmdOrCtrl+Q'
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => captureScreen());
}

function setupIPC() {
  // --- Cross-display selection coordination ---
  ipcMain.on('selection-mouse-event', (event, data) => {
    for (const win of selectionWindows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('selection-update', data);
      }
    }
  });

  // Selection completed — close overlays, capture the screen, crop to selection
  ipcMain.on('selection-complete', async (event, cropRegion) => {
    // Close all overlays and wait for them to disappear from screen
    await closeAllOverlaysAndWait();

    try {
      // Find which display contains the center of the selection
      const displays = screen.getAllDisplays();
      const selCenterX = cropRegion.x + cropRegion.width / 2;
      const selCenterY = cropRegion.y + cropRegion.height / 2;

      let targetDisplay = screen.getPrimaryDisplay();
      for (const d of displays) {
        if (selCenterX >= d.bounds.x && selCenterX < d.bounds.x + d.bounds.width &&
            selCenterY >= d.bounds.y && selCenterY < d.bounds.y + d.bounds.height) {
          targetDisplay = d;
          break;
        }
      }

      const sf = targetDisplay.scaleFactor || 1;
      const capW = targetDisplay.bounds.width * sf;
      const capH = targetDisplay.bounds.height * sf;

      // Capture screens — request at the target display's native pixel resolution
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: capW, height: capH }
      });

      if (sources.length === 0) {
        console.error('No screen sources found');
        return;
      }

      // Find the source matching the target display
      let source = null;
      for (const s of sources) {
        if (s.display_id && s.display_id === targetDisplay.id.toString()) {
          source = s;
          break;
        }
      }
      // Fallback: positional match
      if (!source) {
        const idx = displays.findIndex(d => d.id === targetDisplay.id);
        source = sources[idx < sources.length ? idx : 0];
      }

      const screenshot = source.thumbnail;
      const imgSize = screenshot.getSize();

      // Convert global CSS selection to this display's local pixel coordinates
      const pixelCrop = {
        x: Math.round((cropRegion.x - targetDisplay.bounds.x) * sf),
        y: Math.round((cropRegion.y - targetDisplay.bounds.y) * sf),
        width: Math.round(cropRegion.width * sf),
        height: Math.round(cropRegion.height * sf)
      };

      // Clamp to image bounds
      pixelCrop.x = Math.max(0, Math.min(pixelCrop.x, imgSize.width - 1));
      pixelCrop.y = Math.max(0, Math.min(pixelCrop.y, imgSize.height - 1));
      pixelCrop.width = Math.min(pixelCrop.width, imgSize.width - pixelCrop.x);
      pixelCrop.height = Math.min(pixelCrop.height, imgSize.height - pixelCrop.y);

      if (pixelCrop.width > 0 && pixelCrop.height > 0) {
        const cropped = screenshot.crop(pixelCrop);
        openEditor(cropped);
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    }
  });

  // Selection cancelled
  ipcMain.on('selection-cancel', () => {
    closeAllOverlays();
  });
}

function closeAllOverlays() {
  for (const win of selectionWindows) {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }
  selectionWindows = [];
}

// Close all overlays and wait for them to fully disappear from screen
function closeAllOverlaysAndWait() {
  return new Promise(resolve => {
    const windows = [...selectionWindows];
    selectionWindows = [];

    if (windows.length === 0) {
      setTimeout(resolve, 100);
      return;
    }

    let closed = 0;
    const total = windows.filter(w => w && !w.isDestroyed()).length;

    if (total === 0) {
      setTimeout(resolve, 100);
      return;
    }

    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.on('closed', () => {
          closed++;
          if (closed >= total) {
            // Wait for the screen to fully repaint after overlays disappear
            setTimeout(resolve, 200);
          }
        });
        win.close();
      }
    }
  });
}

// No pre-capture needed — just open semi-transparent selection overlays
async function captureScreen() {
  openSelectionOverlays();
}

function openSelectionOverlays() {
  closeAllOverlays();

  const displays = screen.getAllDisplays();

  // Calculate global bounding box (CSS pixels)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  globalBounds = { minX, minY, maxX, maxY };

  for (const display of displays) {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      fullscreenable: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    if (process.platform === 'darwin') {
      win.setSimpleFullScreen(true);
    } else {
      // Windows/Linux: stay above taskbar without kiosk mode
      win.setAlwaysOnTop(true, 'screen-saver');
    }

    win.loadFile(path.join(__dirname, 'renderer', 'selection.html'));

    win.webContents.once('did-finish-load', () => {
      // No screenshot data — just send display bounds
      win.webContents.send('selection-init', {
        displayBounds: display.bounds,
        globalBounds: globalBounds
      });
    });

    win.on('closed', () => {
      const idx = selectionWindows.indexOf(win);
      if (idx !== -1) selectionWindows.splice(idx, 1);
    });

    selectionWindows.push(win);
  }
}

function openEditor(screenshot) {
  if (editorWindow) {
    editorWindow.close();
  }

  const imgSize = screenshot.getSize();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const editorWidth = Math.min(Math.max(imgSize.width, 700), screenWidth - 80);
  const editorHeight = Math.min(Math.max(imgSize.height + 80, 400), screenHeight - 80);

  editorWindow = new BrowserWindow({
    width: editorWidth,
    height: editorHeight,
    title: 'FeatherShot Editor',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    minWidth: 600,
    minHeight: 360
  });

  editorWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  editorWindow.webContents.once('did-finish-load', () => {
    const dataUrl = screenshot.toDataURL();
    editorWindow.webContents.send('load-screenshot', dataUrl);
    editorWindow.show();
    editorWindow.focus();
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
  });
}

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
