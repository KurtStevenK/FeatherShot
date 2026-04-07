#!/bin/bash
set -e

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
echo "==> Built AppIcon.icns"

echo "==> Compiling Release Binary"
swift build -c release

echo "==> Building App Bundle"
rm -rf FeatherShot.app
mkdir -p FeatherShot.app/Contents/MacOS
mkdir -p FeatherShot.app/Contents/Resources
cp .build/release/FeatherShot FeatherShot.app/Contents/MacOS/
cp AppIcon.icns FeatherShot.app/Contents/Resources/

# Create a final Info.plist inside the bundle
cat <<EOF > FeatherShot.app/Contents/Info.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>FeatherShot</string>
    <key>CFBundleIdentifier</key>
    <string>com.kainzmayer.feathershot.v4</string>
    <key>CFBundleName</key>
    <string>FeatherShot</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.1.9</string>
    <key>CFBundleVersion</key>
    <string>1.1.9</string>
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
</dict>
</plist>
EOF

echo "==> Code Signing App Bundle"
codesign --force --deep --sign - FeatherShot.app

echo "==> App Bundle built at FeatherShot.app"

echo "==> Creating Styled DMG Installer"
if [ ! -d "create-dmg" ]; then
    git clone https://github.com/create-dmg/create-dmg.git
fi

rm -f "FeatherShot 1.1.9.dmg"

./create-dmg/create-dmg \
  --volname "FeatherShot" \
  --background "dmg_background.png" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "FeatherShot.app" 150 200 \
  --hide-extension "FeatherShot.app" \
  --app-drop-link 450 200 \
  "FeatherShot 1.1.9.dmg" \
  "FeatherShot.app/"

echo "==> Done! Release is ready."
