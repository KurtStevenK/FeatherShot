# FeatherShot on Firebase

- **Hosting**: https://feathershot.web.app (static site in [`hosting/public`](../../hosting/public))
- **Project ID**: `feathershot`
- **Release binaries**: Firebase Storage path `releases/v{VERSION}/…` (public read via [`storage.rules`](../../storage.rules))

## `releases/latest.json` schema

Written by CI on each tag (`packaging/firebase/upload-releases.sh`):

```json
{
  "version": "1.3.42",
  "published_at": "2026-03-22T12:00:00Z",
  "bucket": "feathershot.firebasestorage.app",
  "assets": {
    "macos_dmg": { "url": "https://...", "sha256": "...", "filename": "..." },
    "windows_exe": { "url": "...", "sha256": "...", "filename": "..." },
    "linux_deb": { "url": "...", "sha256": "...", "filename": "..." },
    "linux_appimage": { "url": "...", "sha256": "...", "filename": "..." },
    "linux_pacman": { "url": "...", "sha256": "...", "filename": "..." },
    "chrome_zip": { "url": "...", "sha256": "...", "filename": "..." }
  }
}
```

Asset keys are omitted when no matching file exists in the release.

## GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON key for CI uploads + deploy (Storage Object Admin, Firebase Hosting Admin) |

Optional: `FIREBASE_STORAGE_BUCKET` if the default bucket name differs from `feathershot.firebasestorage.app`.

## One-time: enable Storage

Before the first `storage` deploy or CI mirror, open [Firebase Console → Storage](https://console.firebase.google.com/project/feathershot/storage) and click **Get started** (default bucket). Then:

```bash
firebase deploy --only storage
```

Until Storage is enabled, CI still deploys **Hosting**; upload steps need the bucket.

## Local deploy

```bash
npm install -g firebase-tools   # or npx firebase-tools@latest
firebase login
firebase use feathershot
firebase deploy --only hosting,storage
```

## Mac App Store Connect

- **Privacy Policy URL**: https://feathershot.web.app/privacy
- **App Privacy**: align with [`hosting/public/privacy/index.html`](../../hosting/public/privacy/index.html) (no account; optional GitHub API update check; screen capture is on-device).
