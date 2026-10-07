#!/bin/bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

VPS_IP="${VPS_IP:-136.109.194.84}"
VPS_USER="${VPS_USER:-zomby}"
VPS_DIR="${VPS_DIR:-/home/zomby/dunvex_app}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/google_compute_engine}"
APP_VERSION="$(node -p "require('./package.json').version")"
REQUESTED_PLATFORM="${1:-all}"
RELEASE_NOTES="${2:-Cập nhật ứng dụng Dunvex}"

case "$REQUESTED_PLATFORM" in
  android|mac|windows) PLATFORMS=("$REQUESTED_PLATFORM") ;;
  all) PLATFORMS=(android mac windows) ;;
  *) echo "Usage: bash scripts/release_apps.sh [android|mac|windows|all] [release notes]" >&2; exit 2 ;;
esac

if [ ! -f "$SSH_KEY" ]; then
  echo "Không tìm thấy SSH key: $SSH_KEY" >&2
  exit 1
fi

if ! java -version >/dev/null 2>&1 && command -v brew >/dev/null 2>&1; then
  openjdk_prefix="$(brew --prefix openjdk@21)"
  if [ -x "$openjdk_prefix/bin/java" ]; then
    export JAVA_HOME="$openjdk_prefix/libexec/openjdk.jdk/Contents/Home"
    export PATH="$openjdk_prefix/bin:$PATH"
  fi
fi

if [[ "${REUSE_CURRENT_RELEASE:-0}" != "1" && " ${PLATFORMS[*]} " == *" android "* ]]; then
  if [ ! -f android/app/dunvex.keystore ]; then
    echo "Không tìm thấy Android signing keystore: android/app/dunvex.keystore" >&2
    exit 1
  fi
  if ! java -version >/dev/null 2>&1; then
    echo "Cần cài JDK để build APK Android." >&2
    exit 1
  fi
fi

if [ "${REUSE_CURRENT_RELEASE:-0}" = "1" ]; then
  for platform in "${PLATFORMS[@]}"; do
    node -e 'const p=process.argv[1];const m=require(`./server/releases/${p}.json`);if(!Number.isSafeInteger(m.buildNumber)||m.buildNumber<=0)process.exit(1)' "$platform"
    case "$platform" in
      android) [ -s dunvex_app.apk ] ;;
      mac) [ -s server/releases/mac/bundle.zip ] && [ -s dist-mac/Dunvex-Build-1.0.1-Apple-Silicon.dmg ] ;;
      windows) [ -s server/releases/windows/bundle.zip ] && [ -s dist-win/Dunvex-Build-1.0.1-Windows-x64.zip ] && [ -s dist-win/Dunvex-Setup-1.0.1-x64.exe ] ;;
    esac
  done
else
  unset WEB_BUILD_NUMBER
  for platform in "${PLATFORMS[@]}"; do
    build_number="$(node scripts/release_channel.js next "$platform")"
    echo "📦 Building $platform release build $build_number..."
    APP_BUILD_NUMBER="$build_number" APP_VERSION="$APP_VERSION" npm run build
    case "$platform" in
      android)
        npx cap sync android
        (
          cd android
          ./gradlew assembleRelease \
            -PandroidVersionCode="$build_number" \
            -PandroidVersionName="$APP_VERSION"
        )
        cp android/app/build/outputs/apk/release/app-release.apk dunvex_app.apk
        node scripts/release_channel.js publish android "$build_number" "$RELEASE_NOTES"
        ;;
      mac)
        APP_BUILD_NUMBER="$build_number" APP_VERSION="$APP_VERSION" \
          SKIP_FRONTEND_BUILD=1 UPDATE_INSTALLED_APP=0 bash scripts/build_mac_app.sh
        node scripts/release_channel.js publish mac "$build_number" "$RELEASE_NOTES"
        ;;
      windows)
        APP_BUILD_NUMBER="$build_number" APP_VERSION="$APP_VERSION" \
          SKIP_FRONTEND_BUILD=1 bash scripts/build_windows_app.sh
        node scripts/release_channel.js publish windows "$build_number" "$RELEASE_NOTES"
        ;;
    esac
  done
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT
mkdir -p "$STAGE_DIR/server/releases"
mkdir -p "$STAGE_DIR/server/routes"
for platform in "${PLATFORMS[@]}"; do
  cp "server/releases/$platform.json" "$STAGE_DIR/server/releases/"
  if [ "$platform" = "mac" ] || [ "$platform" = "windows" ]; then
    mkdir -p "$STAGE_DIR/server/releases/$platform"
    cp "server/releases/$platform/bundle.zip" "$STAGE_DIR/server/releases/$platform/"
  fi
done
if [[ " ${PLATFORMS[*]} " == *" android "* ]]; then
  mkdir -p "$STAGE_DIR/downloads"
  cp dunvex_app.apk "$STAGE_DIR/downloads/dunvex_app.apk"
  cp dunvex_app.apk "$STAGE_DIR/dunvex_app.apk"
fi
if [[ " ${PLATFORMS[*]} " == *" mac "* ]]; then
  mkdir -p "$STAGE_DIR/downloads"
  cp dist-mac/Dunvex-Build-1.0.1-Apple-Silicon.dmg "$STAGE_DIR/downloads/"
fi
if [[ " ${PLATFORMS[*]} " == *" windows "* ]]; then
  mkdir -p "$STAGE_DIR/downloads"
  cp dist-win/Dunvex-Build-1.0.1-Windows-x64.zip "$STAGE_DIR/downloads/"
  cp dist-win/Dunvex-Setup-1.0.1-x64.exe "$STAGE_DIR/downloads/"
fi

if [[ "${RELEASE_ARTIFACTS_ONLY:-0}" != "1" ]]; then
  cp server/db.js "$STAGE_DIR/server/"
  cp server/routes/api.js server/routes/releases.js server/routes/ota-update.js server/routes/license.js server/routes/sync.js "$STAGE_DIR/server/routes/"
fi

tar -czf /tmp/dunvex-app-releases.tar.gz -C "$STAGE_DIR" .
scp -o StrictHostKeyChecking=no -i "$SSH_KEY" /tmp/dunvex-app-releases.tar.gz "$VPS_USER@$VPS_IP:/tmp/dunvex-app-releases.tar.gz"
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$VPS_USER@$VPS_IP" \
  "VPS_DIR='$VPS_DIR' SKIP_RELEASE_BACKUP='${SKIP_RELEASE_BACKUP:-0}' RELEASE_ARTIFACTS_ONLY='${RELEASE_ARTIFACTS_ONLY:-0}' bash -s" <<'EOF'
set -euo pipefail
cd "$VPS_DIR"
if [ "$SKIP_RELEASE_BACKUP" != "1" ]; then
  mkdir -p backups
  backup_paths=()
  for path in server/db.js server/routes/sync.js server/routes/api.js server/routes/releases.js server/routes/ota-update.js server/routes/license.js server/releases downloads dunvex_app.apk; do
    [ ! -e "$path" ] || backup_paths+=("$path")
  done
  if [ "${#backup_paths[@]}" -gt 0 ]; then
    tar -czf "backups/app_releases_$(date +%Y%m%d_%H%M%S).tar.gz" "${backup_paths[@]}"
  fi
fi
tar -xzf /tmp/dunvex-app-releases.tar.gz
if [ "$RELEASE_ARTIFACTS_ONLY" != "1" ]; then
  pm2 restart dunvex_backend
fi
rm -f /tmp/dunvex-app-releases.tar.gz
if [ "$SKIP_RELEASE_BACKUP" != "1" ] && [ -f scripts/cleanup_backups.sh ]; then
  bash scripts/cleanup_backups.sh >/dev/null 2>&1 || true
fi
EOF
rm -f /tmp/dunvex-app-releases.tar.gz

echo "✅ Selected app release channels deployed independently of the web channel."
