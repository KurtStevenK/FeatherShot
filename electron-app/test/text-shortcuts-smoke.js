// Real-Electron smoke test for the editor's keyboard shortcuts around a text annotation: keys typed
// into the text box must stay text (no tool switch, no undo), and the shortcuts work again afterwards.
//   npx electron test/text-shortcuts-smoke.js
//   xvfb-run -a npx electron --no-sandbox test/text-shortcuts-smoke.js   (Linux CI)
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

// Each character is also a tool shortcut: Arrow, Arrow, Magnifier, Exclamation Arrow and Rectangle.
const TYPED = 'a3m-=';

function finish(code, message) {
  console.log(`Text shortcuts smoke test ${code === 0 ? 'passed' : 'failed'}: ${message}`);
  app.exit(code);
}
setTimeout(() => finish(1, 'timed out'), 60000);

app.whenReady().then(async () => {
  const editor = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  await editor.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  editor.focus();

  const page = (js) => editor.webContents.executeJavaScript(js);
  const state = () => page(`({ tool, editing: editingTextId !== null, typed: textEditor.value,
    focused: document.activeElement === textEditor, texts: drawings.map((d) => d.text) })`);
  // keyDown/keyUp are real input events for the page's key listeners. The character is typed with
  // execCommand: CI windows never get OS focus, so Chromium drops synthetic 'char' events there,
  // and webContents.insertText never resolves without a focused window.
  const press = async (keyCode, modifiers = []) => {
    editor.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    if (keyCode.length === 1 && modifiers.length === 0) {
      await page(`document.execCommand('insertText', false, ${JSON.stringify(keyCode)})`);
    }
    editor.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  };
  // Resolves once `check(state)` holds; fails with the editor state otherwise.
  const expect = async (check, what) => {
    const started = Date.now();
    for (;;) {
      const s = await state();
      if (check(s)) return s;
      if (Date.now() - started > 5000) throw new Error(`expected ${what}, editor state ${JSON.stringify(s)}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const screenshot = nativeImage.createFromBitmap(Buffer.alloc(400 * 300 * 4, 0xff), { width: 400, height: 300 });
  editor.webContents.send('load-screenshot', screenshot.toDataURL());
  await page(`new Promise((resolve) => (function wait() {
    document.getElementById('canvas').width === 400 ? resolve() : setTimeout(wait, 50);
  })())`);

  await press('t');
  await expect((s) => s.tool === 'text', 'T to pick the Text tool');

  const [x, y] = await page(`(() => {
    const r = document.getElementById('canvas').getBoundingClientRect();
    return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
  })()`);
  editor.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  editor.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  await expect((s) => s.editing && s.focused, 'a click to open a focused text box');

  await press('z', ['control']);
  for (const ch of TYPED) await press(ch);
  await expect((s) => s.typed === TYPED, `"${TYPED}" typed into the text box`);
  await expect((s) => s.tool === 'text' && s.editing && s.texts.length === 1, 'no tool switch and no undo while typing');

  await press('Enter');
  await expect((s) => !s.editing && s.texts.join() === TYPED, 'Enter to commit the text');

  await press('3');
  await expect((s) => s.tool === 'arrow', '3 to pick the Arrow tool after the text is done');
  await press('z', ['control']);
  await expect((s) => s.texts.length === 0, 'Ctrl+Z to undo the text annotation');

  finish(0, `typed "${TYPED}" into a text annotation without switching tools; shortcuts work afterwards`);
}).catch((e) => finish(1, e.message));
