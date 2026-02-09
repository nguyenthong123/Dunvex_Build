# Sơ đồ Cấu trúc Ứng dụng Dunvex Build

Dưới đây là sơ đồ tóm tắt các trang và luồng dữ liệu chính để phục vụ việc kiểm tra và phát triển tiếp vào ngày mai.

## 1. Bản đồ Điều hướng (Sitemap)

- **Trang Đăng nhập (`/login`)**: Xác thực qua Google / Firebase.
- **Trang Quản lý Công nợ (`/`) [Trang chủ mới]**:
    - KPI: Tổng phải thu, Phải trả, Nợ quá hạn.
    - Danh sách đối tác, mã đơn nợ.
    - Chức năng: Nhắc nợ, Ghi nhận thu nợ.
- **Trang Tổng quan (`/dashboard`)**:
    - Biểu đồ doanh thu.
    - Hoạt động mới nhất.
    - Phím tắt nhanh đến các module.
- **Quản lý Bán hàng (`/orders`)**:
    - Danh sách đơn hàng đã tạo.
    - **Lên đơn hàng nhanh (`/quick-order`)**:
        - Chọn khách hàng.
        - **Ngày lên đơn (Mới thêm)**.
        - Chọn sản phẩm (Grid boxes).
        - Tính toán VAT, phí vận chuyển, chiết khấu.
- **Quản lý Kho hàng (`/inventory`)**:
    - Danh sách sản phẩm, tồn kho, giá bán.
- **Quản lý Khách hàng (`/customers`)**:
    - Danh mục khách hàng, thông tin liên lạc.
- **Hệ thống Check-in (`/checkin`)**:
    - Bản đồ thời gian thực.
    - Form check-in với thời gian thực tế.
    - Danh sách hoạt động có lọc ngày và phân trang (5 mục/trang).

---

## 2. Luồng dữ liệu (Data Flow)

- **Cơ sở dữ liệu**: Firebase Firestore (Real-time).
- **Lưu trữ ảnh**: Google Drive (Thumbnail sync).
- **Xác thực**: Firebase Auth.

---

## 3. Các mục cần kiểm tra/làm tiếp (To-do)

- [ ] Nhập thêm các tệp mẫu mới từ khách hàng vào thư mục `mau_thiet_ke_moi`.
- [ ] Kiểm tra lại phần tính toán nợ thực tế từ Firestore (hiện đang dùng data mẫu).
- [ ] Hoàn thiện giao diện in phiếu đơn hàng.
- [ ] Kết nối dữ liệu kho hàng thực tế vào form lên đơn.

*Ghi chú: File `upload_script.gs` và `.env` đã được loại bỏ khỏi GitHub để bảo mật.*
