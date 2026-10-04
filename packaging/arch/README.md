# Pacman repository (`KurtStevenK/arch`)

Arch Linux users install **FeatherShot** from the shared pacman repo (GitHub Pages: https://kurtstevenk.github.io/arch/).

## User install (x86_64)

If you already added the repo for other KurtStevenK packages, skip the setup block and run `sudo pacman -Sy feathershot`.

### One-time repository setup

```bash
curl -fsSL https://kurtstevenk.github.io/arch/gpg.key | sudo pacman-key --add -
FINGERPRINT="$(curl -fsSL https://kurtstevenk.github.io/arch/gpg.key | gpg --batch --with-colons --import-options show-only --import 2>/dev/null | awk -F: '$1=="pub"{print $5; exit}')"
sudo pacman-key --lsign-key "$FINGERPRINT"

sudo tee -a /etc/pacman.conf >/dev/null <<'EOF'

[kurtstevenk]
SigLevel = Required DatabaseOptional TrustedOnly
LocalFileSigLevel = Optional
Server = https://kurtstevenk.github.io/arch/$arch
EOF
```

Install or upgrade:

```bash
sudo pacman -Sy feathershot
```

## Maintainer

1. Create an empty public GitHub repo **`KurtStevenK/arch`** (first publish uses the `gh-pages` branch, same pattern as [`KurtStevenK/apt`](https://github.com/KurtStevenK/apt)).
2. Tagged releases build a `.pkg.tar.zst` via electron-builder and run `packaging/arch/publish.sh` in [`.github/workflows/build-release.yml`](../../.github/workflows/build-release.yml) (Arch Linux container for `repo-add`).

Uses the same secrets as APT: **`TAP_TOKEN`**, **`APT_GPG_PRIVATE_KEY`**, optional **`APT_GPG_PASSPHRASE`**. See [apt README](../apt/README.md) and `scripts/push-distribution-secrets-to-github.sh`.
