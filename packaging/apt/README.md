# APT repository (`KurtStevenK/apt`)

Debian and Ubuntu users install **FeatherShot** from the shared APT repo (GitHub Pages: https://kurtstevenk.github.io/apt/).

## User install (amd64)

If you already added the repo for other KurtStevenK packages, skip the first two lines:

```bash
curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/kurtstevenk-apt-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/kurtstevenk-apt-archive-keyring.gpg] https://kurtstevenk.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/kurtstevenk-apt.list
sudo apt-get update
sudo apt-get install feathershot
```

Upgrades:

```bash
sudo apt-get update && sudo apt-get install --only-upgrade feathershot
```

## Maintainer

FeatherShot tagged releases run `packaging/apt/publish.sh` in [`.github/workflows/build-release.yml`](../../.github/workflows/build-release.yml).

## Secrets (FeatherShot Actions)

| Secret | Purpose |
|--------|---------|
| **`TAP_TOKEN`** | GitHub PAT — clone/push [`KurtStevenK/apt`](https://github.com/KurtStevenK/apt) (`gh-pages`). Same token as [homebrew-tap](../homebrew/README.md) (`repo` or fine-grained Contents write). |
| **`APT_GPG_PRIVATE_KEY`** | Full armored **private** GPG key used to sign `InRelease` / `Release.gpg` and publish `gpg.key` |
| **`APT_GPG_PASSPHRASE`** | Only if the signing key has a passphrase (cursor-auto-runner key has none) |

**Local backup:** `~/private/apt-signing/apt-signing-private.asc` — set `APT_GPG_KEY_FILE` in `.env.local` (see [`.env.example`](../../.env.example)), then `bash scripts/push-distribution-secrets-to-github.sh`.

There is no separate “APT API key” beyond GPG + GitHub push access.
