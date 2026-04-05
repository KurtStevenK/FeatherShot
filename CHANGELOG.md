# Changelog

All notable changes to FeatherShot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-05

### Added

- **Windows Support** — FeatherShot is now available on Windows as an Electron-based desktop app with NSIS installer and portable `.exe`.
- **Linux Support** — FeatherShot is now available on Linux with `.deb` (Ubuntu/Debian) and `.AppImage` packages.
- **Chrome Extension** — New browser extension for Chrome, Edge, Brave, and Arc. Capture the visible tab and annotate it directly in the browser.
- **GitHub Actions CI/CD** — Automated multi-platform build pipeline triggered on version tags. Builds macOS DMG, Windows installer, Linux packages, and Chrome extension zip — all attached to GitHub Releases.
- **Landing Page** — Beautiful product landing page at `docs/` with download buttons for all platforms, feature showcase, and responsive design. Deployable via GitHub Pages.

### Changed

- **README redesigned** — Professional multi-platform README with platform badges, download table, collapsible build instructions, and updated architecture section.
- **Version bumped** to 1.1.0 across all configuration files (`Info.plist`, `build_release.sh`).

## [1.0.1] - 2026-04-04

### Added

- **Step Arrow Tool** — New annotation tool that draws arrows with auto-incrementing numbered circles at the start point. Ideal for creating step-by-step guides and numbered instructions on screenshots.
- **Save & Copy** — Annotated screenshots are now automatically saved as timestamped PNGs to `~/Downloads` in addition to being copied to the clipboard.
- **DMG Installer** — Professional DMG with custom background, app icon, and drag-to-install experience via `build_release.sh`.
- **Programmatic asset generation** — `generate_assets.swift` creates the app icon and DMG background entirely in code.

### Changed

- Toolbar redesigned with segmented tool selector (Arrow / Step Arrow / Rectangle) and cleaner layout.
- Arrow rendering improved with sharper, more elegant arrowheads using barb geometry.
- Annotation window uses `titlebarAppearsTransparent` and hidden title for a cleaner editor look.
- Minimum window size enforced (600×300) so the toolbar renders properly even for small captures.

### Fixed

- Screen capture permission flow: app now shows a detailed alert with step-by-step instructions if permission is denied.

## [1.0.0] - 2026-04-04

### Added

- Initial release of FeatherShot.
- Menu bar app (🪶) — no Dock icon, lives quietly in the status bar.
- Native macOS `screencapture` integration for interactive area selection.
- **Arrow Tool** — Draw directional arrows with filled arrowheads.
- **Rectangle Tool** — Draw outlined rectangles to highlight regions.
- **Color Picker** — Choose any annotation color.
- **Line Width Slider** — Adjust stroke thickness (2–15px).
- **Undo / Clear** — Step back or remove all annotations.
- **Clipboard Integration** — One-click copy of the annotated image.
- Built with Swift 6.0 and SwiftUI, targeting macOS 14 (Sonoma)+.

[1.1.0]: https://github.com/KurtStevenK/FeatherShot/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/KurtStevenK/FeatherShot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/KurtStevenK/FeatherShot/releases/tag/v1.0.0
