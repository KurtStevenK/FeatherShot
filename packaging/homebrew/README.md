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
2. **`TAP_TOKEN`** in FeatherShot Actions secrets — see below (shared with APT publish).

Homebrew does **not** issue a separate API key. CI updates the tap with a **GitHub personal access token**.

### `TAP_TOKEN` (GitHub PAT)

| Item | Detail |
|------|--------|
| **What it is** | GitHub **personal access token** with permission to push to `KurtStevenK/homebrew-tap` |
| **Classic PAT scopes** | `repo` (full control of private repositories) — enough for your tap + `KurtStevenK/apt` |
| **Fine-grained PAT** | Resource owner: your account; repository access: `homebrew-tap` and `apt`; **Contents: Read and write** |
| **Create** | [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) |
| **Local shortcut** | If you use `gh auth login`, `gh auth token` is often the same token; `scripts/push-distribution-secrets-to-github.sh` uses it when `TAP_TOKEN` is unset |
| **GitHub secret** | **`TAP_TOKEN`** on `KurtStevenK/FeatherShot` |
| **CI use** | Clone `https://x-access-token:${TAP_TOKEN}@github.com/KurtStevenK/homebrew-tap.git`, commit [`feathershot.rb`](feathershot.rb), push |

No Homebrew account or `brew` API key is required for maintaining the tap.

## DMG filename

CI builds **`FeatherShot-<version>-(macOS).dmg`** via [`build_release.sh`](../../build_release.sh). The cask `url` must match exactly.

## User upgrade

```bash
brew upgrade --cask feathershot
```
