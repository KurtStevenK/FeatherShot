# Changelog

All notable changes to FeatherShot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.8] - 2026-04-07

### Fixed

- **webContents null error eliminated** — Replaced `did-finish-load` push pattern with `ipcMain.handle` / `ipcRenderer.invoke` pull pattern. The renderer requests its init data when ready, so there's no race condition if the window is destroyed before load completes.
- **Overlay sizing on mixed-DPI Windows** — Added 500px padding on all sides of each overlay window to guarantee full display coverage regardless of DPI mismatch between monitors. The excess padding is off-screen and invisible.
- **Coordinate math updated** — Uses actual window origin (including padding offset) for pixel-perfect global coordinate conversion.

## [1.1.7] - 2026-04-07

### Fixed

- **Multi-Monitor Selection using Pointer Capture** — Per-display transparent overlays (no pre-capture, instant open). Uses `setPointerCapture()` so cross-monitor dragging works — the window that receives pointerdown keeps receiving all pointer events even when the cursor moves to another monitor. Canvas sized to `window.innerWidth/Height` for correct DPI handling. Screen captured only after selection completes (fast, no lag).
- **Magnifier centering** — Fixed the magnifier zoom not being centered on the exact click position. Now properly accounts for the ratio between screenshot image pixel dimensions and canvas display dimensions when sampling the source region.

## [1.1.6] - 2026-04-07

### Fixed

- **Multi-Monitor Selection completely rewritten** — Replaced per-display overlay windows with a single window spanning the entire virtual desktop. This fixes: cross-monitor selection (can now drag across monitors), stretched overlays, double taskbars, wrong aspect ratios, and the JavaScript `webContents` error on Windows. The window is non-transparent (uses screenshot as background) for reliable rendering on all Windows DPI configurations.

## [1.1.5] - 2026-04-07

### Fixed

- **Multi-Monitor Selection completely reworked** — Removed kiosk mode which caused stretched overlays, double taskbars, and wrong aspect ratios on Windows. Selection now uses a transparent dim overlay over the live desktop (no pre-capture). Screen is captured only after selection is complete, targeting just the relevant display. Much faster on multi-monitor setups since there's no 3-screen composite step.

### Changed

- **Capture flow redesigned** — Selection overlay is now instant (no delay for screen capture). The screenshot is taken after closing the overlay, then cropped to the selected region. This matches how professional tools like ShareX and Snagit work.

## [1.1.4] - 2026-04-07

### Added

- **Magnifier Tool** — New annotation tool that creates a circular zoom lens on the screenshot. Click to set the center, drag to define the radius. Features configurable zoom level (1.5×–5×) via the slider, a colored border ring, and a crosshair at the center. Available on all platforms (macOS, Windows, Linux, Chrome Extension).

### Changed

- **Tool order redesigned** — Circle/Ellipse tool moved from the end of the toolbar to after Rectangle and before Line, for a more logical grouping. Consistent across all platforms.
- **Keyboard shortcuts updated** — `5` = Circle, `6` = Line, `7` = Question Arrow, `8` = Question Rect, `9` = ABC Arrow, `0` = ABC Rect, `M` = Magnifier.
- **Save & Copy closes editor** — On Windows and Linux, clicking "Save & Copy" now closes the annotation editor window after saving (matching macOS behavior).

### Fixed

- **Multi-Monitor Selection (Windows)** — Fixed overlay windows not covering full display area on Windows with DPI scaling. Overlays now use kiosk mode with screen-saver-level always-on-top to ensure complete coverage across all monitors regardless of scale factor settings.

## [1.1.3] - 2026-04-07

### Added

- **Circle / Ellipse Tool** — New annotation tool that draws stroked ellipses inscribed in a bounding box. No fill, stroke only.

### Fixed

- **Multi-Monitor Selection (Electron)** — Completely reworked the multi-monitor overlay system. Now creates one overlay window per display with global coordinate synchronization, allowing selections to span across 2 or more monitors seamlessly. Works for any number of displays in any resolution/layout constellation.

## [1.1.2] - 2026-04-07

### Added

- **Line Tool** — New annotation tool that draws simple straight lines without arrowheads.
- **Question Arrow & Rectangle** — New annotation tools that draw arrows and rectangles with a "?" circle.
- **ABC Arrow & Rectangle** — New annotation tools that draw arrows and rectangles with an auto-incrementing letter label (a, b, ..., z, aa, ab).

### Fixed

- **Multi-Monitor Support (Electron)** — Fixed a bug where taking a screenshot on a mixed-resolution multi-monitor setup would only capture a portion of the primary display. The tool now correctly captures and composites all displays.
- **macOS Editor Overflow** — Capturing tall screenshots no longer pushes the toolbar off-screen. Large images now smoothly scroll vertically and horizontally within the editor.

## [1.1.1] - 2026-04-06

### Added

- **Step Rectangle Tool** — New annotation tool that draws rectangles with auto-incrementing numbered circles at the top-left corner. Perfect for highlighting multiple regions with ordered callouts. Available on all platforms (macOS, Windows, Linux, Chrome Extension).
- **Area Selection (Windows & Linux)** — Clicking the tray icon now shows a fullscreen overlay where you can drag to select exactly the area you want to capture, matching the macOS behavior. No more mandatory fullscreen captures.
- **Area Selection (Chrome Extension)** — Clicking the extension icon now injects a selection overlay into the active tab. Drag to select an area, then only the selected region opens in the annotation editor.
- **Multi-Monitor Support (Electron)** — Area selection overlay spans all connected displays for seamless multi-monitor screenshot capture.
- **Landing Page SEO** — Added Open Graph meta tags, Twitter Card, keywords, author, canonical URL, and theme color for better social sharing and search engine visibility.

### Changed

- **Tool order redesigned** — Counting tools (Step Arrow, Step Rectangle) are now first in the toolbar, followed by plain tools (Arrow, Rectangle). Step Arrow is the new default tool.
- **macOS editor window** — Now resizable and miniaturizable. Window size is clamped to the visible screen area so full-screen captures no longer push toolbar buttons behind the system title bar.
- **Version bumped** to 1.1.1 across all configuration files (`Info.plist`, `build_release.sh`, `generate_assets.swift`, `electron-app/package.json`, `chrome-extension/manifest.json`).

### Fixed

- **macOS fullscreen capture overflow** — Annotation editor window was larger than the screen when capturing the full display, causing buttons and tools to be hidden behind the toolbar and making the window non-resizable. Window now auto-fits within screen bounds with a minimum size of 600×360.
- **Electron editor not resizable** — Editor window now has a minimum size and can be freely resized by the user.

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

[1.1.7]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.6...v1.1.7
[1.1.6]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/KurtStevenK/FeatherShot/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/KurtStevenK/FeatherShot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/KurtStevenK/FeatherShot/releases/tag/v1.0.0
