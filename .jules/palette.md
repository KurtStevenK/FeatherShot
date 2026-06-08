## 2025-05-15 - [Dynamic Contextual Accessibility]
**Learning:** When a single UI control (like a range slider) serves multiple purposes depending on the active tool, its `aria-label` and `title` must be updated programmatically to reflect the current context.
**Action:** Always update accessibility attributes (`aria-label`, `title`) in the tool selection logic if the control's function changes.

## 2025-05-15 - [Accessible Keyboard Feedback]
**Learning:** Icon-heavy toolbars often lack focus indicators, making keyboard navigation difficult. Standardized focus styles ensure accessibility without cluttering the mouse-driven UI.
**Action:** Apply `outline: 2px solid #0a84ff; outline-offset: 2px;` to `:focus-visible` states for interactive elements.
