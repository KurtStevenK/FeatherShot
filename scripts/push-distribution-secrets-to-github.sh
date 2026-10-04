#!/usr/bin/env bash
# Upload distribution secrets to FeatherShot (same values as cursor-auto-runner).
# Set env vars or place files before running:
#   CHOCOLATEY_API_KEY, TAP_TOKEN
#   APT_GPG_PRIVATE_KEY or APT_GPG_KEY_FILE (path to .asc)
# Optional: APT_GPG_PASSPHRASE
set -euo pipefail

REPO="KurtStevenK/FeatherShot"

if [[ -n "${APT_GPG_KEY_FILE:-}" && -f "$APT_GPG_KEY_FILE" ]]; then
  APT_GPG_PRIVATE_KEY="$(cat "$APT_GPG_KEY_FILE")"
fi

missing=()
[[ -z "${CHOCOLATEY_API_KEY:-}" ]] && missing+=(CHOCOLATEY_API_KEY)
[[ -z "${TAP_TOKEN:-}" ]] && missing+=(TAP_TOKEN)
[[ -z "${APT_GPG_PRIVATE_KEY:-}" ]] && missing+=(APT_GPG_PRIVATE_KEY)

if ((${#missing[@]} > 0)); then
  echo "Missing: ${missing[*]}" >&2
  echo "Export the same values used in cursor-auto-runner, then re-run." >&2
  exit 1
fi

printf '%s' "$CHOCOLATEY_API_KEY" | gh secret set CHOCOLATEY_API_KEY --repo "$REPO"
printf '%s' "$TAP_TOKEN" | gh secret set TAP_TOKEN --repo "$REPO"
printf '%s' "$APT_GPG_PRIVATE_KEY" | gh secret set APT_GPG_PRIVATE_KEY --repo "$REPO"
if [[ -n "${APT_GPG_PASSPHRASE:-}" ]]; then
  printf '%s' "$APT_GPG_PASSPHRASE" | gh secret set APT_GPG_PASSPHRASE --repo "$REPO"
fi

echo "Done. Distribution secrets set on $REPO"
