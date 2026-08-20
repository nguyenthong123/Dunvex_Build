#!/bin/bash

# ==============================================================================
# Dunvex Build - Script Sao Lưu Tự Động Hàng Ngày Lên Google Drive (SQLite version)
# Target Drive Folder ID: 1kQciC7-VvMdKmt6rpiyspNNkQeThydxg
# ==============================================================================

set -e

# Load environment variables
APP_DIR="/home/zomby/dunvex_app"
if [ -f "$APP_DIR/.env" ]; then
  set -a
  source "$APP_DIR/.env"
  set +a
fi

CURRENT_DATE=$(date +"%Y-%m-%d")
BACKUP_DIR="$APP_DIR/backups/tmp_$CURRENT_DATE"

# Đảm bảo dọn dẹp thư mục tạm khi script kết thúc (bất kể thành công hay thất bại)
trap 'rm -rf "$BACKUP_DIR"' EXIT
LOG_FILE="$APP_DIR/backups/backup.log"

mkdir -p "$BACKUP_DIR"
mkdir -p "$APP_DIR/backups"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Bắt đầu quá trình sao lưu tự động SQLite..." >> "$LOG_FILE"

# 1. Sao lưu SQLite CSDL một cách an toàn (dùng lệnh .backup của sqlite3)
DB_BACKUP_RAW="$BACKUP_DIR/dunvex.db"
DB_BACKUP_GZ="$BACKUP_DIR/dunvex-db-$CURRENT_DATE.db.gz"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Đang tạo bản sao lưu an toàn CSDL SQLite..." >> "$LOG_FILE"

sqlite3 "$APP_DIR/data/dunvex.db" ".backup '$DB_BACKUP_RAW'" >> "$LOG_FILE" 2>&1

# Nén file SQLite
gzip -c "$DB_BACKUP_RAW" > "$DB_BACKUP_GZ"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗜️ Nén CSDL thành công..." >> "$LOG_FILE"

# 2. Tải dữ liệu sao lưu lên Google Drive qua Node.js Script (google.drive v3 API)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📤 Đang đẩy file sao lưu lên Google Drive..." >> "$LOG_FILE"

# Upload CSDL SQLite (.db.gz)
if [ -f "$DB_BACKUP_GZ" ]; then
  node "$APP_DIR/vps/upload_gdrive.js" "$DB_BACKUP_GZ" "dunvex-db-$CURRENT_DATE.db.gz" >> "$LOG_FILE" 2>&1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Đã tải sao lưu thành công lên Google Drive!" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✨ Hoàn tất quá trình sao lưu tự động!" >> "$LOG_FILE"
