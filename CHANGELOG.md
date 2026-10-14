# Changelog

All notable changes to FeatherShot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.37] - 2026-10-15

### Fixed

- **VirusTotal detections on the Windows and Linux downloads** — In v1.3.36, 2 of 62 engines flagged the Windows installer, the portable `.exe`, the `.deb` and the `.pacman`: ESET-NOD32 ("MSIL/CaptureScreen.A potentially unsafe application") and DrWeb ("Trojan.ScreenShot.35"). The flagged code came from `screenshot-desktop`, a dependency the Electron app never used, since capture goes through Electron's `desktopCapturer`. electron-builder still packed it into every Windows and Linux build, including its Windows helper `screenCapture_1.3.2.bat`, a batch file that compiles a C# screen-capture program when run. The dependency is removed, so no package contains the script and `app.asar` drops from 406 to 321 files. Capture works as before.

### Added

- **Runtime dependency check** — `electron-app/test/check-dependencies.js` fails CI when no packaged file requires a runtime dependency, or when the production dependency tree contains `.bat`, `.cmd`, `.ps1`, `.vbs` or `.exe` files.

## [1.3.36] - 2026-10-14

### Added

- **VirusTotal scans** — After every tagged release, the new VirusTotal workflow downloads the release's installers, the portable `.exe` and the Chrome extension, uploads them to VirusTotal, and appends a table to the release notes with each file's detection counts and a link to its full report. Files are uploaded first and then polled together, so the scan finishes in one queue wait instead of one per file. Files still queued after 45 minutes are listed as pending with their report link. The scan runs after Build & Release, so it does not hold up Homebrew, APT, Arch, Chocolatey or in-app updates. Run it from the Actions tab to scan an older release, or locally with `npm run scan:virustotal` (key in `.env.local`).
- **SECURITY.md** — Secrets inventory, VirusTotal, repository protection and how to report vulnerabilities. `.env.example` is now committed.

### Changed

- **Repository protection** — `main` no longer accepts force pushes or deletion, and pull requests need the CI checks to pass before they merge. Secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting are on.
- **`scripts/push-distribution-secrets-to-github.sh`** also uploads `VIRUSTOTAL_API_KEY`, falling back to cursor-auto-runner's `.env.local`.

## [1.3.35] - 2026-10-14

### Fixed

- **Windows & Linux text annotations** — The editor's tool shortcuts also fired inside the text box, so typing `a`, `r`, `l`, `m`, a digit, `-`, `=` or `+` switched tools and ended the text: typing "Hallo" kept "H" and picked the Arrow tool. Ctrl+Z removed the annotation being typed while its text box stayed open. While a text annotation is being edited, its keys now go to the text box, and Ctrl+Z is the text box's own undo. Ctrl+S still commits the text and saves, as on macOS.

### Added

- **Text shortcuts smoke test** — `electron-app/test/text-shortcuts-smoke.js` types tool keys into a text annotation in real Electron, then checks that they stayed text and that the shortcuts work again afterwards. CI runs it on Windows and Linux.

## [1.3.34] - 2026-10-14

### Added

- **macOS editor keyboard shortcuts** — The toolbar tooltips named a key for every tool, but the macOS editor had no key handling. It now uses the Windows/Linux keys: `1`–`8` for the first eight tools, `-` and `=` for the Exclamation Arrow and Rectangle, `T` for Text, `9` and `0` for the ABC tools, `M` for the Magnifier, plus the aliases `a`, `r`, `l`, `_` and `+`. **⌘Z** undoes the last annotation and **⌘S** runs Save & Copy. Keys follow the keyboard layout, so on a German keyboard `=` is ⇧0. ⌥ and ⌃ combinations are left alone, and a tool key pressed during a drag is ignored. The Undo and Save & Copy tooltips show their shortcuts, and a unit test compares the mapping with the Electron editor's keydown handler.

### Changed

- **Text annotations on macOS** — A new or reopened text annotation gets keyboard focus with its text selected, so you can type right away instead of clicking into the field first. While the field is open, typed keys go into the text and never switch tools. Only ⌘S still works there, because it commits the text before saving. Return, Tab or a click on the canvas finishes the text, as on Windows and Linux.

## [1.3.33] - 2026-10-14

### Fixed

- **Windows in-app updates** — **Check for Updates…** never installed an update. electron-updater first downloads `latest.yml` from the latest GitHub release, and the release workflow never uploaded it, so the check failed and the app opened the download page instead. Windows installs stayed on old versions, including v1.3.26 and earlier, where Save & Copy does not work on Electron 44. Releases now include `latest.yml` and the installer's `.blockmap`, so installs from v1.3.16 on update in the app.
- **Release asset names** — GitHub rewrites parentheses in uploaded file names (`FeatherShot-Setup-1.3.31-(Windows).exe` became `FeatherShot-Setup-1.3.31-.Windows.exe`), so `latest.yml` would still have named a file that does not exist. The assets are now `FeatherShot-Setup-<version>-Windows.exe`, `FeatherShot-<version>-Windows-Portable.exe`, `FeatherShot-<version>-macOS.dmg`, `FeatherShot-<version>-Debian.deb`, `FeatherShot-<version>-Ubuntu.AppImage` and `FeatherShot-<version>-Arch.pacman`.
- **Chocolatey** — The package downloaded `FeatherShot-Setup-<version>-%28Windows%29.exe`, which GitHub answers with 404. It now uses the installer's asset name, and the Homebrew cask uses the DMG name directly instead of rewriting it.

### Changed

- **Portable Windows build** — **Check for Updates…** opens the download page, because electron-updater updates through the NSIS installer and would install a second copy. A failed update download now shows an error with **Open Download Page** instead of failing silently.

### Added

- **`scripts/verify-release-assets.mjs`** in `npm run verify` — release asset names must survive the GitHub upload, `latest.yml` and the blockmap must be attached to the release, and the Chocolatey and Homebrew URLs must match the built file names.
- **Update feed check** — `scripts/verify-update-feed.mjs` resolves the Windows update with electron-updater's GitHub provider, as installed apps do, then downloads the installer and checks its SHA-512 and size against `latest.yml`. The Build & Release workflow runs it after publishing each release.

## [1.3.32] - 2026-10-14

### Changed

- **Mac App Store & TestFlight updates** — App Store and TestFlight installs no longer show **Check for Updates…** in the menu bar menu. Apple delivers their updates, App Review guideline 2.4.5 allows no other update mechanism, and the GitHub DMG the item pointed to would have replaced the store install. The menu still shows **Version x.y.z**, and the Developer ID DMG and Homebrew builds keep the GitHub update check.

### Added

- **Store build detection** — `UpdateChecker.isAppStoreBuild` looks for a receipt in `Contents/_MASReceipt` (App Store, TestFlight) and for the App Sandbox, which every Mac App Store build has, so App Review does not see the GitHub check even without a receipt. Unit tests cover the receipt and sandbox cases.
- `--smoke-test` lists the menu bar menu items in its output.

## [1.3.31] - 2026-10-14

### Fixed

- **Windows & Linux Save & Copy** — Up to v1.3.26 the editor called `clipboard.writeImage` in the renderer, which Electron 44 no longer provides there (renderer `clipboard` is `undefined`), so the click threw before anything was written. v1.3.27 moved the copy to the main process but still wrote the file only after the clipboard succeeded. The PNG is now saved to Downloads and copied to the clipboard as independent steps. A busy clipboard times out after 5 s instead of blocking the save, a failed save offers **Save As…**, and the editor stays open on any failure.
- **File names** — Local time in the same `FeatherShot_YYYY-MM-DD_HH-mm-ss.png` pattern as macOS (was UTC), with `-2`, `-3`, … instead of overwriting a capture from the same second.

### Added

- **`electron-app/save-and-copy.js`** with Node checks in `npm run verify` (`scripts/verify-electron-save.mjs`), including a guard that every module `main.js` requires is in electron-builder's `files` list.
- **Real-Electron smoke test** — `electron-app/test/save-smoke.js` opens the editor, clicks Save & Copy, and checks Downloads and the clipboard. CI runs it on Windows and Linux.

## [1.3.30] - 2026-10-14

### Fixed

- **macOS Save & Copy** — Saving and copying no longer depend on each other: a failed Downloads write still copies the image, and the editor stays open with a **Save As…** option instead of failing silently. The sandboxed 1.3.25 TestFlight build could not write to Downloads at all because it lacked the Downloads entitlement (added in 1.3.28).
- **Clipboard** — The annotated image goes on the clipboard as PNG and TIFF, so browsers, chat apps, and older Cocoa apps all paste it.
- **Export resolution** — The render scale comes from the captured image instead of the main screen, so a Retina capture keeps full resolution when the main display is not Retina. Window captures keep their transparent shadow.
- **Several editors** — Save & Copy closes its own editor window, not the most recently opened one, and each open editor stays alive.
- **File names** — Same-second captures get `-2`, `-3`, … instead of overwriting each other; timestamps use fixed digits regardless of locale.

### Added

- `NSDownloadsFolderUsageDescription` in the app's Info.plist for the macOS Downloads privacy prompt.
- `ScreenshotExport` unit tests (file naming, save/copy independence, PNG + TIFF clipboard, capture-resolution rendering).

## [1.3.29] - 2026-10-14

### Fixed

- **macOS launch** — v1.3.27 and v1.3.28 started without a menu bar icon. AppKit's default `@main` entry point only creates the app delegate from a main nib, so `applicationDidFinishLaunching` never ran. `AppDelegate.main()` now installs the delegate itself. There is no SwiftUI scene, so no empty "FeatherShot" or Settings window opens at launch (the window seen in the 1.3.25 TestFlight build).

### Added

- **Launch smoke test** — `FeatherShot --smoke-test` exits 0 only when the menu bar item exists and no window is open. CI and the release workflow run it against the release binary.

## [1.3.28] - 2026-10-13

### Fixed

- **macOS Save & Copy** — Write the PNG to Downloads before the editor closes. The previous path encoded `ImageRenderer`'s `NSImage` after the window closed, when `tiffRepresentation` was already nil, so the clipboard could update and no file appeared.
- **Mac App Store sandbox** — `com.apple.security.files.downloads.read-write` so a sandboxed build can save into Downloads.

### Changed

- **macOS capture** — `screencapture` waits off the main thread so the menu bar stays responsive while you select an area.
- **Electron editor** — Multi-monitor composites skip a second PNG encode, and dragging a text annotation redraws at most once per frame.

## [1.3.27] - 2026-10-12

### Fixed

- **macOS launch** — Drop the SwiftUI `WindowGroup` / Settings placeholder; `@main` `AppDelegate` starts via AppKit only so no empty FeatherShot window appears at launch.
- **Windows & Linux Save & Copy** — Export runs in the main process with Electron 44 `clipboard.write` and `app.getPath('downloads')`; errors show a dialog instead of failing silently in the renderer.

### Changed

- **Firebase release upload** — `upload-releases.sh` falls back to `upload_object.py` when `gcloud storage cp` fails.

## [1.3.26] - 2026-10-11

### Added

- **Firebase website** — Project `feathershot` on [Firebase Hosting](https://feathershot.web.app/) with landing page, [privacy policy](https://feathershot.web.app/privacy), and [press / marketing kit](https://feathershot.web.app/marketing); source in [`hosting/public`](hosting/public/).
- **Release mirror** — Tag builds upload binaries to Firebase Storage and refresh [`releases/latest.json`](hosting/public/releases/latest.json) via [`packaging/firebase/upload-releases.sh`](packaging/firebase/upload-releases.sh) (GitHub Releases and package managers unchanged).
- **Mac App Store / TestFlight** — [`packaging/mac/build_appstore.sh`](packaging/mac/build_appstore.sh) builds a sandboxed App Store `.pkg`; [`FeatherShot-AppStore.entitlements`](packaging/mac/FeatherShot-AppStore.entitlements) and upload steps in [`packaging/mac/APP-STORE.md`](packaging/mac/APP-STORE.md).

### Changed

- **Canonical website** — README and GitHub Pages [`docs/`](docs/) redirect to `https://feathershot.web.app/`; legacy `kurtstevenk.github.io/FeatherShot/` redirects.

## [1.3.25] - 2026-10-11

### Security

- **Electron** — Block `<webview>` attachment in the main process (`will-attach-webview`) to prevent renderer privilege escalation.

### Changed

- **Chrome extension editor** — Throttle canvas `render()` during pointer move with `requestAnimationFrame` to cut redundant redraws on high-polling mice.

### Fixed

- **Editor accessibility** — Explicit `aria-label` on color picker, line-width slider, and text input; `aria-hidden` on the redundant width readout; slider `title` / `aria-label` switch between Line Width and Zoom Level when toggling the magnifier (Electron and shared editor markup).

## [1.3.24] - 2026-10-11

### Fixed

- **Windows multi-monitor capture** — Capture only displays under the selection at each display’s native thumbnail size (no more upscaling smaller monitors to the largest display’s box). Crop uses bitmap size ÷ DIP bounds so selections on a 1920×1200 side monitor are 1:1.
- **Windows overlay coordinates** — Selection windows use per-display bounds without `setFullScreen` on Windows so pointer coordinates match `screen` bounds.
- **Editor viewport** — Canvas fits inside the window (`max-width` / `max-height`) while saved PNGs stay full resolution.

### Changed

- **Electron capture flow** — Overlays open immediately; screen capture runs after the drag completes ([`electron-app/capture.js`](electron-app/capture.js), [`electron-app/capture-utils.js`](electron-app/capture-utils.js)).

### Added

- **`scripts/verify-capture-crop.mjs`** — Regression tests for three-monitor crop math (1920×1200 + 2560×1440 + 1080×2560).

## [1.3.23] - 2026-10-11

### Fixed

- **Windows / Linux Electron selection overlay** — Restored `require('electron')` IPC in the selection renderer (broken since v1.3.9 when `window.electronAPI` was used without a preload). Area drag, Escape, and tray Quit work again.
- **Windows multiple processes** — Second launch no longer starts another tray instance; `second-instance` focuses the existing app.
- **Selection escape hatch** — Global Escape in the main process cancels the overlay if the renderer fails.

### Added

- **`scripts/verify-electron-ipc.mjs`** — Fails CI when selection overlay expects `electronAPI` without a wired preload.

## [1.3.22] - 2026-10-04

### Fixed

- **Arch repo database** — Use `feathershot.db.tar.zst` with `repo-add` (current pacman format) and sign the `.tar.zst` indexes.

## [1.3.21] - 2026-10-04

### Fixed

- **Arch publish CI** — Pass `PACMAN_PKG` into the Arch Docker container so `publish.sh` receives the package path.

## [1.3.20] - 2026-10-04

### Fixed

- **Arch publish CI** — Quote pacman package paths containing `(Arch)` when running `publish.sh` inside Docker.

## [1.3.19] - 2026-10-04

### Fixed

- **Arch pacman publish** — CI uploads and publishes `*.pacman` artifacts from electron-builder (not `*.pkg.tar.zst`), so `KurtStevenK/arch` gets a signed `feathershot.db` on release.

## [1.3.18] - 2026-10-04

### Fixed

- **Linux release CI** — Install `libarchive-tools` and `rpm` so electron-builder can produce `.deb` and Arch `.pkg.tar.zst` packages; APT/Arch publish steps skip with a warning instead of failing the whole release when an artifact is missing.

### Changed

- **Electron (Linux)** — “Check for Updates” shows `pacman -Sy feathershot` on Arch and `apt` upgrade hints on Debian/Ubuntu.

## [1.3.17] - 2026-10-04

### Added

- **Arch Linux (pacman)** — `pacman -S feathershot` from [KurtStevenK/arch](https://github.com/KurtStevenK/arch) (`gh-pages`); electron-builder `.pkg.tar.zst` on release; see [`packaging/arch/README.md`](packaging/arch/README.md).

## [1.3.16] - 2026-10-04

### Added

- **Tray / menu-bar updates** — Context menu shows **Version x.y.z** and **Check for Updates…** on macOS (GitHub Releases) and Windows/Linux Electron (`electron-updater` on Windows; apt instructions on Linux `.deb`).

## [1.3.15] - 2026-10-04

### Added

- **Text annotation** — Place text on the canvas, edit inline, and drag to reposition (macOS, Electron, Chrome extension).

## [1.3.14] - 2026-10-04

### Added

- **Exclamation Arrow & Rectangle** — Same badge style as `?` tools, with **`!`** (macOS, Electron, Chrome). Shortcuts **`-`** / **`=`**.

## [1.3.13] - 2026-10-04

### Added

- **Chocolatey** — `choco install feathershot` (Windows NSIS installer from GitHub Releases).
- **Homebrew** — `brew install --cask KurtStevenK/tap/feathershot` (native macOS DMG).
- **APT** — `feathershot` package on [KurtStevenK/apt](https://github.com/KurtStevenK/apt) (see [`packaging/apt/README.md`](packaging/apt/README.md)).
- **CI** — Release workflow builds `.nupkg`, updates homebrew-tap and apt repo; optional [`chocolatey-push`](.github/workflows/chocolatey-push.yml) workflow.

## [1.3.12] - 2026-10-04

### Fixed

- **macOS notarization on GitHub Releases** — Correct `APPLE_ID` email in GitHub Actions; **`v1.3.12`** DMG is notarized (`status: Accepted`), stapled, and opens without Gatekeeper “unidentified developer” workarounds. Prefer this release over **v1.3.9–v1.3.11** for macOS downloads.

### Changed

- Version strings in manifests, extension, Electron, and docs aligned with **1.3.12**.

## [1.3.11] - 2026-10-04

### Changed

- **Release retry** — Re-synced `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` via [`scripts/resync-apple-notarization-secrets.sh`](scripts/resync-apple-notarization-secrets.sh) while fixing notarization (`notarytool` 401 / wrong Apple ID).

## [1.3.10] - 2026-10-04

### Changed

- **Release retry** — Refreshed `CSC_LINK` / `CSC_KEY_PASSWORD` (matching cursor-auto-runner); tagged build still shipped a Developer ID–signed DMG when notarization failed.

### Fixed

- **`scripts/push-apple-signing-to-github.sh`** — Write secrets without trailing newlines.
- **`build_release.sh`** — Do not abort the release when notarization fails; signed DMG still uploads.
- **Release workflow** — `notarytool` preflight warns on bad credentials instead of failing the macOS job.

## [1.3.9] - 2026-10-04

### Changed

- **Bundle ID** — Native macOS and Electron use `xyz.kainzmayer.feathershot` (reverse-DNS for **kainzmayer.xyz**), replacing `com.kainzmayer.feathershot.v4` / `com.kainzmayer.feathershot`.

### Added

- **Signed macOS DMG on GitHub Releases** — Tagged builds use Developer ID Application, hardened runtime, `notarytool`, and stapling. First **notarized** public DMG: **[v1.3.12](https://github.com/KurtStevenK/FeatherShot/releases/tag/v1.3.12)** (earlier tags **v1.3.9–v1.3.11** were signed only).
- **`packaging/mac/`** — Entitlements, signing README, and Mac App Store prep doc ([`APP-STORE.md`](packaging/mac/APP-STORE.md)).
- **`scripts/push-apple-signing-to-github.sh`** — Upload `CSC_*` and Apple notarization secrets to GitHub Actions.

### Changed

- **`build_release.sh`** — Resolves Developer ID from the keychain (ad-hoc `-` fallback for local dev); version from `FEATHERSHOT_VERSION`; notarizes DMG when Apple env vars are set.
- **Release workflow** — Imports signing certificate, preflights `notarytool`, verifies `codesign` / `stapler` / `spctl` on tag builds.

## [1.3.8] - 2026-10-04

### Changed

- **GitHub Actions** — FeatherShot repo requires the same Apple secrets as cursor-auto-runner (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`). See [`packaging/mac/README.md`](packaging/mac/README.md).

## [1.3.7] - 2026-10-04

### Added

- **App Store Connect (manual)** — Create a macOS app record linked to `xyz.kainzmayer.feathershot` when preparing a future Mac App Store listing (not used for GitHub DMG).

## [1.3.6] - 2026-10-04

### Added

- **Apple Developer (manual)** — Register App ID `xyz.kainzmayer.feathershot` in [Identifiers](https://developer.apple.com/account/resources/identifiers/list) (matches **kainzmayer.xyz**; no extra capabilities required for screen recording).

## [1.3.5] - 2026-10-04

### Added

- **macOS signing documentation** — [`packaging/mac/README.md`](packaging/mac/README.md) and secret upload script for CI.

## [1.3.4] - 2026-10-04

### Changed

- **`.github/workflows/build-release.yml`** — macOS job imports Developer ID certificate, runs notarization preflight, and verifies signatures before uploading the DMG artifact.

## [1.3.3] - 2026-10-04

### Changed

- **`build_release.sh`** — Developer ID signing with hardened runtime and optional DMG notarization (foundation for 1.3.9).

## [1.3.2] - 2026-10-04

### Added

- **`packaging/mac/FeatherShot.entitlements`** — Minimal entitlements plist for hardened runtime signing.

## [1.3.1] - 2026-10-04

### Added

- **Jules integration** — Merged community PRs #1–#26 (security, performance, accessibility).
- **`scripts/integrate-jules-pr.sh`** — Helper used to integrate the Jules PR batch.
- **`electron-app/preload.js`** — Context bridge scaffolding for safer renderer APIs.

### Security

- Safer temporary file handling in capture/save paths.
- **Electron `setupSecurity()`** — Deny permission requests; block non-`file:` navigation and unauthorized `window.open`.
- Session hardening across renderer windows.

### Changed

- **Electron renderer** — Canvas hot path uses cached layout and throttled redraws; improved image pipeline during annotation.
- **Editor accessibility** — Toolbar and action buttons use `aria-label` and `aria-pressed`; keyboard hints in labels; interaction and focus polish in CSS/JS.
- **Electron editor** — Loads shared `letterLabel` from `electron-app/shared/letterLabel.js`.

## [1.3.0] - 2026-10-04

### Added

- **Swift unit tests** — `FeatherShotTests` target in `Package.swift`; `swift test` runs in CI and before macOS release builds.
- **CI workflow** (`.github/workflows/ci.yml`) — macOS `swift build` / `swift test`, shared `letterLabel` verification, Electron dependency audit, Chrome extension validation on push and pull requests.
- **Shared ABC label helper** — `shared/letterLabel.js` and `shared/letterLabel.cases.json`; synced to Chrome and Electron via `npm run sync:shared`.
- **Repo verification scripts** — `scripts/sync-shared.mjs`, `scripts/verify-letter-label.mjs`, `scripts/validate-chrome-extension.mjs`; root `npm run verify` runs sync, cross-platform label checks, and extension manifest/file validation.
- **Chrome extension packaging checks** — Release workflow runs sync and validation before zipping the extension.

### Changed

- **Electron** — Upgraded to **44.5.1** and **electron-builder** to **26.15.3** (`npm audit` clean).
- **Electron / Chrome** — `letterLabel` removed from duplicated inline code; Electron loads `electron-app/shared/letterLabel.js`, Chrome loads `letterLabel.js` before `editor.js`.
- **Swift tests** — ABC labels validated against `shared/letterLabel.cases.json` (same vectors as JavaScript).
- **README** — Documents `swift test`, `npm run verify`, and `shared/` layout.
- **Project rules** — `docs/project-conventions.md` documents shared `letterLabel` workflow.

### Fixed

- **macOS screen capture** — `screencapture` no longer blocks a Swift concurrency thread (`waitUntilExit` replaced with async process completion).
- **macOS polish** — Removed debug logging from menu bar startup.

## [1.2.2] - 2026-04-07

### Fixed

- **Editor reliably opens after selection** — Eliminated all async capture timing issues by pre-capturing displays BEFORE showing overlays. Selection crops synchronously from stored captures. Editor uses simple `did-finish-load` + `webContents.send` (no `handleOnce`, no `invoke`, zero race conditions).

## [1.2.1] - 2026-04-07

### Fixed

- **Editor now opens after selection** — Three fixes: (1) `removeHandler` before `handleOnce` clears stale handlers from failed previous attempts, (2) `closeAndWait` exits fullscreen before closing and has a 2-second timeout fallback, (3) `did-finish-load` backup trigger ensures the editor shows even if `ready-to-show` doesn't fire.
- **macOS .dmg missing from release** — Fixed CI glob pattern to match new `FeatherShot-*-(macOS).dmg` filename.

## [1.2.0] - 2026-04-07

### Fixed

- **Multi-monitor selection overhauled** — Transparent overlays with `setFullScreen(true)` for guaranteed full-screen coverage on all monitors (no DPI sizing issues). No pre-capture (instant open, no double taskbar). Capture happens AFTER selection.
- **Cross-monitor selection** — When selection spans multiple displays, each display's portion is captured individually and composited in the editor. All content from all covered monitors is visible.
- **Editor opens after selection** — Fixed missing `show()` call.
- **HiDPI rendering** — Canvas uses `devicePixelRatio` for sharp text and selection borders.

### Changed

- **Release filenames include OS** — `(Windows)`, `(Windows Setup)`, `(Debian)`, `(Ubuntu)`, `(macOS)`.

## [1.1.9] - 2026-04-07

### Fixed

- **Opaque selection overlays** — Replaced `transparent: true` (caused white/broken rendering on Windows) with opaque windows showing per-display screenshots dimmed. No transparency bugs.
- **Editor opens after selection** — Fixed missing `show()` call.
- **HiDPI canvas** — Uses `devicePixelRatio` for sharp text and lines.

### Changed

- **Release filenames include OS** — `(Windows)`, `(Debian)`, `(Ubuntu)` in artifact names.

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

[1.3.37]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.36...v1.3.37
[1.3.36]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.35...v1.3.36
[1.3.35]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.34...v1.3.35
[1.3.34]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.33...v1.3.34
[1.3.33]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.32...v1.3.33
[1.3.32]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.31...v1.3.32
[1.3.31]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.30...v1.3.31
[1.3.30]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.29...v1.3.30
[1.3.29]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.28...v1.3.29
[1.3.28]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.27...v1.3.28
[1.3.27]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.26...v1.3.27
[1.3.26]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.25...v1.3.26
[1.3.25]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.24...v1.3.25
[1.3.24]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.23...v1.3.24
[1.3.23]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.22...v1.3.23
[1.3.22]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.21...v1.3.22
[1.3.21]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.20...v1.3.21
[1.3.20]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.19...v1.3.20
[1.3.19]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.18...v1.3.19
[1.3.18]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.17...v1.3.18
[1.3.17]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.16...v1.3.17
[1.3.16]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.15...v1.3.16
[1.3.15]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.14...v1.3.15
[1.3.14]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.13...v1.3.14
[1.3.13]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.12...v1.3.13
[1.3.12]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.11...v1.3.12
[1.3.11]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.10...v1.3.11
[1.3.10]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.9...v1.3.10
[1.3.9]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.8...v1.3.9
[1.3.8]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.7...v1.3.8
[1.3.7]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.6...v1.3.7
[1.3.6]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.5...v1.3.6
[1.3.5]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/KurtStevenK/FeatherShot/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/KurtStevenK/FeatherShot/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/KurtStevenK/FeatherShot/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/KurtStevenK/FeatherShot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.9...v1.2.0
[1.1.9]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.8...v1.1.9
[1.1.8]: https://github.com/KurtStevenK/FeatherShot/compare/v1.1.7...v1.1.8
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
