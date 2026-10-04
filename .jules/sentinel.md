# Sentinel's Security Journal

## 2025-05-14 - [Renderer Hardening with CSP]
**Vulnerability:** Lack of Content Security Policy (CSP) in Electron renderer windows.
**Learning:** Even with `nodeIntegration: true`, adding a CSP provides a vital defense-in-depth layer against XSS. However, restrictive CSPs (`default-src 'none'`) must be carefully tuned to allow necessary resources like `data:` URIs for screenshots and `unsafe-inline` for dynamic styling.
**Prevention:** Always include a baseline CSP in every HTML entry point, preferring `default-src 'none'` and explicitly whitelisting required sources.
