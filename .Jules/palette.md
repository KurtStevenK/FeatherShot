# Palette's Journal - FeatherShot UX & Accessibility Learnings

## 2025-05-14 - [Initial Assessment] Toolbar Accessibility Gaps
**Learning:** Icon-only buttons in the Electron app lack ARIA labels and focus visibility, making them difficult for screen reader and keyboard users.
**Action:** Always include ARIA labels for icon-only buttons and explicit focus-visible states in CSS.

## 2025-01-24 - [Success States & Accessibility]
**Learning:** Providing consistent visual feedback for destructive and final actions (like saving) across different platforms (macOS/Electron) makes the app feel more polished. ARIA labels on icon-only buttons are crucial for screen reader users to navigate complex toolbars.
**Action:** Always check if icon-only buttons have descriptive ARIA labels and ensure 'focus-visible' styles are defined for keyboard accessibility.
