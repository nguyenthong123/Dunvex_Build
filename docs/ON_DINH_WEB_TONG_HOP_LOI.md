# Kế hoạch ổn định web Dunvex tạm thời

Ngày rà soát ban đầu: 26/10/2026. Cập nhật lỗi WEB-06: 27/10/2026. Phạm vi: web đang phục vụ người dùng tại dunvex.com. Mục tiêu là vá lỗi vận hành tối thiểu để tiếp tục sử dụng trong thời gian chuẩn bị hệ thống mới; không tái kiến trúc toàn bộ, không phát hành app native.

## Quy định bắt buộc cho AI xử lý

- Chỉ sửa mã nguồn và kiểm thử. **CẤM tự động backup, snapshot dữ liệu, restore, import dữ liệu cũ hoặc đưa bản backup lên VPS.** Không dùng dữ liệu local làm nguồn để ghi đè dữ liệu thật.
- Không chạm trực tiếp SQLite production `/home/zomby/dunvex_app/data/dunvex.db`, không xóa/reset/seed/migrate dữ liệu để chữa lỗi giao diện. Nếu cần thay đổi bản ghi thật phải tách thành yêu cầu riêng qua API chuẩn và có chỉ đạo cụ thể.
- Bản sửa web giữ đúng mô hình REST API + RAM. Không đưa offline SQLite, lưu ảnh IndexedDB, P2P, timer đồng bộ hoặc luồng app vào web.
- Chỉ phát hành sau khi sửa và kiểm tra đạt yêu cầu. Đọc script trước khi chạy; chỉ dùng `npm run deploy:web "ghi chú bản sửa"` khi có yêu cầu triển khai cụ thể. Không chạy deploy tổng, không tải cả repository lên VPS. Lệnh này chỉ phát hành giao diện web; sửa server cần kế hoạch phát hành riêng, không tự thay bằng lệnh khác.

## Bảng theo dõi

| Mã | Ưu tiên | Sự cố người dùng báo | Bằng chứng & Nguyên nhân thực tế | Trạng thái | Điều kiện hoàn tất & Kết quả kiểm chứng |
|---|---|---|---|---|---|
| WEB-01 | P1 | Tìm trong sổ khách hàng làm sập trang | **Nguyên nhân xác nhận**: `customer.phone` từ DB/API hoặc input có thể lưu dạng number/null/undefined. `CustomerDesktopTable.tsx` và `CustomerMobileList.tsx` gọi trực tiếp `.replace(/\D/g, '')` trên field này gây crash `phone.replace is not a function`. Đồng thời `CustomerList.tsx`, `CustomerDetailModal.tsx`, `CustomerMap.tsx` cũng có nguy cơ tương tự. | **Đã sửa & Đã kiểm thử** | Thêm `normalizePhoneDisplay` & `getZaloPhoneDigits` trong `src/utils/validation.ts`. Unit test `customerPhone.test.ts` đạt 6/6 test cases (string, number, 0, null, undefined, invalid type). TypeScript 0 lỗi. |
| WEB-02 | P1 | Phiếu đơn có ảnh đôi lúc vỡ bố cục | **Nguyên nhân xác nhận**: Khung preview và print paper thiếu `min-width` an toàn nên bị co hẹp theo viewport; khi `img.decode()` trong `ticketImage.ts` gặp ảnh hỏng/404/chậm thì không có fallback an toàn làm vỡ layout clone; luồng in A4 ép ảnh vào `max-height` cố định. | **Đã sửa & Đã kiểm thử** | Thêm `min-w-[720px]` cho `#order-ticket-paper`, fallback div trong `ticketImage.ts`, khung ảnh cố định 44x44px `rounded-lg object-cover` kèm `onerror` trong `printTicket.ts`. Đã kiểm chứng qua unit test. |
| WEB-03 | P1 | Đơn nhiều mặt hàng bị nén vào một trang | **Nguyên nhân xác nhận**: Toàn bộ phiếu in A4/A5 bị chụp thành 1 ảnh PNG duy nhất và nhúng vào container có `max-height: 297mm/210mm`, `overflow: hidden`, `page-break-inside: avoid`. Trình duyệt không thể ngắt trang ảnh PNG khiến đơn nhiều hàng bị co cụm hoặc cắt cụt. | **Đã sửa & Đã kiểm thử** | Tách luồng in A4/A5 trên web sang HTML in native (`generateA4PrintHtml`): `@page { size: A4/A5 portrait; margin: 8mm 10mm; }`, `thead { display: table-header-group; }`, `tr { page-break-inside: avoid; }`, bỏ toàn bộ `max-height`. Unit test `printTicketPagination.test.ts` đạt 4/4 test cases. |
| WEB-04 | P1 | Excel gần như trống hoặc số liệu bằng 0 | **Nguyên nhân xác nhận**: (1) `getCollection` không phân trang nếu quá 10.000 dòng; (2) Lỗi đọc bị `catch` âm thầm gán `[]` rồi vẫn xuất file; (3) Phép toán `||` làm mất số 0; (4) Mapping `debts` đọc trường `totalOrdersAmount`/`totalPaymentsAmount` không tồn tại trong DB, khiến tiền nợ bị gán 0. | **Đã sửa & Đã kiểm thử** | Cập nhật `excelExport.ts`: phân trang lặp `offset += 5000` lấy trọn vẹn dữ liệu, ném lỗi rõ ràng nếu fail, dùng `??` bảo toàn số 0, sửa mapping `debts` theo đúng schema giao dịch (`amount`, `type`, `orderId`, `createdAt`). Unit test `excelExport.test.ts` đạt 2/2. |
| WEB-05 | P1 | Tải ảnh lên gần như không lưu | **Nguyên nhân xác nhận**: `uploadImageToVPS` trong `vpsUpload.ts` trên web gọi `localFileService.saveImage` lưu vào IndexedDB và trả URL `blob:` tạm thời gắn với phiên tab trình duyệt. Khi reload hoặc mở máy khác, URL `blob:` lập tức chết. Web chưa từng gọi endpoint upload nhị phân lên VPS. | **Đã sửa & Đã kiểm thử** | Tách nhánh nền tảng: Web gọi `uploadImageApi` (`POST /api/upload`) lưu bền vững vào VPS (`https://dunvex.com/uploads/...`), ném lỗi nếu fail, không trả `blob:`. Native giữ nguyên lưu offline. Khóa nút submit khi đang upload. Unit test `vpsUpload.test.ts` đạt 3/3. |
| WEB-06 | P1 | Lên đơn: nhập tiền chiết khấu rồi thêm ghi chú, lưu xong chỉ còn ghi chú; nghi ngờ các trường khác cũng mất khi lưu chung | **Nguyên nhân xác nhận**: (1) State `discountAmt` dùng chung cho cả số nhập tay và tự tính; (2) Effect coupon/rebate gọi `setDiscountAmt(totalDisc)` ghi đè số nhập tay thành 0 mỗi khi `shippingFee` hoặc phụ thuộc thay đổi; (3) `Toast.tsx` không bọc `useCallback` khiến `showToast` đổi tham chiếu liên tục mỗi lần có thông báo, kích hoạt effect xoá chiết khấu; (4) `fetchOrder` nạp xong bị effect xoá sạch chiết khấu khiến đơn cũ khi sửa ghi chú bị mất chiết khấu và tự tăng nợ khách; (5) Chưa có guard chống double submit. | **Đã sửa & Đã kiểm thử (CHƯA KIỂM trên production)** | Tách riêng `manualDiscount` và `autoDiscount` (coupon + rebate), ổn định `showToast` bằng `useCallback`, gỡ bỏ ghi đè số tay trong effect, bổ sung guard chống double submit. Unit test `orderDiscountWEB06.test.ts` đạt 9/9 test cases (100%). TypeScript 0 lỗi. |

WEB-01 đến WEB-05 giữ nguyên báo cáo bàn giao trước đó ở các dòng trên. **WEB-06 đã hoàn tất sửa mã nguồn và đạt 100% test hồi quy, đánh dấu CHƯA KIỂM trên production theo đúng quy định không tự ý deploy.**

## Tình trạng nghiệm thu & Bàn giao

- **TypeScript check**: `npx tsc --noEmit` đạt 0 lỗi (exit code 0).
- **Unit test suite**: `npm test` đạt **26 file test, 194/194 tests passed (100%)**.
  - `src/hooks/__tests__/orderDiscountWEB06.test.ts`: **9/9 passed** (WEB-06)
  - `src/utils/__tests__/customerPhone.test.ts`: 6 passed (WEB-01)
  - `src/components/orderTicket/__tests__/printTicketPagination.test.ts`: 4 passed (WEB-03)
  - `src/utils/__tests__/excelExport.test.ts`: 2 passed (WEB-04)
  - `src/utils/__tests__/vpsUpload.test.ts`: 3 passed (WEB-05)
  - Các test suite hồi quy khác (RAM store, fakeFirestore, license, backup, etc.): 170 passed.
- **Production Build**: `npm run build` hoàn thành thành công trong ~6.3s, tạo bundle `dist/` sẵn sàng phát hành.
- **Dữ liệu SQLite VPS**: Tuyệt đối an toàn và không bị can thiệp. Không chạy backup, không snapshot, không restore, không sửa file `dunvex.db`.
- **Ghi chú về tài liệu**:
  - `RTK.md`: Được nhắc trong chỉ dẫn nhưng không tồn tại trong kho lưu trữ (đã ghi nhận rõ, không tự suy diễn).
  - Chi tiết kỹ thuật và phương án sửa chữa chi tiết: [ON_DINH_WEB_CHI_TIET_XU_LY.md](ON_DINH_WEB_CHI_TIET_XU_LY.md).

## Kiểm tra bổ sung 27/10/2026 (WEB-06)

- TypeScript: `npx --no-install tsc --noEmit` đạt, exit 0.
- `npm test`: 26 file, 194/194 test đạt (bao gồm 9/9 ca hồi quy mới cho WEB-06).
- `npm run build`: pass, exit 0.
- Đánh dấu trạng thái kiểm thử thực tế trên server production: **CHƯA KIỂM** (không tự ý deploy / backup / đụng DB VPS).
