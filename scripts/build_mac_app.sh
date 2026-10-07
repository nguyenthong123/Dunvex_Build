#!/bin/bash
set -e

echo "🔨 [Dunvex macOS] Building Standalone Offline-First Native Mac Application for Apple Silicon (arm64)..."

PROJECT_DIR="/Volumes/DATA_SSD/Projects/Dunvex_Build-main"
APP_BUNDLE="$PROJECT_DIR/dist-mac/Dunvex.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
APP_BUILD_NUMBER="${APP_BUILD_NUMBER:-101}"
APP_VERSION="${APP_VERSION:-1.0.1}"

# 1. Build latest web bundle
echo "📦 1/4. Building production web assets (Vite)..."
cd "$PROJECT_DIR"
if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]; then
  npm run build
fi

# 2. Prepare directories
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 3. Copy dist/ directly into App Bundle for 100% Standalone Offline use
echo "📂 2/4. Bundling local assets into App Resources..."
rm -rf "$RESOURCES_DIR/dist"
cp -R "$PROJECT_DIR/dist" "$RESOURCES_DIR/dist"
cat > "$RESOURCES_DIR/dist/release-info.json" <<EOF
{"platform":"mac","version":"$APP_VERSION","buildNumber":$APP_BUILD_NUMBER}
EOF

# 4. Compile Swift to native macOS Binary (arm64 Apple Silicon)
echo "⚙️ 3/5. Compiling Swift Native Binary (arm64)..."
swiftc -O -target arm64-apple-macos11.0 "$PROJECT_DIR/scripts/DunvexApp.swift" -o "$MACOS_DIR/Dunvex" -framework Cocoa -framework WebKit -framework Network -framework LocalAuthentication -lsqlite3

# 5. Create Info.plist
cat << EOF > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Dunvex</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.dunvex.build.mac</string>
    <key>CFBundleName</key>
    <string>Dunvex</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$APP_VERSION</string>
    <key>CFBundleVersion</key>
    <string>$APP_BUILD_NUMBER</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>Dunvex cần vị trí GPS của bạn để thực hiện chấm công tại cửa hàng và công trình.</string>
    <key>NSLocationUsageDescription</key>
    <string>Dunvex cần vị trí GPS của bạn để thực hiện chấm công tại cửa hàng và công trình.</string>
    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>Dunvex cần vị trí GPS của bạn để thực hiện chấm công tại cửa hàng và công trình.</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
</dict>
</plist>
EOF

# Copy app icons if available
if [ -f "/Applications/dunvex app.app/Contents/Resources/AppIcon.icns" ]; then
  cp "/Applications/dunvex app.app/Contents/Resources/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
fi

chmod +x "$MACOS_DIR/Dunvex"

# 6. Sign bundle with ad-hoc signature for macOS Gatekeeper and security integrity
echo "🔏 4/5. Codesigning application bundle..."
codesign --force --deep --options runtime --sign - "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE" || true

# 7. Package DMG Installer
echo "📦 5/5. Packaging Drag-and-Drop DMG Installer (Apple Silicon)..."
DMG_TMP="$PROJECT_DIR/dist-mac/dmg_tmp"
DMG_OUTPUT="$PROJECT_DIR/dist-mac/Dunvex-Build-1.0.1-Apple-Silicon.dmg"
rm -rf "$DMG_TMP" "$DMG_OUTPUT" "$PROJECT_DIR/dist-mac/Dunvex-Build-1.0.1-Universal.dmg"
mkdir -p "$DMG_TMP"
cp -R "$APP_BUNDLE" "$DMG_TMP/"
ln -s /Applications "$DMG_TMP/Applications"

hdiutil create -volname "Dunvex Build (Apple Silicon)" -srcfolder "$DMG_TMP" -ov -format UDZO "$DMG_OUTPUT"
rm -rf "$DMG_TMP"

# 8. Update installed app in /Applications if it exists
if [ "${UPDATE_INSTALLED_APP:-1}" = "1" ] && [ -d "/Applications/dunvex app.app" ]; then
  echo "🚀 Updating installed app at /Applications/dunvex app.app..."
  rm -f "/Applications/dunvex app.app/Contents/MacOS/dunvex_app"
  rm -f "/Applications/dunvex app.app/Contents/MacOS/dunvex app"
  cp -R "$APP_BUNDLE/" "/Applications/dunvex app.app/"
  ln -sf "Dunvex" "/Applications/dunvex app.app/Contents/MacOS/dunvex_app"
  ln -sf "Dunvex" "/Applications/dunvex app.app/Contents/MacOS/dunvex app"
  codesign --force --deep --options runtime --sign - "/Applications/dunvex app.app"
  codesign --verify --deep --strict --verbose=2 "/Applications/dunvex app.app" || true
fi

echo "✅ [Dunvex macOS] Apple Silicon (arm64) Build and DMG Package finished successfully!"
echo "📍 Application Bundle: $APP_BUNDLE"
echo "📍 Installer DMG: $DMG_OUTPUT"
echo "📍 Installed App: /Applications/dunvex app.app"
