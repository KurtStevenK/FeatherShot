## 2025-05-14 - [Editor Rendering Optimizations]
**Learning:** High-frequency events like `mousemove` can cause significant performance degradation in Electron apps if they trigger layout reflows (via `getBoundingClientRect`) or redundant canvas re-renders. Throttling and layout caching are essential for maintaining a responsive UI during interactive tasks like drawing.
**Action:** Always cache layout-triggering properties outside of high-frequency event handlers and use `requestAnimationFrame` to throttle rendering passes to the display's refresh rate.
