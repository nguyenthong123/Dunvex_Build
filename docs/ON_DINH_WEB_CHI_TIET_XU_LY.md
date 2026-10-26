# Hướng dẫn & Báo cáo kỹ thuật sửa lỗi ổn định web Dunvex

Đọc [bảng tổng hợp](ON_DINH_WEB_TONG_HOP_LOI.md) và `AGENTS.md` trước khi thao tác. Tài liệu này ghi nhận kết quả điều tra mã nguồn thực tế, phương án xử lý, danh sách tệp đã sửa đổi và bằng chứng kiểm thử ngày 26/10/2026.

## 0. Ranh giới công việc và bảo vệ dữ liệu

**Tuyệt đối tuân thủ các quy định:**
- Không tự động backup/snapshot dữ liệu; không restore/import/đưa dữ liệu backup lên máy chủ.
- Không sao chép DB local lên VPS, không can thiệp trực tiếp file SQLite production `/home/zomby/dunvex_app/data/dunvex.db`.
- Không DROP/TRUNCATE/reset/seed hoặc sửa DB production.
- Bản sửa web giữ nguyên mô hình Thin Client REST API + RAM store. Không đưa offline SQLite, IndexedDB lưu ảnh, P2P hay timer đồng bộ lên web.
- Đảm bảo cách ly nền tảng qua `isNativeApp()` để không làm ảnh hưởng tính năng offline của app native (Android/macOS/Windows).

---

## WEB-01 — Sập trang khách hàng khi tìm kiếm

### 1. Nguyên nhân thực tế
- Dữ liệu `customer.phone` từ DB SQLite hoặc qua luồng nhập liệu có thể mang kiểu `number`, `null`, `undefined` hoặc chuỗi có khoảng trắng.
- Tại `CustomerDesktopTable.tsx` và `CustomerMobileList.tsx`, đoạn mã tạo link Zalo:
  `href={`https://zalo.me/${customer.phone.replace(/\D/g, '')}`}`
  chỉ kiểm tra truthy (`customer.phone ? ...`). Khi `phone` mang kiểu `number` (ví dụ `987654321`), JavaScript gọi `.replace()` trực tiếp dẫn đến runtime exception: `TypeError: i.phone.replace is not a function`, làm sập toàn bộ component danh sách khách hàng.
- Ngoài ra, các vị trí tìm kiếm `smartSearchMatch`, format MST/phone, `CustomerDetailModal.tsx` và `CustomerMap.tsx` cũng chưa được bọc an toàn.

### 2. Danh sách file đã sửa
- `src/utils/validation.ts`: Thêm 2 hàm chuẩn hóa:
  - `normalizePhoneDisplay(phone)`: Chuẩn hóa chuỗi an toàn hiển thị; number chuyển thành string qua `String(n)`; null/undefined/array/object/NaN/Infinity trả về chuỗi rỗng `''`.
  - `getZaloPhoneDigits(phone)`: Lấy các chữ số để tạo link Zalo.
- `src/components/customers/CustomerDesktopTable.tsx`: Dùng `normalizePhoneDisplay` và `getZaloPhoneDigits`; chỉ hiển thị link Zalo khi có chữ số hợp lệ.
- `src/components/customers/CustomerMobileList.tsx`: Cập nhật tương tự cho giao diện mobile.
- `src/components/customers/CustomerDetailModal.tsx`: Sử dụng `normalizePhoneDisplay` cho view chi tiết khách hàng.
- `src/components/CustomerMap.tsx`: Bọc chuẩn hóa phone khi hiển thị thông tin bản đồ.
- `src/views/CustomerList.tsx`: Cập nhật chuẩn hóa khi mở form sửa, format tax phone, smart search và xuất Excel.
- `src/utils/__tests__/customerPhone.test.ts`: Tạo bộ unit test hồi quy với 6 kịch bản.

### 3. Kết quả kiểm thử
- `src/utils/__tests__/customerPhone.test.ts`: **6/6 passed**. Đã thử nghiệm với chuỗi số chuẩn, number `912345678`, số `0`, `null`, `undefined`, object `{}`, array `[]`.

---

## WEB-02 & WEB-03 — In phiếu đơn hàng vỡ bố cục & Đơn nhiều mặt hàng bị nén 1 trang

### 1. Nguyên nhân thực tế
- **WEB-03 (Nén trang)**: Luồng in đơn hàng trong `printTicket.ts` biến toàn bộ phiếu thành 1 ảnh PNG duy nhất (`cachedPng` hoặc chụp canvas từ DOM). Khi in A4/A5, ảnh này được nhúng vào container CSS có `max-height: 297mm` (A4) hoặc `210mm` (A5) với thuộc tính `overflow: hidden` và `page-break-inside: avoid`. Do trình duyệt coi ảnh PNG là khối không thể phân trang, đơn từ 20 đến 100 mặt hàng bị ép nhỏ lại hết mức trong 1 trang giấy duy nhất hoặc bị cắt cụt hoàn toàn phần còn lại.
- **WEB-02 (Vỡ bố cục có ảnh)**: 
  - Trong `TicketPaper.tsx`, container `#order-ticket-paper` không có `min-width` cố định trên màn hình hẹp, làm các cột flex/grid bị co kéo.
  - Khi sản phẩm có ảnh, hàm `generateTicketPng` trong `ticketImage.ts` gọi `img.decode()`. Khi ảnh bị lỗi tải (404, CORS hoặc mạng chậm), promise decode fail nhưng thiếu cấu trúc fallback phù hợp làm layout DOM bị xô lệch.
  - Cột ảnh sản phẩm trong bảng in thiếu kích thước ô cố định và thiếu xử lý `onerror`.

### 2. Danh sách file đã sửa
- `src/components/orderTicket/printTicket.ts`:
  - Xây dựng hàm tạo HTML in ấn chuyên biệt cho A4/A5: `generateA4PrintHtml(order, companyInfo, products, creatorName, paperSize)`.
  - Thiết lập CSS phân trang chuẩn: `@page { size: A4/A5 portrait; margin: 8mm 10mm; }`.
  - Thiết lập tiêu đề bảng lặp lại ở mọi trang: `thead { display: table-header-group; }`.
  - Chống ngắt giữa dòng sản phẩm: `tr { page-break-inside: avoid; break-inside: avoid; }`.
  - Chống ngắt khối tổng tiền và chữ ký: `page-break-inside: avoid;`.
  - Cố định kích thước ảnh sản phẩm 44x44px `rounded-lg object-cover`, bọc `onerror` tự động thay thế bằng nhãn fallback an toàn.
  - Bỏ hoàn toàn `max-height` và `overflow: hidden`.
- `src/components/orderTicket/useTicketActions.ts`:
  - Khi người dùng in A4/A5 trên Web, truyền `cachedPng = null` để hệ thống tự động sử dụng luồng in native HTML nhiều trang (vẫn giữ ảnh PNG cho nút "Lưu ảnh" và "Sao chép ảnh" để người dùng gửi Zalo).
- `src/components/orderTicket/ticketImage.ts`:
  - Bổ sung xử lý an toàn: nếu `img.decode()` thất bại, tự động thay thế thẻ `<img>` bằng `<div>` placeholder an toàn trong DOM clone trước khi render canvas.
- `src/components/orderTicket/TicketPaper.tsx`:
  - Thêm `min-w-[720px]` cho khung giấy in để ngăn chặn co hẹp layout trên thiết bị màn hình nhỏ.
- `src/components/OrderTicket.tsx`: Truyền thông tin `creatorName` cho luồng in.
- `src/components/orderTicket/__tests__/printTicketPagination.test.ts`: Tạo bộ unit test hồi quy với 4 kịch bản.

### 3. Kết quả kiểm thử
- `src/components/orderTicket/__tests__/printTicketPagination.test.ts`: **4/4 passed**.
  - Kiểm chứng HTML in sinh ra với đơn 50 mặt hàng có đầy đủ 50 dòng `data-row-index`.
  - Chứa CSS `thead { display: table-header-group; }` và `tr { page-break-inside: avoid; }`.
  - Không còn chứa `max-height: 297mm` hay `overflow: hidden`.
  - Khung ảnh sản phẩm có kích thước 44px và xử lý `onerror`.

---

## WEB-04 — Xuất Excel thiếu dữ liệu hoặc số liệu bằng 0

### 1. Nguyên nhân thực tế
- Trong `src/utils/excelExport.ts`:
  1. Khi đọc các collection (`products`, `customers`, `orders`, `debts`) từ API, nếu phát sinh lỗi (như timeout hoặc lỗi token), khối `try/catch` âm thầm gán `[]` và bỏ qua, dẫn đến việc file Excel vẫn được tải xuống nhưng các sheet rỗng.
  2. Lệnh gọi `getCollection` trên Web gọi `apiClient.getCollection(name, { limit: 10000 })` nhưng không có vòng lặp phân trang; các cửa hàng lớn có trên 10.000 bản ghi sẽ bị cắt cụt dữ liệu.
  3. Quá trình format dữ liệu sử dụng toán tử `||` (ví dụ `Number(item.priceSell || 0)`), gây rủi ro mất giá trị hợp lệ.
  4. Bảng `debtsFormatted` đọc các trường không có thật trong DB là `c.totalOrdersAmount` và `c.totalPaymentsAmount` (thực tế DB VPS lưu bảng `debts` dưới dạng từng giao dịch: `amount`, `type`, `orderId`, `createdAt`), khiến tất cả số liệu công nợ trong sheet xuất ra đều bị gán giá trị 0.

### 2. Danh sách file đã sửa
- `src/utils/excelExport.ts`:
  - Bổ sung phân trang tự động trên Web (`offset += 5000`) qua `getCollection` lặp cho đến khi hết dữ liệu theo đúng `ownerId`, đồng thời cập nhật RAM store.
  - Bổ sung mảng `failedCollections`. Nếu toàn bộ collection chính đọc thất bại, hàm sẽ ném ngoại lệ rõ ràng thay vì âm thầm xuất file rỗng.
  - Thay thế toán tử `||` bằng `??` trên toàn bộ các trường số (`priceSell`, `priceImport`, `stock`, `subTotal`, `totalAmount`, `paidAmount`, `debtAmount`).
  - Cập nhật mapping `customersFormatted` bổ sung trường `'Công nợ hiện tại (đ)': Number(c.debt ?? 0)`.
  - Cập nhật mapping `debtsFormatted` theo đúng schema thực tế của VPS SQLite (`amount`, `type`, `orderId`, `createdAt`, `note`), phân loại rõ ràng "Tăng công nợ (Đơn hàng)" và "Thu nợ / Giảm công nợ".
  - Bảo vệ `saveWorkbookToFile` an toàn trong môi trường test (kiểm tra `typeof document !== 'undefined'`).
- `src/utils/__tests__/excelExport.test.ts`: Tạo bộ unit test hồi quy với 2 kịch bản.

### 3. Kết quả kiểm thử
- `src/utils/__tests__/excelExport.test.ts`: **2/2 passed**.
  - Kiểm chứng xuất thành công đủ 4 sheet (`Danh sách sản phẩm`, `Danh sách khách hàng`, `Lịch sử đơn hàng`, `Lịch sử công nợ`), số dòng và số tiền chính xác, công nợ hiển thị đúng theo loại giao dịch.
  - Kiểm chứng ném lỗi rõ ràng khi API thất bại, không tạo file giả rỗng.

---

## WEB-05 — Tải ảnh lên gần như không lưu (URL blob:)

### 1. Nguyên nhân thực tế
- Tại `src/utils/vpsUpload.ts`, hàm `uploadImageToVPS` không hề gọi API tải ảnh nhị phân lên server VPS, mà gọi qua `localFileService.saveImage`.
- Khi chạy trên Web, `localFileService.saveImage` lưu dữ liệu tạm vào IndexedDB với khóa `local_blob://...` và trả về `URL.createObjectURL(blob)`.
- URL `blob:` này chỉ tồn tại trong bộ nhớ RAM của phiên tab hiện tại. Sau khi reload trang, đăng xuất hoặc mở trên máy khác, URL này lập tức mất hiệu lực, dẫn đến việc sản phẩm không còn hiển thị được ảnh.
- Trong khi đó, backend VPS đã có sẵn route chuẩn `POST /api/upload` tiếp nhận base64 và lưu file tĩnh vào `/uploads/...`, nhưng frontend Web chưa từng gọi đến endpoint này.

### 2. Danh sách file đã sửa
- `src/services/apiClient.ts`:
  - Thêm phương thức `uploadImageApi({ imageBase64, fileName, folder })` gọi `POST /api/upload` với Bearer token xác thực.
- `src/utils/vpsUpload.ts`:
  - Cách ly nền tảng qua `isNativeApp()`:
    - Nếu là App Native: Giữ nguyên cơ chế offline lưu file local.
    - Nếu là Web: Nén ảnh, gọi trực tiếp `uploadImageApi` và trả về URL vĩnh viễn (`https://dunvex.com/uploads/...`). Nếu upload thất bại, ném lỗi rõ ràng; tuyệt đối không fallback về `blob:` trên Web.
- `src/views/ProductList.tsx` & `src/views/InventoryPage.tsx`:
  - Thêm trạng thái `uploading` để khóa nút Lưu sản phẩm trong lúc ảnh đang được upload lên server, ngăn chặn người dùng submit form khi chưa nhận được URL ảnh bền vững.
- `src/utils/__tests__/vpsUpload.test.ts`: Tạo bộ unit test hồi quy với 3 kịch bản.

### 3. Kết quả kiểm thử
- `src/utils/__tests__/vpsUpload.test.ts`: **3/3 passed**.
  - Kiểm chứng Web tải ảnh thành công nhận URL `https://dunvex.com/uploads/...`.
  - Kiểm chứng Web ném lỗi khi API upload thất bại, không sinh URL `blob:`.
  - Kiểm chứng Native App vẫn duy trì cơ chế lưu offline độc lập.

---

## 4. Tổng kết kiểm tra toàn bộ hệ thống

- **TypeScript Typecheck**:
  `npx tsc --noEmit` -> **0 lỗi (Exit Code 0)**.
- **Vitest Test Suite**:
  `npm test` -> **25/25 test files passed, 185/185 tests passed (100%)**.
- **Production Build**:
  `npm run build` -> **Thành công 100%, bundle `dist/` hoàn tất trong ~9.7s**.
- **Dữ liệu SQLite VPS**:
  Tuyệt đối không đụng chạm tới file SQLite production `/home/zomby/dunvex_app/data/dunvex.db`.
