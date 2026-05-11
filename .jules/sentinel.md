## 2025-05-14 - [Insecure Temporary File Usage]
**Vulnerability:** The macOS application used a hardcoded path in the shared `/tmp` directory (`/tmp/feathershot_temp.png`) to store screenshots before they were loaded into the editor.
**Learning:** Fixed paths in world-writable directories like `/tmp` are susceptible to symlink attacks where another user could redirect the file write to an arbitrary location or read the screenshot data.
**Prevention:** Always use user-specific temporary directories provided by the operating system, such as `FileManager.default.temporaryDirectory` on macOS, which ensures isolation between users.
