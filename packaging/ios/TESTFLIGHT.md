# iPhone app: TestFlight

The iPhone app lives in [`ios/`](../../ios). [`ios/project.yml`](../../ios/project.yml) is the source of the Xcode project. After editing it, run `xcodegen generate` in `ios/` and commit both files. The drawing code (`Sources/DrawingShapes.swift`, `EditorTheme.swift`, `EditorZoom.swift`) is compiled into both the Mac app and the iPhone app, so a change there must build on both.

- Bundle ID `xyz.kainzmayer.feathershot`, the same as the Mac app (Universal Purchase: one App Store record, one listing)
- iOS 18 or later, iPhone (portrait) and iPad (all orientations). iPad has no Action Button, so its setup texts point to Control Center.
- Apple Watch app (`ios/Watch`, watchOS 11+, `xyz.kainzmayer.feathershot.watchkitapp`), embedded in the iPhone app: after Save & Copy the iPhone sends a small copy (WatchConnectivity), and the watch shows the recent ones with Digital Crown zoom. Nothing leaves the user's own devices.
- Version: `MARKETING_VERSION` in [`ios/Config/Version.xcconfig`](../../ios/Config/Version.xcconfig). The build number is set per upload.

## One-time setup in App Store Connect

1. Open the FeatherShot app record (the Mac app, [6821684358](https://appstoreconnect.apple.com/apps/6821684358)) and add the **iOS** platform (**+** next to the platform list in the sidebar). Until the record has iOS, uploads fail with "no suitable application records".
2. In the [developer portal](https://developer.apple.com/account/resources/identifiers/list), the App ID `xyz.kainzmayer.feathershot` needs no extra capabilities. App Intents and add-only Photos access need none.
3. TestFlight → **Internal Testing** → create a group and add yourself.

## Build and upload

```bash
bash packaging/ios/build_testflight.sh
```

This archives with automatic signing (team `XPPUZJDN56`, Apple Distribution) and writes `ios/build/export/FeatherShot.ipa`. The build number defaults to the UTC time (`20261105.1430`), so every run is unique. Set `FEATHERSHOT_BUILD` to override it.

Upload it with any one of these:

- **Transporter:** drag `FeatherShot.ipa` into Transporter.
- **The script:** `FEATHERSHOT_UPLOAD=1 bash packaging/ios/build_testflight.sh` uploads straight from `xcodebuild` with the Xcode account.
- **API key** (no Xcode account needed, e.g. CI): also set `ASC_KEY_ID=WVB97T8LBH` and `ASC_ISSUER_ID=<issuer id>`. The key is read from `~/.private_keys/AuthKey_<id>.p8`, or from `ASC_KEY_PATH`. The issuer ID is at [Users and Access → Integrations](https://appstoreconnect.apple.com/access/integrations/api).

`ITSAppUsesNonExemptEncryption` is false, so TestFlight asks no export-compliance question.

## The bundled shortcut

The app ships a signed shortcut, **FeatherShot Screenshot** (Take Screenshot → Annotate Screenshot), as [`FeatherShot-Screenshot.signedshortcut`](../../ios/FeatherShot/Resources/FeatherShot-Screenshot.signedshortcut). Shortcuts names an imported shortcut after its file, so the app shares it as a temporary copy named `FeatherShot Screenshot.shortcut`. The home screen's **Add the Shortcut** button shares it to the Shortcuts app, which offers **Add Shortcut**. An app cannot add a page to the Action Button settings, and a Control cannot take a screenshot, so this shortcut is how the Action Button reaches FeatherShot.

The shortcut finds FeatherShot's action by the intent's type name (`OpenScreenshotIntent`) and its parameter name (`screenshot`). After renaming either, rebuild the file with `bash ios/Shortcut/build_shortcut.sh` (needs a Mac signed in to iCloud: `shortcuts sign` gets an "anyone" signature from Apple) and commit it. Its signing certificate runs until 1 Dec 2027; re-sign it (same script) before then, or new imports may be refused. Don't copy the signer's output by hand with `mv`: the signing service deletes the file it wrote some seconds later, even after a move. The script writes a separate copy.

## Testing on a device

The simulator cannot press the Action Button, so the main path needs a real iPhone (15 Pro or newer):

1. Install the build from TestFlight and open it.
2. On first launch the setup guide opens (later: **Add the Shortcut** on the home screen). Check the animated intro, tap through **Next**, then **Add the Shortcut** → **Shortcuts** → **Add Shortcut**.
3. Settings → Action Button → swipe to **Shortcut** → **FeatherShot Screenshot**.
4. In any app, press the Action Button. The first time, Shortcuts asks to share the image with FeatherShot: choose **Always Allow**.
5. Check that FeatherShot opens on **Select Area** with the screenshot, that the shortcut did not also save the screenshot to Photos, and that Save & Copy puts the image in Photos and on the clipboard (paste it into Messages or Notes).

**Annotate a Screenshot from Photos** on the home screen is the same flow without the shortcut. App Review uses it too.

## App Review notes (for the App Store submission)

> FeatherShot annotates screenshots. To try it without setup, tap "Annotate a Screenshot from Photos" and pick any image. The main flow is a Shortcut ("Take Screenshot" → FeatherShot's "Annotate Screenshot" action), which the app offers with "Add the Shortcut", on the Action Button. On iPad the shortcut runs from Control Center. The Apple Watch app shows the screenshots the user saved on their iPhone (sent over WatchConnectivity after Save & Copy). The app takes no screenshots by itself, collects no data and has no network access.

Privacy: "Data Not Collected", as on the Mac. `PrivacyInfo.xcprivacy` declares no tracking, no collected data, and file-timestamp access (C617.1) for the cleanup of its own temp files.

## App Store images

Every size below is one App Store Connect lists for its slot (checked 2026-11-06). Output goes to `_archive/appstore-ios/` (not in git):

| Slot in App Store Connect | Folder | Size | From |
|---|---|---|---|
| iPhone mit Dynamic Island (6.1"/6.3") | `iphone-6.3/` | 1206×2622 | iPhone 18 Pro simulator |
| iPhone Duo | `iphone-duo/` | 1398×2034 | iPhone Duo simulator, cover display (`--display=1`) |
| iPad 13" | `ipad-13/` | 2064×2752 | iPad Pro 13-inch (M5) simulator |
| Apple Watch | `apple-watch/` | 422×514 | Apple Watch Ultra 4 (49mm) simulator, raw |
| Kopfzeile (product page header) | `header/` | 3840×1646 and 5244×2950 | `banner.swift` |
| Suchergebnisse | — | not made yet: the size was not visible | |

Boot one simulator at a time (8 GB RAM), and shut it down before the next.

```bash
# Debug build with the --demo scenes (iPhone, iPad and the embedded Watch app)
xcodebuild build -project ios/FeatherShot.xcodeproj -scheme FeatherShot \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/fs-dd
APP=/tmp/fs-dd/Build/Products/Debug-iphonesimulator/FeatherShot.app

# Per device: boot, install, capture, compose, shut down
xcrun simctl boot <udid> && xcrun simctl bootstatus <udid> -b
xcrun simctl install <udid> "$APP"
bash packaging/ios/appstore/capture.sh <udid> /tmp/fs-shots-<device> [display]
swift packaging/ios/appstore/compose.swift /tmp/fs-shots-<device> _archive/appstore-ios/<folder> <width> <height> <phone|duo|ipad>
xcrun simctl shutdown <udid>

# Header
swift packaging/ios/appstore/banner.swift /tmp/fs-shots-iphone ios/FeatherShot/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png \
  _archive/appstore-ios/header/header-3840x1646.png 3840 1646
```

- [`demo_screen.swift`](appstore/demo_screen.swift) draws the screen that gets annotated: a made-up "Lisbon Weekend" itinerary, our own content.
- [`capture.sh`](appstore/capture.sh) opens it in the Debug app with `--demo <scene>` ([`DemoScenes.swift`](../../ios/FeatherShot/Debug/DemoScenes.swift), Debug builds only) and saves each screen with a 9:41 status bar. On the iPhone Duo pass `1` as display: the simulator starts folded, and its inner 2007×2853 display stays dark without the Simulator app's fold control.
- [`compose.swift`](appstore/compose.swift) adds the gradient, headline, subtitle and device frame at the exact canvas size; headlines are in its `slides` list (iPad gets its own slide 2). The guide frame comes from `guide-1` … `guide-8` (the intro animation keeps running): copy the one showing "3 Annotate" to `guide-3.png`.
- Apple Watch: launch the iPhone app once with `--open-screenshot demo.png --demo-export <dir>` to write the annotated demo images, copy them (JPEG, ≤900 px) into the Watch app's `Documents/Shots` (`xcrun simctl get_app_container <watch> xyz.kainzmayer.feathershot.watchkitapp data`), then launch the Watch app plain, with `--demo-detail`, and with `--demo-detail --demo-zoom 1.8`. Watch captures have transparent corners: flatten them onto black before uploading. watchOS ignores the 9:41 status bar override.
