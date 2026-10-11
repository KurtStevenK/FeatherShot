#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const selectionJs = fs.readFileSync(
  path.join(root, 'electron-app/renderer/selection.js'),
  'utf8'
);
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

console.log('Electron selection IPC wiring OK');
