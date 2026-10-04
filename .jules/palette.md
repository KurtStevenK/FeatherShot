## 2025-06-29 - Synchronizing Dynamic Control Purpose
**Learning:** When a UI element (like a range slider) switches its function dynamically (e.g., from 'Line Width' to 'Zoom Level'), updating only the visual label or `title` attribute is insufficient for accessibility. The `aria-label` must be programmatically updated to ensure screen reader users receive immediate context about the control's new purpose.
**Action:** Always update both `title` and `aria-label` simultaneously when a control's role or purpose changes in response to user selection.
