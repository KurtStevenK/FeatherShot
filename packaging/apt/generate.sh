#!/usr/bin/env bash
# Regenerate APT indexes under $REPO_DIR from all .deb files in pool/.
set -euo pipefail

REPO_DIR="${1:?usage: generate.sh <apt-repo-dir>}"
DEB_FILE="${2:?usage: generate.sh <apt-repo-dir> <path-to.deb>}"

if [[ ! -f "$DEB_FILE" ]]; then
  echo "deb not found: $DEB_FILE" >&2
  exit 1
fi

POOL_DIR="$REPO_DIR/pool/main/f/feathershot"
mkdir -p "$POOL_DIR"
cp -f "$DEB_FILE" "$POOL_DIR/"

PKG_DIR="$REPO_DIR/dists/stable/main/binary-amd64"
mkdir -p "$PKG_DIR"

(
  cd "$REPO_DIR"
  dpkg-scanpackages --arch amd64 pool /dev/null > "$PKG_DIR/Packages"
  gzip -9c "$PKG_DIR/Packages" > "$PKG_DIR/Packages.gz"
)

echo "Generated Packages for $(basename "$DEB_FILE") and any other debs in pool/"
