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

Update the version string in **all 3 locations**:

### `Info.plist`
```xml
<key>CFBundleShortVersionString</key>
<string>NEW_VERSION</string>
<key>CFBundleVersion</key>
<string>NEW_VERSION</string>
```

### `build_release.sh`
Update the version in the embedded Info.plist **and** the DMG filename:
```bash
# In the heredoc Info.plist:
<string>NEW_VERSION</string>   # CFBundleShortVersionString
<string>NEW_VERSION</string>   # CFBundleVersion

# DMG filename (2 occurrences):
rm -f "FeatherShot NEW_VERSION.dmg"
"FeatherShot NEW_VERSION.dmg" \
```

### `generate_assets.swift`
```swift
let subtitle = "Version NEW_VERSION"
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

## 4. Build the Release

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

## 5. Test the DMG

1. Mount the DMG and drag the app to Applications
2. Launch and verify the 🪶 icon appears in the menu bar
3. Take a screenshot, annotate it, save & copy
4. Verify the version number in the DMG background

## 6. Commit & Tag

```bash
git add -A
git commit -m "Release vNEW_VERSION"
git tag vNEW_VERSION
git push origin main --tags
```

## 7. Create GitHub Release

1. Go to **Releases → Create a new release** on GitHub
2. Select the `vNEW_VERSION` tag
3. Title: `FeatherShot vNEW_VERSION`
4. Paste the changelog entry as the description
5. Attach the DMG file
6. Publish
