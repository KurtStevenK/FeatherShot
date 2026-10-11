#!/usr/bin/env bash
# Upload release artifacts to Firebase Storage and write hosting/public/releases/latest.json
set -euo pipefail

ARTIFACTS_DIR="${1:?artifacts directory}"
VERSION="${2:?version without v prefix}"
REPO_ROOT="${3:-$(cd "$(dirname "$0")/../.." && pwd)}"
BUCKET="${FIREBASE_STORAGE_BUCKET:-feathershot.firebasestorage.app}"
MANIFEST_PATH="$REPO_ROOT/hosting/public/releases/latest.json"

storage_public_url() {
  local object_path="$1"
  local encoded
  encoded=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$object_path")
  echo "https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

upload_one() {
  local file="$1"
  local dest="releases/v${VERSION}/$(basename "$file")"
  echo "Uploading $(basename "$file") -> gs://${BUCKET}/${dest}"
  gcloud storage cp --cache-control="public, max-age=31536000" "$file" "gs://${BUCKET}/${dest}"
  local url sha
  url=$(storage_public_url "$dest")
  sha=$(sha256_file "$file")
  printf '%s' "{\"url\":\"$url\",\"sha256\":\"$sha\",\"filename\":\"$(basename "$file")\"}"
}

find_first() {
  find "$ARTIFACTS_DIR" -type f -name "$1" 2>/dev/null | head -1
}

DMG=$(find_first "*.dmg")
EXE=$(find "$ARTIFACTS_DIR" -type f -name "*Setup*.exe" 2>/dev/null | head -1)
if [[ -z "$EXE" ]]; then
  EXE=$(find_first "*.exe")
fi
DEB=$(find_first "*.deb")
APPIMAGE=$(find_first "*.AppImage")
PACMAN=$(find_first "*.pacman")
ZIP=$(find "$ARTIFACTS_DIR" -type f -name "*Chrome*.zip" 2>/dev/null | head -1)
if [[ -z "$ZIP" ]]; then
  ZIP=$(find_first "*.zip")
fi

PUBLISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
json_assets=""

add_asset() {
  local key="$1"
  local file="$2"
  if [[ -z "$file" || ! -f "$file" ]]; then
    return 0
  fi
  local entry
  entry=$(upload_one "$file")
  if [[ -n "$json_assets" ]]; then
    json_assets+=","
  fi
  json_assets+="\"$key\":$entry"
}

add_asset macos_dmg "$DMG"
add_asset windows_exe "$EXE"
add_asset linux_deb "$DEB"
add_asset linux_appimage "$APPIMAGE"
add_asset linux_pacman "$PACMAN"
add_asset chrome_zip "$ZIP"

mkdir -p "$(dirname "$MANIFEST_PATH")"
cat >"$MANIFEST_PATH" <<EOF
{
  "version": "$VERSION",
  "published_at": "$PUBLISHED_AT",
  "bucket": "$BUCKET",
  "assets": {
    $json_assets
  }
}
EOF

echo "Wrote $MANIFEST_PATH"
