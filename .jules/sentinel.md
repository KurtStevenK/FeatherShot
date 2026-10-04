## 2025-05-15 - [Secure Temporary Path Usage]
**Vulnerability:** Hardcoded temporary file paths in world-writable directories (like `/tmp`) can lead to symlink attacks or race conditions.
**Learning:** MacOS provides `FileManager.default.temporaryDirectory`, which returns a unique, user-isolated temporary directory that is significantly more secure than `/tmp`.
**Prevention:** Always use system APIs to resolve temporary directories rather than hardcoding paths.
