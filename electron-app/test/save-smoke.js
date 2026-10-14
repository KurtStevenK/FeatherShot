// Real-Electron smoke test for Save & Copy: loads main.js, opens the editor page with a test image,
// clicks Save & Copy, then checks the PNG in a temporary Downloads folder and on the clipboard.
//   npx electron test/save-smoke.js
//   xvfb-run -a npx electron --no-sandbox test/save-smoke.js   (Linux CI)
const { app, BrowserWindow, clipboard, dialog, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WIDTH = 64;
const HEIGHT = 48;
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'feathershot-smoke-'));
app.setPath('downloads', downloads);

function finish(code, message) {
  console.log(`Save & Copy smoke test ${code === 0 ? 'passed' : 'failed'}: ${message}`);
  app.exit(code);
}

// main.js only shows dialogs on error paths, and a modal dialog would hang CI.
dialog.showMessageBox = async (...args) => {
  const options = args.find((a) => a && typeof a === 'object' && 'message' in a) || {};
  finish(1, `unexpected dialog "${options.message}": ${options.detail}`);
  return { response: 1 };
};
dialog.showErrorBox = (title, content) => finish(1, `unexpected error box "${title}": ${content}`);
setTimeout(() => finish(1, 'timed out'), 60000);

require('../main.js');

function waitFor(check, what, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      const value = await check();
      if (value) return resolve(value);
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${what}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

function sizeOf(image) {
  const { width, height } = image.getSize();
  return `${width}x${height}`;
}

app.whenReady().then(async () => {
  if (!app.hasSingleInstanceLock()) return finish(1, 'another FeatherShot instance holds the single-instance lock');

  const editor = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const closed = new Promise((resolve) => editor.once('closed', resolve));
  await editor.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4, 0xff);
  const screenshot = nativeImage.createFromBitmap(pixels, { width: WIDTH, height: HEIGHT });
  editor.webContents.send('load-screenshot', screenshot.toDataURL());
  await waitFor(
    () => editor.webContents.executeJavaScript(`document.getElementById('canvas').width === ${WIDTH}`),
    'the editor to load the screenshot'
  );

  await clipboard.clear();
  await editor.webContents.executeJavaScript(`document.getElementById('btn-save').click()`);

  const file = await waitFor(() => {
    const name = fs.readdirSync(downloads).find((f) => /^FeatherShot_.*\.png$/.test(f));
    return name && path.join(downloads, name);
  }, 'the PNG in Downloads');
  const saved = nativeImage.createFromPath(file);
  if (sizeOf(saved) !== `${WIDTH}x${HEIGHT}`) return finish(1, `saved image is ${sizeOf(saved)}`);

  await waitFor(() => clipboard.has('image/png'), 'a PNG on the clipboard');
  const [item] = await clipboard.read();
  const pasted = nativeImage.createFromBuffer(Buffer.from(await (await item.getType('image/png')).arrayBuffer()));
  if (sizeOf(pasted) !== `${WIDTH}x${HEIGHT}`) return finish(1, `clipboard image is ${sizeOf(pasted)}`);

  await Promise.race([closed, new Promise((_, reject) => setTimeout(() => reject(new Error('editor did not close')), 5000))]);
  finish(0, `saved ${path.basename(file)} and copied ${sizeOf(pasted)} PNG; editor closed`);
}).catch((e) => finish(1, e.message));
