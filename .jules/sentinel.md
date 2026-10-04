## 2025-05-14 - Electron Session and Renderer Hardening
**Vulnerability:** The Electron application lacked critical defense-in-depth measures, including restricted permissions, navigation guards, and a Content Security Policy (CSP). This left the application vulnerable to potential XSS and RCE if the renderer process were compromised.
**Learning:** Default Electron sessions are overly permissive. Security must be explicitly configured both in the main process (via `session` and `web-contents-created` events) and the renderer process (via CSP meta tags).
**Prevention:** Always implement `setPermissionRequestHandler`, `setWindowOpenHandler`, and restrict `will-navigate` in the main process. Supplement these with a strict CSP in all HTML files.
