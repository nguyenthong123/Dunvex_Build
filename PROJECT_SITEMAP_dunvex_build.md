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
    - **Lập kế hoạch & Đánh giá KPI** 🆕: Hệ thống thiết lập chỉ tiêu tháng (lương cứng, số lượt check-in, chỉ tiêu sản phẩm SKU) và tự động tính toán hiệu suất, thưởng/phạt lương thực tế cho nhân viên.
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
- **Lưu trữ ảnh**: Cloudinary (High performance, CDN optimized).
- **Xác thực**: Firebase Auth.
- **Phân quyền (RBAC)**: Thực thi nghiêm ngặt trên toàn bộ Router và Component.
- **Bảo mật HTTP (Standard A+)**: Đã triển khai CSP, XFO, HSTS qua `vercel.json` để ngăn chặn XSS và Clickjacking.
- **Backend Script**: Google Apps Script xử lý upload và email mời nhân viên.

---

## 4. Các mục đã hoàn thành & Cần làm (To-do)

### ✅ Đã hoàn thành (Done)
- [x] **Nhập liệu hàng loạt (Bulk Import) Thông minh**: 
    *   **Smart Update & Anti-Overwrite**: Tự động nhận diện sản phẩm dựa trên bộ đôi **[Mã SKU/Tên + Danh mục]**. Cơ chế này cho phép nhập nhiều bảng giá (Niêm yết, Chủ nhà, Thợ...) cho cùng một loại sản phẩm mà không bị ghi đè dữ liệu cũ.
    *   **Bảo toàn dữ liệu (Partial Update)**: Hệ thống chỉ cập nhật những cột có trong file Excel, giữ nguyên các thông tin cũ (như số lượng tồn kho) nếu cột đó bị thiếu trong lần nhập sau.
    *   **Giải mã Tiêu đề linh hoạt**: Tự động nhận diện các tiêu đề cột như "Ngành hàng", "Danh mục", "Nhóm", "SĐT", "Điện thoại"... giúp người dùng không cần chỉnh sửa file Excel trước khi tải lên.
    *   **Xử lý Số liệu chuyên sâu**: Bộ lọc thông minh tự động loại bỏ ký tự tiền tệ (đ, VND), xử lý chính xác dấu chấm hàng nghìn và dấu phẩy thập phân kiểu Việt Nam.
    *   **Google Sheets Pro**: Chuyển đổi sang cơ chế xuất XLSX giúp giữ nguyên định dạng dữ liệu và hỗ trợ lấy chính xác từng trang tính (GID) từ link.
- [x] **Tối ưu Lên đơn & Danh mục (Quick Order UX)**:
    *   **Đổi tên Ngành hàng -> Danh mục**: Thống nhất thuật ngữ "Danh mục" trên toàn bộ ứng dụng để dễ hiểu hơn.
    *   **Cơ chế Lọc tinh gọn**: Loại bỏ việc trộn lẫn tiêu đề Báo giá vào danh sách chọn sản phẩm. Giờ đây, danh mục và sản phẩm chỉ được lấy 100% từ dữ liệu thực tế trong Kho hàng, đảm bảo sự sạch sẽ và chính xác về giá/tồn kho.
    *   **Sắp xếp Alphabet**: Tự động sắp xếp danh sách danh mục theo thứ tự A-Z giúp tìm kiếm nhanh chóng.
- [x] **Sao lưu Google Sheets Tự động (Sync to Sheets)**: 
    *   **Đồng bộ đa năng**: Cho phép Admin tự động hoặc chủ động đẩy toàn bộ dữ liệu (Khách hàng, Sản phẩm, Đơn hàng) từ Firestore về Google Sheets.
    *   **Báo cáo Đa nền tảng**: Tích hợp thông báo email tự động mỗi khi đồng bộ thành công.
    *   **Phân tích Hiệu suất**: Email báo cáo bao gồm bảng tổng hợp doanh thu, số lượng đơn hàng và khách hàng mới theo từng nhân viên trong khoảng thời gian đồng bộ.
    *   **Linh hoạt thời gian**: Hỗ trợ các mốc Hàng tuần, Hàng tháng và Hàng quý với cơ chế tự động tính toán khoảng ngày chính xác.
- [x] **Ổn định hóa Bản đồ & Định vị**: Khắc phục triệt để lỗi trắng bản đồ trên PC, tối ưu hóa nút "Vị trí hiện tại" với cơ chế Timeout và thông báo lỗi chi tiết. Tương thích hoàn toàn React-Leaflet v5.
- [x] **Cải thiện UI/UX & Độ tin cậy**: Thay thế hộp thoại xóa mặc định bằng xác nhận in-line cao cấp. Bảo vệ ứng dụng khỏi các lỗi crash do dữ liệu không đúng định dạng (tên khách hàng là số) tại các view Công nợ và Đơn hàng.
- [x] **Dọn dẹp mã nguồn (Cleanup)**: Đã gỡ bỏ toàn bộ console.log/error dư thừa và tối ưu hóa logic state/effects.
- [x] **Tối ưu Safari (Phase 2)**: Đã khắc phục triệt để lỗi trắng bản đồ trên Safari bằng cách ép chiều cao container và sửa lỗi flexbox.
- [x] **Sửa lỗi Firestore Index**: Loại bỏ hoàn toàn lỗi "failed-precondition" bằng cách chuyển sang lọc và sắp xếp dữ liệu phía Client cho các module: Thông báo, Nhật ký hoạt động, Đơn hàng, Công nợ.
- [x] **Tích hợp Mã Chuyển Khoản**: Tự động tạo và hiển thị mã chuyển khoản (DVX...) trong QR thanh toán và quản lý yêu cầu nạp tiền (Nexus Control).
- [x] **Thực thi phân quyền toàn diện**: Đã áp dụng cho Dashboard, Đơn hàng, Kho hàng, Khách hàng, Công nợ và Check-in.
- [x] **Quản lý Gói dịch vụ (Subscription)**: Tích hợp hệ thống kiểm soát dùng thử (Trial) và khóa tính năng cao cấp (Pro). Hiển thị chi tiết tên gói (Tháng/Năm) và **số ngày còn lại** đồng bộ từ Nexus Control.
- [x] **Ổn định hóa Giao diện Điều hướng (Bottom Nav & Top Bar)**: Khắc phục triệt để hiện tượng nháy (flickering) và tự động ẩn khi cuộn. Chuyển sang cơ chế hiển thị cố định (Pinned) giúp người dùng truy cập menu nhanh chóng và mượt mà hơn trên mọi thiết bị di động.
- [x] **Redesign Mobile Header & Navigation (Feb 21)**: 
    - **Header Premium**: Chuyển sang giao diện trắng (Glassmorphism), căn giữa logo DunvexBuild và tối ưu hóa hiển thị trên mọi nền tảng di động.
    - **Bottom Nav 5-nút**: Tinh chỉnh hệ thống 5 nút điều động (Dynamic Items) with nút trung tâm nổi bật, hỗ trợ Label tiếng Việt viết hoa sang trọng và hiệu ứng active tinh tế.
- [x] **Hệ thống Mã Giảm Giá & Thanh toán (Feb 22 Updates)**:
    *   **Bảo mật Mã giảm giá (Promo Security)**: Tích hợp cơ chế kiểm tra mã SKU theo định dạng chuẩn `XX-000` (VD: DV-476). Hệ thống truy vấn trực tiếp kho sản phẩm của tài khoản Admin `dunvex.green@gmail.com` để lấy giá trị chiết khấu.
    *   **Quản lý lượt dùng (Stock-based Promo)**: Sử dụng trường "Tồn kho" của sản phẩm giảm giá để giới hạn số lần sử dụng. Hệ thống tự động trừ kho ngay khi người dùng hoàn tất yêu cầu thanh toán.
    *   **Điều hướng thông minh**: Chỉ hiển thị phần nhập mã giảm giá cho **Gói Năm** để tối ưu hóa doanh thu và tăng giá trị đơn hàng trung bình.
    *   **Khắc phục hiển thị QR (VietQR Fix)**: Cập nhật chính sách bảo mật CSP cho tên miền `vietqr.io`, đảm bảo hình ảnh QR thanh toán luôn hiển thị sắc nét trên mọi thiết bị.
    *   **Ổn định hóa Thông báo Email**: Sửa lỗi logic gửi email về `dunvex.green@gmail.com` bằng cơ chế `no-cors`, đảm bảo yêu cầu kích hoạt dịch vụ của khách hàng luôn đến tay Admin tức thì.
- [x] **Tối ưu Chi tiết Khách hàng**: Chuyển đổi sang dạng Bottom Sheet mượt mà trên di động, hỗ trợ gọi điện trực tiếp từ ứng dụng.
- [x] **Bảo mật chuẩn A+**: Triển khai toàn diện CSP, XFO, HSTS, Referrer-Policy thông qua `vercel.json`.
- [x] **Lọc theo ngày (Date Filtering)**: Đã hoàn thiện bộ lọc ngày thực tế cho danh sách công nợ và bảng kê chi tiết khách hàng.
- [x] **In phiếu & Xuất PDF Chuyên nghiệp (Feb 23 Upgrade)**: 
    - **Đa trang (Multi-page Support)**: Tích hợp cơ chế tự động ngắt trang thông minh và lặp lại tiêu đề bảng cho Báo giá và Công nợ dài, đảm bảo bản in liền mạch và chuyên nghiệp.
    - **Cô lập Hiển thị (Visibility Isolation)**: Áp dụng kỹ thuật ẩn mờ toàn cục để loại bỏ hoàn toàn rác giao diện (thanh menu, nút bấm) khỏi bản in.
    - **Chuẩn hóa A4**: Ép cứng định dạng vùng in theo chuẩn giấy A4 quốc tế (210mm x 297mm) với lề an toàn cho máy in.
    - **Tối ưu Tỷ lệ (Scaling/Zoom)**: Tự động khử toàn bộ hiệu ứng thu phóng và animations của trình duyệt khi in để bản in luôn sắc nét và bắt đầu từ đỉnh trang giấy.
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
- [x] **Toastify Toàn bộ Thông báo (Global Notification System)**: Thay thế hoàn toàn 100% các hộp thoại `alert()` mặc định của trình duyệt bằng hệ thống Toast cao cấp. Đã triển khai trên toàn bộ 18 views và components chính, mang lại trải nghiệm người dùng hiện đại, đồng bộ và chuyên nghiệp.
- [x] **Nexus Control & Smart Billing**: 
    - Nâng cấp giao diện Nexus Control đáp ứng mọi màn hình (Responsive).
    - Triển khai cột **"Ngày vào trang"** (Joined Date) thay cho Ngày hết hạn, tự động reset mốc khi cập nhật gói (Mail xác nhận).
    - Cột **Gói đăng ký chuyên sâu**: Tích hợp menu xổ xuống (FREE, 1 THÁNG, 1 NĂM).
    - Hệ thống **Auto-Lock (Tự động khóa)**: Tự động khóa các tính năng Đơn hàng, Công nợ, Đồng bộ Sheets dựa theo thời gian sử dụng (FREE: 60 ngày, 1 THÁNG: 30 ngày, 1 NĂM: 365 ngày).
- [x] **Cấu hình Bảo mật chuN A+ (Security Refinement)**: 
    - Tinh chỉnh chính sách CSP để hỗ trợ hiển thị hình ảnh từ DiceBear SVG API cho Trung tâm đào tạo.
    - Cho phép kết nối và nạp script Google Analytics / Tag Manager theo tiêu chuẩn bảo mật cao nhất qua `vercel.json`.
- [x] **Báo Giá Niêm Yết chuyên nghiệp (Inventory Pro)**: Tích hợp cơ chế nhập dữ liệu từ Excel/Google Sheets, quản lý lịch sử đa bản giá trên Firestore. Hỗ trợ thu phóng thông minh (60%-85%-100%) và ép khung Desktop trên Mobile giúp chụp ảnh màn hình tờ báo giá trọn vẹn, không bị nhảy dòng. Tinh chỉnh giao diện cao cấp với tiêu đề cột siêu tương phản (Slate-950).
- [x] **Check-in Geofencing Pro (Feb 23)**: Khắc phục lỗi bỏ qua khoảng cách, hỗ trợ đa định dạng tọa độ (`lat`/`lng`, `latitude`/`longitude`) và ép kiểu số học để đảm bảo bán kính 50m luôn được thực thi nghiêm ngặt trên mọi thiết bị.
- [x] **Check-in Đa ảnh (Multi-photo Support)**: Cho phép nhân viên tải lên tối đa **3 ảnh hiện trường** trong một lần check-in. Tích hợp giao diện Preview dạng lưới, cho phép thêm/xóa ảnh linh hoạt và tự động tối ưu hiển thị trên Feed hoạt động.
- [x] **Xác thực & Bảo mật Đăng nhập (Auth & Security)**: Khắc phục triệt để lỗi "missing initial state" và "invalid action" trên mọi thiết bị. Tối ưu hóa CSP & COOP headers cho Firebase Auth. Tích hợp thanh trạng thái đăng nhập chi tiết và cơ chế tự động chuyển đổi giữa Popup/Redirect thông minh giúp người dùng luôn vào được hệ thống dù là trên trình duyệt Zalo, Safari hay Chrome.
- [x] **Tối ưu Báo Giá Di động (Price List Mobile Optimization)**: Tinh chỉnh giao diện Chi tiết báo giá siêu gọn nhẹ và chuyên nghiệp trên điện thoại. Tối ưu hóa kích thước bảng giá, hỗ trợ xuống dòng thông minh và hệ thống Zoom Pill cao cấp giúp chụp ảnh màn hình báo giá trọn vẹn.
- [x] **Tối ưu Lên đơn & Danh mục (Quick Order UX Refinement - Feb 23)**:
    *   **Decimal Quantity**: Hỗ trợ nhập số lượng thập phân (ví dụ: 2.255) bằng `step="any"` và cơ chế xử lý chuỗi linh hoạt.
    *   **Searchable Dropdowns**: Thay thế menu xổ xuống bằng bộ chọn Sản phẩm/Danh mục tích hợp tìm kiếm thông minh, hiển thị tồn kho trực tiếp.
    *   **UX Cải tiến**: Tự động xóa nội dung khi nhập mới thay vì mặc định số 10.
- [x] **Tích hợp Cloudinary (Image Storage Upgrade)**:
    *   **Di cư Hệ thống**: Chuyển toàn bộ hạ tầng lưu trữ từ Google Drive sang Cloudinary để tối ưu tốc độ và độ tin cậy.
    *   **Phân loại Thư mục**: Tự động tổ chức ảnh vào các thư mục `dunvex_products`, `dunvex_checkins`, và `dunvex_payments`.
    *   **Tương thích ngược**: Cơ chế `getImageUrl` thông minh hỗ trợ hiển thị song song ảnh cũ (Drive) và ảnh mới (Cloudinary).
- [x] **Quản lý Hồ sơ Khách hàng nâng cao (Customer CRM Pro)**:
    *   **Email & Tài liệu**: Hỗ trợ lưu trữ Email khách hàng và gửi email trực tiếp từ ứng dụng.
    *   **Giấy phép kinh doanh (GPKD) Đa tệp**: Tích hợp tải lên **nhiều tệp** (ảnh/PDF) giấy phép kinh doanh qua Cloudinary. Hỗ trợ hiển thị dạng lưới và danh sách chuyên nghiệp.
    *   **Hình ảnh Công trình**: Cho phép lưu trữ không giới hạn bộ sưu tập hình ảnh thực tế tại công trình/cửa hàng của khách hàng.
    *   **UX Cải tiến**: Form nhập liệu được tổ chức lại chuyên nghiệp, hỗ trợ xem chi tiết dạng Bottom Sheet trên di động với đầy đủ hình ảnh trực quan.
- [x] **Phiếu Giao Hàng & Đóng gói**:
    *   **Tính Kiện tự động**: Tự động tính toán tổng số Kiện dựa trên tỷ lệ đóng gói (`qty / packaging`) và hiển thị trên Phiếu giao hàng (Order Ticket).
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
- [x] **Tối ưu Mobile UI & Điều hướng (Feb 21 Refinement)**:
    - **Header & Nav Pro**: Nâng cấp Header Glassmorphism và Bottom Nav hỗ trợ Safe Area. Gỡ bỏ các wrapper dư thừa cho biểu tượng thông báo giúp giao diện thoáng hơn.
    - **Nút Trung tâm tối giản (Dynamic FAB)**: Rút gọn nút Center thành dạng hình tròn (Icon-only) màu cam nổi bật. Tối ưu logic: Hiện **"Lên đơn"** tại Trang chủ để thao tác nhanh, hiện **"Thu nợ"** tại trang Công nợ.
- [x] **Dọn dẹp & Tinh gọn Hệ thống**: Gỡ bỏ hoàn toàn tính năng Affiliate và hệ thống mã giảm giá (Coupon/Promo) trên toàn bộ ứng dụng (Pricing, Quick Order) để tối ưu hiệu suất.
- [x] **PWA Reliability**: Cập nhật cơ chế precache HTML giúp sửa lỗi điều hướng khi sử dụng Service Worker.
- [x] **Hệ thống Phân trang Chuyên nghiệp (Refined Pagination - Feb 23)**:
    *   **Đồng nhất hóa (Standardization)**: Áp dụng bộ điều khiển phân trang hiện đại (10 bản ghi/trang) trên toàn bộ hệ thống: **Khách hàng, Đơn hàng, Công nợ, Lịch sử báo giá, Sổ quỹ và Lợi nhuận**.
    *   **Điều hướng thông minh**: Cơ chế hiển thị "3 trang đầu - 3 trang cuối" kèm dấu ba chấm (ellipsis) và nút mũi tên, tối ưu cho tập dữ liệu lớn.
    *   **Trải nghiệm mượt mà**: Tự động quay về trang 1 khi lọc dữ liệu và tự động cuộn lên đầu trang khi chuyển trang.
- [x] **Cô lập dữ liệu & Phân quyền (Enterprise Data Security - Feb 24)**:
    *   **Data Isolation (Nhân viên)**: Triển khai cơ chế cô lập dữ liệu triệt để tại các module **Khách hàng, Đơn hàng, Công nợ và Dashboard**. Nhân viên chỉ xem và quản lý được dữ liệu do chính mình tạo ra (`createdByEmail`).
    *   **Phân quyền Quản lý Sản phẩm**: Thiết lập quyền Admin tối cao cho việc **Thêm/Sửa/Xóa/Nhập khẩu** sản phẩm. Nhân viên chỉ có quyền xem danh sách và sử dụng dữ liệu sản phẩm chung để lên đơn hàng.
    *   **Audit Logs Pro**: Tự động lọc nhật ký hoạt động theo người dùng. Nhân viên chỉ thấy lịch sử của mình, Admin quản lý toàn bộ vết (Trace) của hệ thống.
    *   **Chuẩn hóa Tìm kiếm (Normalization)**: Nâng cấp bộ lọc tìm kiếm sản phẩm hỗ trợ chuẩn hóa tiếng Việt (NFC) và không phân biệt hoa/thường, đảm bảo tìm kiếm chính xác tuyệt đối trên mọi nền tảng.
- [x] **Tối ưu Hệ thống Ưu đãi & Điều hướng (Feb 24 Updates)**:
    *   **Coupon Mobile UI Pro**: Nâng cấp toàn diện giao diện Quản lý mã giảm giá trên điện thoại. Chuyển đổi form tạo mã sang dạng Bottom Sheet cuộn thông minh, cố định nút bấm giúp thao tác cực kỳ mượt mà.
    *   **Dynamic Navigation Context**: Tự động thay đổi nhãn và icon nút Center thành **"Tạo mã mới"** khi người dùng truy cập trang Ưu đãi, giúp tăng tốc quy trình vận hành.
    *   **Deep Linking (URL Actions)**: Tích hợp tham số `?action=new` vào URL, cho phép mở nhanh trình tạo mã từ bất kỳ đâu (thanh điều hướng hoặc phím tắt).
    *   **Bảo mật & Ổn định (Bug Fixes)**: Khắc phục triệt để các lỗi Console (NaN values, syntax errors) và tối ưu hóa logic nhập liệu cho các trường giới hạn lượt dùng.
    *   **Clean Code & Performance**: Loại bỏ các import dư thừa và tối ưu hóa React state để ứng dụng phản hồi tức thì trên mọi thiết bị di động.

### 📝 Cần làm tiếp (To-do)

#### 🛡️ Bảo mật (Security)
- [ ] **Firestore Audit**: Kiểm tra và thắt chặt Security Rules, đảm bảo dữ liệu chỉ được truy cập bởi đúng `ownerId`.
- [ ] **Data Sanitation**: Triển khai lớp xác thực dữ liệu đầu vào (Zod/Yup) cho tất cả các form để ngăn chặn dữ liệu rác.
- [ ] **Masking**: Tự động che bớt thông tin nhạy cảm (SĐT, Email) trong các nhật ký hoạt động cho nhân viên.

#### ⚡ Hiệu suất & Mượt mà (Performance)
- [ ] **Lazy Loading Routines**: Chuyển đổi sang `React.lazy` và `Suspense` cho tất cả các Routes để giảm dung lượng tải trang đầu tiên.
- [ ] **List Virtualization**: Áp dụng `react-window` cho danh sách Khách hàng và Sản phẩm để xử lý mượt mà hàng ngàn bản ghi.
- [ ] **Cloudinary Dynamic Optimization**: Tự động thêm tham số `f_auto,q_auto` vào mọi link ảnh để tối ưu băng thông và tốc độ tải.
- [ ] **Query Limitation**: Tối ưu hóa các truy vấn Firestore, giới hạn số lượng bản ghi tải về mỗi lần (Pagination thực tế tại DB).

#### 🔔 Thông báo & Trải nghiệm (UX/UI)
- [ ] **Skeleton Loaders**: Thay thế các vòng xoay loading bằng hiệu ứng Shimmer (xương) giúp cảm giác tải trang "xịn" hơn.
- [ ] **Haptic Feedback**: Thêm rung phản hồi nhẹ trên di động khi quét QR thành công hoặc chốt đơn hàng.
- [ ] **Offline Banner**: Hiển thị thanh thông báo trạng thái "Đứt kết nối - Đang dùng dữ liệu ngoại tuyến" rõ ràng hơn.
- [ ] **Interactive Tour**: Thêm hướng dẫn ảo (Guided Tour) cho người dùng mới khi lần đầu truy cập các module phức tạp.

#### 📊 Chức năng bổ sung (Roadmap)
- [ ] **Báo cáo & Xuất dữ liệu (Finance Pro)**: Tích hợp nút xuất báo cáo Sổ quỹ và Lợi nhuận ra file Excel/PDF theo khoảng thời gian tùy chọn.
- [ ] **Ký nhận điện tử (E-Signature)**: Cho phép khách hàng ký nhận trực tiếp trên màn hình di động khi giao hàng; tích hợp chữ ký vào Phiếu giao hàng.
- [ ] **Tự động hóa Zalo/Messenger**: Gửi thông báo nhắc nợ hoặc ảnh hóa đơn nhanh chỉ với 1 lần nhấp.
- [ ] **Dòng thời gian khách hàng (CRM Pro)**: Hiển thị toàn bộ lịch sử Giao dịch - Thanh toán - Checkin của từng khách hàng trên 1 trục thời gian (Timeline).
- [ ] **Dự báo dòng tiền (AI Forecast)**: Phân tích lịch sử thu chi để dự báo số dư khả dụng trong 30 ngày tiếp theo.
- [ ] **Smart Search**: Tìm kiếm gợi ý thông minh dựa trên hành vi và lịch sử thao tác của người dùng.

*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
