---
description: Project rules and conventions for FeatherShot
---

# FeatherShot — Project Rules

## Language & Platform

- **Swift 6.0** with strict concurrency checking enabled.
- **macOS 14 (Sonoma)** minimum deployment target — never use APIs older than this.
- All UI code uses **SwiftUI**. AppKit is used only for `NSStatusItem`, `NSWindow`, `NSPasteboard`, and `NSImage` interop.
- The app is a **menu bar accessory** (`LSUIElement = true`) — it must **never** show a Dock icon.

## Architecture

- Entry point: `AppMain.swift` → `FeatherShotApp` with `@NSApplicationDelegateAdaptor`.
- `AppDelegate` owns the status bar item, manages screen capture via `/usr/sbin/screencapture`, and presents the annotation window.
- `AnnotationView` is the SwiftUI editor. It uses `ImageRenderer` for pixel-perfect export.
- `DrawingShapes.swift` defines the `Tool` enum and all shape/view implementations.

## Concurrency Rules

- `AppDelegate` is `@MainActor` — all UI work stays on the main thread.
- Use `Task { }` for async work (e.g., running `Process` for screencapture).
- Closures passed across actor boundaries must be `@Sendable`.

## Adding New Drawing Tools

When adding a new annotation tool, you must update **all 4 locations**:

1. `DrawingShapes.swift` — Add a case to the `Tool` enum.
2. `DrawingShapes.swift` — Create a new `View` struct for the tool.
3. `AnnotationView.swift` → `drawingContent` — Add rendering for both completed and active drawings.
4. `AnnotationView.swift` → `toolbar` — Add a toolbar button with an SF Symbol icon.

See `.agents/workflows/add-tool.md` for the full walkthrough.

## Version Bumping

The version string (`CFBundleShortVersionString` / `CFBundleVersion`) exists in **3 places** — all must be updated together:

1. `Info.plist` — lines 12 and 14
2. `build_release.sh` — lines 46, 48, 75, and 86 (version in bundle plist + DMG filename)
3. `generate_assets.swift` — line 101 (DMG background "Version X.X.X" text)

Always update `CHANGELOG.md` when bumping the version.

## Code Style

- Use `// MARK: -` comments to separate logical sections in longer files.
- Keep source files focused: one major type per file.
- Prefer `guard let` early returns over nested `if let`.
- Use SF Symbols for all toolbar icons.

## Build & Release

- Debug: `swift build` → `.build/debug/FeatherShot`
- Release: `./build_release.sh` (generates icon → builds release → creates .app → signs → creates DMG)
- The `create-dmg/` directory is a cloned external tool — it is **not** part of the project and is `.gitignore`'d.

## Files That Should NOT Be Committed

- `FeatherShot.app/` — built app bundle
- `*.dmg` — built installer
- `create-dmg/` — external cloned tool
- `AppIcon.iconset/` — intermediate build artifact
- `.DS_Store` — macOS metadata
