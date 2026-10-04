## 2025-05-15 - [Correcting Micro-optimization vs Robustness]
**Learning:** Prioritizing minor performance gains in a render loop (like removing integer increments) can lead to regressions in dynamic UI behavior (like auto-renumbering). Bolt optimizations should focus on high-impact bottlenecks like layout thrashing and frame rate throttling.
**Action:** Always verify that performance optimizations do not compromise core features such as dynamic re-calculation of state during rendering.
