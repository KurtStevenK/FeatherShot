# iPhone app: TestFlight

The iPhone app lives in [`ios/`](../../ios). [`ios/project.yml`](../../ios/project.yml) is the source of the Xcode project. After editing it, run `xcodegen generate` in `ios/` and commit both files. The drawing code (`Sources/DrawingShapes.swift`, `EditorTheme.swift`, `EditorZoom.swift`) is compiled into both the Mac app and the iPhone app, so a change there must build on both.

- Bundle ID `xyz.kainzmayer.feathershot`, the same as the Mac app (Universal Purchase: one App Store record, one listing)
- iOS 18 or later, iPhone only, portrait
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

> FeatherShot annotates screenshots. To try it without setup, tap "Annotate a Screenshot from Photos" and pick any image. The main flow is a Shortcut ("Take Screenshot" → FeatherShot's "Annotate Screenshot" action), which the app offers with "Add the Shortcut", on the Action Button. The app takes no screenshots by itself, collects no data and has no network access.

Privacy: "Data Not Collected", as on the Mac. `PrivacyInfo.xcprivacy` declares no tracking, no collected data, and file-timestamp access (C617.1) for the cleanup of its own temp files.

## App Store screenshots

Six 1320×2868 images (the 6.9" size; App Store Connect scales them for smaller iPhones), in the style of the Mac set in `_archive/appstore`:

```bash
xcodebuild build -project ios/FeatherShot.xcodeproj -scheme FeatherShot \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath /tmp/fs-dd
xcrun simctl install booted /tmp/fs-dd/Build/Products/Debug-iphonesimulator/FeatherShot.app
bash packaging/ios/appstore/capture.sh booted /tmp/fs-shots
swift packaging/ios/appstore/compose.swift /tmp/fs-shots _archive/appstore-ios
```

- [`demo_screen.swift`](appstore/demo_screen.swift) draws the screen that gets annotated: a made-up "Lisbon Weekend" itinerary, our own content.
- [`capture.sh`](appstore/capture.sh) opens it in the Debug app with `--demo <scene>` ([`DemoScenes.swift`](../../ios/FeatherShot/Debug/DemoScenes.swift), Debug builds only) and saves each screen with a 9:41 status bar.
- [`compose.swift`](appstore/compose.swift) adds the gradient, headline, subtitle and iPhone frame. The headlines and subtitles are in its `slides` list.

The guide frame is picked from `guide-1` … `guide-8` (the intro animation keeps running); `compose.swift` uses `guide-3`, the "Annotate" step.
