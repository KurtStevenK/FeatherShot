#!/usr/bin/env bash
# Exit 0: push allowed. Exit 2: skip push (moderation backlog). Other: failure.
set -euo pipefail

PACKAGE_ID="${1:-feathershot}"
URL="https://community.chocolatey.org/packages/${PACKAGE_ID}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

http_code="$(curl -sS -L -o "$tmp" -w '%{http_code}' "$URL" || true)"

if [[ "$http_code" == "404" ]]; then
  echo "Package page not found — first submission; push allowed."
  exit 0
fi

if [[ "$http_code" != "200" ]]; then
  echo "Unexpected HTTP $http_code from $URL" >&2
  exit 1
fi

body="$(cat "$tmp")"

if grep -qiE 'Status[^|]*\|[^|]*Approved' <<<"$body"; then
  echo "At least one approved version exists; push allowed."
  exit 0
fi

if grep -qi 'awaiting moderation' <<<"$body"; then
  echo "Package has version(s) awaiting moderation and none approved yet; skip push."
  exit 2
fi

if grep -qiE 'Pending Automated Review|Pending automated review|Ready for Review|Submitted' <<<"$body"; then
  if ! grep -qiE 'Status[^|]*\|[^|]*Approved' <<<"$body"; then
    echo "No approved version yet (pending moderation); skip push."
    exit 2
  fi
fi

echo "Push allowed (default)."
exit 0
