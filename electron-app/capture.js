const {
  physicalThumbnailSize,
  cropRectInThumbnail,
  compositeCanvasSize,
  findOverlappingDisplays,
  matchSourceToDisplay,
} = require('./capture-utils');

const CAPTURE_SETTLE_MS = 150;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureDisplaysForCrop(crop, displays, desktopCapturer) {
  const overlaps = findOverlappingDisplays(crop, displays);
  if (overlaps.length === 0) return null;

  const captured = [];
  for (const { display, bounds, overlap } of overlaps) {
    const thumbSize = physicalThumbnailSize(display);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbSize,
    });
    const src = matchSourceToDisplay(sources, display, displays);
    if (!src) continue;
    const bitmapSize = src.thumbnail.getSize();
    captured.push({
      thumbnail: src.thumbnail,
      bounds,
      overlap,
      bitmapSize,
    });
  }

  if (captured.length === 0) return null;

  if (captured.length === 1) {
    const c = captured[0];
    const rect = cropRectInThumbnail(c.bitmapSize, c.bounds, c.overlap, crop, displays);
    if (rect.sw <= 0 || rect.sh <= 0) return null;
    return c.thumbnail.crop({ x: rect.sx, y: rect.sy, width: rect.sw, height: rect.sh }).toDataURL();
  }

  const pieces = [];
  for (const c of captured) {
    const rect = cropRectInThumbnail(c.bitmapSize, c.bounds, c.overlap, crop, displays);
    if (rect.sw <= 0 || rect.sh <= 0) continue;
    pieces.push({
      dataUrl: c.thumbnail
        .crop({ x: rect.sx, y: rect.sy, width: rect.sw, height: rect.sh })
        .toDataURL(),
      destX: rect.destX,
      destY: rect.destY,
      destW: rect.destW,
      destH: rect.destH,
    });
  }
  if (pieces.length === 0) return null;
  const size = compositeCanvasSize(pieces);
  return { type: 'composite', width: size.width, height: size.height, pieces };
}

async function buildScreenshotFromCrop(crop, displays, desktopCapturer) {
  await delay(CAPTURE_SETTLE_MS);
  return captureDisplaysForCrop(crop, displays, desktopCapturer);
}

module.exports = { buildScreenshotFromCrop, CAPTURE_SETTLE_MS };
