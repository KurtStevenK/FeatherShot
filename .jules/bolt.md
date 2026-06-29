## 2026-06-29 - Throttling Canvas Rendering
**Learning:** Calling `getBoundingClientRect()` in high-frequency event handlers like `mousemove` causes layout thrashing, significantly impacting performance. Throttling render calls with `requestAnimationFrame` ensures that the UI only updates as fast as the display can refresh.
**Action:** Always cache layout-triggering properties before a high-frequency interaction loop begins, and use `requestAnimationFrame` to throttle visual updates.
