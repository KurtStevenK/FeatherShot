## 2026-02-14 - Editor Accessibility & Safety
**Learning:** Icon-only toolbars in Electron/web apps often lack semantic state and keyboard feedback. Using `aria-pressed` on tool buttons and `focus-visible` with a distinct outline ensures that both screen reader and keyboard-only users can navigate and understand the application state.
**Action:** Always pair `aria-label` (including shortcuts) with `aria-pressed` for toggle/tool buttons, and implement `focus-visible` styles to avoid "invisible focus" for keyboard users.
