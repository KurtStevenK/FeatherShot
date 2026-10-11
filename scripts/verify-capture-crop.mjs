#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  findOverlappingDisplays,
  cropRectInThumbnail,
  compositeCanvasSize,
  physicalThumbnailSize,
} = require(path.join(root, 'electron-app/capture-utils.js'));

// Kurt's Windows layout: left 1920×1200, primary 2560×1440, right 1080×2560 portrait
const displays = [
  { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1200 }, scaleFactor: 1 },
  { id: 2, bounds: { x: 0, y: 0, width: 2560, height: 1440 }, scaleFactor: 1 },
  { id: 3, bounds: { x: 2560, y: 0, width: 1080, height: 2560 }, scaleFactor: 1 },
];

// Selection only on left monitor (full native 1920×1200)
const leftOnly = { x: -1920, y: 0, width: 1920, height: 1200 };
const leftOverlaps = findOverlappingDisplays(leftOnly, displays);
if (leftOverlaps.length !== 1) {
  console.error('expected one display overlap for left-only crop, got', leftOverlaps.length);
  process.exit(1);
}

const leftThumb = physicalThumbnailSize(leftOverlaps[0].display);
const leftCrop = cropRectInThumbnail(
  leftThumb,
  leftOverlaps[0].bounds,
  leftOverlaps[0].overlap,
  leftOnly,
  displays
);
if (leftCrop.sw !== 1920 || leftCrop.sh !== 1200) {
  console.error('left-only crop should be 1920×1200 pixels, got', leftCrop.sw, leftCrop.sh);
  process.exit(1);
}

// Cross from left into primary
const cross = { x: -400, y: 200, width: 1200, height: 600 };
const crossOverlaps = findOverlappingDisplays(cross, displays);
if (crossOverlaps.length !== 2) {
  console.error('expected two overlaps for cross-monitor crop, got', crossOverlaps.length);
  process.exit(1);
}

const pieces = crossOverlaps.map(({ display, bounds, overlap }) => {
  const thumb = physicalThumbnailSize(display);
  const c = cropRectInThumbnail(thumb, bounds, overlap, cross, displays);
  return { destX: c.destX, destY: c.destY, destW: c.destW, destH: c.destH };
});
const { width, height } = compositeCanvasSize(pieces);
if (width <= 0 || height <= 0) {
  console.error('invalid composite size', width, height);
  process.exit(1);
}

// Left segment: 400 CSS px at 1:1 → 400 px wide; primary segment: 800 CSS px → 800 px
const leftPiece = pieces.find((p) => p.destX === 0);
const primaryPiece = pieces.find((p) => p.destX > 0);
if (!leftPiece || leftPiece.destW !== 400) {
  console.error('left piece width should be 400px, got', leftPiece);
  process.exit(1);
}
if (!primaryPiece || primaryPiece.destW !== 800) {
  console.error('primary piece width should be 800px, got', primaryPiece);
  process.exit(1);
}

console.log('capture crop math OK');
