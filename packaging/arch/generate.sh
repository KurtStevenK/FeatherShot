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
DB="$ARCH_DIR/feathershot.db"

(
  cd "$ARCH_DIR"
  shopt -s nullglob
  for old in feathershot-*.pkg.tar.zst FeatherShot-*.pacman; do
    if [[ "$old" != "$NEW_PKG" ]]; then
      if [[ -f "$DB" ]]; then
        repo-remove -q "$DB" "$old" 2>/dev/null || true
      fi
      rm -f "$old"
    fi
  done
  cp -f "$PKG_FILE" "./$NEW_PKG"
  repo-add -q "$DB" "$NEW_PKG"
)

echo "Updated $DB with $NEW_PKG"
