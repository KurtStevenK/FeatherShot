# macOS signing (Developer ID) & App Store (later)

Never commit `.p12` or private `.key` files.

## Two different Apple certificates

| Certificate | Use |
|-------------|-----|
| **Developer ID Application** | GitHub DMG — install outside the App Store (**required for releases**) |
| **Apple Distribution** | Mac App Store only (see [APP-STORE.md](APP-STORE.md)) |

## Two Apple websites

| Site | FeatherShot |
|------|-------------|
| [developer.apple.com/account](https://developer.apple.com/account) | Register App ID **`xyz.kainzmayer.feathershot`** (matches **kainzmayer.xyz**) |
| [appstoreconnect.apple.com](https://appstoreconnect.apple.com) | Optional macOS app record for future Mac App Store |

## GitHub Actions secrets

Copy the same values you use for [cursor-auto-runner](https://github.com/KurtStevenK/cursor-auto-runner) (GitHub cannot read secret values via API — re-export `.p12` or copy from your password manager). Check status: `bash scripts/copy-apple-secrets-from-cursor-auto-runner.sh`.

| Secret | Purpose |
|--------|---------|
| `CSC_LINK` | Base64 `.p12` (Developer ID Application) |
| `CSC_KEY_PASSWORD` | `.p12` password |
| `APPLE_TEAM_ID` | Team ID from [Apple Developer → Membership](https://developer.apple.com/account) |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for `notarytool` |

**Local files (gitignored):** see `~/private/README.md` — Apple certs under `~/private/apple-developer-id/` and `app-store-connect/`, APT GPG under `~/private/apt-signing/`. Chocolatey + GitHub tap/APT tokens: [chocolatey](../chocolatey/README.md), [homebrew](../homebrew/README.md), [apt](../apt/README.md) and `.env.local` / `scripts/push-distribution-secrets-to-github.sh`.

Interactive upload (uses `~/private/apple-developer-id/DeveloperIDApplication-for-ci.p12` when present):

```bash
bash scripts/push-apple-signing-to-github.sh
```

Tagged releases (`v*`) **fail** if `CSC_LINK`, `CSC_KEY_PASSWORD`, or `APPLE_TEAM_ID` are missing.

Notarization requires `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`. Create at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords. Use `gh secret set --body` with no trailing newline.

If `notarytool` returns **HTTP 401**, regenerate the app-specific password and update both `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`.

## Release

```bash
git tag v1.3.12
git push origin v1.3.12
```

CI builds `FeatherShot-<version>-(macOS).dmg` with Developer ID signing + notarization.

## Local signed build

```bash
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=YOUR_APPLE_TEAM_ID
export FEATHERSHOT_VERSION=1.3.12
./build_release.sh
```

## Verify

```bash
codesign --verify --strict --verbose=2 FeatherShot.app
xcrun stapler validate "FeatherShot-1.3.12-(macOS).dmg"
spctl -a -t exec -vv FeatherShot.app/Contents/MacOS/FeatherShot
```

Expect `Developer ID Application` and `accepted`.
