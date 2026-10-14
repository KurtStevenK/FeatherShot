const fs = require('fs');
const path = require('path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CLIPBOARD_TIMEOUT_MS = 5000;

function pad(n) {
  return String(n).padStart(2, '0');
}

// Local time, same pattern as the macOS app: 2026-10-14_11-15-00
function timestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function defaultFileName(date) {
  return `FeatherShot_${timestamp(date)}.png`;
}

// Writes FeatherShot_<timestamp>.png, adding -2, -3, … instead of overwriting a same-second capture.
async function savePng(buffer, dir, date) {
  await fs.promises.mkdir(dir, { recursive: true });
  const base = defaultFileName(date).replace(/\.png$/, '');
  for (let n = 1; ; n++) {
    const filePath = path.join(dir, n === 1 ? `${base}.png` : `${base}-${n}.png`);
    try {
      await fs.promises.writeFile(filePath, buffer, { flag: 'wx' });
      return filePath;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

// Electron 44 removed clipboard.writeImage; the async clipboard.write with ClipboardItem is main-process only.
async function copyPng(buffer, clipboard, ClipboardItem, timeoutMs = CLIPBOARD_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('The clipboard did not respond. Another app may be holding it open.')),
      timeoutMs
    );
  });
  try {
    await Promise.race([
      clipboard.write([new ClipboardItem({ 'image/png': new Blob([buffer], { type: 'image/png' }) })]),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function message(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}

// Save and copy are independent: a failed save still copies, and a busy clipboard never blocks the save.
async function saveAndCopy(pngBytes, { downloadsDir, clipboard, ClipboardItem, date = new Date(), clipboardTimeoutMs }) {
  const buffer = Buffer.from(pngBytes);
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('The editor did not produce a PNG image.');
  }
  const [saved, copied] = await Promise.allSettled([
    Promise.resolve().then(() => savePng(buffer, downloadsDir(), date)),
    copyPng(buffer, clipboard, ClipboardItem, clipboardTimeoutMs),
  ]);
  return {
    buffer,
    filePath: saved.status === 'fulfilled' ? saved.value : null,
    saveError: saved.status === 'rejected' ? message(saved.reason) : null,
    copyError: copied.status === 'rejected' ? message(copied.reason) : null,
  };
}

module.exports = { saveAndCopy, savePng, copyPng, timestamp, defaultFileName };
