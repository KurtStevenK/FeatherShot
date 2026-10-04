## 2025-05-14 - Electron Session Hardening
**Vulnerability:** Default Electron sessions may retain default permissions if not explicitly configured upon app readiness.
**Learning:** Configuring `session.defaultSession` permissions within `app.whenReady()` is necessary to protect the initial session, while the `session-created` event handles any subsequent sessions.
**Prevention:** Always initialize global security settings (permissions, navigation handlers) immediately after the `ready` event and use global event listeners for newly created web contents and sessions.
