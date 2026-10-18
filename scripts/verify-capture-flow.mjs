#!/usr/bin/env node
// Capture-first flow of the Electron app with a fake desktopCapturer: every display is captured before
// the overlay opens, a hung capture times out, and the selection is cropped from the frozen images.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { captureAllDisplays, cropCaptures } = require(path.join(root, 'electron-app/capture.js'));

// Kurt's Windows layout: left 1920×1200, primary 2560×1440, right 1080×2560 portrait
const displays = [
  { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1200 }, scaleFactor: 1 },
  { id: 2, bounds: { x: 0, y: 0, width: 2560, height: 1440 }, scaleFactor: 1 },
  { id: 3, bounds: { x: 2560, y: 0, width: 1080, height: 2560 }, scaleFactor: 1 },
];

// A thumbnail like Electron's nativeImage: crop() records the rect and toDataURL() names the source.
function fakeThumbnail(name, width, height, empty = false) {
  return {
    name,
    getSize: () => ({ width, height }),
    isEmpty: () => empty,
    crop: (rect) => ({ toDataURL: () => `data:${name}:${rect.x},${rect.y},${rect.width},${rect.height}` }),
  };
}

// desktopCapturer.getSources: every screen at the requested thumbnail size, like Chromium (aspect fit).
function fakeCapturer({ hang = false, emptyDisplayIds = [], calls = [] } = {}) {
  return {
    getSources: async ({ thumbnailSize }) => {
      calls.push(thumbnailSize);
      if (hang) return new Promise(() => {});
      return displays.map((d) => {
        const scale = Math.min(thumbnailSize.width / d.bounds.width, thumbnailSize.height / d.bounds.height);
        return {
          id: `screen:${d.id}:0`,
          display_id: String(d.id),
          thumbnail: fakeThumbnail(
            `d${d.id}`,
            Math.round(d.bounds.width * scale),
            Math.round(d.bounds.height * scale),
            emptyDisplayIds.includes(d.id)
          ),
        };
      });
    },
  };
}

const failures = [];
async function test(name, fn) {
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

await test('captures every display 1:1 with one getSources call per physical size', async () => {
  const calls = [];
  const captures = await captureAllDisplays(displays, fakeCapturer({ calls }));
  assert.equal(captures.length, 3);
  assert.equal(calls.length, 3, 'three distinct sizes → three calls');
  for (const c of captures) {
    assert.deepEqual(c.bitmapSize, { width: c.display.bounds.width, height: c.display.bounds.height });
  }
});

await test('same-size displays share one getSources call', async () => {
  const twins = [
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
  ];
  const calls = [];
  const capturer = {
    getSources: async ({ thumbnailSize }) => {
      calls.push(thumbnailSize);
      return twins.map((d) => ({ id: `screen:${d.id}:0`, display_id: String(d.id), thumbnail: fakeThumbnail(`d${d.id}`, 1920, 1080) }));
    },
  };
  const captures = await captureAllDisplays(twins, capturer);
  assert.equal(captures.length, 2);
  assert.equal(calls.length, 1);
});

await test('a capture that never answers fails with a timeout instead of hanging', async () => {
  await assert.rejects(
    captureAllDisplays(displays, fakeCapturer({ hang: true }), { timeoutMs: 30 }),
    /did not finish within/
  );
});

await test('all-empty thumbnails are an error, one empty display is logged and skipped', async () => {
  await assert.rejects(
    captureAllDisplays(displays, fakeCapturer({ emptyDisplayIds: [1, 2, 3] })),
    /returned no image/
  );
  const lines = [];
  const captures = await captureAllDisplays(displays, fakeCapturer({ emptyDisplayIds: [3] }), { log: (...p) => lines.push(p.join(' ')) });
  assert.equal(captures.length, 2);
  assert.ok(lines.some((l) => /display 3 .* has no capture/.test(l)), lines.join('\n'));
});

await test('a selection on one display is a 1:1 crop of its frozen capture', async () => {
  const captures = await captureAllDisplays(displays, fakeCapturer());
  const payload = cropCaptures({ x: -1800, y: 100, width: 600, height: 400 }, captures, displays);
  assert.equal(payload, 'data:d1:120,100,600,400');
});

await test('a selection across displays composites pieces from each frozen capture', async () => {
  const captures = await captureAllDisplays(displays, fakeCapturer());
  const payload = cropCaptures({ x: -400, y: 200, width: 1200, height: 600 }, captures, displays);
  assert.equal(payload.type, 'composite');
  assert.deepEqual({ width: payload.width, height: payload.height }, { width: 1200, height: 600 });
  const left = payload.pieces.find((p) => p.destX === 0);
  const primary = payload.pieces.find((p) => p.destX === 400);
  assert.equal(left.dataUrl, 'data:d1:1520,200,400,600');
  assert.equal(primary.dataUrl, 'data:d2:0,200,800,600');
});

await test('a selection on a display without a capture is null, not a crash', async () => {
  const captures = await captureAllDisplays(displays, fakeCapturer({ emptyDisplayIds: [3] }));
  assert.equal(cropCaptures({ x: 2600, y: 100, width: 200, height: 200 }, captures, displays), null);
  assert.equal(cropCaptures({ x: 9000, y: 9000, width: 10, height: 10 }, captures, displays), null);
});

if (failures.length) {
  console.error(`Electron capture flow checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Electron capture flow OK');
