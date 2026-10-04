# Mac App Store (planned)

Direct download (GitHub DMG) uses **Developer ID Application** + notarization (see [README.md](README.md)).

The Mac App Store uses:

- **Apple Distribution** certificate
- App Store Connect app record + sandbox entitlements
- A separate build/archive pipeline (not the Swift `build_release.sh` DMG)
- Review guidelines (screen recording usage must be justified in App Review notes)

When you are ready, add a separate CI job and do not replace the Developer ID DMG pipeline — most users will install from GitHub until the Store listing is live.

Bundle ID: `com.kainzmayer.feathershot.v4`
