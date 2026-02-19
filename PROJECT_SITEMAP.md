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
    - **Vị trí & Giờ làm**: Cấu hình tọa độ GPS, bán kính chấm công (Geofencing) và giờ làm việc chính thức.
    - **Quản lý Nhân sự**: Mời nhân viên qua email, quản lý vai trò (Sale, Kho, Kế toán).
    - **Bảng công Tổng hợp** 🆕: Theo dõi giờ vào/ra văn phòng, giờ check-in đầu/cuối của nhân viên thị trường và quản lý yêu cầu Nghỉ/Đi muộn.
    - **Chia sẻ bảng công**: Cho phép chia sẻ quyền xem dữ liệu chấm công cho Kế toán qua email.
    - **Phân quyền Truy cập (RBAC)**: Bật/tắt chức năng cụ thể cho từng nhân viên.
    - **Nhật ký Hoạt động**: Theo dõi lịch sử thao tác hệ thống.
- **Trang Chấm công Di động (`/attendance`)** 🆕:
    - Chấm công vào/ra dựa trên định vị GPS (Geofencing).
    - Khóa chấm công theo thiết bị (Fingerprint ID) để chống gian lận.
    - **Đăng ký Nghỉ/Đi muộn**: Gửi yêu cầu kèm lý do trực tiếp từ ứng dụng.
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
- **Quản lý Tài chính (`/finance`)** 🆕:
    - **Sổ quỹ nội bộ**: Theo dõi thu chi vận hành, lương, nhập hàng và số dư thực tế.
    - **Báo cáo Tuổi nợ (Debt Aging)**: Phân loại nợ quá hạn theo các mốc 30-60-90 ngày để đánh giá rủi ro tài chính.
    - **Lợi nhuận chi tiết**: Thống kê doanh thu, giá vốn và lợi nhuận gộp trên từng đơn hàng đã chốt.
- **Hệ thống Đào tạo (`/khoa-dao-tao`)** 🎓:
    - **Hands-on Practice**: Thực hành trực tiếp trên dữ liệu thật của chính người dùng.
    - **Môi trường Interactive Lab**: Chia đôi màn hình, hướng dẫn chi tiết từng bước.
    - **Real-time Scoring**: Tự động chấm điểm bằng cách truy vấn dữ liệu thực tế gắn với `ownerId`.
    - **Chứng chỉ Digital**: Cấp chứng chỉ ngay sau khi hoàn thành các nhiệm vụ trong bài Lab.
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
- [x] **Nhập liệu hàng loạt (Bulk Import) + Google Sheets**: Hỗ trợ nhập danh sách Khách hàng/Sản phẩm từ Excel và trực tiếp từ link Google Sheets. Tự động xử lý tọa độ vị trí từ một cột duy nhất (Lat, Lng). **Cải tiến**: Chuyển đổi cơ chế lấy dữ liệu sang XLSX để tránh lỗi định dạng CSV, tích hợp bộ lọc số thông minh hỗ trợ dấu phẩy thập phân kiểu Việt Nam (VD: 0,3).
- [x] **Sao lưu Google Sheets Tự động (Sync to Sheets)**: Cho phép Admin tự động khởi tạo file Google Sheets riêng và đẩy toàn bộ dữ liệu (Khách hàng, Sản phẩm, Đơn hàng) từ Firestore về để lưu trữ dự phòng hoặc xử lý báo cáo nâng cao.
- [x] **Ổn định hóa Bản đồ & Định vị**: Khắc phục triệt để lỗi trắng bản đồ trên PC, tối ưu hóa nút "Vị trí hiện tại" với cơ chế Timeout và thông báo lỗi chi tiết. Tương thích hoàn toàn React-Leaflet v5.
- [x] **Cải thiện UI/UX & Độ tin cậy**: Thay thế hộp thoại xóa mặc định bằng xác nhận in-line cao cấp. Bảo vệ ứng dụng khỏi các lỗi crash do dữ liệu không đúng định dạng (tên khách hàng là số) tại các view Công nợ và Đơn hàng.
- [x] **Dọn dẹp mã nguồn (Cleanup)**: Đã gỡ bỏ toàn bộ console.log/error dư thừa và tối ưu hóa logic state/effects.
- [x] **Tối ưu Safari (Phase 2)**: Đã khắc phục triệt để lỗi trắng bản đồ trên Safari bằng cách ép chiều cao container và sửa lỗi flexbox.
- [x] **Sửa lỗi Firestore Index**: Loại bỏ hoàn toàn lỗi "failed-precondition" bằng cách chuyển sang lọc và sắp xếp dữ liệu phía Client cho các module: Thông báo, Nhật ký hoạt động, Đơn hàng, Công nợ.
- [x] **Tích hợp Mã Chuyển Khoản**: Tự động tạo và hiển thị mã chuyển khoản (DVX...) trong QR thanh toán và quản lý yêu cầu nạp tiền (Nexus Control).
- [x] **Thực thi phân quyền toàn diện**: Đã áp dụng cho Dashboard, Đơn hàng, Kho hàng, Khách hàng, Công nợ và Check-in.
- [x] **Quản lý Gói dịch vụ (Subscription)**: Tích hợp hệ thống kiểm soát dùng thử (Trial) và khóa tính năng cao cấp (Pro). Hiển thị chi tiết tên gói (Tháng/Năm) và **số ngày còn lại** đồng bộ từ Nexus Control.
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
- [x] **Tối ưu UX Lên đơn trên Di động**: Hiển thị mặc định nút xóa sản phẩm và tăng kích thước vùng nhấp trên thiết bị cảm ứng để thao tác nhanh và chính xác hơn.
- [x] **Nexus Control & Smart Billing**: 
    - Nâng cấp giao diện Nexus Control đáp ứng mọi màn hình (Responsive).
    - Triển khai cột **"Ngày vào trang"** (Joined Date) thay cho Ngày hết hạn, tự động reset mốc khi cập nhật gói (Mail xác nhận).
    - Cột **Gói đăng ký chuyên sâu**: Tích hợp menu xổ xuống (FREE, 1 THÁNG, 1 NĂM).
    - Hệ thống **Auto-Lock (Tự động khóa)**: Tự động khóa các tính năng Đơn hàng, Công nợ, Đồng bộ Sheets dựa theo thời gian sử dụng (FREE: 60 ngày, 1 THÁNG: 30 ngày, 1 NĂM: 365 ngày).
- [x] **Cấu hình Bảo mật chuN A+ (Security Refinement)**: 
    - Tinh chỉnh chính sách CSP để hỗ trợ hiển thị hình ảnh từ DiceBear SVG API cho Trung tâm đào tạo.
    - Cho phép kết nối và nạp script Google Analytics / Tag Manager theo tiêu chuẩn bảo mật cao nhất qua `vercel.json`.
- [x] **Báo Giá Niêm Yết chuyên nghiệp (Inventory Pro)**: Tích hợp cơ chế nhập dữ liệu từ Excel/Google Sheets, quản lý lịch sử đa bản giá trên Firestore. Hỗ trợ thu phóng thông minh (60%-85%-100%) và ép khung Desktop trên Mobile giúp chụp ảnh màn hình tờ báo giá trọn vẹn, không bị nhảy dòng. Tinh chỉnh giao diện cao cấp với tiêu đề cột siêu tương phản (Slate-950).
- [x] **Xác thực & Bảo mật Đăng nhập (Auth & Security)**: Khắc phục triệt để lỗi "missing initial state" và "invalid action" trên mọi thiết bị. Tối ưu hóa CSP & COOP headers cho Firebase Auth. Tích hợp thanh trạng thái đăng nhập chi tiết và cơ chế tự động chuyển đổi giữa Popup/Redirect thông minh giúp người dùng luôn vào được hệ thống dù là trên trình duyệt Zalo, Safari hay Chrome.
- [x] **Tối ưu Báo Giá Di động (Price List Mobile Optimization)**: Tinh chỉnh giao diện Chi tiết báo giá siêu gọn nhẹ và chuyên nghiệp trên điện thoại. Tối ưu hóa kích thước bảng giá, hỗ trợ xuống dòng thông minh và hệ thống Zoom Pill cao cấp giúp chụp ảnh màn hình báo giá trọn vẹn.
- [x] **Phân trang & Tìm kiếm Mobile thông minh (UX Refinement)**:
    - **Phân trang (Pagination)**: Áp dụng cho danh sách Sản phẩm (10 mục/trang), giúp tăng tốc độ tải và giao diện gọn gàng. Tự động reset về trang 1 khi tìm kiếm.
    - **Tìm kiếm Mobile 1-chạm**: Tích hợp nút tìm kiếm trực tiếp vào thanh điều hướng dưới cùng cho các trang Sản phẩm và Đơn hàng. Tự động focus và mở bàn phím ngay khi nhấn.
    - **Điều hướng theo ngữ cảnh**: Tùy chỉnh menu di động linh hoạt: Trang Khách hàng có nút "Bản đồ", trang Kho có nút "Lịch sử kho", tất cả các module chính đều tích hợp sẵn nút "Nhập Excel" nhanh.
- [x] **Báo cáo & Phân tích thời gian thực (Dashboard Live)**: 
    - **Doanh thu & Lợi nhuận**: Tự động tính toán Doanh thu và Lợi nhuận gộp (giá bán - giá nhập) theo ngày và theo tháng từ dữ liệu thực tế của Firestore.
    - **Biểu đồ Tăng trưởng**: Chuyển đổi biểu đồ tĩnh sang biểu đồ động, hiển thị doanh thu 7 ngày gần nhất với cơ chế tự động cân bằng tỷ lệ (Auto-scale).
    - **Nhật ký Hoạt động (Home Activity)**: Hiển thị 5 hoạt động mới nhất của nhân viên ngay tại trang chủ, hỗ trợ nhảy nhanh đến nhật ký chi tiết trong phần Quản trị thông qua tham số URL (?tab=audit).
- [x] **Đào tạo & Hệ thống Chứng chỉ (Training & Certification)**:
    - **Lab 04 (Đối soát & Tài chính)**: Hoàn thiện bài thực hành cuối cùng về ghi nhận thu nợ, đồng bộ và đối soát dữ liệu trên Google Sheets thông qua câu hỏi trắc nghiệm động (Dynamic Quizzes) quét dữ liệu thực.
    - **Hệ thống Chứng chỉ (Badges System)**: Kích hoạt hệ thống huy chương (Nhập môn -> Bậc thầy) tự động mở khóa dựa trên tổng điểm kỹ năng thực tế tích lũy từ các bài Lab.
    - **Real-time Scoring**: Tích hợp cơ chế chấm điểm và tự động lưu (Auto-save) tiến độ vào Firestore, đồng bộ hiển thị điểm số và huy chương ngay tại trang danh mục đào tạo.
    - **Tối ưu Mobile (Responsive Training)**: Khắc phục triệt để lỗi tràn dòng cho các mã ID dài, tối ưu sidebar hướng dẫn dạng stack linh hoạt cho điện thoại, đảm bảo trải nghiệm đào tạo mượt mà trên mọi thiết bị.
- [x] **Hệ thống Chấm công & Quản lý Nhân sự (Attendance & HR)**:
    - **Mobile Check-in**: Chấm công thời gian thực dựa trên Geofencing (GPS) và nhận diện thiết bị duy nhất (Device Fingerprint) để chống chấm công hộ.
    - **Đăng ký Nghỉ/Đi muộn**: Hệ thống gửi yêu cầu kèm lý do trực tiếp từ ứng dụng dành cho nhân viên.
    - **Bảng công Tổng hợp**: Tự động tổng hợp giờ làm văn phòng và lịch sử viếng thăm khách hàng (Thị trường) vào một bảng duy nhất cho Admin. Hỗ trợ **phân trang (10 dòng/trang)** và **bộ lọc ngày** thông minh.
    - **Phân quyền Chia sẻ**: Cho phép cấp quyền xem bảng công cho Kế toán/Quản lý một cách bảo mật.
    - **Tối ưu Mobile Admin**: Giao diện Tab trượt ngang, các bảng điều khiển và bộ lọc được thiết kế lại dạng cột/stack cho điện thoại. Thanh điều hướng (Bottom Nav) thay đổi linh hoạt các nút tắt (Thêm NV, Chấm công, Nhân sự, Phân quyền) khi Admin truy cập trang quản trị.
- [x] **UI/UX Refinement (Sidebar & Notifications)**: Khắc phục lỗi hiển thị thông báo bị che khuất trên PC bằng cơ chế mở ngược lên (Placement Up) và căn lề thông minh (Align Left).
- [x] **Hệ thống Tài liệu & Hướng dẫn (User Education)**: Xây dựng bộ "Cẩm nang vận hành chi tiết" 6 bước (Khách hàng, Sản phẩm, Đơn hàng, Công nợ, Báo giá, Checkin) tích hợp ngay trong Cài đặt. Bổ sung chính sách Bảo mật, Quyền GPS và thông tin minh bạch về gói dịch vụ (Premium vs Free).
- [x] **Cấu trúc Giá & Thanh toán (Billing & QR)**: Cập nhật phí thuê bao Premium mới (199k/tháng & 1.5tr/năm). Tích hợp hệ thống thanh toán qua VietinBank với QR Code tự động điền số tiền và nội dung định danh.
- [x] **Điều hướng Thông minh theo Ngữ cảnh (Smart Navigation)**:
    - **Trung tâm Đào tạo**: Tùy biến nút chính thành "Kết thúc Lab" và các mục menu thành Tồn kho chuyên sâu, Vận hành, Tài chính.
    - **Trang Cài đặt**: Tích hợp phím tắt nhanh trên Bottom Nav bao gồm: Bật/tắt Chế độ tối (FAB chính), nhảy nhanh đến Gói dịch vụ, Cẩm nang vận hành và nút Đăng xuất trực tiếp.
- [x] **Hệ thống Định danh & Quét mã QR (QR System Pro)**:
    - **Định danh duy nhất**: Mỗi sản phẩm được gắn một mã QR duy nhất dựa trên **Firestore ID**, loại bỏ hoàn toàn việc trùng lặp khi nhiều sản phẩm dùng chung mã SKU.
    - **In Tem QR**: Tích hợp chức năng in tem sản phẩm chuyên nghiệp ngay từ trình xem chi tiết, hỗ trợ dán nhãn vật lý trong kho.
    - **Quét mã Tra cứu Nhanh**: Tích hợp nút quét mã QR toàn cục tại Trang chủ và trang Sản phẩm, cho phép nhảy thẳng đến chi tiết sản phẩm chỉ với 1 lần quét.
    - **Lên đơn bằng QR**: Tối ưu hóa trình quét tại trang Lên đơn hàng, hỗ trợ nhận diện ID sản phẩm tức thì để tự động điền thông tin và quản lý tồn kho chính xác.
    - **Công nghệ Local QR**: Sử dụng thư viện `qrcode.react` để tạo mã QR trực tiếp tại phía Client, đảm bảo tốc độ tải tức thì, bảo mật dữ liệu và không phụ thuộc vào Internet hay dịch vụ bên ngoài.
- [x] **Tìm kiếm & Trải nghiệm Lên đơn (Search & UX)**:
    - **Tìm kiếm Đa năng**: Hỗ trợ tìm kiếm khách hàng theo **Tên doanh nghiệp (Business Name)**, tên cá nhân và số điện thoại đồng nhất tại các module Lên đơn, Công nợ và Danh sách đơn hàng.
    - **Lưu trữ Thông tin**: Tự động lưu và hiển thị tên doanh nghiệp trong chi tiết đơn hàng giúp kế toán đối soát chính xác.
- [x] **Cảnh báo & Phân tích thông minh (System Alerts)**:
    - **Dự báo Hết kho (Low Stock Velocity)**: Tự động phân tích tốc độ bán hàng trong 30 ngày để cảnh báo các sản phẩm sắp hết kho trong vòng 7 ngày tới.
    - **Nhắc nợ Tự động (Debt Aging)**: Hệ thống tự động quét và gửi thông báo nhắc thu hồi công nợ cho các đơn hàng đã chốt quá 6 ngày mà vẫn chưa thanh toán đủ.
    - **Trung tâm Thông báo**: Tích hợp biểu tượng trực quan (⚠️, 💰) vào nút chuông thông báo giúp Admin nắm bắt tình hình kinh doanh tức thì.
- [x] **PWA & Offline Support**:
    - **Cài đặt như Mobile App**: Hỗ trợ cài đặt vào màn hình chính (Add to Home Screen) trên cả iOS và Android với giao diện standalone chuyên nghiệp.
    - **Hoạt động Offline**: Kích hoạt bộ nhớ đệm Firestore Persistence cho phép xem dữ liệu khách hàng, sản phẩm và công nợ ngay cả khi không có mạng. Tự động đồng bộ dữ liệu khi kết nối lại.
    - **Cập nhật Thông minh**: Hệ thống Reload Prompt thông báo ngay khi có bản cập nhật mới hoặc khi ứng dụng đã sẵn sàng chạy Offline.
- [x] **Quản lý Tài chính nâng cao (Advanced Finance)**: Tích hợp Sổ quỹ, Báo cáo Tuổi nợ, Lợi nhuận chi tiết và **Bộ lọc thời gian (Từ ngày - Đến ngày)** đồng bộ trên toàn bộ module.

### 📝 Cần làm tiếp (To-do)
- [ ] **Báo cáo & Xuất dữ liệu (Finance Pro)**: Tích hợp nút xuất báo cáo Sổ quỹ và Lợi nhuận ra file Excel/PDF theo khoảng thời gian tùy chọn.
- [ ] **Ký nhận điện tử (E-Signature)**: Cho phép khách hàng ký nhận trực tiếp trên màn hình di động khi giao hàng; tích hợp chữ ký vào Phiếu giao hàng.
- [ ] **Tự động hóa quy trình (Automation)**: Gửi thông báo nhắc nợ hoặc ảnh hóa đơn qua Zalo/Messenger nhanh chỉ với 1 lần nhấp.
- [ ] **Dòng thời gian khách hàng (CRM Pro)**: Hiển thị toàn bộ lịch sử Giao dịch - Thanh toán - Checkin của từng khách hàng trên 1 trục thời gian (Timeline).
- [ ] **Dự báo dòng tiền (AI Forecast)**: Phân tích lịch sử thu chi để dự báo số dư khả dụng trong 30 ngày tiếp theo.
- [ ] **Hệ thống KPI & Phân vùng**: Thống kê doanh số theo nhân viên để tính hoa hồng và phân chia khách hàng theo tuyến bán hàng.
- [ ] **Smart Search**: Tìm kiếm nhanh bằng gợi ý thông minh dựa trên hành vi người dùng.

*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
