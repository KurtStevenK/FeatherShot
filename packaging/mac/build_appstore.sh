#!/bin/bash
# Mac App Store / TestFlight: sandboxed .app + signed .pkg (not Developer ID DMG).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VERSION="${FEATHERSHOT_VERSION:-1.3.27}"
BUILD="${FEATHERSHOT_BUILD:-1327}"
TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"
BUNDLE_ID="xyz.kainzmayer.feathershot"
ENTITLEMENTS="${ROOT}/packaging/mac/FeatherShot-AppStore.entitlements"
PKG_NAME="FeatherShot-${VERSION}-AppStore.pkg"
APP_NAME="FeatherShot.app"

echo "==> FeatherShot Mac App Store build ${VERSION} (${BUILD})"

if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "Missing entitlements: $ENTITLEMENTS" >&2
  exit 1
fi

if [[ ! -f icon_1024.png ]]; then
  echo "Missing icon_1024.png in repo root" >&2
  exit 1
fi

echo "==> Creating Iconset"
mkdir -p AppIcon.iconset
sips -z 16 16     icon_1024.png --out AppIcon.iconset/icon_16x16.png
sips -z 32 32     icon_1024.png --out AppIcon.iconset/icon_16x16@2x.png
sips -z 32 32     icon_1024.png --out AppIcon.iconset/icon_32x32.png
sips -z 64 64     icon_1024.png --out AppIcon.iconset/icon_32x32@2x.png
sips -z 128 128   icon_1024.png --out AppIcon.iconset/icon_128x128.png
sips -z 256 256   icon_1024.png --out AppIcon.iconset/icon_128x128@2x.png
sips -z 256 256   icon_1024.png --out AppIcon.iconset/icon_256x256.png
sips -z 512 512   icon_1024.png --out AppIcon.iconset/icon_256x256@2x.png
sips -z 512 512   icon_1024.png --out AppIcon.iconset/icon_512x512.png
cp icon_1024.png AppIcon.iconset/icon_512x512@2x.png
iconutil -c icns AppIcon.iconset
rm -rf AppIcon.iconset

echo "==> Compiling Release Binary"
swift build -c release

echo "==> Building App Bundle"
rm -rf "$APP_NAME"
mkdir -p "$APP_NAME/Contents/MacOS" "$APP_NAME/Contents/Resources"

cp .build/release/FeatherShot "$APP_NAME/Contents/MacOS/"
cp AppIcon.icns "$APP_NAME/Contents/Resources/"

cat <<EOF > "$APP_NAME/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>FeatherShot</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>FeatherShot</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${BUILD}</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 Kurt Steven Kainzmayer</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon.icns</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSScreenCaptureUsageDescription</key>
    <string>FeatherShot needs screen recording permission to capture the screen.</string>
    <key>ITSAppUsesNonExemptEncryption</key>
    <false/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.graphics-design</string>
</dict>
</plist>
EOF

resolve_distribution_identity() {
  if [[ -n "${CODESIGN_IDENTITY:-}" ]]; then
    echo "$CODESIGN_IDENTITY"
    return
  fi
  security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"\(Apple Distribution:.*\)"/\1/p' | head -1
}

resolve_installer_identity() {
  if [[ -n "${INSTALLER_SIGN_IDENTITY:-}" ]]; then
    echo "$INSTALLER_SIGN_IDENTITY"
    return
  fi
  local id
  id=$(security find-identity -v -p basic 2>/dev/null \
    | sed -n 's/.*"\(3rd Party Mac Developer Installer:.*\)"/\1/p' | head -1)
  if [[ -n "$id" ]]; then
    echo "$id"
    return
  fi
  id=$(security find-identity -v -p basic 2>/dev/null \
    | sed -n 's/.*"\(Mac Installer Distribution:.*\)"/\1/p' | head -1)
  if [[ -n "$id" ]]; then
    echo "$id"
    return
  fi
  security find-identity -v -p basic 2>/dev/null \
    | sed -n 's/.*"\(Apple Distribution:.*\)"/\1/p' | head -1
}

find_provisioning_profile() {
  if [[ -n "${PROVISIONING_PROFILE_PATH:-}" && -f "$PROVISIONING_PROFILE_PATH" ]]; then
    echo "$PROVISIONING_PROFILE_PATH"
    return
  fi
  local dir="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
  local f profile app_id
  if [[ ! -d "$dir" ]]; then
    return 1
  fi
  while IFS= read -r -d '' f; do
    app_id=$(security cms -D -i "$f" 2>/dev/null | plutil -extract Entitlements.'com.apple.application-identifier' raw -o - - 2>/dev/null || true)
    if [[ -z "$app_id" ]]; then
      app_id=$(security cms -D -i "$f" 2>/dev/null | plutil -extract Entitlements.'application-identifier' raw -o - - 2>/dev/null || true)
    fi
    if [[ "$app_id" == *"${BUNDLE_ID}"* ]]; then
      profile=$(security cms -D -i "$f" 2>/dev/null | plutil -extract ProvisionedDevices raw -o - - 2>/dev/null || echo "store")
      if [[ "$profile" == "store" || -z "$profile" ]]; then
        echo "$f"
        return 0
      fi
    fi
  done < <(find "$dir" -name '*.provisionprofile' -print0 2>/dev/null)
  return 1
}

SIGN_ID=$(resolve_distribution_identity)
if [[ -z "$SIGN_ID" ]]; then
  echo "No Apple Distribution signing identity in keychain. Install cert or set CODESIGN_IDENTITY." >&2
  exit 1
fi
echo "==> App sign identity: $SIGN_ID"

PROFILE_PATH=""
if PROFILE_PATH=$(find_provisioning_profile); then
  echo "==> Using provisioning profile: $PROFILE_PATH"
  cp "$PROFILE_PATH" "$APP_NAME/Contents/embedded.provisionprofile"
else
  echo "==> WARNING: No Mac App Store provisioning profile found for ${BUNDLE_ID}."
  echo "    Create one at https://developer.apple.com/account/resources/profiles/add"
  echo "    or set PROVISIONING_PROFILE_PATH. Attempting sign without embedded profile..."
fi

echo "==> Code signing app (App Store sandbox)"
codesign --force --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGN_ID" \
  "$APP_NAME/Contents/MacOS/FeatherShot"
codesign --force --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGN_ID" \
  "$APP_NAME"
codesign --verify --strict --verbose=2 "$APP_NAME"

rm -f "$PKG_NAME"
INSTALLER_ID=$(resolve_installer_identity || true)

if [[ -n "$INSTALLER_ID" ]]; then
  echo "==> Packaging with productbuild (installer: $INSTALLER_ID)"
  if productbuild --component "$APP_NAME" /Applications --sign "$INSTALLER_ID" "$PKG_NAME"; then
    echo "==> Done: $PKG_NAME"
    echo "    Upload with Transporter or: xcrun iTMSTransporter -m upload -f \"$PKG_NAME\" -assetFile \"$(pwd)/$PKG_NAME\""
    exit 0
  fi
  echo "==> productbuild failed; trying xcodebuild export..."
fi

echo "==> Fallback: xcodebuild archive + export (managed installer signing)"
ARCHIVE_DIR="${ROOT}/build/appstore"
ARCHIVE_PATH="${ARCHIVE_DIR}/FeatherShot.xcarchive"
EXPORT_PATH="${ARCHIVE_DIR}/export"
EXPORT_PLIST="${ARCHIVE_DIR}/ExportOptions.plist"
rm -rf "$ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR"

cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <false/>
</dict>
</plist>
PLIST

# Stash signed app for archive assembly if xcodebuild cannot archive SPM directly.
STASH_APP="${ARCHIVE_DIR}/staged/${APP_NAME}"
mkdir -p "$(dirname "$STASH_APP")"
ditto "$APP_NAME" "$STASH_APP"

assemble_xcarchive() {
  local archive_path="${ARCHIVE_DIR}/FeatherShot.xcarchive"
  rm -rf "$archive_path"
  mkdir -p "$archive_path/Products/Applications"
  ditto "$APP_NAME" "$archive_path/Products/Applications/$APP_NAME"
  cat > "$archive_path/Info.plist" <<ARCHIVEPLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>ApplicationProperties</key>
	<dict>
		<key>ApplicationPath</key>
		<string>Applications/${APP_NAME}</string>
		<key>Architectures</key>
		<array><string>arm64</string></array>
		<key>CFBundleIdentifier</key>
		<string>${BUNDLE_ID}</string>
		<key>CFBundleShortVersionString</key>
		<string>${VERSION}</string>
		<key>CFBundleVersion</key>
		<string>${BUILD}</string>
		<key>SigningIdentity</key>
		<string>${SIGN_ID}</string>
		<key>Team</key>
		<string>${TEAM_ID}</string>
	</dict>
	<key>ArchiveVersion</key>
	<integer>2</integer>
	<key>CreationDate</key>
	<date>$(date -u +%Y-%m-%dT%H:%M:%SZ)</date>
	<key>Name</key>
	<string>FeatherShot</string>
	<key>SchemeName</key>
	<string>FeatherShot</string>
</dict>
</plist>
ARCHIVEPLIST
  echo "$archive_path"
}

echo "==> Exporting Mac App Store .pkg via xcodebuild (managed installer signing)"
ARCHIVE_PATH=$(assemble_xcarchive)
EXPORT_PATH="${ARCHIVE_DIR}/export"
rm -rf "$EXPORT_PATH"
mkdir -p "$EXPORT_PATH"

cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <false/>
</dict>
</plist>
PLIST

if xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates; then
  EXPORTED_PKG=$(find "$EXPORT_PATH" -name '*.pkg' | head -1)
  if [[ -n "$EXPORTED_PKG" ]]; then
    cp "$EXPORTED_PKG" "$PKG_NAME"
    echo "==> Done: $PKG_NAME"
    exit 0
  fi
fi

echo "xcodebuild -exportArchive failed." >&2
exit 1
