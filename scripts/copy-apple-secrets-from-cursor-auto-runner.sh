#!/usr/bin/env bash
# Copy Apple signing secret *names* from cursor-auto-runner — values must be set manually.
# GitHub does not expose secret values. Use the same .p12 + passwords as cursor-auto-runner:
#   bash scripts/push-apple-signing-to-github.sh
set -euo pipefail

echo "FeatherShot required secrets: CSC_LINK CSC_KEY_PASSWORD APPLE_TEAM_ID APPLE_ID APPLE_APP_SPECIFIC_PASSWORD"
echo ""
echo "cursor-auto-runner has:"
gh secret list --repo KurtStevenK/cursor-auto-runner | grep -E 'CSC_|APPLE_' || true
echo ""
echo "FeatherShot has:"
gh secret list --repo KurtStevenK/FeatherShot | grep -E 'CSC_|APPLE_' || echo "(none — run scripts/push-apple-signing-to-github.sh)"
