#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const selectionJs = fs.readFileSync(
  path.join(root, 'electron-app/renderer/selection.js'),
  'utf8'
);
const appJs = fs.readFileSync(path.join(root, 'electron-app/renderer/app.js'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'electron-app/main.js'), 'utf8');

const usesElectronApi = /\bwindow\.electronAPI\b/.test(selectionJs);
const preloadWired =
  /preload:\s*path\.join\(__dirname,\s*['"]preload\.js['"]\)/.test(mainJs) &&
  /contextIsolation:\s*true/.test(mainJs);

if (usesElectronApi && !preloadWired) {
  console.error(
    'electron-app/renderer/selection.js uses window.electronAPI but selection BrowserWindow does not load preload.js with contextIsolation: true'
  );
  process.exit(1);
}

if (/\bclipboard\.writeImage\b/.test(appJs)) {
  console.error(
    'electron-app/renderer/app.js must not call clipboard.writeImage — use ipcRenderer.invoke("save-and-copy") (Electron 44+ main-process clipboard)'
  );
  process.exit(1);
}

const hasSaveHandler =
  /ipcMain\.handle\(\s*['"]save-and-copy['"]/.test(mainJs) &&
  /\bclipboard\.write\s*\(/.test(mainJs) &&
  /app\.getPath\(\s*['"]downloads['"]\s*\)/.test(mainJs);

if (!hasSaveHandler) {
  console.error(
    'electron-app/main.js must handle save-and-copy with clipboard.write and app.getPath("downloads")'
  );
  process.exit(1);
}

if (!/ipcRenderer\.invoke\(\s*['"]save-and-copy['"]/.test(appJs)) {
  console.error('electron-app/renderer/app.js must invoke save-and-copy via IPC');
  process.exit(1);
}

console.log('Electron selection IPC wiring OK');
