#!/bin/bash
set -e

echo "🔨 [Dunvex Windows] Building Windows app and per-user installer..."

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIN_DIR="$PROJECT_DIR/windows"
OUTPUT_DIR="$PROJECT_DIR/dist-win"
APP_BUILD_NUMBER="${APP_BUILD_NUMBER:-101}"
APP_VERSION="${APP_VERSION:-1.0.1}"

DOTNET_BIN="dotnet"
if [ -f "$HOME/.dotnet/dotnet" ]; then
  DOTNET_BIN="$HOME/.dotnet/dotnet"
fi

# 1. Build latest web bundle
echo "📦 1/3. Building production web assets (Vite)..."
cd "$PROJECT_DIR"
if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]; then
  npm run build
fi

# 2. Prepare output directory
mkdir -p "$OUTPUT_DIR"
rm -rf "$OUTPUT_DIR/dist"
cp -R "$PROJECT_DIR/dist" "$OUTPUT_DIR/dist"
printf '{"platform":"windows","version":"%s","buildNumber":%s}\n' "$APP_VERSION" "$APP_BUILD_NUMBER" > "$OUTPUT_DIR/dist/release-info.json"

# 3. Compile Windows Binary
echo "⚙️ 2/3. Compiling C# .NET 8 Standalone Windows Binary (win-x64)..."
$DOTNET_BIN publish "$WIN_DIR/Dunvex.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:Version="$APP_VERSION" -o "$OUTPUT_DIR/app"
rm -rf "$OUTPUT_DIR/app/dist"
cp -R "$PROJECT_DIR/dist" "$OUTPUT_DIR/app/dist"
printf '{"platform":"windows","version":"%s","buildNumber":%s}\n' "$APP_VERSION" "$APP_BUILD_NUMBER" > "$OUTPUT_DIR/app/dist/release-info.json"

# 4. Package portable archive for the installer payload and advanced users
echo "📦 3/4. Packaging Windows application..."
PORTABLE_ZIP="$OUTPUT_DIR/Dunvex-Build-1.0.1-Windows-x64.zip"
rm -f "$PORTABLE_ZIP"
(
  cd "$OUTPUT_DIR/app"
  zip -r "$PORTABLE_ZIP" .
)

# 5. Build a self-contained installer that creates Start Menu and optional Desktop shortcuts
echo "📦 4/4. Building the Windows installer..."
mkdir -p "$OUTPUT_DIR/installer"
$DOTNET_BIN publish "$WIN_DIR/installer/DunvexInstaller.csproj" \
  -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true \
  -p:Version="$APP_VERSION" \
  -p:AppArchivePath="$PORTABLE_ZIP" \
  -o "$OUTPUT_DIR/installer"
cp "$OUTPUT_DIR/installer/Dunvex-Setup.exe" "$OUTPUT_DIR/Dunvex-Setup-1.0.1-x64.exe"

echo "✅ [Dunvex Windows] Build and packaging finished successfully!"
echo "📍 Windows App Directory: $OUTPUT_DIR/app"
echo "📍 Windows Executable: $OUTPUT_DIR/app/Dunvex.exe"
echo "📍 Windows Distribution ZIP: $OUTPUT_DIR/Dunvex-Build-1.0.1-Windows-x64.zip"
echo "📍 Windows Installer: $OUTPUT_DIR/Dunvex-Setup-1.0.1-x64.exe"
