#!/usr/bin/env bash
# Re-upload APPLE_ID + app-specific password (no trailing newline). Use the same values as cursor-auto-runner.
set -euo pipefail
REPO="KurtStevenK/FeatherShot"

if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  printf '%s' "$APPLE_ID" | gh secret set APPLE_ID --repo "$REPO"
  printf '%s' "$APPLE_APP_SPECIFIC_PASSWORD" | gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO"
  echo "Updated APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD on $REPO from environment."
  exit 0
fi

read -rp "Apple ID email (same as cursor-auto-runner): " APPLE_ID
read -rsp "App-specific password (appleid.apple.com): " APPLE_ASP
echo ""
printf '%s' "$APPLE_ID" | gh secret set APPLE_ID --repo "$REPO"
printf '%s' "$APPLE_ASP" | gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO"
echo "Done. Re-run the latest release tag workflow or: gh workflow run build-release.yml --ref v1.3.12"
