#!/usr/bin/env bash
# Add a pacman package to an Arch repo tree, sign indexes, and refresh gpg.key.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${1:?usage: publish.sh <arch-repo-dir> <path-to.pkg.tar.zst>}"
PKG_FILE="${2:?usage: publish.sh <arch-repo-dir> <path-to.pkg.tar.zst>}"

bash "$SCRIPT_DIR/generate.sh" "$REPO_DIR" "$PKG_FILE"
bash "$SCRIPT_DIR/sign.sh" "$REPO_DIR"
touch "$REPO_DIR/.nojekyll"
