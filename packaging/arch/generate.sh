#!/usr/bin/env bash
# Add a pacman package (.pacman from electron-builder / FPM) and refresh the database.
set -euo pipefail

REPO_DIR="${1:?usage: generate.sh <arch-repo-dir>}"
PKG_FILE="${2:?usage: generate.sh <arch-repo-dir> <path-to.pacman>}"

if [[ ! -f "$PKG_FILE" ]]; then
  echo "package not found: $PKG_FILE" >&2
  exit 1
fi

ARCH_DIR="$REPO_DIR/x86_64"
mkdir -p "$ARCH_DIR"

NEW_PKG="$(basename "$PKG_FILE")"
DB_NAME="feathershot.db.tar.zst"

(
  cd "$ARCH_DIR"
  shopt -s nullglob
  # Remove legacy/broken DB files from earlier publish attempts
  rm -f feathershot.db feathershot.db.sig feathershot.files feathershot.files.sig 2>/dev/null || true

  for old in feathershot-*.pkg.tar.zst FeatherShot-*.pacman; do
    if [[ "$old" != "$NEW_PKG" ]]; then
      if [[ -f "$DB_NAME" ]]; then
        repo-remove -q "$DB_NAME" "$old" 2>/dev/null || true
      fi
      rm -f "$old"
    fi
  done
  cp -f "$PKG_FILE" "./$NEW_PKG"
  repo-add -q "$DB_NAME" "$NEW_PKG"
)

echo "Updated $ARCH_DIR/$DB_NAME with $NEW_PKG"
