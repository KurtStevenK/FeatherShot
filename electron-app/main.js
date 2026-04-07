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

    // Capture each screen individually for reliable multi-monitor support
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 1, // Minimal default — we resize per-source below
        height: 1
      }
    });

    // For each display, find its matching source and capture at correct resolution
    const displayCaptures = [];

    for (const display of displays) {
      const sf = display.scaleFactor || 1;
      const capW = display.bounds.width * sf;
      const capH = display.bounds.height * sf;

      // Re-capture with the right thumbnail size for this display
      const perDisplaySources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: capW, height: capH }
      });

      // Match source to display by display_id in the source id or by index
      let matched = null;
      for (const src of perDisplaySources) {
        // Electron source IDs often contain the display id, e.g. "screen:0:0"
        // Try matching by display index
        const srcIdMatch = src.display_id;
        if (srcIdMatch && srcIdMatch === display.id.toString()) {
          matched = src;
          break;
        }
      }

      // Fallback: if only one source is returned or no display_id match, use positional matching
      if (!matched && perDisplaySources.length > 0) {
        const displayIndex = displays.indexOf(display);
        if (displayIndex < perDisplaySources.length) {
          matched = perDisplaySources[displayIndex];
        } else {
          matched = perDisplaySources[0];
        }
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

    // If only one display, use it directly
    if (displayCaptures.length === 1) {
      capturedScreenshot = displayCaptures[0].thumbnail;
      openSelectionOverlay();
      return;
    }

    // Composite all display captures onto a single canvas
    // Use the primary display scale factor for the composite
    const primaryDisplay = screen.getPrimaryDisplay();
    const compositeSF = primaryDisplay.scaleFactor || 1;
    const compositeW = totalWidth * compositeSF;
    const compositeH = totalHeight * compositeSF;

    // We need to create a BrowserWindow offscreen to use canvas for compositing
    const compositeWindow = new BrowserWindow({
      width: compositeW,
      height: compositeH,
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const captureData = displayCaptures.map(dc => ({
      dataUrl: dc.thumbnail.toDataURL(),
      x: (dc.bounds.x - minX) * compositeSF,
      y: (dc.bounds.y - minY) * compositeSF,
      w: dc.bounds.width * compositeSF,
      h: dc.bounds.height * compositeSF
    }));

    const htmlContent = `
      <html><body style="margin:0;padding:0;">
      <canvas id="c" width="${compositeW}" height="${compositeH}"></canvas>
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
      openSelectionOverlay();
    });

    // Timeout fallback — if compositing takes too long, use first source
    setTimeout(() => {
      if (!capturedScreenshot) {
        compositeWindow.close();
        capturedScreenshot = displayCaptures[0].thumbnail;
        openSelectionOverlay();
      }
    }, 5000);

  } catch (err) {
    console.error('Screenshot capture failed:', err);
  }
}

function openSelectionOverlay() {
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

  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor || 1;

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
