#!/bin/bash
# Captures the App Store scenes from the Debug app in a booted iPhone simulator.
#
#   bash packaging/ios/appstore/capture.sh <simulator-udid> <out-dir>
#
# Needs a Debug build of ios/FeatherShot.xcodeproj installed on that simulator (the `--demo`
# scenes exist only in Debug builds). Writes <out-dir>/<scene>.png at the device's resolution.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEVICE="$1"
OUT="$2"
APP_ID="xyz.kainzmayer.feathershot"
mkdir -p "$OUT"

swift "$HERE/demo_screen.swift" "$OUT/demo.png" >/dev/null

xcrun simctl status_bar "$DEVICE" override --time "9:41" --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularMode active --cellularBars 4 --dataNetwork wifi

# simctl sometimes reports a launch that never starts: retry until the process is there.
launch() {
  for _ in 1 2 3 4 5 6 7 8; do
    xcrun simctl terminate "$DEVICE" "$APP_ID" >/dev/null 2>&1 || true
    sleep 1
    xcrun simctl launch "$DEVICE" "$APP_ID" "$@" >/dev/null 2>&1 || true
    sleep 3
    if xcrun simctl spawn "$DEVICE" launchctl list | grep -q "$APP_ID"; then return 0; fi
  done
  echo "Could not launch $APP_ID" >&2
  return 1
}

shoot() {
  xcrun simctl io "$DEVICE" screenshot "$OUT/$1.png" >/dev/null 2>&1
  echo "captured $1"
}

# A first launch clears the status bar's "◀ <previous app>" link.
launch
for scene in crop mixed steps callouts done; do
  launch --open-screenshot "$OUT/demo.png" --demo "$scene"
  sleep 5
  shoot "$scene"
done

# The first-launch setup guide: the argument domain overrides the stored "already shown" flag.
launch -setupGuideShown NO
sleep 4
for i in 1 2 3 4 5 6 7 8; do
  shoot "guide-$i"
  sleep 0.8
done

xcrun simctl terminate "$DEVICE" "$APP_ID" >/dev/null 2>&1 || true
