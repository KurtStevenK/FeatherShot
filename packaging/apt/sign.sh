#!/usr/bin/env bash
# Sign dists/stable/Release → InRelease + Release.gpg; refresh gpg.key at repo root.
set -euo pipefail

REPO_DIR="${1:?usage: sign.sh <apt-repo-dir>}"

if [[ -z "${APT_GPG_PRIVATE_KEY:-}" ]]; then
  echo "APT_GPG_PRIVATE_KEY is required" >&2
  exit 1
fi

GPG_HOME="$(mktemp -d)"
export GNUPGHOME="$GPG_HOME"
trap 'rm -rf "$GPG_HOME"' EXIT

if [[ -n "${APT_GPG_PASSPHRASE:-}" ]]; then
  gpg --batch --yes --passphrase "$APT_GPG_PASSPHRASE" --import <<<"$APT_GPG_PRIVATE_KEY"
else
  gpg --batch --yes --import <<<"$APT_GPG_PRIVATE_KEY"
fi

SIGNING_KEY="$(gpg --list-secret-keys --with-colons | awk -F: '$1=="sec"{print $5; exit}')"
if [[ -z "$SIGNING_KEY" ]]; then
  echo "no secret key found after import" >&2
  exit 1
fi

STABLE="$REPO_DIR/dists/stable"
mkdir -p "$STABLE/main/binary-amd64"

(
  cd "$STABLE"
  apt-ftparchive release . > Release
)

gpg --batch --yes --local-user "$SIGNING_KEY" --clearsign \
  -o "$STABLE/InRelease" "$STABLE/Release"

gpg --batch --yes --local-user "$SIGNING_KEY" --detach-sign --armor \
  -o "$STABLE/Release.gpg" "$STABLE/Release"

gpg --batch --yes --export --armor "$SIGNING_KEY" > "$REPO_DIR/gpg.key"

echo "Signed stable suite with key $SIGNING_KEY"
