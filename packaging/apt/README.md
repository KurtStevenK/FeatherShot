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

Secrets in **FeatherShot** (same as cursor-auto-runner): `TAP_TOKEN`, `APT_GPG_PRIVATE_KEY`, optional `APT_GPG_PASSPHRASE`.
