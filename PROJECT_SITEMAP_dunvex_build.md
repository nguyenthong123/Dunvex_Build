# Sơ đồ Cấu trúc Ứng dụng Dunvex Build

Dưới đây là sơ đồ tóm tắt các trang và luồng dữ liệu chính để phục vụ việc kiểm tra và phát triển tiếp vào ngày mai.

## 0. Môi trường Phát triển (Development) 🚀
- **Địa chỉ Local**: `http://localhost:5173/`
- **Lưu ý**: Luôn triển khai trên cổng **5173** để tránh phải khai báo lại địa chỉ truy cập.

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
    *   **Nhận diện Toàn cục (Global ID)**: Tự động nhận diện sản phẩm dựa trên **[Mã SKU]** hoặc **[Tên]** trên toàn hệ thống (không phân biệt danh mục). Điều này giúp cập nhật giá hoặc thay đổi danh mục mà không tạo ra sản phẩm trùng lặp, đảm bảo một mã SKU chỉ có duy nhất một kho hàng thực tế.
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
- [x] **In phiếu & Xuất PDF Chuyên nghiệp (Feb 24 Upgrade - The Print Engine V2)**: 
    - **Cơ chế Popup Độc lập (Print to New Window)**: Chuyển đổi toàn bộ hệ thống in ấn sang cơ chế mở cửa sổ popup riêng biệt. Điều này giúp cách ly hoàn toàn Tờ Phiếu khỏi mã nguồn rác của ứng dụng (Sidebar, Nav), đảm bảo độ ổn định tuyệt đối 100% và không bao giờ bị trắng trang.
    - **Fix Lỗi In trên Di động (Mobile Print Fix)**: Tích hợp thẻ `<base>` để đồng bộ Style và khắc phục triệt để lỗi "Đã xảy ra sự cố" trên Android/iOS. Điều chỉnh logic đóng cửa sổ thông minh giúp quá trình tạo PDF trên di động mượt mà và không bị ngắt quãng.
    - **Cân bằng & Thẳng hàng Tuyệt đối**: Ép cấu trúc Grid 2 cột cho phần thông tin Khách hàng - Người lập phiếu, khắc phục triệt để lỗi "cái cao cái thấp" do trình duyệt tự ý co dãn.
    - **Chống lấp nội dung (Anti-Clipping)**: Gỡ bỏ giới hạn chiều cao và ép trạng thái `overflow: visible`, đảm bảo phần Tổng tiền và Chữ ký ở cuối phiếu luôn hiển thị đầy đủ, không bị cắt mất khi đơn hàng dài.
    - **Đa module (Order, Debt, Price)**: Áp dụng đồng bộ cho Phiếu giao hàng, Bảng kê công nợ và Báo giá hệ thống.
    - **Chuẩn hóa A4 & High Fidelity**: Ép cứng định dạng A4 (210mm) và bảo toàn 100% màu sắc, đường kẻ bảng sắc nét cho bản in và xuất PDF chuyên nghiệp.
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
- [x] **Dọn dẹp & Tinh gọn Hệ thống**: Gỡ bỏ tính năng Affiliate cũ. Hệ thống Mã giảm giá (Coupon) được tái thiết lập với cơ chế bảo mật mới phục vụ riêng cho Nâng cấp tài khoản.
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
- [x] **Tối ưu Kho & Trải nghiệm Đối tác (Feb 24 Final Refinement)**:
    *   **Inventory Sync (Chỉnh sửa/Xóa)**: Hoàn thiện logic đồng bộ kho tự động khi chỉnh sửa đơn hàng cũ (hoàn kho cũ - trừ kho mới) và tự động hoàn kho khi xóa đơn đơn hàng, đảm bảo tính nguyên tử (Atomicity) qua `writeBatch`.
    *   **Prioritize Business Name**: Nâng cấp UI đồng bộ trên các module **Công nợ, Đơn hàng, Khách hàng và Quick Order** để ưu tiên hiển thị **Tên cơ sở kinh doanh** lên hàng đầu, giúp nhận diện đối tác nhanh và chuyên nghiệp hơn.
    *   **Secure Coupon System (Plan Upgrade)**: Tái thiết lập hệ thống mã giảm giá bảo mật cho nâng cấp tài khoản (Gói Năm). Kiểm tra 4 điều kiện: Mã khớp, Chủ sở hữu hệ thống (`dunvex.green@gmail.com`), Chưa hết hạn và Còn lượt sử dụng.
    *   **Centralized Coupon Tracking**: Bổ sung cơ chế lưu vết `ownerEmail` cho mã giảm giá, cho phép hệ thống phân biệt mã nội bộ cửa hàng và mã ưu đãi hệ thống từ Dunvex Digital.
- [x] **Tối ưu Hệ thống Ưu đãi & Điều hướng (Feb 24 Updates)**:
    *   **Coupon Mobile UI Pro**: Nâng cấp toàn diện giao diện Quản lý mã giảm giá trên điện thoại. Chuyển đổi form tạo mã sang dạng Bottom Sheet cuộn thông minh, cố định nút bấm giúp thao tác cực kỳ mượt mà.
    *   **Dynamic Navigation Context**: Tự động thay đổi nhãn và icon nút Center thành **"Tạo mã mới"** khi người dùng truy cập trang Ưu đãi, giúp tăng tốc quy trình vận hành.
    *   **Deep Linking (URL Actions)**: Tích hợp tham số `?action=new` vào URL, cho phép mở nhanh trình tạo mã từ bất kỳ đâu (thanh điều hướng hoặc phím tắt).
    *   **Bảo mật & Ổn định (Bug Fixes)**: Khắc phục triệt để các lỗi Console (NaN values, syntax errors) and tối ưu hóa logic nhập liệu cho các trường giới hạn lượt dùng.
    *   **Clean Code & Performance**: Loại bỏ các import dư thừa và tối ưu hóa React state để ứng dụng phản hồi tức thì trên mọi thiết bị di động.
- [x] **Nâng cấp Hệ thống Skeleton Loaders & UX (Feb 24 Refinement)**:
    *   **Shimmer Effect (Premium UX)**: Triển khai hiệu ứng Shimmer (xương) cao cấp thay thế cho các vòng xoay loading tại **Trang chủ** và **Danh sách Khách hàng**, mang lại cảm giác tải trang hiện đại và mượt mà.
    *   **Vá lỗi JSX & Cấu trúc**: Khắc phục triệt để các lỗi cú pháp JSX, unclosed fragments và sai lệch thẻ `div` trong module Khách hàng, đảm bảo tính ổn định tuyệt đối.
    *   **Tối ưu Mobile List & Pagination**: Tinh chỉnh giao diện danh sách di động và logic phân trang, tự động cuộn lên đầu và hiển thị trạng thái loading đồng nhất trên mọi thiết bị.
    *   **Giao diện Modal Cao cấp**: Hoàn thiện thiết kế Modal Chi tiết và Thêm/Sửa khách hàng với phong cách Glassmorphism và tối ưu hóa khả năng tương tác.
- [x] **Khắc phục Google Sheets & UI Di động (Feb 24 Night Updates)**:
    *   **Mobile Sheet Import Fix**: Đã khắc phục triệt để lỗi "Không thể truy cập trang tính" trên iPhone/Android bằng cơ chế `credentials: 'omit'`, đảm bảo yêu cầu fetch dữ liệu từ Google luôn thành công trên trình duyệt di động.
    *   **Z-index & Layout Fix**: Chuẩn hóa Z-index lên `150/160` và thêm padding dưới giúp nút "Xóa khách" không bị che bởi thanh điều hướng.
    *   **Logical Cleanup**: Sửa lỗi hiển thị số "0" dư thừa do logic kiểm tra tọa độ trong chi tiết khách hàng.
    *   **Map Popup Improvement**: Ưu tiên hiển thị **Tên cơ sở kinh doanh** thay cho mã ID/Tên khách hàng trong cửa sổ thông báo trên bản đồ, giúp nhận diện đối tác nhanh chóng hơn.
    *   **Firestore Query Optimization**: Khắc phục lỗi "failed-precondition" (yêu cầu index) bằng cách chuyển cơ chế lọc dữ liệu theo nhân viên và trạng thái sang phía Client. Đảm bảo ứng dụng chạy mượt mà ngay cả khi chưa kịp tạo Index trên Google Cloud Console.
- [x] **Trích xuất dữ liệu Excel (Client-Side Export Upgrade)**:
    *   **Cơ chế Serverless**: Chuyển đổi hoàn toàn từ Cloud Functions sang xử lý tại trình duyệt bằng thư viện `xlsx`. Loại bỏ phụ thuộc vào gói Blaze và lỗi khởi động server.
    *   **Báo cáo Chi tiết (`order_details`)**: Tự động tách nhỏ các món hàng trong đơn hàng ra một Sheet riêng, giúp kế toán dễ dàng làm Pivot Table và thống kê số lượng hàng bán.
    *   **Định dạng thông minh**: Tự động chuyển đổi Timestamp của Firestore sang định dạng ngày tháng Việt Nam và xử lý chuỗi JSON để file Excel luôn sạch đẹp, không bị lỗi `[object Object]`.
    *   **Quản lý Lượt dùng (Monthly Reset)**: Tích hợp bộ đếm lượt tải ngay tại giao diện, tự động reset về 0 mỗi khi sang tháng mới để kiểm soát tài nguyên hệ thống.
- [x] **Ổn định hóa Bảo mật & Quyền truy cập**:
    *   **Fix lỗi Permission Denied**: Cập nhật lại toàn diện `firestore.rules`, khắc phục triệt để các lỗi đỏ tại Chuông thông báo và Hệ thống cảnh báo tự động.
    *   **Phân quyền Đa tầng**: Đảm bảo quyền truy cập an toàn cho cả Chủ shop và Nhân viên dựa trên `ownerId` và email, đồng thời bảo vệ dữ liệu nhạy cảm.
- [x] **Nâng cấp Giao diện Báo Giá & Quản lý Khách hàng (Feb 25)**:
    *   **Price List Redesign**: Chuyển đổi toàn bộ giao diện báo giá sang tông màu Vàng Cam (Amber/Orange) cao cấp, tăng cường độ tương phản văn bản và bổ sung hệ thống đường kẻ ô (Grid lines) giúp tra cứu dữ liệu cực kỳ dễ dàng.
    *   **Customer CRM Enhancements**: Cho phép Admin chỉnh sửa email nhân viên phụ trách (`createdByEmail`) để bàn giao khách hàng. Tích hợp nút sao chép nhanh ghi chú chi tiết và hiển thị thông tin nhân viên phụ trách trong bảng chi tiết khách hàng.
    *   **Check-in Lookup Optimization**: Đồng bộ hóa trình tìm kiếm khách hàng tại module Check-in, ưu tiên hiển thị Tên cơ sở kinh doanh và sửa lỗi placeholder tìm kiếm.
    	*   **Subscription Logic Fix**: Khắc phục lỗi hiển thị sai số ngày còn lại của Gói Dịch Vụ bằng cách tự động hóa việc tính toán ngày hết hạn (`subscriptionExpiresAt`) khi thay đổi gói trong Nexus Control. Chuyển sang cơ chế `setDoc` (merge) để đảm bảo cập nhật ổn định ngay cả khi tài liệu cấu hình chưa tồn tại.
- [x] **Logic Xuất kho Thông minh (Inventory Status Logic - Mar 1)**:
    *   **Loại bỏ Đơn nháp**: Cập nhật logic trừ kho chỉ áp dụng cho các đơn hàng có trạng thái **"Đơn chốt"** hoặc **"Đang giao"**. Các đơn nháp sẽ không còn làm sai lệch tồn kho.
    *   **Tự động Hoàn kho (Auto-Revert)**: Cơ chế tự động cộng trả lại số lượng vào kho khi chuyển đơn hàng từ trạng thái chốt về "Đơn nháp" hoặc khi xóa đơn hàng, đảm bảo tính nhất quán dữ liệu.
    *   **Chính xác 100%**: Đảm bảo số liệu tồn kho, báo cáo sản phẩm và hệ thống cảnh báo hết kho luôn phản ánh đúng thực tế hàng hóa đã xuất đi.
- [x] **Bảo mật Tài chính & Phân quyền Nhân viên (Finance Security - Mar 1)**:
    *   **Khóa module Tài chính**: Chặn hoàn toàn quyền truy cập của tài khoản nhân viên vào các tab nhạy cảm: **Sổ quỹ, Tuổi nợ và Lợi nhuận**. Nhân viên sẽ tự động bị chuyển về tab KPI cá nhân.
    *   **Ẩn Thông tin Lợi nhuận (Product List)**: Nhân viên không thể xem **Giá nhập** và **Lợi nhuận gộp** ước tính trong chi tiết sản phẩm. Chức năng sửa Giá nhập cũng bị khóa cho nhân viên.
    *   **KPI Privacy**: Trong bảng tính hoa hồng, nhân viên chỉ thấy số lượng bán và hoa hồng thực nhận. Các cột liên quan đến lợi nhuận gộp của công ty được ẩn đi hoàn toàn.
    *   **Permission Logic Hardening**: Cập nhật `hasPermission` mặc định trả về **false** cho nhân viên nếu không có quyền cụ thể, đảm bảo tính bảo mật "Whitelist" thay vì "Blacklist".
- [x] **Sửa lỗi Thêm Khách hàng (Customer List Bug Fix - Mar 1)**:
    *   **Zod Schema Update**: Sửa lỗi validation trường `lat` (vĩ độ) và `lng` (kinh độ), cho phép giá trị `null` hoặc `undefined` khi chưa lấy được tọa độ.
    *   **Trường tùy chọn (Optional Fields)**: Bỏ bắt buộc nhập **Địa chỉ** và **Số điện thoại** trong form khách hàng, giúp lên đơn nhanh cho khách lẻ.
    *   **Enhanced Debugging**: Thêm hệ thống log chi tiết và cảnh báo Toast giúp xác định chính xác nguyên nhân nếu việc thêm khách hàng thất bại.
    *   **Initial State Fix**: Chuẩn hóa dữ liệu khởi tạo form giúp đồng bộ hoàn hảo với schema validation.
- [x] **Tự động hóa Mã giảm giá (Coupon Automation - Mar 2)**:
    *   **Auto-Deletion**: Hệ thống tự động quét và xóa các mã giảm giá đã hết hạn ngay khi Admin truy cập trang Ưu đãi.
    *   **Thông báo Sắp hết hạn (Expiry Alerts)**: Tự động gửi cảnh báo Toast cho các mã còn dưới 3 ngày sử dụng, giúp Admin chủ động gia hạn hoặc thay thế chương trình.
    *   **Cơ chế Throttling**: Thông báo mã hết hạn được giới hạn hiển thị 12 giờ một lần để tránh spam người dùng.
- [x] **Sửa lỗi tồn kho theo SKU (Stock Sync Fix - Mar 2)**:
    *   **Cơ chế Cộng dồn Tồn kho**: Khắc phục lỗi "Hết hàng" ảo khi sản phẩm có cùng mã SKU nhưng nằm ở các danh mục khác nhau. Hệ thống tự động cộng dồn tồn kho của tất cả sản phẩm cùng SKU trong cùng một công ty.
    *   **Cô lập dữu liệu Admin (Admin Isolation)**: Cam kết 100% SKU được lọc theo `ownerId`. Dù nhiều công ty dùng chung một mã SKU, tồn kho vẫn hoàn toàn tách biệt, không bao giờ bị trừ nhầm sang đơn vị khác.
    *   **Cảnh báo SKU trùng**: Khi thêm sản phẩm thủ công, hệ thống sẽ cảnh báo nếu SKU đã tồn tại trong danh mục của Admin đó để tránh tạo nhầm dữ liệu.
    *   **So khớp SKU Toàn diện**: Tự động chuẩn hóa mã SKU (xoá khoảng trắng, NFC, không phân biệt hoa thường) để đồng bộ kho chính xác.
- [x] **Lịch sử Thu nợ & Quản lý phiếu thu (Payment History - Mar 2)**:
    *   **Tối ưu Phiếu báo công nợ (Premium Statement UI)**: Nâng cấp giao diện phiếu báo công nợ đồng bộ với phiếu giao hàng. Sử dụng Header hiện đại, bảng biểu có tiêu đề đậm và khung tổng kết nợ rực rỡ, chuyên nghiệp.
    *   **Chỉnh sửa & Xóa**: Chủ doanh nghiệp có thể sửa thông tin hoặc xóa các phiếu thu bị lên sai, hệ thống sẽ tự động tính toán lại dư nợ khách hàng ngay lập tức.
    *   **Giao diện Đa nền tảng**: Tối ưu hiển thị dạng thẻ (Cards) trên điện thoại và dạng bảng chuyên nghiệp trên máy tính.
- [x] **Cập nhật Nav-Bar Mobile (Mobile UI Enhancement - Mar 2)**:
    *   **Phím tắt Lịch sử thu nợ**: Tại trang Quản lý công nợ trên điện thoại, nút "Sản phẩm" đã được thay bằng phím tắt "Lịch sử thu nợ" để giúp người dùng truy xuất nhanh các phiếu thu.
    *   **Đồng bộ Tab**: Hỗ trợ chuyển đổi Tab linh hoạt thông qua đường dẫn URL, giúp phím tắt Mobile hoạt động chính xác.
- [x] **Tối ưu Giao diện Đơn hàng Mobile (Order List UI - Mar 2)**:
    *   **Ưu tiên Tên cơ sở**: Thay đổi hiển thị trong danh sách đơn hàng trên điện thoại, đưa **Tên cơ sở kinh doanh** lên làm tiêu đề chính (chữ đậm) thay vì mã đơn hàng.
    *   **Thứ tự Thông tin**: Mã đơn hàng được chuyển xuống dòng phụ giúp chủ doanh nghiệp và nhân viên nhận diện khách hàng nhanh chóng hơn khi lướt danh sách.
- [x] **Sửa lỗi Xoá đơn hàng (Order Deletion Fix - Mar 3)**:
    *   **Safeguard against Deleted Products**: Khắc phục triệt để lỗi "No document to update" khi xoá đơn hàng chứa sản phẩm đã bị xoá khỏi danh mục. Hệ thống hiện tự động kiểm tra sự tồn tại của sản phẩm trước khi hoàn kho.
    *   **Atomic Inventory Sync**: Đảm bảo quá trình hoàn kho và xoá đơn hàng diễn ra an toàn, không bị ngắt quãng ngay cả khi dữ liệu sản phẩm gốc không còn.
    *   **QuickOrder Stability**: Cập nhật logic tương tự cho trình Lên đơn nhanh, ngăn chặn lỗi crash khi chỉnh sửa đơn hàng có sản phẩm cũ đã bị xoá.

### 📝 Cần làm tiếp (To-do)

#### 🛡️ Bảo mật (Security)
- [x] **Firestore Audit**: Kiểm tra và thắt chặt Security Rules, đảm bảo dữ liệu chỉ được truy cập bởi đúng `ownerId`. Khắc phục lỗi chặn quyền truy cập ngầm.
- [x] **Data Sanitation**: Triển khai lớp xác thực dữ liệu đầu vào (Zod/Yup) cho tất cả các form để ngăn chặn dữ liệu rác.
- [x] **Masking**: Tự động che bớt thông tin nhạy cảm (SĐT, Email) trong các nhật ký hoạt động cho nhân viên.

#### ⚡ Hiệu suất & Mượt mà (Performance)
- [x] **Lazy Loading Routines**: Triển khai `React.lazy` và `Suspense` giúp ứng dụng tải trang ban đầu siêu nhanh.
- [x] **List Virtualization**: Áp dụng `react-window` cho danh sách Khách hàng và Sản phẩm, giúp cuộn mượt mà ngay cả với hàng nghìn bản ghi.
- [x] **Cloudinary Dynamic Optimization**: Tự động tối ưu hóa định dạng (`f_auto`) và chất lượng (`q_auto`) hình ảnh theo thiết bị.
- [x] **Query Limitation**: Tối ưu hóa các truy vấn Firestore, giới hạn số lượng bản ghi tải về để tiết kiệm băng thông và tăng tốc xử lý.


####  Thông báo & Trải nghiệm (UX/UI)
- [x] **Product Search Fix**: Sửa lỗi tìm kiếm sản phẩm trong QuickOrder, xử lý trùng lặp khoảng trắng và chuẩn hóa dữ liệu giúp tìm kiếm chính xác 100%.
- [x] **Skeleton Loaders (Phase 2)**: Triển khai hiệu ứng Shimmer cho các module Sản phẩm, Đơn hàng và Công nợ để đồng bộ hóa trải nghiệm.
- [x] **Haptic Feedback**: Thêm rung phản hồi nhẹ trên di động khi quét QR thành công hoặc chốt đơn hàng trong QuickOrder.
- [x] **Offline Banner**: Hiển thị thanh thông báo trạng thái "Đứt kết nối - Đang dùng dữ liệu ngoại tuyến" rõ ràng hơn.
- [ ] **Interactive Tour**: Thêm hướng dẫn ảo (Guided Tour) cho người dùng mới khi lần đầu truy cập các module phức tạp.
- [x] **Báo cáo & Xuất dữ liệu (Finance Pro)**: Tích hợp nút xuất báo cáo Sổ quỹ và Lợi nhuận ra file Excel/PDF theo khoảng thời gian tùy chọn. Khởi chạy phiên bản Excel Client-side ổn định.
- [ ] **Ký nhận điện tử (E-Signature)**: Cho phép khách hàng ký nhận trực tiếp trên màn hình di động khi giao hàng; tích hợp chữ ký vào Phiếu giao hàng.
- [ ] **Tự động hóa Zalo/Messenger**: Gửi thông báo nhắc nợ hoặc ảnh hóa đơn nhanh chỉ với 1 lần nhấp.
- [ ] **Dòng thời gian khách hàng (CRM Pro)**: Hiển thị toàn bộ lịch sử Giao dịch - Thanh toán - Checkin của từng khách hàng trên 1 trục thời gian (Timeline).
- [ ] **Dự báo dòng tiền (AI Forecast)**: Phân tích lịch sử thu chi để dự báo số dư khả dụng trong 30 ngày tiếp theo.
- [ ] **Smart Search**: Tìm kiếm gợi ý thông minh dựa trên hành vi và lịch sử thao tác của người dùng.

*Ghi chú: File `upload_script.gs` đã được cập nhật logic gửi email.*
