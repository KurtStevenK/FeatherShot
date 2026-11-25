# Handoff for the Mac: iOS and macOS 1.3.51 to the App Store

Written on 2026-11-25 by the Windows session for the Claude session on the Mac. Everything below
is a TODO for the Mac: the Windows machine has no Xcode, so nothing here was built or run on Apple
hardware yet. CI did compile it: `swift build -c release`, `swift test` (macOS) and the new `ios` job
(`xcodebuild` for the iOS simulator, unsigned) all pass on main.

## Where things stand

- **Tag `v1.3.51`** is on main (`8bce455`). It is released on GitHub with the notarized macOS DMG,
  Windows (exe, msi, portable), Linux (deb, AppImage, pacman, snap) and the Chrome extension ZIP. The
  Android APK is added by the new workflow "Android APK for a release". Homebrew, APT, Snap Store,
  Chocolatey and the Firebase mirror (feathershot.xyz) are updated.
- **Versions in the repo:** `Info.plist` 1.3.51, `ios/Config/Version.xcconfig` MARKETING_VERSION 1.3.51.
- **App Store Connect** (app id 6821684358, one record for iOS and macOS):
  - iOS 1.3.47 is live (Ready for Distribution).
  - macOS 1.3.44 (build 1346) is live. It is the only macOS build there.
- **What's new in 1.3.49–1.3.51 for the Apple apps** (see CHANGELOG.md):
  1. **Dashed Line** tool (`Tool.dashedLine`, `DashedLineView`, shortcut D on the Mac, SF Symbol `ellipsis`).
  2. **Text tool reworked** (`TextAnnotation` in `Sources/DrawingShapes.swift`, `AnnotationView.swift`,
     `ios/FeatherShot/Editor/*`). A click starts an empty text right there; while typing, the drawn
     text is hidden and the plain field looks like the result (dashed outline only). A click elsewhere
     commits it and starts the next one; Return/Esc finish; empty texts are dropped; tool switch,
     ⌘S/Save & Copy, Undo and Clear commit first. Root cause of the user's bug: Undo removed the text
     still being typed, Esc did nothing, and switching tools / clicking beside the image left the
     field open.

## TODO 1: pull and build

```bash
cd ~/path/to/FeatherShot   # the Mac checkout
git checkout main && git pull
swift build -c release && swift test
```

## TODO 2: test the new Text tool and Dashed Line on the Mac (nobody has run them yet)

Run the debug app (`swift run` or `.build/release/FeatherShot`), take a screenshot, and check each of these.
Fix what fails (see "If something is wrong" below):

- [ ] T, click: an empty field with a faint "Type here" opens at the click, **already focused** (type without clicking again).
- [ ] While typing there is **one** copy of the text, in the selected **color** (if the plain `TextField`
      ignores `.foregroundStyle(color)` while typing, use `.foregroundColor(color)`), same size, no box.
- [ ] Return and Esc finish; the text does **not jump** (check at 100 %, Fit and 200 % zoom; the
      system font's optical sizing may make the field a few % wider than the final text off 1:1).
- [ ] Vertical position: the field may sit ~1 pt off the final text. Adjust in `textAnnotationEditingFrame` if visible.
- [ ] Click elsewhere on the image: the first text stays, a second empty field opens there.
- [ ] Click beside the image (dark margin): the open text is committed.
- [ ] Click an existing text: it opens with the **caret at the end** (`placeCaretAtEnd` polls for the field
      editor; if it never finds it, the whole text is selected instead). Drag a text: it moves from the grab point.
- [ ] Click inside the open field: places the caret, does not move the text or close the field.
- [ ] ⌘S while typing saves **with** the text; Undo while typing an empty field only drops that field;
      Undo after typing removes that text; switching tools (keys or palette) keeps the text.
- [ ] Dashed Line: palette button after Line, key D, dashes 3× / gaps 2× the width, in the exported PNG too.
- [ ] Text and dashed line appear in the saved PNG and on the clipboard.

## TODO 3: test on the iPhone (simulator, and a device if one is connected)

```bash
xcrun simctl list devices available | grep iPhone      # pick one of these names
xcodebuild -project ios/FeatherShot.xcodeproj -scheme FeatherShot -destination 'platform=iOS Simulator,name=<iPhone name>' build
```

- [ ] Text tool: tap opens a focused field with the keyboard (the least certain part: focus is set from a
      `.task` inside the canvas's own hosting controller, with a 100 ms retry). Typing shows one copy.
- [ ] The keyboard can cover a text near the bottom; nothing scrolls it up yet. If that is bad in practice,
      move the canvas up while the keyboard is shown.
- [ ] Tap elsewhere commits and starts the next text; Done (Return) finishes; tapping into the field places the caret.
- [ ] Dashed Line in the tool bar after Line, drawn and exported.

## If something is wrong

Fix it on a branch, open a PR (CI must pass: `swift`, `ios`, …), merge, then bump to **1.3.52** in all
version files (docs/project-conventions.md → "Version Bumping"), add a CHANGELOG entry, tag `v1.3.52` and
use that version below. If everything works, build 1.3.51.

## TODO 4: Mac App Store build and upload

`build_appstore.sh` still defaults to 1.3.44, so pass the version. The build number must be higher
than the live 1346:

```bash
FEATHERSHOT_VERSION=1.3.51 FEATHERSHOT_BUILD=1351 bash packaging/mac/build_appstore.sh
```

Upload `FeatherShot-1.3.51-AppStore.pkg` with Transporter, or with the API key (see packaging/mac/APP-STORE.md → Upload).
Also worth doing: make `build_appstore.sh` default `VERSION` to `CFBundleShortVersionString` from `Info.plist`.

## TODO 5: iOS build and upload

```bash
FEATHERSHOT_UPLOAD=1 bash packaging/ios/build_testflight.sh
```

(MARKETING_VERSION is already 1.3.51; the build number defaults to the UTC time.)

## TODO 6: App Store Connect (the user signs in; ask them, do not enter passwords)

1. Wait until both builds finish **Processing** in TestFlight.
2. **macOS:** + Version → **1.3.51**. Select build 1351.
   - Replace the Mac screenshots with the 5 new ones in
     `packaging/mac/appstore/screenshots/` (2880 × 1800, in order 1–5). They show the website and two
     sample pages annotated in the editor, and only Apple platforms (no Windows, Android or other store
     badges, App Review guideline 2.3.10). They were rendered from the shared editor on Windows. Compare
     the tool bar with the real Mac app; if an icon differs noticeably, take the screenshots from the
     real app in the same layout instead.
   - Use the same What's New text as below.
3. **iOS:** + Version → **1.3.51**. Select the new build. Screenshots can stay.
4. **What's New** (both, English):

   ```
   • New Dashed Line tool.
   • Reworked Text tool: tap or click and type. The text appears right where you put it, exactly as it will look. Tap or click somewhere else to keep it and start the next one.
   • Fixed: a text you were still typing could get lost.
   ```

   On the Mac you can add "(shortcut D)" after Dashed Line, and "Return or Esc finishes" after the Text tool sentence.
5. **Submit both for review**, "release automatically after approval". Confirm with the user before pressing Submit.

## TODO 7: report back

Write the result (build numbers, review status, anything fixed or still open) into a commit on main or a
short note for the user. The Windows session still has to send Chrome extension 1.3.51 to the Chrome
Web Store. The ZIP is on the GitHub release, and 1.3.49 is pending review there.
