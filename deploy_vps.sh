#!/bin/bash

# Dừng nếu có lỗi
set -e

# Load environment variables from .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

VPS_IP="${VPS_IP:-136.109.194.84}"
VPS_USER="${VPS_USER:-zomby}"
VPS_DIR="${VPS_DIR:-/home/zomby/dunvex_app}"
SSH_KEY="${SSH_KEY:-~/.ssh/google_compute_engine}"
APP_NAME="dunvex_backend"

echo "🚀 [1/4] Build Frontend (React/Vite)..."
npm run build

echo "📦 [2/4] Đóng gói dữ liệu..."
# Nén các file cần thiết
tar -czf deploy.tar.gz dist/ server/ server.js package.json package-lock.json .env

echo "📤 [3/4] Upload lên VPS ($VPS_USER@$VPS_IP)..."
# Tạo thư mục trên VPS nếu chưa có
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $VPS_USER@$VPS_IP "mkdir -p $VPS_DIR"

# Copy file nén lên VPS
scp -o StrictHostKeyChecking=no -i $SSH_KEY deploy.tar.gz $VPS_USER@$VPS_IP:$VPS_DIR/

echo "⚙️  [4/4] Cài đặt và Khởi động lại ứng dụng trên VPS..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $VPS_USER@$VPS_IP << EOF
  cd $VPS_DIR
  
  # Giải nén đè lên file cũ
  tar -xzf deploy.tar.gz
  
  # Cài đặt thư viện Node.js
  npm install --production
  
  # Kiểm tra xem PM2 đã chạy app này chưa
  if pm2 list | grep -q "$APP_NAME"; then
    echo "🔄 Khởi động lại $APP_NAME..."
    pm2 restart $APP_NAME
  else
    echo "▶️ Khởi chạy lần đầu $APP_NAME..."
    # Cấu hình PORT cho PM2 để không trùng với cổng 3000 của fb-bot
    PORT=5000 pm2 start server.js --name $APP_NAME
  fi
  
  # Dọn dẹp file nén
  rm deploy.tar.gz
EOF

echo "✅ Hoàn tất Deploy!"
