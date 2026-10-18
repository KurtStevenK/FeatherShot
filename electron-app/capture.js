// Screen capture for the Windows/Linux app.
//
// Every display is captured BEFORE the selection overlay opens, and the selection is then cropped
// from those frozen images. Capturing after the overlay closed raced the overlay windows being
// destroyed: on Windows the capture then came back empty, included the dimmed overlay, or never
// resolved at all, and the editor silently did not open.
const {
  physicalThumbnailSize,
  cropRectInThumbnail,
  compositeCanvasSize,
  findOverlappingDisplays,
  matchSourceToDisplay,
} = require('./capture-utils');

const CAPTURE_TIMEOUT_MS = 15000;
const PREVIEW_JPEG_QUALITY = 92;

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${Math.round(ms / 1000)} s.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sizeKey(size) {
  return `${size.width}x${size.height}`;
}

// One desktopCapturer call per distinct physical display size: the thumbnail size applies to every
// source of a call, and a display is only 1:1 when its own physical size is requested.
async function captureAllDisplays(displays, desktopCapturer, { timeoutMs = CAPTURE_TIMEOUT_MS, log = () => {} } = {}) {
  const groups = new Map();
  for (const display of displays) {
    const size = physicalThumbnailSize(display);
    const key = sizeKey(size);
    if (!groups.has(key)) groups.set(key, { size, displays: [] });
    groups.get(key).displays.push(display);
  }

  const captures = [];
  const missing = [];
  for (const { size, displays: group } of groups.values()) {
    const started = Date.now();
    const sources = await withTimeout(
      desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size }),
      timeoutMs,
      'The screen capture'
    );
    log(
      `getSources ${sizeKey(size)} -> ${sources.length} source(s) in ${Date.now() - started} ms:`,
      sources.map((s) => `${s.id}/${s.display_id || '-'} ${sizeKey(s.thumbnail.getSize())}`).join(', ')
    );
    for (const display of group) {
      const src = matchSourceToDisplay(sources, display, displays);
      if (!src || src.thumbnail.isEmpty()) {
        missing.push(display);
        continue;
      }
      captures.push({
        display,
        bounds: display.bounds,
        thumbnail: src.thumbnail,
        bitmapSize: src.thumbnail.getSize(),
      });
    }
  }

  if (captures.length === 0) {
    throw new Error('The screen capture returned no image. On Windows, check that no other app blocks screen capture.');
  }
  for (const display of missing) {
    log(`display ${display.id} ${JSON.stringify(display.bounds)} has no capture; selections on it will fail`);
  }
  return captures;
}

// JPEG data URL of one display's capture for the overlay preview (the crop uses the PNG thumbnail).
function previewDataUrl(capture) {
  return `data:image/jpeg;base64,${capture.thumbnail.toJPEG(PREVIEW_JPEG_QUALITY).toString('base64')}`;
}

// Crops the selection (global DIP rect) out of the frozen captures. Returns a PNG data URL for one
// display, a composite for a selection across displays, or null when nothing was captured there.
function cropCaptures(crop, captures, displays) {
  const overlaps = findOverlappingDisplays(crop, displays);
  if (overlaps.length === 0) return null;

  const pieces = [];
  for (const { display, bounds, overlap } of overlaps) {
    const capture = captures.find((c) => c.display.id === display.id);
    if (!capture) continue;
    const rect = cropRectInThumbnail(capture.bitmapSize, bounds, overlap, crop, displays);
    if (rect.sw <= 0 || rect.sh <= 0) continue;
    pieces.push({
      dataUrl: capture.thumbnail.crop({ x: rect.sx, y: rect.sy, width: rect.sw, height: rect.sh }).toDataURL(),
      destX: rect.destX,
      destY: rect.destY,
      destW: rect.destW,
      destH: rect.destH,
    });
  }
  if (pieces.length === 0) return null;
  if (pieces.length === 1) return pieces[0].dataUrl;
  const size = compositeCanvasSize(pieces);
  return { type: 'composite', width: size.width, height: size.height, pieces };
}

module.exports = { captureAllDisplays, cropCaptures, previewDataUrl, withTimeout, CAPTURE_TIMEOUT_MS };
