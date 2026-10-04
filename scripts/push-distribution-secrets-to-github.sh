#!/usr/bin/env bash
# Upload distribution secrets to FeatherShot (same values as cursor-auto-runner).
#
# GitHub cannot copy secret values between repos — use the same sources you used for
# cursor-auto-runner (see cursor-auto-runner/SECURITY.md and packaging/*/README.md).
#
# Non-interactive: export CHOCOLATEY_API_KEY, TAP_TOKEN, APT_GPG_PRIVATE_KEY
#   (or APT_GPG_KEY_FILE pointing at apt-signing-private.asc)
# Optional: APT_GPG_PASSPHRASE
#
# Interactive: run with no env vars; TAP_TOKEN defaults to `gh auth token` if unset.
set -euo pipefail

REPO="KurtStevenK/FeatherShot"
CAR_ROOT="${CURSOR_AUTO_RUNNER_ROOT:-/Users/kurtsteven/Projekte/cursor-auto-runner}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.local"
  set +a
fi

if [[ -z "${APT_GPG_PRIVATE_KEY:-}" ]]; then
  if [[ -n "${APT_GPG_KEY_FILE:-}" && -f "$APT_GPG_KEY_FILE" ]]; then
    APT_GPG_PRIVATE_KEY="$(cat "$APT_GPG_KEY_FILE")"
  elif [[ -f "${HOME}/private/apt-signing/apt-signing-private.asc" ]]; then
    APT_GPG_PRIVATE_KEY="$(cat "${HOME}/private/apt-signing/apt-signing-private.asc")"
  elif [[ -f "${HOME}/apt-signing-private.asc" ]]; then
    APT_GPG_PRIVATE_KEY="$(cat "${HOME}/apt-signing-private.asc")"
  elif [[ -f "$CAR_ROOT/apt-signing-private.asc" ]]; then
    APT_GPG_PRIVATE_KEY="$(cat "$CAR_ROOT/apt-signing-private.asc")"
  fi
fi

if [[ -z "${TAP_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  TAP_TOKEN="$(gh auth token)"
  echo "Using TAP_TOKEN from gh auth token (PAT with repo scope)."
fi

if [[ -z "${CHOCOLATEY_API_KEY:-}" ]]; then
  echo "Chocolatey API key (same as cursor-auto-runner; from community.chocolatey.org → Account → API Key):"
  read -rsp "CHOCOLATEY_API_KEY: " CHOCOLATEY_API_KEY
  echo ""
fi

if [[ -z "${APT_GPG_PRIVATE_KEY:-}" ]]; then
  default_asc="$CAR_ROOT/apt-signing-private.asc"
  echo ""
  echo "APT signing key: path to apt-signing-private.asc"
  echo "  (generated per cursor-auto-runner packaging/apt/README.md; not in git)"
  read -rp "Path [$default_asc]: " asc_path
  asc_path="${asc_path:-$default_asc}"
  if [[ ! -f "$asc_path" ]]; then
    echo "File not found: $asc_path" >&2
    echo "Export from gpg or copy from your password manager, then re-run." >&2
    exit 1
  fi
  APT_GPG_PRIVATE_KEY="$(cat "$asc_path")"
fi

missing=()
[[ -z "${CHOCOLATEY_API_KEY:-}" ]] && missing+=(CHOCOLATEY_API_KEY)
[[ -z "${TAP_TOKEN:-}" ]] && missing+=(TAP_TOKEN)
[[ -z "${APT_GPG_PRIVATE_KEY:-}" ]] && missing+=(APT_GPG_PRIVATE_KEY)

if ((${#missing[@]} > 0)); then
  echo "Missing: ${missing[*]}" >&2
  exit 1
fi

printf '%s' "$CHOCOLATEY_API_KEY" | gh secret set CHOCOLATEY_API_KEY --repo "$REPO"
printf '%s' "$TAP_TOKEN" | gh secret set TAP_TOKEN --repo "$REPO"
printf '%s' "$APT_GPG_PRIVATE_KEY" | gh secret set APT_GPG_PRIVATE_KEY --repo "$REPO"
if [[ -n "${APT_GPG_PASSPHRASE:-}" ]]; then
  printf '%s' "$APT_GPG_PASSPHRASE" | gh secret set APT_GPG_PASSPHRASE --repo "$REPO"
else
  read -rsp "APT_GPG_PASSPHRASE (Enter if none): " APT_GPG_PASSPHRASE
  echo ""
  if [[ -n "$APT_GPG_PASSPHRASE" ]]; then
    printf '%s' "$APT_GPG_PASSPHRASE" | gh secret set APT_GPG_PASSPHRASE --repo "$REPO"
  fi
fi

echo "Done. Distribution secrets set on $REPO"
echo "Re-run the v1.3.16 release workflow (or tag a patch) to publish Homebrew tap, APT, and Chocolatey."
