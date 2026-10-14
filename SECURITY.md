# Security

FeatherShot is a public repository. Signing keys, tokens and passwords live only in GitHub Actions secrets and in gitignored local files.

## Never commit

- **`.env`** and **`.env.local`** (local secrets, including `CHOCOLATEY_API_KEY` and `VIRUSTOTAL_API_KEY`)
- Apple certificates and keys (`*.p12`, `*.cer`, `*.mobileprovision`, `AuthKey_*.p8`), or a base64-encoded `CSC_LINK`
- The APT / Arch signing key (`apt-signing-private.asc`), PATs (`TAP_TOKEN`) and Firebase service-account JSON

[`.env.example`](.env.example) lists the local variables without values. See [`.gitignore`](.gitignore) for the full ignore list.

## GitHub Actions secrets

| Secret | Used for |
|---|---|
| `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID` | Developer ID signing of the macOS app and DMG ([packaging/mac/README.md](packaging/mac/README.md)) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` | Notarization of the DMG |
| `TAP_TOKEN` | Pushing the Homebrew cask, APT and Arch repositories |
| `APT_GPG_PRIVATE_KEY`, `APT_GPG_PASSPHRASE` | Signing the APT and Arch repositories |
| `CHOCOLATEY_API_KEY` | Publishing the Chocolatey package |
| `FIREBASE_SERVICE_ACCOUNT` | Mirroring downloads to feathershot.web.app |
| `VIRUSTOTAL_API_KEY` | Scanning release files on VirusTotal |

`scripts/push-distribution-secrets-to-github.sh` uploads the distribution secrets from `.env.local`. It takes `VIRUSTOTAL_API_KEY` from cursor-auto-runner's `.env.local` when FeatherShot's has none.

## VirusTotal

After every tagged release, the [VirusTotal workflow](.github/workflows/virustotal.yml) downloads the release's installers, the portable `.exe` and the Chrome extension, uploads them to [VirusTotal](https://www.virustotal.com), and appends a table to the GitHub release notes: detection counts per file and a link to each file's full report (`virustotal.com/gui/file/<sha256>`). The free API allows 4 requests a minute and queues new files, so the workflow runs after Build & Release has published everything and waits up to 45 minutes (`VIRUSTOTAL_WAIT_MINUTES`) for the analyses. A file still queued then is listed as pending, and its report link shows the result once VirusTotal finishes. Detections are reported but do not fail the workflow unless `VIRUSTOTAL_FAIL_ON_DETECTION=1`.

To scan an older release, run the workflow from the Actions tab with its tag. To scan local builds, set `VIRUSTOTAL_API_KEY` in `.env.local`, then after a build:

```bash
npm run scan:virustotal
# or: node scripts/virustotal-scan.mjs --artifacts-dir electron-app/dist FeatherShot-<version>-macOS.dmg
```

Some engines flag new Electron apps heuristically. Read the full report, not a single detection.

## Repository protection

- **`main` is protected:** no force pushes and no deletion. Pull requests must pass the [CI](.github/workflows/ci.yml) checks (`swift`, `shared`, `electron`, `chrome` and both `electron-save-smoke` jobs) on an up-to-date branch before they merge. Admins can still push release commits directly; tags are not affected.
- **Secret scanning and push protection:** GitHub rejects pushes that contain recognised credentials.
- **Dependabot:** alerts and security-update pull requests for vulnerable dependencies.
- **Private vulnerability reporting** is on (see below).

## If a secret was committed

1. **Rotate or revoke** the credential right away (Apple certificate or app-specific password, PAT, GPG key, Chocolatey or VirusTotal key, Firebase service account).
2. Remove the file from history: [GitHub — removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Reporting vulnerabilities

Please report security issues through [GitHub Security Advisories](https://github.com/KurtStevenK/FeatherShot/security/advisories/new) or by email to the maintainer listed in [`electron-app/package.json`](electron-app/package.json).
