// Real-Electron smoke test for the capture-first selection flow: loads main.js, starts a selection
// (every display is captured and an overlay opens per display showing the frozen capture), then
// finishes the selection and checks that the editor opened with a screenshot of the selected size.
//   npx electron test/selection-smoke.js
//   xvfb-run -a npx electron --no-sandbox test/selection-smoke.js   (Linux CI)
const { app, dialog, desktopCapturer, nativeImage, screen, systemPreferences } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'feathershot-selection-')));

// macOS needs Screen Recording permission for desktopCapturer, which a developer shell rarely has.
// There the capturer is replaced by one that returns a generated image per display, so the overlay,
// the crop and the editor are still exercised; CI (Windows, Linux) captures for real.
let captureMode = 'real';
if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
  captureMode = 'fake (no Screen Recording permission)';
  desktopCapturer.getSources = async ({ thumbnailSize }) =>
    screen.getAllDisplays().map((d) => {
      const sf = d.scaleFactor || 1;
      const width = Math.min(thumbnailSize.width, Math.round(d.bounds.width * sf));
      const height = Math.min(thumbnailSize.height, Math.round(d.bounds.height * sf));
      const pixels = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) pixels.writeUInt32LE(0xff000000 | ((i * 7) & 0xffffff), i * 4);
      return { id: `screen:${d.id}:0`, display_id: String(d.id), thumbnail: nativeImage.createFromBitmap(pixels, { width, height }) };
    });
}

function finish(code, message) {
  console.log(`Selection smoke test ${code === 0 ? 'passed' : 'failed'}: ${message}`);
  app.exit(code);
}

dialog.showErrorBox = (title, content) => finish(1, `unexpected error box "${title}": ${content}`);
dialog.showMessageBox = async (...args) => {
  const options = args.find((a) => a && typeof a === 'object' && 'message' in a) || {};
  finish(1, `unexpected dialog "${options.message}": ${options.detail}`);
  return { response: 1 };
};
setTimeout(() => finish(1, 'timed out'), 90000);

const main = require('../main.js');

function waitFor(check, what, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      let value;
      try {
        value = await check();
      } catch (e) {
        return reject(e);
      }
      if (value) return resolve(value);
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${what}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

app.whenReady().then(async () => {
  if (!app.hasSingleInstanceLock()) return finish(1, 'another FeatherShot instance holds the single-instance lock');
  await new Promise((resolve) => setTimeout(resolve, 300));

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  // Tray click → capture every display → one overlay per display.
  main.startSelection();
  const overlays = await waitFor(
    () => main.getSelectionWindows().length === displays.length && main.getSelectionWindows(),
    `${displays.length} selection overlay(s)`
  );
  const overlay = overlays.find((w) => {
    const b = w.getBounds();
    return b.x === primary.bounds.x && b.y === primary.bounds.y;
  }) || overlays[0];
  // The overlay renderer must have received the frozen capture of its display.
  const preview = await waitFor(
    () => overlay.webContents.executeJavaScript('preview ? { width: preview.width, height: preview.height } : null'),
    'the overlay to show the frozen capture'
  );
  if (preview.width <= 0 || preview.height <= 0) return finish(1, `overlay preview is ${preview.width}x${preview.height}`);

  // Drag on the primary display with real mouse input events (the overlay's pointer handlers,
  // pointer capture included): 300×200 DIP starting 40,40 inside it.
  const crop = { x: primary.bounds.x + 40, y: primary.bounds.y + 40, width: 300, height: 200 };
  const local = (gx, gy) => ({ x: gx - primary.bounds.x, y: gy - primary.bounds.y });
  const mouse = (type, gx, gy, extra = {}) =>
    overlay.webContents.sendInputEvent({ type, ...local(gx, gy), button: 'left', clickCount: 1, ...extra });
  await waitFor(() => overlay.webContents.executeJavaScript('displayBounds !== null'), 'the overlay to initialise');
  // Sent back-to-back: the machine's real cursor also sits on the overlay, and a real mouse move with
  // no button pressed in the middle of the synthetic drag would count as the release.
  mouse('mouseDown', crop.x, crop.y);
  mouse('mouseMove', crop.x + 150, crop.y + 100, { modifiers: ['leftButtonDown'] });
  mouse('mouseMove', crop.x + crop.width, crop.y + crop.height, { modifiers: ['leftButtonDown'] });
  mouse('mouseUp', crop.x + crop.width, crop.y + crop.height);

  const editor = await waitFor(() => main.getEditorWindow(), 'the editor window');
  await waitFor(() => editor.isVisible(), 'the editor to show');
  const canvas = await waitFor(
    () => editor.webContents.executeJavaScript(
      `screenshotImage ? { width: canvas.width, height: canvas.height } : null`
    ),
    'the editor to load the screenshot'
  );
  const sf = primary.scaleFactor || 1;
  const expected = { width: Math.round(crop.width * sf), height: Math.round(crop.height * sf) };
  if (canvas.width !== expected.width || canvas.height !== expected.height) {
    return finish(1, `editor canvas is ${canvas.width}x${canvas.height}, expected ${expected.width}x${expected.height}`);
  }
  if (main.getSelectionWindows().length !== 0) return finish(1, 'selection overlays are still open');

  finish(0, `captured ${displays.length} display(s) with ${captureMode} capture, overlay showed a ${preview.width}x${preview.height} preview, editor opened with ${canvas.width}x${canvas.height}`);
}).catch((e) => finish(1, e.message));
