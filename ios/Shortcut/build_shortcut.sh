#!/bin/bash
# Rebuilds the signed "FeatherShot Screenshot" shortcut bundled in the app
# (Take Screenshot → Annotate Screenshot). Needs macOS signed in to iCloud: `shortcuts sign`
# uploads it to Apple for an "anyone" signature. Run after renaming the intent or its parameter.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(/usr/bin/mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# The file name becomes the shortcut's name on import.
python3 -I "$HERE/make_shortcut.py" "$TMP/FeatherShot Screenshot.shortcut"
# The signing service deletes the file it wrote some seconds later, following it even when moved,
# so write a separate copy (`cat`, not `mv` or `cp`, which may clone it) and let it delete its own.
# The app copies the bundled file to a temporary "FeatherShot Screenshot.shortcut" when shared.
OUT="$HERE/../FeatherShot/Resources/FeatherShot-Screenshot.signedshortcut"
shortcuts sign --mode anyone --input "$TMP/FeatherShot Screenshot.shortcut" --output "$TMP/signed.shortcut"
cat "$TMP/signed.shortcut" > "$OUT"
chmod 644 "$OUT"
echo "Signed: ios/FeatherShot/Resources/FeatherShot-Screenshot.signedshortcut"
