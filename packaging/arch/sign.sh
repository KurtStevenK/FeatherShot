#!/usr/bin/env bash
# Sign feathershot.db (+ .files) and export gpg.key at repo root (same key as APT).
set -euo pipefail

REPO_DIR="${1:?usage: sign.sh <arch-repo-dir>}"

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

ARCH_DIR="$REPO_DIR/x86_64"
DB="$ARCH_DIR/feathershot.db"

if [[ ! -f "$DB" ]]; then
  echo "database not found: $DB" >&2
  exit 1
fi

gpg --batch --yes --local-user "$SIGNING_KEY" --detach-sign --armor \
  -o "$DB.sig" "$DB"
gpg --batch --yes --local-user "$SIGNING_KEY" --detach-sign --armor \
  -o "$DB.files.sig" "$DB.files"

gpg --batch --yes --export --armor "$SIGNING_KEY" > "$REPO_DIR/gpg.key"

echo "Signed pacman database with key $SIGNING_KEY"
