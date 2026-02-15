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
- **Báo Giá Niêm Yết (`/price-list`)**:
    - Quản lý lịch sử nhiều bản báo giá (Firestore), hỗ trợ Lưu/Xóa linh hoạt.
    - Chế độ "Desktop trên Mobile" & Thu phóng (60%-100%) để chụp ảnh toàn bộ bảng giá.
    - Giao diện in ấn Premium, tự động khớp thông tin doanh nghiệp.

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
- [x] **Sao lưu Google Sheets Tự động (Sync to Sheets)**: Cho phép Admin tự động khởi tạo file Google Sheets riêng và đẩy toàn bộ dữ liệu (Khách hàng, Sản phẩm, Đơn hàng) từ Firestore về để lưu trữ dự phòng hoặc xử lý báo cáo nâng cao.
- [x] **Ổn định hóa Bản đồ & Định vị**: Khắc phục triệt để lỗi trắng bản đồ trên PC, tối ưu hóa nút "Vị trí hiện tại" với cơ chế Timeout và thông báo lỗi chi tiết. Tương thích hoàn toàn React-Leaflet v5.
- [x] **Cải thiện UI/UX & Độ tin cậy**: Thay thế hộp thoại xóa mặc định bằng xác nhận in-line cao cấp. Bảo vệ ứng dụng khỏi các lỗi crash do dữ liệu không đúng định dạng (tên khách hàng là số) tại các view Công nợ và Đơn hàng.
- [x] **Dọn dẹp mã nguồn (Cleanup)**: Đã gỡ bỏ toàn bộ console.log/error dư thừa và tối ưu hóa logic state/effects.
- [x] **Tối ưu Safari (Phase 2)**: Đã khắc phục triệt để lỗi trắng bản đồ trên Safari bằng cách ép chiều cao container và sửa lỗi flexbox.
- [x] **Sửa lỗi Firestore Index**: Loại bỏ hoàn toàn lỗi "failed-precondition" bằng cách chuyển sang lọc và sắp xếp dữ liệu phía Client cho các module: Thông báo, Nhật ký hoạt động, Đơn hàng, Công nợ.
- [x] **Tích hợp Mã Chuyển Khoản**: Tự động tạo và hiển thị mã chuyển khoản (DVX...) trong QR thanh toán và quản lý yêu cầu nạp tiền (Nexus Control).
- [x] **Thực thi phân quyền toàn diện**: Đã áp dụng cho Dashboard, Đơn hàng, Kho hàng, Khách hàng, Công nợ và Check-in.
- [x] **Quản lý Gói dịch vụ (Subscription)**: Tích hợp hệ thống kiểm soát dùng thử (Trial) và khóa tính năng cao cấp (Pro).
- [x] **Ổn định hóa Giao diện Điều hướng (Bottom Nav & Top Bar)**: Khắc phục triệt để hiện tượng nháy (flickering) và tự động ẩn khi cuộn. Chuyển sang cơ chế hiển thị cố định (Pinned) giúp người dùng truy cập menu nhanh chóng và mượt mà hơn trên mọi thiết bị di động.
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
- [x] **Quản lý Kho nâng cao (Inventory Pro)**: Tích hợp cơ chế liên kết sản phẩm (Linked Products) cho phép nhiều mã giá dùng chung 1 kho. Hệ thống tự động trừ kho từ sản phẩm gốc khi bán sản phẩm liên kết.
- [x] **Lịch sử Giao dịch Kho (Inventory Logs)**: Ghi lại chi tiết mọi biến động kho: Nhập khởi tạo, Xuất đơn hàng, Điều chuyển và Đối soát.
- [x] **Điều chuyển Kho nội bộ**: Cho phép luân chuyển số lượng giữa các mặt hàng khác nhau với nhật ký đối soát chi tiết.
- [x] **Đối soát & Kiểm kho Định kỳ**: Hệ thống kiểm kê thực tế, tự động tính chênh lệch và cập nhật số dư kho với lý do điều chỉnh cụ thể.
- [x] **Nâng cấp Bảo mật (Security Pro)**: Tối ưu hóa CSP, chặn Clickjacking và XSS theo tiêu chuẩn Mozilla HTTP Observatory thông qua `vercel.json`.
- [x] **Ổn định hóa Nhập liệu & Kết nối**: Khắc phục lỗi "Failed to fetch" khi nhập liệu từ Google Sheets và tối ưu hóa kết nối Real-time cho Firebase bằng cách tinh chỉnh chính sách CSP.
- [x] **Nexus Control & Feature Locking**: Nâng cấp giao diện Nexus Control đáp ứng mọi màn hình. Triển khai cơ chế khóa tính năng Google Sheets Sync linh hoạt (toàn hệ thống cho user Free hoặc thủ công cho từng doanh nghiệp).
- [x] **Báo Giá Niêm Yết chuyên nghiệp (Inventory Pro)**: Tích hợp cơ chế nhập dữ liệu từ Excel/Google Sheets, quản lý lịch sử đa bản giá trên Firestore. Hỗ trợ thu phóng thông minh (60%-85%-100%) và ép khung Desktop trên Mobile giúp chụp ảnh màn hình tờ báo giá trọn vẹn, không bị nhảy dòng. Tinh chỉnh giao diện cao cấp với tiêu đề cột siêu tương phản (Slate-950).
- [x] **Xác thực & Bảo mật Đăng nhập (Auth & Security)**: Khắc phục triệt để lỗi "missing initial state" và "invalid action" trên mọi thiết bị. Tối ưu hóa CSP & COOP headers cho Firebase Auth. Tích hợp thanh trạng thái đăng nhập chi tiết và cơ chế tự động chuyển đổi giữa Popup/Redirect thông minh giúp người dùng luôn vào được hệ thống dù là trên trình duyệt Zalo, Safari hay Chrome.
- [x] **Tối ưu Báo Giá Di động (Price List Mobile Optimization)**: Tinh chỉnh giao diện Chi tiết báo giá siêu gọn nhẹ và chuyên nghiệp trên điện thoại. Tối ưu hóa kích thước bảng giá, hỗ trợ xuống dòng thông minh và hệ thống Zoom Pill cao cấp giúp chụp ảnh màn hình báo giá trọn vẹn.
- [x] **Phân trang & Tìm kiếm Mobile thông minh (UX Refinement)**:
    - **Phân trang (Pagination)**: Áp dụng cho danh sách Sản phẩm (10 mục/trang), giúp tăng tốc độ tải và giao diện gọn gàng. Tự động reset về trang 1 khi tìm kiếm.
    - **Tìm kiếm Mobile 1-chạm**: Tích hợp nút tìm kiếm trực tiếp vào thanh điều hướng dưới cùng cho các trang Sản phẩm và Đơn hàng. Tự động focus và mở bàn phím ngay khi nhấn.
    - **Điều hướng theo ngữ cảnh**: Tùy chỉnh menu di động linh hoạt: Trang Khách hàng có nút "Bản đồ", trang Kho có nút "Lịch sử kho", tất cả các module chính đều tích hợp sẵn nút "Nhập Excel" nhanh.

### 📝 Cần làm tiếp (To-do)
- [ ] **Báo cáo & Phân tích thông minh (Dashboard Pro)**: Chuyển đổi biểu đồ sang dữ liệu thực, tự động tính lợi nhuận gộp và cảnh báo hàng sắp hết kho.
- [ ] **Tự động hóa quy trình (Automation)**: Gửi thông báo nhắc nợ qua Zalo/SMS API và tích hợp nút chia sẻ hóa đơn nhanh cho khách hàng.
- [ ] **PWA & Offline Support**: Cài đặt ứng dụng vào màn hình chính và hỗ trợ xem dữ liệu cơ bản khi mất kết nối mạng.
- [ ] **Quản lý Tài chính nâng cao**: Thêm sổ quỹ nội bộ quản lý chi phí vận hành và báo cáo phân loại tuổi nợ (30-60-90 ngày).
- [ ] **Hệ thống KPI & Phân vùng**: Thống kê doanh số theo nhân viên để tính hoa hồng và phân chia khách hàng theo tuyến bán hàng.
- [ ] **Smart Search**: Tìm kiếm nhanh bằng giọng nói hoặc gợi ý thông minh dựa trên hành vi người dùng.

*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
