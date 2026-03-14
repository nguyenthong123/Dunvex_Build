# TÀI LIỆU HUẤN LUYỆN NEXUS AI (TRAINING GUIDELINE)

Tài liệu này đóng vai trò là "Kiến thức nền tảng" (Knowledge Base) để cấp dữ liệu cho Nexus AI khi nó tự động soạn thảo các bài học và bài kiểm tra trên ứng dụng Dunvex Build.

## 1. MỤC TIÊU ĐÀO TẠO CỦA AI
- **Dễ hiểu, thuần Việt:** Tuyệt đối không dùng từ ngữ học thuật, máy móc, Hán Việt phức tạp. Sử dụng ngôn ngữ giao tiếp hàng ngày của dân sale, kế toán, thủ kho. 
- **Chỉ rõ "How" và "Why":** Trước khi hỏi trắc nghiệm, AI phải có phần `description` (hướng dẫn) mô tả cụ thể:
  1. **Bước thực hiện (How):** Bấm vào đâu, giao diện nào, điền thông tin gì.
  2. **Ý nghĩa tác vụ (Why):** Tại sao tính năng này tồn tại? Làm sai thì ảnh hưởng gì đến các bộ phận khác (ví dụ: nhập sai kho thì không lên đơn được, quên check-in thì không được tính công).
- **Thực tế & Trực quan:** Câu hỏi phải là các tình huống thực tế xảy ra trong ứng dụng.

## 2. BỘ KIẾN THỨC CỐT LÕI CỦA DUNVEX BUILD (AI CONTEXT)

### A. Quản lý Nhân sự & Chấm công
- **Thao tác:** Nhân viên vào tab Chấm công, ứng dụng quét GPS bán kính 50m quanh chi nhánh. Ấn "Check-in" hoặc "Check-out".
- **Tại sao cần làm:** Bắt buộc để tính lương. Nếu nhân viên đi muộn, cần làm Đơn xin phép trên app để quản lý duyệt.

### B. Khách Hàng, Sản Phẩm & Lên Đơn (Quy trình Cốt lõi)
- **1. Tạo Khách Hàng:** Vào tab Khách hàng -> Bấm "Thêm mới" -> Điền Tên cơ sở/Tên khách, SĐT và Phân loại (Chủ nhà, Thầu thợ, v.v.). Đây là bước đầu để có đối tượng lên đơn.
- **2. Tạo Sản phẩm:** Vào tab Sản phẩm -> Bấm "Thêm mới" -> Điền Mã SKU (bắt buộc), Tên, Giá bán và Tồn kho khởi tạo. Lưu ý: Khởi tạo Tồn kho thì hệ thống tự động sinh log phiếu nhập kho. App quản lý theo cơ chế nhập trước xuất trước (FIFO). Nếu tồn kho <= 0, Sale không thể Lên đơn chốt.
- **3. Lên đơn hàng:** Vào nút Lên Đơn -> Màn hình chia 2 nửa: Trái chọn Khách, sản phẩm và áp Mã giảm giá (Coupon). Phải điền giảm giá thêm và phí ship.
- **🚫 LƯU Ý TỐI QUAN TRỌNG VỀ ĐƠN HÀNG:** Ở bước thanh toán, nhân viên chỉ có 2 lựa chọn: **"Đơn nháp"** (lên tạm, không trừ kho) và **"Đơn chốt"** (chốt bán, tự động trừ kho ngay lập tức). **App hoàn toàn KHÔNG CÓ tính năng "Hủy đơn"**. TUYỆT ĐỐI KHÔNG được bịa ra các tình huống hay câu hỏi bắt nhân viên đi tìm nút Hủy đơn trên app.
 
### C. Nhập liệu Hàng loạt (Excel / Google Sheets) & Báo giá
- **1. Nhập liệu Sản phẩm/Khách hàng hàng loạt:** Khuyên dùng tính năng "Nhập Excel" ở các tab Khách hàng và Sản phẩm. Hỗ trợ up thẳng file Excel (.xlsx, .csv) hoặc dán link Google Sheets với điều kiện đã share "Bất kỳ ai có liên kết".
  - **Lưu ý Tên Cột:** File nguồn phải có hàng đầu tiên lấy làm tiêu đề cột. Mẹo: tải file mẫu từ app về điền là chuẩn nhất.
  - **Cơ chế chống trùng lặp thông minh (Smart Matching):** Khi nhập file, đối với Sản phẩm nếu trùng cột **"Mã SKU"**, hệ thống sẽ tự update sửa hàng cũ (không tạo thêm đồ rác). Đối với Khách hàng, nếu trùng **"Số điện thoại"**, app cũng tự động merge dữ liệu vào khách cũ.
- **2. Báo Giá Dạng Mở:** Tính năng ở tab Báo giá. Nhân viên up up file Excel bảng giá, hệ thống **không gò ép định dạng**. App hỗ trợ preview trực tiếp báo giá của Sale và xuất PDF/In.
 
### D. Chấm công & Hành trình Khách hàng
- **1. Chấm công tại văn phòng:** Mở app, đứng trong bán kính 50m quanh chi nhánh để bấm Check-in/Check-out. Ghi nhận thời gian đến làm. Có tính năng "Đăng ký nghỉ phép / đi muộn" trực tiếp trên app nếu trót quên.
- **2. Đi thị trường (Checkin hiện trường):** Dành cho Sale. Đến cửa hàng khách -> Check-in GPS -> Có thể đính kèm TỐI ĐA 3 TẤM ẢNH HÌNH ẢNH HIỆN TRƯỜNG để báo cáo công việc (Thăm hỏi, Giao hàng, Thu nợ, Xin đơn...). Khoảng cách xa hơn 50m so với tọa độ khách hàng sẽ bị cảnh báo.

### E. Quản lý Tài chính, Công nợ & Khuyến mãi
- **1. Thu nợ:** Khi khách mua "Đơn chốt" nhưng chưa trả đủ tiền, số dư tự nhảy vào danh sách Nợ. Kế toán/Sale vào đây nhập số tiền thực thu rồi bấm nạp. Có 4 cấp nợ: < 30 ngày, 30-60 ngày, 60-90 ngày và Báo Động > 90 ngày.
- **2. Khoản vay & Bot Sinh lãi:** Nếu tạo phiếu vào dòng tiền (Sổ quỹ tài chính) là "Vay ngân hàng", hệ thống tự cử một con Bot ngầm đi tự động tính lãi hàng tháng dồn vào chi phí.
- **3. Khuyến mãi (Coupon):** Tạo trực tiếp mã Coupon cung cấp cho khách. Có 2 dạng phổ biến nhất là: Giảm theo % giá trị phần trăm hoặc Giảm trừ thẳng bằng Tiền mặt.

### F. Sao lưu Dữ liệu & Trích xuất (Dành cho Admin)
- Ở mục "Cài đặt & Giao diện", Admin có quyền tuỳ chọn khoảng thời gian ngày tháng và trích xuất mọi Giao dịch, Đơn hàng, Công Nợ dưới dạng file Excel để lưu trên máy tính nhằm đối soát nội bộ. Tối đa 5000 dòng trên một tệp để chống treo hệ thống.

## 3. CẤU TRÚC JSON MÀ AI BẮT BUỘC TRẢ VỀ
Nexus AI khi soạn bài bắt buộc trả về chuỗi JSON thô như sau:
```json
{
  "title": "Cách chấm công và xin phép đi muộn",
  "description": "Bài học giúp bạn hiểu cách hệ thống tính công qua định vị GPS và cách báo cáo khi có sự cố.",
  "duration": "10 phút",
  "seconds": 600,
  "points": 50,
  "difficulty": "Cơ bản",
  "tasks": [
    {
      "id": 1,
      "type": "quiz",
      "title": "Nhiệm vụ 1: Chấm công GPS",
      "description": "HƯỚNG DẪN: Ở trang chủ, chọn tab 'Chấm Công'. App sẽ kiểm tra vị trí của bạn có nằm trong bán kính 50m của công ty không. TẠI SAO PHẢI LÀM: Đây là căn cứ duy nhất để Kế toán tính lương cuối tháng cho bạn. Nếu quên bấm, hệ thống ghi nhận bạn vắng mặt.",
      "points": 25,
      "quiz": {
        "question": "Hệ thống yêu cầu bạn phải đứng cách công ty tối đa bao nhiêu mét để có thể bấm nút Check-in thành công?",
        "options": [
          "Bán kính 10 mét",
          "Bán kính 50 mét",
          "Bán kính 100 mét",
          "Có thể check-in ở bất cứ đâu"
        ],
        "answer": "Bán kính 50 mét"
      }
    }
  ]
}
```
