<p align="center">
  <img src="icon_1024.png" alt="FeatherShot Logo" width="128" height="128" style="border-radius: 22%;">
</p>

<h1 align="center">FeatherShot</h1>

<p align="center">
  <em>Lightweight screenshot annotations for macOS — fast, native, and distraction-free.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.1-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-macOS%2014%2B-lightgrey?style=flat-square&logo=apple" alt="Platform">
  <img src="https://img.shields.io/badge/Swift-6.0-orange?style=flat-square&logo=swift" alt="Swift">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

---

## ✨ What is FeatherShot?

FeatherShot lives in your **menu bar** as a tiny 🪶 icon. Click it, select a screen region, annotate it, and the result is instantly copied to your clipboard and saved to Downloads — all in seconds.

No Dock icon. No bloat. No subscription.

---

## 🛠 Annotation Tools

| Tool | Icon | Description |
|---|---|---|
| **Arrow** | `↗` | Draw clean, directional arrows with elegant filled arrowheads. |
| **Step Arrow** | `1→ 2→ 3→` | Arrows with **auto-incrementing numbered circles** at the start — perfect for step-by-step guides and tutorials. |
| **Rectangle** | `▢` | Highlight regions with outlined rectangles to draw attention to specific areas. |

### Additional Controls

- 🎨 **Color Picker** — Choose any annotation color via the native macOS color wheel.
- 📏 **Line Width Slider** — Adjust stroke thickness from 2px to 15px.
- ↩️ **Undo / Clear** — Step back or wipe all annotations.
- 💾 **Save & Copy** — Saves a timestamped PNG to `~/Downloads` and copies to clipboard in one click.

---

## 📦 Installation

### Download (Recommended)

1. Download the latest **[FeatherShot DMG](https://github.com/KurtStevenK/FeatherShot/releases/latest)** from Releases.
2. Open the DMG and drag `FeatherShot.app` into your Applications folder.
3. Launch FeatherShot — look for 🪶 in your menu bar.

### Build from Source

Requires **Xcode** and **Swift 6.0+** on macOS 14 (Sonoma) or later.

```bash
# Clone the repository
git clone https://github.com/KurtStevenK/FeatherShot.git
cd FeatherShot

# Build and run (debug)
swift build
.build/debug/FeatherShot &

# Build a release DMG
chmod +x build_release.sh
./build_release.sh
```

> **Note:** The `&` runs FeatherShot in the background so your terminal stays usable.

---

## 🚀 Usage

1. Click the **🪶** icon in your menu bar (or right-click for options).
2. Your cursor becomes a crosshair — **select a region** of your screen.
3. The **annotation editor** opens:
   - Pick a tool from the toolbar (Arrow, Step Arrow, or Rectangle).
   - Draw your annotations on the screenshot.
   - Adjust color and line width as needed.
4. Click **Save & Copy** — done! The image is on your clipboard and in `~/Downloads`.

### Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Take Screenshot | Left-click 🪶 menu bar icon |
| Open Menu | Right-click 🪶 menu bar icon |
| Quit | Right-click → Quit (or `⌘Q` from menu) |

---

## 🔐 Permissions

On first launch, macOS will prompt for:

| Permission | Why |
|---|---|
| **Screen Recording** | Required for `screencapture` to capture your screen. |
| **Accessibility** | May be requested depending on macOS security settings. |

Go to **System Settings → Privacy & Security** to manage these.

---

## 🏗 Architecture

FeatherShot is a lean, 3-file Swift application:

```
Sources/
├── AppMain.swift          # Menu bar app lifecycle, screen capture, window management
├── AnnotationView.swift   # SwiftUI editor with canvas, toolbar, save/export
└── DrawingShapes.swift    # Tool enum, shape definitions (Arrow, StepArrow, Rectangle)
```

| Component | Responsibility |
|---|---|
| `FeatherShotApp` | SwiftUI App entry point with `@NSApplicationDelegateAdaptor` |
| `AppDelegate` | Status bar item, `screencapture` process, annotation window |
| `AnnotationView` | Drawing canvas with drag gesture, `ImageRenderer` for export |
| `DrawingShapes` | `Tool` enum, `ArrowView`, `StepArrowView`, `RectangleShape` |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository.
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Commit** your changes: `git commit -m "Add my feature"`
4. **Push** and open a **Pull Request**.

### Adding a New Tool

See the workflow guide at [`.agents/workflows/add-tool.md`](.agents/workflows/add-tool.md) for a step-by-step walkthrough.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed release history.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

**Copyright © 2026 Kurt Steven Kainzmayer**

---

<p align="center">
  <sub>Built with ❤️ and Swift · Crafted by <a href="https://github.com/KurtStevenK">Kurt Steven Kainzmayer</a></sub>
</p>
