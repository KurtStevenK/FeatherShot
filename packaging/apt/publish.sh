#!/usr/bin/env bash
# Add a .deb to an APT repo tree, regenerate indexes, and GPG-sign the suite.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${1:?usage: publish.sh <apt-repo-dir> <path-to.deb>}"
DEB_FILE="${2:?usage: publish.sh <apt-repo-dir> <path-to.deb>}"

bash "$SCRIPT_DIR/generate.sh" "$REPO_DIR" "$DEB_FILE"
bash "$SCRIPT_DIR/sign.sh" "$REPO_DIR"
touch "$REPO_DIR/.nojekyll"
