# 🏗️ Dunvex Build — Architecture & Project Guide

> ⚠️ **BẮT BUỘC CHO AI AGENT**: Đọc [AGENTS.md](file:///Volumes/DATA_SSD/Projects/Dunvex_Build-main/AGENTS.md) trước khi làm việc.
> **NGUYÊN TẮC CỐT LÕI**: Tuyệt đối **tách biệt luồng phát hành** Web (`npm run deploy:web`) và App Android/Mac/Win (`npm run deploy:android`, `deploy:mac`, `deploy:win`). Cập nhật app KHÔNG ĐƯỢC ảnh hưởng hay sửa đổi web đang chạy.

---

## 📍 Đường dẫn & Kết nối

### Local (máy Mac — MacBook Pro của ZOMBY)
| Mục | Path |
|---|---|
| **Project** | `/Volumes/DATA_SSD/Projects/Dunvex_Build-main/` |
| **Dev server** | `npm run dev` → `http://localhost:5173/` |
| **DB test local** | `data/dunvex_from_vps.db` (sync từ VPS) |
| **SSH key VPS** | `~/.ssh/google_compute_engine` |

### VPS Dunvex Build (chính)
| Mục | Chi tiết |
|---|---|
| **IP** | `136.109.194.84` |
| **User** | `zomby` |
| **SSH Key** | `~/.ssh/google_compute_engine` |
| **Deploy dir** | `/home/zomby/dunvex_app/` |
| **Database** | `/home/zomby/dunvex_app/data/dunvex.db` (SQLite, ~17MB) |
| **PM2 App** | `dunvex_backend` (PORT 5000) |

### VPS May-chu-mail (dự án khác — đừng nhầm!)
| Mục | Chi tiết |
|---|---|
| **IP** | `34.169.201.51` |
| **User** | `zomby` |
| **SSH Key** | `/Volumes/DATA_SSD/Projects/may-chu-mail-dunvex/gcp_ai_key` |
| **Project** | `/opt/project-1/` |
| **Mô tả** | App theo dõi giao dịch ngân hàng (Next.js) — **không liên quan Dunvex Build** |

### Kết nối VPS:
```bash
# SSH Dunvex Build
ssh -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine zomby@136.109.194.84

# Check PM2
ssh -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine zomby@136.109.194.84 "pm2 status"

# Sync DB từ VPS về local
scp -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine \
  zomby@136.109.194.84:/home/zomby/dunvex_app/data/dunvex.db \
  /Volumes/DATA_SSD/Projects/Dunvex_Build-main/data/dunvex_from_vps.db
```

---

## 🔥 Kiến trúc dữ liệu (QUAN TRỌNG)

```
┌─────────────────────────────────────────────────┐
│                  BROWSER (React + Vite)          │
│                                                  │
│  firebase.ts ──────► Firebase Auth (Google OAuth)│
│       │                                          │
│       └── db = dummy (KHÔNG xài Firestore thật!) │
│                                                  │
│  fakeFirestore.ts ──► Gọi REST API local         │
│       (giả lập Firestore API)                    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              VPS (136.109.194.84)                │
│  Deploy: /home/zomby/dunvex_app                  │
│  PM2: dunvex_backend (PORT 5000)                 │
│                                                  │
│  server.js ──► Express API                       │
│       │                                          │
│       └──► SQLite: data/dunvex.db (~17MB)        │
└──────────────────────────────────────────────────┘
```

### Quan trọng:
- **Firebase = Auth only** (Google đăng nhập). Không dùng Firestore, không dùng Realtime DB.
- **Toàn bộ data** (orders, customers, payments, products...) lưu trong SQLite trên VPS.
- `fakeFirestore.ts` giả lập Firestore API nhưng thực chất gọi REST API → SQLite.
- `src/services/firebase.ts` export `db` là dummy, re-export từ `fakeFirestore.ts`.
- **Android offline**: `src/services/localDb/localDatabase.ts` đọc/ghi SQLite riêng trong vùng lưu trữ app qua Capacitor SQLite; thay đổi được ghi cục bộ trước rồi đồng bộ lên VPS khi có mạng. IndexedDB hiện có được chuyển sang SQLite một lần và vẫn được giữ làm bản dự phòng. Trình duyệt web tiếp tục dùng IndexedDB.
- **App desktop Windows/macOS**: SQLite và thư mục ảnh offline mặc định nằm trong thư mục dữ liệu riêng của Dunvex; người dùng có thể chuyển cả hai sang thư mục `DunvexData` trong ổ/thư mục đã chọn. Quá trình chuyển checkpoint WAL, sao chép và kiểm tra SQLite/ảnh trước khi đổi vị trí hoạt động. Cache IndexedDB/HTTP do WebView quản lý và không di chuyển; Android giữ SQLite/ảnh trong vùng riêng của app.

---

## 🚫 QUY TẮC BẢO MẬT & DỮ LIỆU BẮT BUỘC CHO AI AGENT (STRICT RULES)

> [!CAUTION]
> **1. TUYỆT ĐỐI KHÔNG TỰ Ý BACKUP / GHI ĐÈ / RESTORE DATABASE TRÊN VPS:**
> - **NGHIÊM CẤM** AI tự ý chạy lệnh copy đè (`scp`, `rsync`, restore) file database SQLite (`dunvex.db`) từ máy local lên VPS hoặc từ các file backup cũ lên VPS.
> - **Lý do**: Database trên VPS đang chứa dữ liệu trạng thái thời gian thực (trạng thái bật/tắt khóa tính năng trên Nexus Control, lịch sử thanh toán, hạn dùng gói cước của 57 doanh nghiệp). Mọi hành vi tự ý ghi đè DB sẽ làm **sai lệch trạng thái bật/tắt (toggle) trên Nexus Control** và gây mất dữ liệu live.
> 
> **2. KHÔNG TỰ Ý CHẠY CÁC SCRIPT BACKUP LÀM XÁO TRỘN DỮ LIỆU:**
> - Không tự động trigger các script backup/restore dữ liệu trừ khi có yêu cầu bằng văn bản rõ ràng từ User.
> - Khi deploy code (`deploy_vps.sh`), chỉ deploy thư mục `dist/`, `server/`, code logic — **KHÔNG ĐƯỢC CHẠM VÀO THƯ MỤC `data/dunvex.db` TRÊN VPS**.

---

## 📁 Cấu trúc project

```
Dunvex_Build-main/
├── src/
│   ├── components/
│   │   ├── admin/         # NexusControl tabs (Requests, Customers, Logs, Config, AI)
│   │   ├── customers/     # Customer list components
│   │   ├── debts/         # Debt KPIs, tables, payment modals
│   │   ├── inventory/     # Inventory management
│   │   ├── layout/        # Sidebar, Header, MobileNav, BottomNav
│   │   ├── orders/        # OrderFormHeader, OrderLineItems, OrderSummary + CustomerPicker, ProductLines, Footer
│   │   ├── profile/       # SalesChart, TopSellers
│   │   ├── purchase/      # Purchase order components
│   │   └── shared/        # Toast, Calculator, QRScanner, BulkImport...
│   ├── hooks/             # ~20 custom hooks
│   │   ├── useDebtCalculations.ts   # (2026-08-12 — Phase 1)
│   │   ├── useDebtFilters.ts        # (2026-08-12 — Phase 1)
│   │   ├── useDebtPayments.ts       # (2026-08-12 — Phase 1)
│   │   ├── useDebtStatement.ts      # (2026-08-12 — Phase 1)
│   │   ├── useNexusData.ts          # (2026-08-12 — Phase 2)
│   │   └── useOrderForm.ts          # (2026-08-12 — Phase 3)
│   ├── services/
│   │   ├── firebase.ts      # Firebase Auth + re-export fakeFirestore
│   │   ├── fakeFirestore.ts # Giả lập Firestore → gọi REST API
│   │   ├── apiClient.ts     # HTTP client cho REST API
│   │   ├── dataAccess.ts    # Data access layer
│   │   ├── docTypes.ts      # TypeScript types
│   │   └── transactionService.ts
│   ├── utils/               # debtUtils, imageUtils, notifications, profitUtils, validation...
│   ├── views/               # Page-level components (20+ views)
│   │   ├── Debts.tsx         # 987 dòng (was 1,543 — refactored 2026-08-12)
│   │   ├── NexusControl.tsx  # 779 dòng (was 1,693 — refactored 2026-08-12)
│   │   ├── QuickOrder.tsx    # 198 dòng (was 1,376 — refactored 2026-08-12)
│   │   └── ... (20+ views khác)
│   ├── styles/global.css     # Tailwind v4 + CSS design tokens
│   └── App.tsx               # Router + providers
├── server/                   # Express backend chạy trên VPS
│   ├── server.js
│   ├── db.js                 # SQLite database layer
│   ├── firebase-admin.js     # Firebase Admin SDK (auth verify)
│   └── routes/               # API routes
├── data/
│   ├── dunvex.db             # Local test DB
│   └── dunvex_from_vps.db    # Sync từ VPS (dùng để test local — 17MB)
├── deploy_vps.sh             # Deploy script (tự động build + push + PM2 restart)
├── deploy.tar.gz             # Build archive
├── README.md                 # Tổng quan project
├── ARCHITECTURE.md           # File này — hướng dẫn cho AI agent
└── PROJECT_SITEMAP_dunvex_build.md  # Sơ đồ toàn bộ page/route (87KB)
```

---

## 📊 Database (SQLite — 37 tables)

Các bảng chính:

| Bảng | Mô tả |
|---|---|
| `orders` | Đơn hàng |
| `customers` | Khách hàng |
| `payments` | Thanh toán / thu nợ |
| `debts` | Công nợ |
| `products` | Sản phẩm |
| `suppliers` | Nhà cung cấp |
| `purchase_orders` | Đơn mua hàng |
| `inventory_logs` | Lịch sử kho |
| `attendance_logs` | Chấm công |
| `checkins` | Check-in thị trường |
| `coupons` | Mã giảm giá |
| `price_lists` | Bảng giá |
| `notifications` | Thông báo |
| `audit_logs` | Nhật ký hệ thống |
| `system_config` | Cấu hình hệ thống |
| `permissions` | Phân quyền |
| `users` | Người dùng |

---

## 🔧 Commands thường dùng

```bash
# ─── Local ─────────────────────────────
cd /Volumes/DATA_SSD/Projects/Dunvex_Build-main
npm run dev              # Vite dev server → localhost:5173
npm run build            # Production build → dist/
npx tsc --noEmit         # TypeScript check

# ─── Sync data từ VPS ──────────────────
scp -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine \
  zomby@136.109.194.84:/home/zomby/dunvex_app/data/dunvex.db \
  data/dunvex_from_vps.db

# ─── Deploy ────────────────────────────
bash deploy_vps.sh

# ─── VPS commands ──────────────────────
ssh -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine zomby@136.109.194.84
pm2 status
pm2 logs dunvex_backend
pm2 restart dunvex_backend

# ─── Check DB trên VPS ────────────────
ssh -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine zomby@136.109.194.84 \
  "ls -lh /home/zomby/dunvex_app/data/dunvex.db"
```

---

## 📝 Refactor Log

| Ngày | Thay đổi |
|---|---|
| **2026-08-12** | Phase 1-4: Tách 3 God Components → 14 files mới. Giảm 50% code/view. CSS tokens. |
| 2026-07-31 | Stable v1.0 |

---

## ⚠️ Lưu ý cho AI agent

1. **Firebase config** trong `.env` — chỉ dùng cho Auth (Google OAuth), không dùng Firestore.
2. **SQLite trên VPS** là data chính. `data/dunvex_from_vps.db` là bản sync offline để test local.
3. **2 VPS khác nhau**: Dunvex Build (`136.109.194.84`) và May-chu-mail (`34.169.201.51`). SSH key cũng khác.
4. **Tailwind v4**: Không hỗ trợ `@apply` với custom class trong `@layer components` — dùng CSS thuần.
5. **Build tool**: Vite 7 + React 19. PWA có sẵn (Workbox service worker).
6. **Deploy**: `deploy_vps.sh` tự động build + push, không ghi đè database VPS.
7. **KHÔNG deploy khi đang có user** — deploy vào buổi tối khi vắng người dùng.
