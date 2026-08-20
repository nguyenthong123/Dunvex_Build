# 🏗️ Dunvex Build — Architecture & Project Guide

> **Dành cho AI Agent** — đọc file này đầu tiên khi mở project.

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
