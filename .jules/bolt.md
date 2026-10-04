# Bolt's Performance Journal

This journal tracks critical performance-related learnings for the FeatherShot project.

## 2025-05-15 - Caching Layout and Throttling Renders
**Learning:** Calling `getBoundingClientRect()` in a `mousemove` handler causes layout thrashing by forcing synchronous reflows. Additionally, frequent mouse events can lead to more render calls than the screen can display, causing "frame piling".
**Action:** Cache the bounding rect and scale factors during `mousedown` and use `requestAnimationFrame` to throttle `render()` calls during `mousemove`.
