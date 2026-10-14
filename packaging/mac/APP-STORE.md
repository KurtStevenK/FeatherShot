# Mac App Store / TestFlight

Direct download (GitHub DMG) uses **Developer ID Application** + notarization (see [README.md](README.md)).

The Mac App Store uses a **separate** pipeline:

- **Apple Distribution** + **App Sandbox** ([`FeatherShot-AppStore.entitlements`](FeatherShot-AppStore.entitlements))
- Mac App Store **`.pkg`** (not the Developer ID DMG from [`build_release.sh`](../../build_release.sh))
- App Store Connect app **FeatherShot** — bundle `xyz.kainzmayer.feathershot`

Do not replace the Developer ID DMG CI job; most users install from GitHub until the Store listing is live.

## Local build (TestFlight / App Store upload)

```bash
cd /path/to/FeatherShot
FEATHERSHOT_VERSION=1.3.25 FEATHERSHOT_BUILD=1326 bash packaging/mac/build_appstore.sh
```

Output: `FeatherShot-<version>-AppStore.pkg` in the repo root.

The script compiles the Swift app, assembles `FeatherShot.app`, signs with **Apple Distribution**, then runs `xcodebuild -exportArchive` (managed **Mac Installer** signing). Xcode creates a **Mac Team Store** provisioning profile on first export if needed.

### Info.plist requirements (App Store)

Included in the App Store build template:

- `ITSAppUsesNonExemptEncryption` = false (HTTPS only)
- `LSApplicationCategoryType` = `public.app-category.graphics-design`
- `NSScreenCaptureUsageDescription`
- `NSDownloadsFolderUsageDescription` (macOS asks once before Save & Copy writes to Downloads; needs the `com.apple.security.files.downloads.read-write` entitlement)

### Updates

App Review guideline 2.4.5 lets only the Mac App Store update a store app, so the menu bar menu hides **Check for Updates…** (the GitHub DMG check) in store builds and keeps **Version x.y.z**. `UpdateChecker.isAppStoreBuild` counts the app as a store build when it has a receipt in `Contents/_MASReceipt` (App Store, TestFlight) or runs in the App Sandbox (App Review may launch it without a receipt). Keep the Developer ID build's [`FeatherShot.entitlements`](FeatherShot.entitlements) unsandboxed, or the DMG loses its update check.

## Upload

**Transporter (GUI):** drag `FeatherShot-*-AppStore.pkg` into [Transporter](https://apps.apple.com/app/transporter/id1450874784).

**CLI (same as Transporter):** API key in `~/.private_keys/AuthKey_WVB97T8LBH.p8` (copy from `~/private/app-store-connect/`). Use system `PATH` so GNU `mktemp` does not break Java:

```bash
PATH="/usr/bin:/bin:/usr/sbin:/sbin:/Applications/Xcode.app/Contents/Developer/usr/bin" \
  TMPDIR=/tmp \
  xcrun iTMSTransporter -m upload \
  -assetFile "FeatherShot-1.3.25-AppStore.pkg" \
  -apiKey WVB97T8LBH \
  -apiIssuer "<issuer-id-from-app-store-connect-integrations>"
```

Issuer ID: [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api).

## App Store listing URLs

| Field | URL |
|-------|-----|
| Privacy Policy | https://feathershot.web.app/privacy |
| Marketing / support site | https://feathershot.web.app/ |

Set **Privacy Policy URL** under App Information in App Store Connect before submitting for review. Align **App Privacy** answers with [`hosting/public/privacy/index.html`](../../hosting/public/privacy/index.html).

## After upload

1. Wait for **Processing** on [TestFlight → macOS](https://appstoreconnect.apple.com/apps/6821684358/testflight/macos).
2. Answer **export compliance** (no non-exempt encryption if `ITSAppUsesNonExemptEncryption` is false).
3. Enable the build for **internal testing** (create a group if needed).
4. Match **marketing version** on the macOS App Store version page to `CFBundleShortVersionString` (e.g. 1.3.25). Use **manual release** until the listing is ready.

## Credentials (not in git)

| Credential | Used for |
|------------|----------|
| `AuthKey_*.p8` + Key ID + Issuer ID | Upload / App Store Connect API |
| App-specific password | `notarytool` for **Developer ID** DMGs only |
| `DeveloperIDApplication-for-ci.p12` | GitHub DMG CI (`CSC_LINK`) |

Local backup: `~/private/app-store-connect/` and `~/private/apple-developer-id/`.
