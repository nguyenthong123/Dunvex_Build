# 🏗️ Dunvex Build - Hệ thống Quản trị Xây dựng Toàn diện

Dunvex Build là nền tảng quản trị doanh nghiệp chuyên biệt cho ngành xây dựng và cung ứng vật tư, tối ưu hóa cho trải nghiệm di động và vận hành thực tế tại hiện trường.

> 📖 **AI Agents**: Đọc `ARCHITECTURE.md` trước khi làm việc với project này.

---

## 🌟 Tính năng Chính

### 💰 Quản lý Tài chính & Công nợ
- **Auto-Calc System**: Tự động tính toán lợi nhuận, dư nợ ngân hàng và lãi suất hàng tháng.
- **Debt Statement Pro**: Xuất phiếu công nợ cao cấp với chế độ Screenshot/Zoom hỗ trợ gửi cho khách hàng.
- **Phân tích rủi ro**: Theo dõi tuổi nợ (Debt Aging) 30-60-90 ngày.

### 📦 Kho hàng & Lên đơn (Inventory & Quick Order)
- **Nhập liệu hàng loạt**: Hỗ trợ Bulk Import từ Excel và Google Sheets.
- **Quản lý SKU**: Tự động tạo mã SKU, hỗ trợ in tem QR Code.
- **Logic FIFO**: Cơ chế Nhập trước - Xuất trước để tính giá vốn.

### 📍 Chấm công & Hiện trường (HR & Fieldwork)
- **Geofencing Attendance**: Chấm công dựa trên GPS (bán kính 50m) và ID thiết bị.
- **Check-in Thị trường**: Check-in tại vị trí khách hàng kèm ảnh hiện trường.

---

## 🛠️ Công nghệ

| Layer | Tech |
|---|---|
| **Frontend** | React 19 + Vite 7 + Tailwind CSS 4 |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Database** | SQLite trên VPS (qua REST API, không dùng Firestore) |
| **API Bridge** | `fakeFirestore.ts` (giả lập Firestore API → gọi REST API nội bộ) |
| **Offline Android** | SQLite cục bộ trong vùng lưu trữ riêng của app; IndexedDB dùng trên web và làm bản dự phòng |
| **Backend** | Node.js + Express + PM2 |
| **Storage** | Cloudinary (ảnh) |
| **Maps** | Leaflet + React-Leaflet |
| **PWA** | Service Worker (Workbox), offline support |

Trên Android, dữ liệu đã tải về được đọc từ SQLite cục bộ; thao tác tạo/sửa/xóa được lưu tại máy trước và đưa vào hàng đợi đồng bộ khi có mạng. Không có dữ liệu nào được lấy mới từ VPS khi thiết bị đang offline. Dữ liệu IndexedDB hiện có được chuyển sang SQLite cục bộ ở lần khởi chạy đầu tiên có plugin SQLite.

---

## 📁 Cấu trúc Thư mục

```
src/
├── components/   # UI components (admin, customers, debts, inventory, layout, orders, shared...)
├── hooks/        # Custom React hooks (~20 hooks)
├── services/     # firebase.ts (auth), fakeFirestore.ts (API bridge), apiClient.ts
├── utils/        # debtUtils, profitUtils, notifications, validation...
├── views/        # Page-level components (Debts, NexusControl, QuickOrder, Home...)
└── App.tsx       # Router & Global Providers
server/           # Express backend (chạy trên VPS)
data/             # SQLite DB (dunvex_from_vps.db: sync từ VPS để test local)
```

---

## 🚀 Hướng dẫn Chạy Local

```bash
npm install
npm run dev        # → http://localhost:5173/
npm run build      # Production build
npx tsc --noEmit   # TypeScript check
```

**Sync data từ VPS về test:**
```bash
scp -o StrictHostKeyChecking=no -i ~/.ssh/google_compute_engine \
  zomby@136.109.194.84:/home/zomby/dunvex_app/data/dunvex.db \
  data/dunvex_from_vps.db
```

---

## 🚢 Deploy lên VPS

```bash
npm run deploy:web -- "Web release"
npm run release:apps -- all "Cập nhật ứng dụng Dunvex"
```
Hai lệnh phát hành độc lập: `deploy:web` chỉ cập nhật web/PWA; `release:apps` nhận `android`, `mac`, `windows` hoặc `all`, chỉ cập nhật gói tải và OTA của các nền tảng được chọn. Mỗi nền tảng có build number, metadata và bundle OTA riêng; cả hai lệnh giữ nguyên database VPS. Bộ cài Windows tạo ứng dụng trong Start Menu, Apps & Features và lối tắt Desktop tùy chọn; gói ZIP portable vẫn được giữ cho trường hợp cần dùng thủ công. `bash deploy_vps.sh` là alias tương thích cho web-only, không phát hành app.

Ứng dụng Android kiểm tra phiên bản khi mở, tải APK mới và mở trình cài đặt khi có build mới. Android vẫn yêu cầu người dùng xác nhận cài đặt. Bản Android đầu tiên có cơ chế kiểm tra/tải cập nhật cần được cài thủ công từ trang tải ứng dụng; các bản kế tiếp mới kiểm tra OTA APK được.

---

*Cập nhật: 12/08/2026 — Refactor Phase 1-4 hoàn thành*
