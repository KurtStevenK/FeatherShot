const { app, BrowserWindow, Tray, Menu, screen, desktopCapturer, nativeImage, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let editorWindow = null;

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

async function captureScreen() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: width * scaleFactor,
        height: height * scaleFactor
      }
    });

    if (sources.length > 0) {
      const screenshot = sources[0].thumbnail;
      openEditor(screenshot);
    }
  } catch (err) {
    console.error('Screenshot capture failed:', err);
  }
}

function openEditor(screenshot) {
  if (editorWindow) {
    editorWindow.close();
  }

  editorWindow = new BrowserWindow({
    width: Math.min(screenshot.getSize().width, 1200),
    height: Math.min(screenshot.getSize().height + 80, 800),
    title: 'FeatherShot Editor',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    autoHideMenuBar: true
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
