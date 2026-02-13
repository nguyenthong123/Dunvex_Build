# Sơ đồ Cấu trúc Ứng dụng Dunvex Build

Dưới đây là sơ đồ tóm tắt các trang và luồng dữ liệu chính để phục vụ việc kiểm tra và phát triển tiếp vào ngày mai.

## 1. Bản đồ Điều hướng (Sitemap)

- **Trang Đăng nhập (`/login`)**: Xác thực qua Google / Firebase. Hỗ trợ cơ chế "Mời nhân viên" tự động điều hướng về công ty của Admin.
- **Trang Chủ / Tổng quan (`/`)**:
    - Biểu đồ doanh thu (Có chế độ Glassmorphism).
    - Hoạt động mới nhất.
    - Phím tắt nhanh đến các module.
- **Trang Quản Trị Doanh Nghiệp (`/admin`)** 🆕:
    - **Thông tin doanh nghiệp**: Cấu hình tên, logo, VAT, địa chỉ.
    - **Quản lý Nhân sự**: Mời nhân viên qua email, quản lý vai trò (Sale, Kho, Kế toán).
    - **Phân quyền Truy cập (RBAC)**: Bật/tắt chức năng cụ thể cho từng nhân viên.
    - **Nhật ký Hoạt động**: Theo dõi lịch sử thao tác hệ thống.
- **Trang Cài Đặt Ứng Dụng (`/settings`)** 🆕:
    - Cấu hình giao diện (Sáng/Tối).
    - Các tùy chọn cá nhân hóa khác.
- **Trang Quản lý Công nợ (`/debts`)**:
    - KPI: Tổng phải thu, Phải trả, Nợ quá hạn.
    - Danh sách đối tác, mã đơn nợ.
    - Chức năng: Nhắc nợ, Ghi nhận thu nợ.
- **Quản lý Kho hàng (`/orders`)**:
    - Danh sách đơn hàng đã tạo.
    - **Checkin ngay (`/checkin`)**:
        - Ghi nhận hoạt động viếng thăm/khiếu nại.
        - **Hoạt động (Mới)**: Danh sách lịch sử checkin.

---

## 2. Hệ thống Giao diện & Điều hướng (Nâng cấp 🚀)

Hệ thống điều hướng đã được nâng cấp để thay đổi ngữ cảnh linh hoạt theo từng trang và tối ưu không gian làm việc:

### 📱 Dynamic Bottom Navigation (Mobile)
- **Thông minh**: Menu thay đổi nút Center (Giữa) theo từng trang (Lên đơn, Thu nợ, Thêm SP, Checkin).
- **Phân quyền**: Tự động ẩn các mục menu nếu nhân viên không được cấp quyền truy cập.

### �️ Desktop Sidebar & Workspace
- **Ẩn/Hiện Menu**: Hỗ trợ thu gọn menu chính (màu xanh) để mở rộng không gian làm việc, có ghi nhớ trạng thái người dùng.
- **Admin Layout Mới**: Trang Quản Trị Doanh Nghiệp chuyển sang dạng Tab ngang phía trên, tối ưu diện tích cho quản lý nhân sự và phân quyền.

---

## 3. Hệ thống & Bảo mật (System & Security)

- **Cơ sở dữ liệu**: Firebase Firestore (Real-time).
- **Lưu trữ ảnh**: Google Drive (Thumbnail sync).
- **Xác thực**: Firebase Auth.
- **Phân quyền (RBAC)**: Thực thi nghiêm ngặt trên toàn bộ Router và Component. Nhân viên không có quyền sẽ thấy màn hình thông báo chuyên nghiệp.
- **Index**: Đã cấu hình Composite Index cho `audit_logs` để truy vấn mượt mà theo `ownerId` và `createdAt`.
- **Backend Script**: Google Apps Script xử lý upload và email mời nhân viên.

---

## 4. Các mục đã hoàn thành & Cần làm (To-do)

### ✅ Đã hoàn thành (Done)
- [x] **Tối ưu Safari (Phase 2)**: Đã khắc phục triệt để lỗi trắng bản đồ trên Safari bằng cách ép chiều cao container và sửa lỗi flexbox.
- [x] **Sửa lỗi Firestore Index**: Loại bỏ hoàn toàn lỗi "failed-precondition" bằng cách chuyển sang lọc và sắp xếp dữ liệu phía Client cho các module: Thông báo, Nhật ký hoạt động, Đơn hàng, Công nợ.
- [x] **Tích hợp Mã Chuyển Khoản**: Tự động tạo và hiển thị mã chuyển khoản (DVX...) trong QR thanh toán và quản lý yêu cầu nạp tiền (Nexus Control).
- [x] **Cải thiện độ tương phản Safari**: Bật chế độ làm mượt font-smoothing và làm đậm các hiệu ứng mờ (blur) để nội dung dễ đọc hơn trên nền trắng của Safari.
- [x] **Thực thi phân quyền toàn diện**: Đã áp dụng cho Dashboard, Đơn hàng, Kho hàng, Khách hàng, Công nợ và Check-in.
- [x] **Quản lý Gói dịch vụ (Subscription)**: Tích hợp hệ thống kiểm soát dùng thử (Trial) và khóa tính năng cao cấp (Pro).

### 📝 Cần làm tiếp (To-do)
- [ ] **Lọc theo ngày**: Hoàn thiện bộ lọc ngày thực tế cho các báo cáo doanh thu và bảng kê công nợ.
- [ ] **In phiếu đơn hàng**: Hoàn thiện giao diện in phiếu đơn hàng & Xuất file PDF gửi qua Zalo.
- [ ] **PWA Support**: Tích hợp để cài đặt ứng dụng vào màn hình chính điện thoại.
- [ ] **Báo cáo lợi nhuận**: Tự động tính lợi nhuận dựa trên giá vốn và giá bán thực tế.
- [ ] **Dọn dẹp mã nguồn**: Xóa các console.log dư thừa và tối ưu hóa các hook useEffect.


*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
