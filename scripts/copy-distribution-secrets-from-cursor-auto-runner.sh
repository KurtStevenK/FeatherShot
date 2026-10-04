#!/usr/bin/env bash
# Lists distribution secret names on cursor-auto-runner vs FeatherShot (values are never shown).
set -euo pipefail

echo "FeatherShot distribution secrets: CHOCOLATEY_API_KEY TAP_TOKEN APT_GPG_PRIVATE_KEY APT_GPG_PASSPHRASE"
echo ""
echo "cursor-auto-runner has:"
gh secret list --repo KurtStevenK/cursor-auto-runner | grep -E 'CHOCOLATEY|TAP_TOKEN|APT_GPG' || true
echo ""
echo "FeatherShot has:"
gh secret list --repo KurtStevenK/FeatherShot | grep -E 'CHOCOLATEY|TAP_TOKEN|APT_GPG' || echo "(none — copy values manually from cursor-auto-runner Settings → Secrets)"
