#!/usr/bin/env bash
# Lists distribution secret names on cursor-auto-runner vs FeatherShot (values are never shown).
set -euo pipefail

echo "FeatherShot distribution secrets: CHOCOLATEY_API_KEY TAP_TOKEN APT_GPG_PRIVATE_KEY APT_GPG_PASSPHRASE"
echo ""
echo "cursor-auto-runner has:"
gh secret list --repo KurtStevenK/cursor-auto-runner | grep -E 'CHOCOLATEY|TAP_TOKEN|APT_GPG' || true
echo ""
echo "FeatherShot has:"
gh secret list --repo KurtStevenK/FeatherShot | grep -E 'CHOCOLATEY|TAP_TOKEN|APT_GPG' || echo "(none yet)"
echo ""
echo "GitHub never shows secret values again after upload."
echo "Local files (gitignored) in cursor-auto-runner:"
CAR="${CURSOR_AUTO_RUNNER_ROOT:-/Users/kurtsteven/Projekte/cursor-auto-runner}"
for f in "${HOME}/private/apt-signing/apt-signing-private.asc" "${HOME}/apt-signing-private.asc" "$CAR/apt-signing-private.asc" "$CAR/packaging/apt/apt-signing-private.asc"; do
  [[ -f "$f" ]] && echo "  found: $f" || true
done
if [[ ! -f "${HOME}/private/apt-signing/apt-signing-private.asc" && ! -f "${HOME}/apt-signing-private.asc" && ! -f "$CAR/apt-signing-private.asc" && ! -f "$CAR/packaging/apt/apt-signing-private.asc" ]]; then
  echo "  (no apt-signing-private.asc on disk — use gpg export or your backup)"
fi
echo ""
echo "Upload to FeatherShot: bash scripts/push-distribution-secrets-to-github.sh"
