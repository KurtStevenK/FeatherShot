# Mac App Store (planned)

Direct download (GitHub DMG) uses **Developer ID Application** + notarization (see [README.md](README.md)).

The Mac App Store uses:

- **Apple Distribution** certificate
- App Store Connect app record + sandbox entitlements
- A separate build/archive pipeline (not the Swift `build_release.sh` DMG)
- Review guidelines (screen recording usage must be justified in App Review notes)

When you are ready, add a separate CI job and do not replace the Developer ID DMG pipeline — most users will install from GitHub until the Store listing is live.

Bundle ID: `xyz.kainzmayer.feathershot`

## App Store Connect API key (`.p8`)

Apple issues **API keys** (filename like `AuthKey_WVB97T8LBH.p8`) from [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api). This is **not** a `.p6` file and is **not** the same as:

| Credential | Used for |
|------------|----------|
| `AuthKey_*.p8` + Key ID + Issuer ID | App Store Connect API (upload builds, metadata, TestFlight) |
| App-specific password | `notarytool` / `altool` notarization for **Developer ID** DMGs (`APPLE_APP_SPECIFIC_PASSWORD` in GitHub) |
| `DeveloperIDApplication-for-ci.p12` | Code signing DMGs in CI (`CSC_LINK`) |

Keep `.p8` files out of git (see root `.gitignore`). Local backup: `~/private/app-store-connect/`.
