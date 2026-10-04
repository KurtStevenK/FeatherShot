## 2025-05-14 - [Dynamic A11y Labels and State-Based Action Disabling]
**Learning:** For multi-purpose UI elements (like a slider that changes from Line Width to Zoom Level), static ARIA labels are insufficient. Dynamically updating `aria-label` and `title` ensures screen reader users maintain context during tool switching. Additionally, synchronizing the 'disabled' state of all canvas-clearing actions (Undo, Clear All) with the state of the 'drawings' array prevents confusing interactions on an empty canvas.
**Action:** Always verify if a UI element changes its semantic meaning based on application state, and programmatically update its accessibility attributes. Centralize state-based action disabling in a single synchronization function (e.g., `updateActionStates`).

## 2025-05-14 - [Destructive Action Confirmation]
**Learning:** Users can easily misclick destructive "Clear All" buttons, especially when they are adjacent to frequent actions like "Undo". A simple native `confirm()` dialog provides a low-friction but highly effective safety net that prevents accidental loss of all annotations.
**Action:** Implement confirmation dialogs for any action that results in significant, irreversible loss of user-generated content, even in lightweight utility apps.
