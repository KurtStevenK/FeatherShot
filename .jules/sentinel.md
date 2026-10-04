## 2025-05-15 - [Electron IPC and Permission Hardening]
**Vulnerability:** The application was missing basic security hardening for the Electron Main process and Renderer windows. Specifically, IPC messages were unvalidated, and no Content Security Policy (CSP) was defined.
**Learning:** Even simple utilities like FeatherShot can benefit from Electron's security model. Denying all permission requests by default is a safe baseline for apps that don't need access to sensors or geolocation.
**Prevention:** Always validate data coming from the renderer in the main process. Implement a restrictive CSP to mitigate XSS risks, and explicitly deny unnecessary permissions using `setPermissionRequestHandler`.
