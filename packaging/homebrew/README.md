# Homebrew tap (`KurtStevenK/homebrew-tap`)

macOS users install with:

```bash
brew tap KurtStevenK/tap
brew install --cask feathershot
```

Or in one line:

```bash
brew install --cask KurtStevenK/tap/feathershot
```

The cask is updated on every tagged FeatherShot release by the **Update Homebrew tap** step in [`.github/workflows/build-release.yml`](../../.github/workflows/build-release.yml).

## Maintainer setup

1. Repository **`KurtStevenK/homebrew-tap`** (hosts multiple casks).
2. **`TAP_TOKEN`** in FeatherShot Actions secrets — PAT with **Contents: write** on `homebrew-tap` (same token as `cursor-auto-runner` / APT).

## DMG filename

CI builds **`FeatherShot-<version>-(macOS).dmg`** via [`build_release.sh`](../../build_release.sh). The cask `url` must match exactly.

## User upgrade

```bash
brew upgrade --cask feathershot
```
