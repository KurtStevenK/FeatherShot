const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, ipcMain } = require('electron');
const path = require('path');

let tray = null;
let editorWindow = null;
let selectionWindow = null;
let capturedScreenshot = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(() => {
  // Hide from taskbar / dock
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

  // Left-click to capture on Windows/Linux
  tray.on('click', () => captureScreen());
}

function setupIPC() {
  // Selection completed — crop and open editor
  ipcMain.on('selection-complete', (event, cropRegion) => {
    if (selectionWindow) {
      selectionWindow.close();
      selectionWindow = null;
    }

    if (capturedScreenshot) {
      const cropped = capturedScreenshot.crop(cropRegion);
      openEditor(cropped);
    }
  });

  // Selection cancelled
  ipcMain.on('selection-cancel', () => {
    if (selectionWindow) {
      selectionWindow.close();
      selectionWindow = null;
    }
    capturedScreenshot = null;
  });
}

async function captureScreen() {
  try {
    // Get ALL displays for multi-monitor support
    const displays = screen.getAllDisplays();

    // Calculate a bounding box that covers all displays
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const display of displays) {
      const { x, y, width, height } = display.bounds;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    // Use primary display scale factor for thumbnail
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: totalWidth * scaleFactor,
        height: totalHeight * scaleFactor
      }
    });

    if (sources.length > 0) {
      // Use the first screen source (covers all displays on most OSes)
      capturedScreenshot = sources[0].thumbnail;
      openSelectionOverlay(scaleFactor);
    }
  } catch (err) {
    console.error('Screenshot capture failed:', err);
  }
}

function openSelectionOverlay(scaleFactor) {
  if (selectionWindow) {
    selectionWindow.close();
  }

  // Get the combined bounds of all displays
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  selectionWindow = new BrowserWindow({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Enter simple fullscreen on macOS
  if (process.platform === 'darwin') {
    selectionWindow.setSimpleFullScreen(true);
  }

  selectionWindow.loadFile(path.join(__dirname, 'renderer', 'selection.html'));

  selectionWindow.webContents.once('did-finish-load', () => {
    const dataUrl = capturedScreenshot.toDataURL();
    selectionWindow.webContents.send('selection-screenshot', {
      dataUrl,
      scale: scaleFactor
    });
  });

  selectionWindow.on('closed', () => {
    selectionWindow = null;
  });
}

function openEditor(screenshot) {
  if (editorWindow) {
    editorWindow.close();
  }

  const imgSize = screenshot.getSize();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Clamp editor to screen while keeping aspect ratio visible
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
    // Send the screenshot data to the renderer
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
  // Don't quit when windows close — keep tray alive
  e.preventDefault();
});
