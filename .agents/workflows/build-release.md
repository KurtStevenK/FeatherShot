---
description: How to build and publish a new release of FeatherShot
---

# Build & Release Workflow

Follow these steps to cut a new release of FeatherShot.

## 1. Decide the New Version

Choose the next version number following [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): Bug fixes, minor tweaks
- **Minor** (1.x.0): New features, new tools
- **Major** (x.0.0): Breaking changes, major redesign

## 2. Bump the Version

### macOS (Swift)

Update the version string in **all 3 locations**:

#### `Info.plist`

```xml
<key>CFBundleShortVersionString</key>
<string>NEW_VERSION</string>
<key>CFBundleVersion</key>
<string>NEW_VERSION</string>
```

#### `build_release.sh`

Update the version in the embedded Info.plist **and** the DMG filename:

```bash
# In the heredoc Info.plist:
<string>NEW_VERSION</string>   # CFBundleShortVersionString
<string>NEW_VERSION</string>   # CFBundleVersion

# DMG filename (2 occurrences):
rm -f "FeatherShot NEW_VERSION.dmg"
"FeatherShot NEW_VERSION.dmg" \
```

#### `generate_assets.swift`

```swift
let subtitle = "Version NEW_VERSION"
```

### Electron App

#### `electron-app/package.json`

```json
"version": "NEW_VERSION"
```

### Chrome Extension

#### `chrome-extension/manifest.json`

```json
"version": "NEW_VERSION"
```

## 3. Update the Changelog

Add a new section at the top of `CHANGELOG.md`:

```markdown
## [NEW_VERSION] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Update the comparison links at the bottom of the file.

## 4. Build the macOS Release

```bash
// turbo
chmod +x build_release.sh
```

```bash
./build_release.sh
```

This will:

- Generate the app icon from `icon_1024.png`
- Compile the release binary
- Create `FeatherShot.app` bundle with code signing
- Create the styled DMG installer

## 5. Build the Electron App (Windows/Linux)

```bash
cd electron-app
npm ci
npm run build:all
```

This produces:

- `dist/FeatherShot Setup.exe` — Windows NSIS installer
- `dist/FeatherShot.exe` — Windows portable
- `dist/feathershot.deb` — Debian/Ubuntu package
- `dist/FeatherShot.AppImage` — Universal Linux binary

## 6. Package the Chrome Extension

```bash
cd chrome-extension
zip -r ../FeatherShot-Chrome-Extension.zip . -x ".*"
```

## 7. Test the Builds

1. **macOS**: Mount the DMG, drag to Applications, verify 🪶 menu bar icon
2. **Windows**: Run the installer, check tray icon, take screenshot, annotate
3. **Linux**: Install the `.deb` or run `.AppImage`, verify tray and annotation
4. **Chrome**: Load unpacked extension, capture a tab, annotate, save

## 8. Commit & Tag

```bash
git add -A
git commit -m "Release vNEW_VERSION"
git tag vNEW_VERSION
git push origin main --tags
```

> **Note:** Pushing a tag prefixed with `v` will automatically trigger the GitHub Actions CI/CD workflow, which builds all platforms and creates a GitHub Release with all artifacts attached.

## 9. Create GitHub Release (Manual Fallback)

If the automated workflow doesn't run or you prefer manual control:

1. Go to **Releases → Create a new release** on GitHub
2. Select the `vNEW_VERSION` tag
3. Title: `FeatherShot vNEW_VERSION`
4. Paste the changelog entry as the description
5. Attach: DMG, EXE, DEB, AppImage, Chrome Extension ZIP
6. Publish
