#!/bin/bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

VPS_IP="${VPS_IP:-34.133.127.214}"
VPS_USER="${VPS_USER:-zomby}"
VPS_DIR="${VPS_DIR:-/home/zomby/dunvex_app}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/google_compute_engine}"

if [ ! -f "$SSH_KEY" ]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

unset APP_BUILD_NUMBER APP_VERSION
WEB_BUILD_NUMBER="$(node scripts/release_channel.js next web)"
export WEB_BUILD_NUMBER
npm run build
node scripts/release_channel.js publish web "$WEB_BUILD_NUMBER" "${1:-Web release}"

PACKAGE="/tmp/dunvex-web-release.tar.gz"
tar -czf "$PACKAGE" dist server/releases/web.json
scp -o StrictHostKeyChecking=no -i "$SSH_KEY" "$PACKAGE" "$VPS_USER@$VPS_IP:/tmp/dunvex-web-release.tar.gz"
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "VPS_DIR='$VPS_DIR' bash -s" <<'EOF'
set -euo pipefail
cd "$VPS_DIR"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT
tar -xzf /tmp/dunvex-web-release.tar.gz -C "$STAGE_DIR"
rm -rf dist
mv "$STAGE_DIR/dist" dist
mv "$STAGE_DIR/server/releases/web.json" server/releases/web.json
rm -f /tmp/dunvex-web-release.tar.gz
EOF
rm -f "$PACKAGE"

echo "✅ Web-only build $WEB_BUILD_NUMBER deployed. App packages and app release channels were not changed."
