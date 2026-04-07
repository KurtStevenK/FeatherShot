const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, ipcMain } = require('electron');
const path = require('path');

let tray = null;
let editorWindow = null;
let selectionWindows = []; // One per display
let capturedScreenshot = null;
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
  // When a mouse event happens in any overlay, broadcast it to ALL overlays
  ipcMain.on('selection-mouse-event', (event, data) => {
    // data: { type: 'down'|'move'|'up', globalX, globalY }
    for (const win of selectionWindows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('selection-update', data);
      }
    }
  });

  // Selection completed — crop global coordinates from composite
  ipcMain.on('selection-complete', (event, cropRegion) => {
    closeAllOverlays();

    if (capturedScreenshot && globalBounds) {
      // cropRegion is in global CSS coordinates
      // We need to figure out which display the selection center falls on
      // and use that display's scale factor for accurate cropping
      const displays = screen.getAllDisplays();
      const selCenterX = cropRegion.x + cropRegion.width / 2;
      const selCenterY = cropRegion.y + cropRegion.height / 2;

      // Find the display containing the center of the selection
      let targetDisplay = screen.getPrimaryDisplay();
      for (const d of displays) {
        if (selCenterX >= d.bounds.x && selCenterX < d.bounds.x + d.bounds.width &&
            selCenterY >= d.bounds.y && selCenterY < d.bounds.y + d.bounds.height) {
          targetDisplay = d;
          break;
        }
      }

      // Use the primary display's scale factor for the composite image
      // since that's what we used to build the composite
      const primarySF = screen.getPrimaryDisplay().scaleFactor || 1;

      const pixelCrop = {
        x: Math.round((cropRegion.x - globalBounds.minX) * primarySF),
        y: Math.round((cropRegion.y - globalBounds.minY) * primarySF),
        width: Math.round(cropRegion.width * primarySF),
        height: Math.round(cropRegion.height * primarySF)
      };

      // Clamp to image bounds
      const imgSize = capturedScreenshot.getSize();
      pixelCrop.x = Math.max(0, Math.min(pixelCrop.x, imgSize.width - 1));
      pixelCrop.y = Math.max(0, Math.min(pixelCrop.y, imgSize.height - 1));
      pixelCrop.width = Math.min(pixelCrop.width, imgSize.width - pixelCrop.x);
      pixelCrop.height = Math.min(pixelCrop.height, imgSize.height - pixelCrop.y);

      if (pixelCrop.width > 0 && pixelCrop.height > 0) {
        const cropped = capturedScreenshot.crop(pixelCrop);
        openEditor(cropped);
      }
    }
  });

  // Selection cancelled
  ipcMain.on('selection-cancel', () => {
    closeAllOverlays();
    capturedScreenshot = null;
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

async function captureScreen() {
  try {
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

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;
    const primarySF = screen.getPrimaryDisplay().scaleFactor || 1;

    // Capture all screens — ask for full virtual desktop resolution
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: totalWidth * primarySF,
        height: totalHeight * primarySF
      }
    });

    if (sources.length === 0) {
      console.error('No screen sources found');
      return;
    }

    // If there's only one source, it's likely the entire virtual desktop
    if (sources.length === 1) {
      capturedScreenshot = sources[0].thumbnail;
      openSelectionOverlays();
      return;
    }

    // Multiple sources — need to composite per-display captures
    // First, capture each display at its native resolution
    const displayCaptures = [];

    for (const display of displays) {
      const sf = display.scaleFactor || 1;
      const capW = display.bounds.width * sf;
      const capH = display.bounds.height * sf;

      const perSources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: capW, height: capH }
      });

      // Match by display_id
      let matched = null;
      for (const src of perSources) {
        if (src.display_id && src.display_id === display.id.toString()) {
          matched = src;
          break;
        }
      }
      // Fallback: positional
      if (!matched && perSources.length > 0) {
        const idx = displays.indexOf(display);
        matched = perSources[idx < perSources.length ? idx : 0];
      }

      if (matched) {
        displayCaptures.push({
          thumbnail: matched.thumbnail,
          bounds: display.bounds,
          scaleFactor: sf
        });
      }
    }

    if (displayCaptures.length === 0) {
      console.error('No display captures obtained');
      return;
    }

    if (displayCaptures.length === 1) {
      capturedScreenshot = displayCaptures[0].thumbnail;
      openSelectionOverlays();
      return;
    }

    // Composite via offscreen BrowserWindow
    const compositeW = totalWidth * primarySF;
    const compositeH = totalHeight * primarySF;

    const compositeWindow = new BrowserWindow({
      width: Math.ceil(compositeW),
      height: Math.ceil(compositeH),
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const captureData = displayCaptures.map(dc => ({
      dataUrl: dc.thumbnail.toDataURL(),
      x: (dc.bounds.x - minX) * primarySF,
      y: (dc.bounds.y - minY) * primarySF,
      w: dc.bounds.width * primarySF,
      h: dc.bounds.height * primarySF
    }));

    const htmlContent = `
      <html><body style="margin:0;padding:0;">
      <canvas id="c" width="${Math.ceil(compositeW)}" height="${Math.ceil(compositeH)}"></canvas>
      <script>
        const {ipcRenderer} = require('electron');
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        const captures = ${JSON.stringify(captureData)};
        let loaded = 0;
        captures.forEach(cap => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, cap.x, cap.y, cap.w, cap.h);
            loaded++;
            if (loaded === captures.length) {
              ipcRenderer.send('composite-ready', canvas.toDataURL('image/png'));
            }
          };
          img.src = cap.dataUrl;
        });
      </script>
      </body></html>
    `;

    compositeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    ipcMain.once('composite-ready', (event, compositeDataUrl) => {
      compositeWindow.close();
      capturedScreenshot = nativeImage.createFromDataURL(compositeDataUrl);
      openSelectionOverlays();
    });

    // Timeout fallback
    setTimeout(() => {
      if (selectionWindows.length === 0 && !compositeWindow.isDestroyed()) {
        compositeWindow.close();
        capturedScreenshot = displayCaptures[0].thumbnail;
        openSelectionOverlays();
      }
    }, 5000);

  } catch (err) {
    console.error('Screenshot capture failed:', err);
  }
}

function openSelectionOverlays() {
  closeAllOverlays();

  const displays = screen.getAllDisplays();
  const primarySF = screen.getPrimaryDisplay().scaleFactor || 1;

  for (const display of displays) {
    const sf = display.scaleFactor || 1;

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
      enableLargerThanScreen: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // macOS: simple fullscreen per display
    if (process.platform === 'darwin') {
      win.setSimpleFullScreen(true);
    } else {
      // Windows/Linux: use always-on-top at screen-saver level to cover taskbar,
      // then enter kiosk mode to ensure full coverage regardless of DPI scaling
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setKiosk(true);
    }

    win.loadFile(path.join(__dirname, 'renderer', 'selection.html'));

    win.webContents.once('did-finish-load', () => {
      // Send this display's portion of the composite screenshot
      const compositeSize = capturedScreenshot.getSize();

      // Calculate which portion of the composite this display maps to (pixel coords)
      const cropX = Math.round((display.bounds.x - globalBounds.minX) * primarySF);
      const cropY = Math.round((display.bounds.y - globalBounds.minY) * primarySF);
      const cropW = Math.round(display.bounds.width * primarySF);
      const cropH = Math.round(display.bounds.height * primarySF);

      // Clamp to composite bounds
      const clampedW = Math.min(cropW, compositeSize.width - cropX);
      const clampedH = Math.min(cropH, compositeSize.height - cropY);

      let displayDataUrl;
      if (cropX >= 0 && cropY >= 0 && clampedW > 0 && clampedH > 0) {
        const cropped = capturedScreenshot.crop({
          x: cropX, y: cropY,
          width: clampedW, height: clampedH
        });
        displayDataUrl = cropped.toDataURL();
      } else {
        // Fallback — use full composite
        displayDataUrl = capturedScreenshot.toDataURL();
      }

      win.webContents.send('selection-init', {
        dataUrl: displayDataUrl,
        displayBounds: display.bounds, // CSS pixel bounds of this display
        globalBounds: globalBounds,    // CSS pixel bounds of all displays combined
        scale: sf
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
