## 2025-05-15 - [Dynamic Slider Labels and Action State Synchronization]
**Learning:** In interactive tool-based applications, a single UI element (like a slider) may change purpose. Programmatically updating its accessibility attributes (title, aria-label) is crucial for screen reader users to maintain context. Additionally, global actions that clear state should be synchronized with that state to prevent confusion.
**Action:** Always check if a shared UI component needs updated metadata when the application mode changes, and ensure "Clear" or "Reset" actions are disabled when there is nothing to clear.

## 2025-05-15 - [Keyboard Accessibility with Focus-Visible]
**Learning:** Default focus rings are often suppressed for aesthetic reasons, but this breaks keyboard navigation. Using `:focus-visible` allows for a clear focus indicator that only appears for keyboard users, satisfying both design and accessibility requirements.
**Action:** Implement `:focus-visible` styles using the project's brand colors (e.g., #0a84ff) and a consistent offset to ensure high visibility without cluttering the mouse-driven UI.
