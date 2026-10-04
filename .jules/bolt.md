## 2024-05-21 - [Electron Canvas Performance]
**Learning:** Redundant encoding/decoding cycles (e.g., Canvas -> DataURL -> Image) are extremely costly in Electron renderers, especially for high-resolution images. Extracting the PNG buffer directly from a Base64 string is significantly faster than re-encoding with `toPNG()`.
**Action:** Always look for intermediate encoding steps in image pipelines and eliminate them by sharing raw canvas or buffer objects.

## 2024-05-21 - [NativeImage createFromBitmap Risk]
**Learning:** `nativeImage.createFromBitmap` is fast but dangerous for cross-platform apps because it expects native byte order (BGRA on Windows, RGBA on others), while Web Canvas `getImageData` always returns RGBA.
**Action:** Stick to PNG buffers or Data URLs for `nativeImage` creation unless performance is so critical that platform-specific byte-swapping is justified.
