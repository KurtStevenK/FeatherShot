# Chocolatey package (`feathershot`)

Windows installs via [Chocolatey Community](https://community.chocolatey.org/packages/feathershot):

```powershell
choco install feathershot
```

The `.nupkg` is built in the **Build & Release** workflow on tagged releases. It downloads the NSIS installer from GitHub Releases (see `tools/chocolateyinstall.ps1`).

`iconUrl` uses jsDelivr (not `raw.githubusercontent.com`):

`https://cdn.jsdelivr.net/gh/KurtStevenK/FeatherShot@v<version>/icon_1024.png`

## First-time moderation

The first pushed version stays **unlisted** until a moderator approves it. While **no version is approved**, Chocolatey may return **403** on newer versions.

CI runs [`should-push.sh`](should-push.sh) and skips push with a notice when moderation blocks.

## Manual push after approval

1. Open **Actions → Chocolatey push** in this repository.
2. **Run workflow** with the release tag (e.g. `v1.3.13`).
3. Requires **`CHOCOLATEY_API_KEY`** in repository secrets (same value as `cursor-auto-runner`).

## Local build

```bash
gh release download v1.3.13 --pattern 'FeatherShot-Setup-1.3.13-(Windows).exe' -D electron-app/dist
bash scripts/build-chocolatey-nupkg.sh 1.3.13 electron-app/dist/FeatherShot-Setup-1.3.13-\(Windows\).exe
```
