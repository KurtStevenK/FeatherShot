#!/usr/bin/env node
// Save & Copy logic for the Electron app (Windows / Linux), with a fake clipboard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { saveAndCopy, timestamp } = require(path.join(root, 'electron-app/save-and-copy.js'));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('body')]);
const date = new Date(2026, 9, 14, 9, 5, 7);

class FakeClipboardItem {
  constructor(items) {
    this.items = items;
  }
}

function fakeClipboard(behavior = 'ok') {
  const clipboard = { written: null };
  clipboard.write = async (items) => {
    if (behavior === 'reject') throw new Error('clipboard locked');
    if (behavior === 'hang') return new Promise(() => {});
    clipboard.written = Buffer.from(await items[0].items['image/png'].arrayBuffer());
  };
  return clipboard;
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'feathershot-save-'));
}

const failures = [];
async function test(name, fn) {
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

await test('local-time file name matching the macOS app', async () => {
  assert.equal(timestamp(date), '2026-10-14_09-05-07');
});

await test('saves the PNG and copies the same bytes', async () => {
  const dir = tempDir();
  const clipboard = fakeClipboard();
  const result = await saveAndCopy(PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length), {
    downloadsDir: () => dir, clipboard, ClipboardItem: FakeClipboardItem, date,
  });
  assert.equal(result.saveError, null);
  assert.equal(result.copyError, null);
  assert.equal(path.basename(result.filePath), 'FeatherShot_2026-10-14_09-05-07.png');
  assert.deepEqual(fs.readFileSync(result.filePath), PNG);
  assert.deepEqual(clipboard.written, PNG);
});

await test('same-second save gets a -2 suffix instead of overwriting', async () => {
  const dir = tempDir();
  const options = { downloadsDir: () => dir, clipboard: fakeClipboard(), ClipboardItem: FakeClipboardItem, date };
  await saveAndCopy(PNG, options);
  const second = await saveAndCopy(PNG, options);
  assert.equal(path.basename(second.filePath), 'FeatherShot_2026-10-14_09-05-07-2.png');
});

await test('clipboard failure still saves the file', async () => {
  const dir = tempDir();
  const result = await saveAndCopy(PNG, {
    downloadsDir: () => dir, clipboard: fakeClipboard('reject'), ClipboardItem: FakeClipboardItem, date,
  });
  assert.match(result.copyError, /clipboard locked/);
  assert.equal(result.saveError, null);
  assert.ok(fs.existsSync(result.filePath));
});

await test('a clipboard that never answers times out and still saves', async () => {
  const dir = tempDir();
  const result = await saveAndCopy(PNG, {
    downloadsDir: () => dir, clipboard: fakeClipboard('hang'), ClipboardItem: FakeClipboardItem, date, clipboardTimeoutMs: 50,
  });
  assert.match(result.copyError, /did not respond/);
  assert.ok(fs.existsSync(result.filePath));
});

await test('save failure still copies to the clipboard', async () => {
  const notADirectory = path.join(tempDir(), 'Downloads');
  fs.writeFileSync(notADirectory, '');
  const clipboard = fakeClipboard();
  const result = await saveAndCopy(PNG, {
    downloadsDir: () => notADirectory, clipboard, ClipboardItem: FakeClipboardItem, date,
  });
  assert.ok(result.saveError);
  assert.equal(result.filePath, null);
  assert.equal(result.copyError, null);
  assert.deepEqual(clipboard.written, PNG);
});

await test('a downloads path lookup that throws is reported as a save error', async () => {
  const result = await saveAndCopy(PNG, {
    downloadsDir: () => { throw new Error('no downloads folder'); },
    clipboard: fakeClipboard(), ClipboardItem: FakeClipboardItem, date,
  });
  assert.match(result.saveError, /no downloads folder/);
  assert.equal(result.copyError, null);
});

await test('rejects data that is not a PNG', async () => {
  await assert.rejects(
    saveAndCopy(Buffer.from('not a png'), {
      downloadsDir: () => tempDir(), clipboard: fakeClipboard(), ClipboardItem: FakeClipboardItem, date,
    }),
    /did not produce a PNG/
  );
});

// electron-builder only packages the whitelisted files; a missing module crashes the installed app.
await test('every local module main.js requires is packaged', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'electron-app/package.json'), 'utf8'));
  const seen = new Set();
  const queue = ['main.js'];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(path.join(root, 'electron-app', file), 'utf8');
    for (const [, rel] of src.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
      queue.push(rel.endsWith('.js') ? rel : `${rel}.js`);
    }
  }
  const missing = [...seen].filter((f) => !pkg.build.files.includes(f));
  assert.deepEqual(missing, [], `not in electron-app/package.json build.files: ${missing.join(', ')}`);
});

if (failures.length) {
  console.error(`Electron Save & Copy checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Electron Save & Copy OK');
