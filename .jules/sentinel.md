# Sentinel Journal

## 2025-05-14 - initial security assessment
**Vulnerability:** Found `nodeIntegration: true` and `contextIsolation: false` in Electron `main.js`.
**Learning:** This is a classic Electron security risk that allows the renderer process to access Node.js APIs directly, making it vulnerable to RCE if any untrusted content is loaded.
**Prevention:** Always use `contextIsolation: true` and `nodeIntegration: false`, and use a `preload` script to expose specific functionality via `contextBridge`.
