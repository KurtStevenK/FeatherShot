## 2025-05-14 - Dynamic ARIA labels for multi-purpose controls
**Learning:** When a single UI control (like a slider) changes its function based on the active tool, updating only its visual label or title is insufficient for screen readers. The `aria-label` must be dynamically updated in sync with the tool state to maintain accessibility.
**Action:** Always ensure that any state-driven changes to a control's purpose are reflected by programmatically updating the `aria-label` and `title` attributes.
