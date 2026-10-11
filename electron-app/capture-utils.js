/**
 * Display overlap and crop math for multi-monitor screenshots.
 * Uses actual thumbnail bitmap size vs DIP bounds (handles scaled thumbnails).
 */

function physicalThumbnailSize(display) {
  const sf = display.scaleFactor || 1;
  return {
    width: Math.round(display.bounds.width * sf),
    height: Math.round(display.bounds.height * sf),
  };
}

function pxPerDip(thumbnailSize, bounds) {
  return {
    x: thumbnailSize.width / bounds.width,
    y: thumbnailSize.height / bounds.height,
  };
}

function overlapsForCrop(crop, bounds) {
  const ox1 = Math.max(crop.x, bounds.x);
  const oy1 = Math.max(crop.y, bounds.y);
  const ox2 = Math.min(crop.x + crop.width, bounds.x + bounds.width);
  const oy2 = Math.min(crop.y + crop.height, bounds.y + bounds.height);
  if (ox2 <= ox1 || oy2 <= oy1) return null;
  return { ox1, oy1, ox2, oy2 };
}

function displayAtGlobalX(displays, x) {
  for (const display of displays) {
    const b = display.bounds;
    if (x >= b.x && x < b.x + b.width) return display;
  }
  return displays[0];
}

function displayAtGlobalY(displays, y) {
  for (const display of displays) {
    const b = display.bounds;
    if (y >= b.y && y < b.y + b.height) return display;
  }
  return displays[0];
}

function pxPerDipForDisplay(display) {
  const thumb = physicalThumbnailSize(display);
  return pxPerDip(thumb, display.bounds);
}

/** Map global CSS X to composite pixel X along [crop.x, globalX]. */
function globalXToCompositePx(globalX, cropX, displays) {
  let px = 0;
  let x = cropX;
  const target = globalX;
  while (x < target) {
    const display = displayAtGlobalX(displays, x);
    const b = display.bounds;
    const ratio = pxPerDipForDisplay(display);
    const segmentEnd = Math.min(target, b.x + b.width);
    px += (segmentEnd - x) * ratio.x;
    x = segmentEnd;
  }
  return Math.round(px);
}

function globalYToCompositePx(globalY, cropY, displays) {
  let px = 0;
  let y = cropY;
  const target = globalY;
  while (y < target) {
    const display = displayAtGlobalY(displays, y);
    const b = display.bounds;
    const ratio = pxPerDipForDisplay(display);
    const segmentEnd = Math.min(target, b.y + b.height);
    px += (segmentEnd - y) * ratio.y;
    y = segmentEnd;
  }
  return Math.round(px);
}

function cropRectInThumbnail(thumbnailSize, bounds, overlap, crop, displays) {
  const ratio = pxPerDip(thumbnailSize, bounds);
  const sx = Math.max(0, Math.round((overlap.ox1 - bounds.x) * ratio.x));
  const sy = Math.max(0, Math.round((overlap.oy1 - bounds.y) * ratio.y));
  const sw = Math.min(
    Math.round((overlap.ox2 - overlap.ox1) * ratio.x),
    thumbnailSize.width - sx
  );
  const sh = Math.min(
    Math.round((overlap.oy2 - overlap.oy1) * ratio.y),
    thumbnailSize.height - sy
  );
  const destX = globalXToCompositePx(overlap.ox1, crop.x, displays);
  const destY = globalYToCompositePx(overlap.oy1, crop.y, displays);
  const destW = globalXToCompositePx(overlap.ox2, crop.x, displays) - destX;
  const destH = globalYToCompositePx(overlap.oy2, crop.y, displays) - destY;
  return { sx, sy, sw, sh, destX, destY, destW, destH };
}

function compositeCanvasSize(pieces) {
  let w = 0;
  let h = 0;
  for (const p of pieces) {
    w = Math.max(w, p.destX + p.destW);
    h = Math.max(h, p.destY + p.destH);
  }
  return { width: w, height: h };
}

function findOverlappingDisplays(crop, displays) {
  const overlaps = [];
  for (const display of displays) {
    const bounds = display.bounds;
    const overlap = overlapsForCrop(crop, bounds);
    if (overlap) overlaps.push({ display, bounds, overlap });
  }
  return overlaps;
}

function matchSourceToDisplay(sources, display, displays) {
  let src = sources.find((s) => s.display_id === display.id.toString());
  if (!src) {
    const i = displays.indexOf(display);
    src = sources[i < sources.length ? i : 0];
  }
  return src;
}

module.exports = {
  physicalThumbnailSize,
  pxPerDip,
  overlapsForCrop,
  cropRectInThumbnail,
  compositeCanvasSize,
  findOverlappingDisplays,
  matchSourceToDisplay,
  globalXToCompositePx,
  globalYToCompositePx,
};
