# 🏗️ Dunvex Build - Hệ thống Quản trị Xây dựng Toàn diện

Dunvex Build là một nền tảng quản trị doanh nghiệp chuyên biệt cho ngành xây dựng và cung ứng vật tư, được tối ưu hóa cho trải nghiệm di động và vận hành thực tế tại hiện trường. Dự án hiện đã đạt mốc **Stable & Lean v1.0**.

---

## 🌟 Tính năng Chính

### 💰 Quản lý Tài chính & Công nợ
- **Auto-Calc System**: Tự động tính toán lợi nhuận, dư nợ ngân hàng và lãi suất hàng tháng.
- **Debt Statement Pro**: Xuất phiếu công nợ cao cấp với chế độ Screenshot/Zoom hỗ trợ gửi cho khách hàng.
- **Phân tích rủi ro**: Theo dõi tuổi nợ (Debt Aging) 30-60-90 ngày để kiểm soát dòng tiền.

### 📦 Kho hàng & Lên đơn (Inventory & Quick Order)
- **Nhập liệu hàng loạt**: Hỗ trợ Bulk Import từ Excel và Google Sheets thông minh.
- **Quản lý SKU**: Tự động tạo mã SKU duy nhất, hỗ trợ in tem QR Code vật lý.
- **Logic FIFO**: Thực thi nghiêm ngặt cơ chế Nhập trước - Xuất trước để tính giá vốn chính xác.

### 📍 Chấm công & Hiện trường (HR & Fieldwork)
- **Geofencing Attendance**: Chấm công dựa trên định vị GPS (bán kính 50m) và ID thiết bị.
- **Check-in Thị trường**: Nhân viên thị trường check-in tại vị trí khách hàng kèm tối đa 3 ảnh hiện trường.
- **Lộ trình khách hàng**: Tích hợp dẫn đường Google Maps trực tiếp từ ứng dụng.

### 📚 Trung tâm Đào tạo (Knowledge Base)
- **Blog-style Training**: Hệ thống bài viết hướng dẫn vận hành chuyên nghiệp.
- **Admin Studio**: Trình quản lý nội dung bài viết và video YouTube tutorial.

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

- **Frontend**: [React 19](https://react.dev/), [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database & Auth**: [Firebase 12](https://firebase.google.com/) (Firestore & Auth)
- **Lưu trữ ảnh**: [Cloudinary](https://cloudinary.com/)
- **Bản đồ**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Xử lý dữ liệu**: [XLSX](https://github.com/SheetJS/sheetjs) (Excel), [Zod](https://zod.dev/) (Validation)
- **PWA**: Hỗ trợ chạy ngoại tuyến và cài đặt như ứng dụng di động.

---

## 📁 Cấu trúc Thư mục

```text
src/
├── components/   # Các UI components dùng chung (Layout, Inventory, CRM...)
├── hooks/        # Custom React hooks (Auth, Owner, Attendance...)
├── services/     # Tương tác với Firebase, Cloudinary, Apps Script
├── utils/        # Hàm tiện ích (Validation, Format tiền, Date...)
├── views/        # Các màn hình chính (Home, Finance, Debts, Inventory...)
└── App.tsx       # Cấu hình Routing & Global Providers
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy Local

1. **Clone dự án**:
   ```bash
   git clone <repository-url>
   cd Dunvex_Build-main
   ```

2. **Cài đặt dependencies**:
   ```bash
   npm install
   ```

3. **Cấu hình môi trường**:
   Tạo file `.env` tại thư mục gốc và điền các thông tin:
   - Firebase Config (API Key, Project ID...)
   - Cloudinary Cloud Name
   - Groq API Key (Nếu dùng AI nâng cao)

4. **Chạy Dev Server**:
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại: `http://localhost:5173/`

---

## 📅 Roadmap (Hạng mục tiếp theo)

- [ ] **Ký nhận điện tử (E-Signature)**: Ký xác nhận giao hàng trực tiếp trên Mobile.
- [ ] **Tích hợp Zalo/Messenger**: Tự động gửi thông báo nhắc nợ/hóa đơn.
- [ ] **Dòng thời gian khách hàng (CRM Timeline)**: Tổng hợp lịch sử giao dịch trực quan.
- [ ] **Dự báo dòng tiền (AI Forecast)**: Phân tích xu hướng tài chính 30 ngày.

---
*Ngày cập nhật: 24/04/2026*
*Phiên bản: 1.0.0 Stable*
