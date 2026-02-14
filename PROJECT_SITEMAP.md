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
- **Phân quyền (RBAC)**: Thực thi nghiêm ngặt trên toàn bộ Router và Component.
- **Bảo mật HTTP (Standard A+)**: Đã triển khai CSP, XFO, HSTS qua `vercel.json` để ngăn chặn XSS và Clickjacking.
- **Backend Script**: Google Apps Script xử lý upload và email mời nhân viên.

---

## 4. Các mục đã hoàn thành & Cần làm (To-do)

### ✅ Đã hoàn thành (Done)
- [x] **Nhập liệu hàng loạt (Bulk Import) + Google Sheets**: Hỗ trợ nhập danh sách Khách hàng/Sản phẩm từ Excel và trực tiếp từ link Google Sheets. Tự động xử lý tọa độ vị trí từ một cột duy nhất (Lat, Lng).
- [x] **Ổn định hóa Bản đồ & Định vị**: Khắc phục triệt để lỗi trắng bản đồ trên PC, tối ưu hóa nút "Vị trí hiện tại" với cơ chế Timeout và thông báo lỗi chi tiết. Tương thích hoàn toàn React-Leaflet v5.
- [x] **Cải thiện UI/UX & Độ tin cậy**: Thay thế hộp thoại xóa mặc định bằng xác nhận in-line cao cấp. Bảo vệ ứng dụng khỏi các lỗi crash do dữ liệu không đúng định dạng (tên khách hàng là số) tại các view Công nợ và Đơn hàng.
- [x] **Dọn dẹp mã nguồn (Cleanup)**: Đã gỡ bỏ toàn bộ console.log/error dư thừa và tối ưu hóa logic state/effects.
- [x] **Tối ưu Safari (Phase 2)**: Đã khắc phục triệt để lỗi trắng bản đồ trên Safari bằng cách ép chiều cao container và sửa lỗi flexbox.
- [x] **Sửa lỗi Firestore Index**: Loại bỏ hoàn toàn lỗi "failed-precondition" bằng cách chuyển sang lọc và sắp xếp dữ liệu phía Client cho các module: Thông báo, Nhật ký hoạt động, Đơn hàng, Công nợ.
- [x] **Tích hợp Mã Chuyển Khoản**: Tự động tạo và hiển thị mã chuyển khoản (DVX...) trong QR thanh toán và quản lý yêu cầu nạp tiền (Nexus Control).
- [x] **Thực thi phân quyền toàn diện**: Đã áp dụng cho Dashboard, Đơn hàng, Kho hàng, Khách hàng, Công nợ và Check-in.
- [x] **Quản lý Gói dịch vụ (Subscription)**: Tích hợp hệ thống kiểm soát dùng thử (Trial) và khóa tính năng cao cấp (Pro).
- [x] **Hệ thống Điều hướng Thông minh (Mobile UX)**: Tự động ẩn Thanh điều hướng (Bottom Nav) và Top Bar khi cuộn xuống để tối ưu diện tích hiển thị trên điện thoại.
- [x] **Tối ưu Chi tiết Khách hàng**: Chuyển đổi sang dạng Bottom Sheet mượt mà trên di động, hỗ trợ gọi điện trực tiếp từ ứng dụng.
- [x] **Bảo mật chuẩn A+**: Triển khai toàn diện CSP, XFO, HSTS, Referrer-Policy thông qua `vercel.json`.
- [x] **Lọc theo ngày (Date Filtering)**: Đã hoàn thiện bộ lọc ngày thực tế cho danh sách công nợ và bảng kê chi tiết khách hàng.
- [x] **In phiếu & Xuất PDF**: Đã tích hợp tính năng in phiếu báo nợ trực tiếp và tối ưu hóa tỷ lệ (Scaling/Zoom) để chụp ảnh gửi Zalo/Messenger sắc nét.
- [x] **Số dư đầu kỳ & Lịch sử Công nợ**: Đã hiển thị chính xác số dư đầu kỳ dựa trên khoảng thời gian lọc và liệt kê chi tiết lịch sử giao dịch/thanh toán.
- [x] **Bản đồ Khách hàng Thông minh**: 
    - **Lọc thông minh**: Tự động nhận diện tất cả loại khách hàng từ dữ liệu và tạo bảng chú thích lọc (Legend) linh hoạt.
    - **Tối ưu không gian**: Thêm nút thu gọn/mở rộng danh sách phân loại để không che khuất bản đồ.
    - **Định vị hiện tại (My Location)**: Chế độ định vị thực tế với chấm xanh nhấp nháy, giúp người dùng biết vị trí đứng so với các điểm khách hàng xung quanh.
    - **Chống lỗi (Stability)**: Cơ chế bảo vệ 3 lớp chống crash khi dữ liệu tải chậm hoặc định dạng sai.

### 📝 Cần làm tiếp (To-do)
- [ ] **PWA Support**: Tích hợp Service Worker để cài đặt ứng dụng vào màn hình chính và thông báo đẩy (Push Notifications).
- [ ] **Báo cáo tài chính nâng cao**: Chuyển đổi các biểu đồ tĩnh sang dữ liệu thực, tự động tính lợi nhuận ròng và dự báo dòng tiền.
- [ ] **QR Code Scanning**: Tích hợp quét mã QR sản phẩm để lên đơn nhanh và kiểm kho bằng camera điện thoại.
- [ ] **Quản lý Kho (Advanced)**: Thêm lịch sử nhập/xuất kho chi tiết (Inventory Logs) và quản lý chuyển kho nội bộ.
- [ ] **Tự động hóa chăm sóc khách hàng**: Gửi thông báo nhắc nợ tự động qua SMS/Zalo API khi tới ngày đến hạn.
- [ ] **Hệ thống Kiểm kho Định kỳ**: Tính năng đối soát số lượng thực tế trong kho và số lượng trên phần mềm.
- [ ] **Chế độ Offline**: Lưu trữ dữ liệu cơ bản local (Cache) để có thể xem thông tin khi mất kết nối mạng tạm thời.

*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
