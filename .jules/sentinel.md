## 2025-05-15 - Electron Session Hardening Timing
**Vulnerability:** Potential bypass of permission request handlers if only listening to `session-created`.
**Learning:** In Electron, `session.defaultSession` is often initialized before the `app.on('session-created')` listener can be attached in `app.whenReady()`. This means the primary session might lack the security restrictions intended for all sessions.
**Prevention:** Always apply security configurations (like `setPermissionRequestHandler`) directly to `session.defaultSession` in addition to using the `session-created` event for any dynamically created sessions.
