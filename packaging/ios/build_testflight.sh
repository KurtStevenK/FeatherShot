#!/bin/bash
# iOS TestFlight: archive the iPhone app and export an App Store Connect .ipa (optionally upload it).
#
#   bash packaging/ios/build_testflight.sh                 # archive + export ios/build/export/FeatherShot.ipa
#   FEATHERSHOT_UPLOAD=1 bash packaging/ios/build_testflight.sh   # ... and upload to App Store Connect
#
# Signing is automatic (team XPPUZJDN56, Apple Distribution). xcodebuild creates the App Store
# profile with -allowProvisioningUpdates, using the Xcode account or, when ASC_KEY_ID,
# ASC_ISSUER_ID and ASC_KEY_PATH are set, an App Store Connect API key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="${ROOT}/ios"
OUT="${IOS}/build"
TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"
# Unique and rising on every run: TestFlight refuses a build number it has seen for this version.
BUILD="${FEATHERSHOT_BUILD:-$(date -u +%Y%m%d.%H%M)}"
VERSION=$(sed -n 's/^MARKETING_VERSION = //p' "${IOS}/Config/Version.xcconfig")

echo "==> FeatherShot iOS ${VERSION} (${BUILD})"

if command -v xcodegen >/dev/null 2>&1; then
  (cd "$IOS" && xcodegen generate --quiet)
fi

AUTH=()
if [[ -n "${ASC_KEY_ID:-}" && -n "${ASC_ISSUER_ID:-}" ]]; then
  KEY_PATH="${ASC_KEY_PATH:-$HOME/.private_keys/AuthKey_${ASC_KEY_ID}.p8}"
  AUTH=(-authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  echo "==> Using App Store Connect API key ${ASC_KEY_ID}"
fi

rm -rf "$OUT"
mkdir -p "$OUT"
ARCHIVE="${OUT}/FeatherShot.xcarchive"

echo "==> Archiving"
xcodebuild archive \
  -project "${IOS}/FeatherShot.xcodeproj" \
  -scheme FeatherShot \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD"

DESTINATION=export
if [[ "${FEATHERSHOT_UPLOAD:-0}" == "1" ]]; then
  DESTINATION=upload
fi

cat > "${OUT}/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>${DESTINATION}</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <true/>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
</dict>
</plist>
PLIST

echo "==> Exporting (${DESTINATION})"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "${OUT}/export" \
  -exportOptionsPlist "${OUT}/ExportOptions.plist" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}

if [[ "$DESTINATION" == "upload" ]]; then
  echo "==> Uploaded ${VERSION} (${BUILD}). Processing takes a few minutes in App Store Connect → TestFlight."
else
  echo "==> Done: ${OUT}/export/FeatherShot.ipa"
  echo "    Upload: drag it into Transporter, or rerun with FEATHERSHOT_UPLOAD=1."
fi
