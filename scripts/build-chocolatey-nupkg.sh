#!/usr/bin/env bash
# Build feathershot.nupkg locally. Requires choco CLI on PATH.
set -euo pipefail

VERSION="${1:?usage: $0 <version> [path-to-setup.exe]}"
EXE="${2:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "$EXE" ]]; then
  for candidate in \
    "electron-app/dist/FeatherShot-Setup-${VERSION}-(Windows).exe" \
    "electron-app/dist/FeatherShot-Setup-${VERSION}-\(Windows\).exe"; do
    [[ -f "$candidate" ]] && EXE="$candidate" && break
  done
fi

if [[ -z "$EXE" || ! -f "$EXE" ]]; then
  echo "Download installer first, e.g.:" >&2
  echo "  gh release download v${VERSION} --pattern 'FeatherShot-Setup-${VERSION}-(Windows).exe' -D electron-app/dist" >&2
  exit 1
fi

if ! command -v choco >/dev/null 2>&1; then
  echo "choco CLI not found. Use GitHub Actions chocolatey-push workflow." >&2
  exit 1
fi

SHA=$(shasum -a 256 "$EXE" | awk '{print $1}')
PKG=choco-pkg
mkdir -p "$PKG/tools"
sed -e "s/__VERSION__/$VERSION/g" -e "s/__EXESHA__/$SHA/g" packaging/chocolatey/feathershot.nuspec > "$PKG/feathershot.nuspec"
sed -e "s/__VERSION__/$VERSION/g" -e "s/__EXESHA__/$SHA/g" packaging/chocolatey/tools/chocolateyinstall.ps1 > "$PKG/tools/chocolateyinstall.ps1"
( cd "$PKG" && choco pack )
echo "Built: $PKG/feathershot.${VERSION}.nupkg"
