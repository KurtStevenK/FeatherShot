#!/usr/bin/env bash
# Upload macOS signing + notarization secrets to GitHub Actions.
# Never commit .p12 or .key files.
set -euo pipefail

REPO="KurtStevenK/FeatherShot"
DEFAULT_P12="${HOME}/private/apple-developer-id/DeveloperIDApplication-for-ci.p12"

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "No Developer ID Application certificate in Keychain." >&2
  echo "See packaging/mac/README.md (same flow as cursor-auto-runner)." >&2
  exit 1
fi

security find-identity -v -p codesigning | grep "Developer ID Application" | head -3

echo ""
if [[ -n "${APPLE_P12_FILE:-}" && -f "$APPLE_P12_FILE" ]]; then
  P12_PATH="$APPLE_P12_FILE"
elif [[ -f "$DEFAULT_P12" ]]; then
  P12_PATH="$DEFAULT_P12"
  echo "Using $P12_PATH"
else
  echo "Export from Keychain Access: My Certificates → Developer ID Application → Export → .p12"
  echo "Or place DeveloperIDApplication-for-ci.p12 in ~/private/apple-developer-id/"
  read -rp "Path to .p12 file: " P12_PATH
fi
if [[ ! -f "$P12_PATH" ]]; then
  echo "File not found: $P12_PATH" >&2
  exit 1
fi

read -rsp "Password for that .p12 (CSC_KEY_PASSWORD): " P12_PASS
echo ""
read -rp "Apple ID email (notarization): " APPLE_ID
read -rsp "App-specific password (appleid.apple.com): " APPLE_ASP
echo ""
if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
  TEAM_ID="$APPLE_TEAM_ID"
else
  read -rp "Apple Team ID (developer.apple.com → Membership): " TEAM_ID
fi
if [[ -z "${TEAM_ID:-}" ]]; then
  echo "APPLE_TEAM_ID is required." >&2
  exit 1
fi

B64=$(mktemp)
base64 < "$P12_PATH" | tr -d '\n' > "$B64"

echo "Uploading secrets to ${REPO}…"
gh secret set CSC_LINK --repo "$REPO" < "$B64"
printf '%s' "$P12_PASS" | gh secret set CSC_KEY_PASSWORD --repo "$REPO"
printf '%s' "$APPLE_ID" | gh secret set APPLE_ID --repo "$REPO"
printf '%s' "$APPLE_ASP" | gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO"
printf '%s' "$TEAM_ID" | gh secret set APPLE_TEAM_ID --repo "$REPO"

rm -f "$B64"
echo "Done. Tag a release (e.g. git tag v1.3.12 && git push origin v1.3.12) to publish a signed macOS DMG."
