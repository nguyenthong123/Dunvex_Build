# Hướng dẫn & Báo cáo kỹ thuật sửa lỗi ổn định web Dunvex

Đọc [bảng tổng hợp](ON_DINH_WEB_TONG_HOP_LOI.md) và `AGENTS.md` trước khi thao tác. Tài liệu này ghi nhận kết quả điều tra mã nguồn thực tế, phương án xử lý, danh sách tệp đã sửa đổi và bằng chứng kiểm thử ngày 26/10/2026.

Bổ sung ngày 27/10/2026: WEB-06 bên dưới đã được tái hiện, chứng minh nguyên nhân, sửa đổi mã nguồn và kiểm thử hồi quy 9/9 ca đạt 100%. Trạng thái trên môi trường kiểm thử là ĐẠT; trên môi trường production ghi nhận **CHƯA KIỂM** do chưa được lệnh deploy từ người dùng.

## WEB-06 — Chiết khấu nhập tay bị mất khi nhập thêm ghi chú/lưu nhiều trường

**Trạng thái: ĐÃ SỬA MÃ NGUỒN & PASS TEST HỒI QUY — CHƯA KIỂM TRÊN PRODUCTION (P1).**
Người dùng báo: khi lên đơn, nhập số tiền chiết khấu rồi nhập thêm ghi chú, sau lưu chỉ còn ghi chú, chiết khấu mất; lo ngại các trường khác cũng bị rơi rụng.

### 1. Bằng chứng tái hiện lỗi thực tế trước khi sửa (Runtime Evidence)
Chạy kịch bản kiểm thử tích hợp mount hook `useOrderForm`:
- **Trước khi sửa:**
  1. Nhập mặt hàng 1.000.000đ → Nhập chiết khấu tay 50.000đ → Đổi `shippingFee` thành 20.000đ:
     `discountAmt after shippingFee change: 0` (Bị effect coupon/rebate tự động xoá sạch).
  2. Nhập chiết khấu tay 50.000đ → Nhập ghi chú → Toast hiển thị / ToastProvider render lại làm đổi reference của `showToast`:
     `discountAmt after showToast recreation: 0` (Effect phụ thuộc `showToast` chạy lại và gán `totalDisc = 0`).
  3. Mở đơn cũ có sẵn chiết khấu tay 50.000đ, phí 20.000đ, tổng 970.000đ:
     `After fetchOrder - discountAmt: 0`, `finalTotal: 1020000`. Khi người dùng sửa ghi chú và bấm lưu, `discountValue` bị gửi lên bằng 0, đồng thời hệ thống tính lệch `diffDebt = +50.000đ` và tự động cộng tăng nợ khách hàng sai trái!
- **Sau khi sửa:**
  1. `discountAmt after shippingFee change: 50000` (Giữ nguyên).
  2. `discountAmt after showToast recreation: 50000` (Giữ nguyên).
  3. `After fetchOrder - discountAmt: 50000`, `finalTotal: 970000`, `diffDebt: 0` (Giữ nguyên toàn bộ chiết khấu và tổng tiền, nợ khách không đổi).

### 2. Nguyên nhân cốt lõi đã chứng minh
1. **Dùng chung một biến state cho hai mục đích xung đột:** Hook `useOrderForm` chỉ có một state `discountAmt` duy nhất để lưu cả số tiền người dùng nhập tay lẫn tổng tiền tự tính từ Coupon + Rebate.
2. **Effect tự tính ghi đè huỷ diệt:** Effect tại dòng 245-277 tính `totalDisc = couponDisc + rebateDisc` rồi gọi thẳng `setDiscountAmt(totalDisc)`. Khi đơn hàng không có coupon/rebate, `totalDisc = 0`, effect lập tức xoá sạch số tiền người dùng đã nhập tay.
3. **Tham chiếu không ổn định của `showToast`:** `Toast.tsx` định nghĩa `showToast` và `showConfirm` bằng arrow function nội bộ không bọc `useCallback`, object value context không bọc `useMemo`. Khi có toast xuất hiện hoặc tự đóng sau 5s, `ToastProvider` render lại, tạo mới `showToast`, kích hoạt effect phụ thuộc nó chạy lại và xoá chiết khấu tay.
4. **Hydration đơn cũ bị effect xoá:** Trong `fetchOrder`, sau khi nạp `discountValue` và `adjustmentValue`, effect tự động phát hiện `lineItems`/`shippingFee` thay đổi và chạy ngay lập tức, đè `discountAmt = 0`.
5. **Thiếu guard submit trùng:** `handleConfirmOrder` không chặn double-click lúc đang submit (`isSubmittingRef`), dẫn đến rủi ro gửi hai giao dịch đồng thời và nhân đôi công nợ khi mạng chập chờn.

### 3. Phương án xử lý chi tiết
1. **Ổn định `ToastProvider` (`src/components/shared/Toast.tsx`):**
   - Bọc `showToast`, `removeToast`, `showConfirm` bằng `useCallback`.
   - Bọc giá trị context `value` bằng `useMemo`.
2. **Tách bạch State & Logic chiết khấu trong `src/hooks/useOrderForm.ts`:**
   - Tạo state riêng `manualDiscount` cho khoản nhập tay (`useState(0)`).
   - Dùng `showToastRef` để lưu `showToast`, tách hẳn callback thông báo khỏi dependency array của các effect nghiệp vụ.
   - Tính toán thuần túy (pure `useMemo`):
     - `couponDiscount`: tính từ `appliedCoupon` + `lineItems` + `subTotal` + `shippingFee`.
     - `rebateDiscount`: tính từ `appliedRebate`.
     - `autoDiscount = couponDiscount + rebateDiscount`.
     - `totalDiscount = Math.min(subTotal, Math.max(0, manualDiscount) + autoDiscount)`.
     - `finalTotal = Math.max(0, subTotal + shippingFee - totalDiscount)`.
     - `totalProfitActual = profitSubTotal - profitCostTotal - totalDiscount`.
     - `discountAmt = totalDiscount` (giữ tương thích 100% cho mọi consumer).
     - `setDiscountAmt = setManualDiscount` (khi người dùng gõ vào ô chiết khấu là gán vào `manualDiscount`).
   - Effect auto-coupon: Chỉ tự động quét tìm coupon tốt nhất khi tạo đơn mới (`!editId`), chưa có mã và người dùng chưa chủ động gỡ mã. Tuyệt đối không gọi `setDiscountAmt` và không chạm vào `manualDiscount`.
   - Effect auto-rebate: Khi người dùng chọn hoặc đổi khách hàng, tự tìm rebate hợp lệ. Bổ sung cờ `userManuallySelectedRebate` và `userManuallyClearedRebate` để không tự xoá rebate do người dùng chọn thủ công.
   - Handlers `handleSelectCoupon`, `handleRemoveCoupon`, `handleSelectRebate`, `handleRemoveRebate`, `handleApplyCoupon`: Chỉ quản lý coupon/rebate, bảo toàn 100% `manualDiscount`.
   - `fetchOrder`: Khôi phục `manualDiscount` từ `data.manualDiscount` hoặc `Math.max(0, data.discountValue - (data.rebateAmount || 0))`. Giữ nguyên `couponCode`.
   - `handleConfirmOrder`: Bổ sung `isSubmittingRef` chống double submit; lưu đồng thời `discountValue: totalDiscount`, `discountAmt: totalDiscount`, `manualDiscount: manualDiscount`, `adjustmentValue: shippingFee`, `note: orderNote`, `orderCode`. Khi sửa chỉ ghi chú, `totalDiscount` được giữ nguyên → `diffDebt = 0` → không ghi nợ thừa.
3. **Cập nhật giao diện `OrderSummary.tsx` & `QuickOrder.tsx`:**
   - Ô input "Số tiền Chiết khấu (-)" liên kết trực tiếp với `manualDiscount`.
   - Nếu có chiết khấu tự động (`autoDiscount > 0`), hiển thị nhãn phụ `(Đã gồm tự động: -X đ)`.
   - Bảng tổng kết bên phải hiển thị tổng chiết khấu `totalDiscount`.
   - Nhập chuỗi rỗng tự về 0, không gây `NaN`.

### 4. Danh sách tệp đã chỉnh sửa
- `src/components/shared/Toast.tsx`: Memoize `showToast`, `showConfirm`, context value.
- `src/hooks/useOrderForm.ts`: Tách `manualDiscount`, `autoDiscount`, `totalDiscount`, ổn định effect, khôi phục đơn cũ, chống double submit.
- `src/components/orders/OrderSummary.tsx`: Hỗ trợ `manualDiscount`, hiển thị nhãn phụ auto discount, input an toàn.
- `src/views/QuickOrder.tsx`: Truyền `manualDiscount`, `autoDiscount`, `totalDiscount` xuống `OrderSummary`.
- `src/hooks/__tests__/orderDiscountWEB06.test.ts`: Bộ test hồi quy 9 ca kiểm thử toàn diện.

### 5. Kết quả kiểm thử & Bằng chứng xác nhận
- **Test suite WEB-06 (`src/hooks/__tests__/orderDiscountWEB06.test.ts`): 9/9 test passed (100%)**:
  1. Ca 1: Tiền hàng 1.000.000đ + phí 20.000đ − chiết khấu tay 50.000đ = 970.000đ; ghi chú "Giao buổi chiều" — lưu & reload giữ nguyên toàn bộ (PASSED).
  2. Ca 2: Đảo thứ tự nhập (Ghi chú → Chiết khấu → Phí và các biến thể) cho kết quả đồng nhất 970.000đ (PASSED).
  3. Ca 3: Mở đơn cũ có chiết khấu, chỉ sửa ghi chú rồi lưu — giữ nguyên chiết khấu, `diffDebt = 0`, không phát sinh nợ tăng (PASSED).
  4. Ca 4: Giá trị biên (chiết khấu 0, xoá rỗng, nhập rồi lưu ngay) không bị NaN/rơi trường (PASSED).
  5. Ca 5: Provider re-render & showToast liên tục không làm mất chiết khấu nhập tay (PASSED).
  6. Ca 6: Áp dụng và gỡ Coupon khi có chiết khấu tay — không ghi đè, không cộng trùng (PASSED).
  7. Ca 7: Áp dụng và gỡ Rebate khi có chiết khấu tay — bảo toàn số tay (PASSED).
  8. Ca 8: Lưu đồng thời ngày đơn, khách, toạ độ, ghi chú, phí, chiết khấu — reload giữ đủ (PASSED).
  9. Ca 9: Double submit guard chặn retry đồng thời, không tạo đơn kép và không nhân đôi nợ (PASSED).
- **Toàn bộ dự án**:
  - `npx tsc --noEmit`: 0 lỗi (exit code 0).
  - `npm test`: **26 test files, 194/194 passed (100%)**.
  - `npm run build`: Production bundle thành công trong 6.27s.
- **Trạng thái phát hành**: **CHƯA KIỂM trên production** (Tuân thủ nghiêm ngặt: không tự ý chạy deploy, không backup, không can thiệp SQLite VPS).

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
