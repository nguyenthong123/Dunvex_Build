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
- **Hệ thống Đào tạo (`/khoa-dao-tao`)** 🎓:
    - **Hands-on Practice**: Thực hành trực tiếp trên dữ liệu thật của chính người dùng.
    - **Môi trường Interactive Lab**: Chia đôi màn hình, hướng dẫn chi tiết từng bước.
    - **Video Hướng dẫn** 🆕: Thư viện video tutorial YouTube dành cho toàn bộ người dùng.
    - **Quản lý Nội dung**: Tính năng Thêm/Sửa/Xóa video bảo mật bằng mã xác thực gửi qua Email Admin.
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
- [x] **Quản lý Vòng đời & Hiển thị Sản phẩm (Product Management Upgrade - Mar 16)**:
    - **Tự động hóa (Auto-delete)**: Bổ sung "Ngày hết hạn" trong form Thêm/Sửa. Tự động kiểm tra và xóa sản phẩm khỏi hệ thống nếu quá hạn.
    - **Hiển thị Giá nhập**: Bổ sung hiển thị Giá nhập nổi bật ngay bên cạnh Lợi nhuận ước tính trong chi tiết sản phẩm.
    - **Phân quyền Bảo mật (RBAC)**: Tự động ẩn hoàn toàn các trường thông tin nhạy cảm (Giá nhập kho, Lợi nhuận ước tính) khi tài khoản nhân viên đăng nhập, đảm bảo an toàn dữ liệu nguồn.
- [x] **Tính năng Nhắc hẹn Tất toán Khoản vay (Loan Repayment Reminder - Mar 12)**:
    - **Cột Nhắc hẹn mới**: Bổ sung cột "Nhắc hẹn" vào bảng Nhật ký thu chi nội bộ.
    - **Công tắc Toggle**: Cho phép bật/tắt nhắc nhở cho từng khoản vay ngân hàng/vay khác.
    - **Cơ chế nhắc nhở**: Thiết lập nhắc hẹn tất toán vào ngày 25 hàng tháng (nhắc trước 5 ngày qua email) để người dùng chủ động nguồn vốn.
- [x] **AI Phân tích Khoản vay & Tự động viết Ghi chú (AI Loan Advisor - Mar 12)**:
    - **Tự động viết nội dung**: Tích hợp nút "Tạo ghi chú AI" giúp DeepSeek phân tích sâu khoản vay từ Số tiền, Ngân hàng, Lãi suất và Kỳ hạn.
    - **Tính toán tài chính thông minh**: AI tự động tính toán lãi hàng tháng, tổng lãi cả kỳ, số tiền cần đáo hạn và trình bày mạch lạc theo văn phong mong muốn.
    - **Nâng cấp trải nghiệm người dùng**: Giúp chủ doanh nghiệp nắm bắt nhanh nghĩa vụ tài chính chỉ qua một đoạn văn bản tóm tắt, thay vì phải tự tính toán thủ công.
- [x] **Tối ưu Hiển thị Tài chính trên Di động (Finance Mobile Optimization - Mar 12)**:
    - **Giao diện Thẻ (Card Layout)**: Thiết kế lại danh sách sổ quỹ cho điện thoại, chuyển từ bảng trượt ngang sang dạng thẻ trắng bo tròn hiện đại, dễ đọc và chuyên nghiệp.
    - **Nút gạt Nhắc nợ Mobile**: Tích hợp trực tiếp nút gạt (Toggle Switch) bật/tắt nhắc nhở ngay trên từng thẻ khoản vay trên di động, đồng bộ chức năng với bản Desktop.
    - **Tối ưu Thao tác một tay**: Sắp xếp lại các nút Xoá và Nhắc nợ ở vị trí thuận tiện nhất cho ngón tay khi sử dụng điện thoại.
- [x] **Tinh chỉnh Điều hướng & Sửa lỗi Hệ thống (Navigation & Console Fix - Mar 12)**:
    - **Căn chỉnh Bảng Desktop**: Khôi phục cột "Ngày" bị thiếu, giúp tiêu đề và dữ liệu khớp nhau 100%, tạo giao diện chuyên nghiệp.
    - **Popup Chi tiết Nội dung**: Tích hợp tính năng nhấn vào ghi chú để mở cửa sổ phóng to (Popup) xem đầy đủ nội dung, áp dụng cho cả Mobile và Desktop.
    - **Bottom Nav Thông minh**: Cập nhật thanh điều hướng trang Tài chính với phím tắt "Lịch sử" riêng biệt, giúp truy cập nhanh nhật ký thu chi.
    - **Dọn dẹp Console**: Xử lý triệt để các lỗi "Duplicate Key" do trùng lặp địa chỉ các nút bấm, đảm bảo ứng dụng vận hành mượt mà và sạch lỗi.
    - **Bảo toàn Bố cục Chuyên nghiệp**: Khôi phục và chuẩn hóa lại khoảng cách, vị trí các nút bấm theo đúng thiết lập gốc của người dùng sau quá trình tối ưu.
- [x] **Nâng cấp Hệ thống Nhắc nợ Email (Enhanced Backend Reminders - Mar 12)**:
    - **Gửi Email đa điểm**: Cập nhật Google Apps Script để tự động gửi thông báo nhắc nợ đến cả Admin và Khách hàng (nếu có email), đảm bảo thông tin thông suốt.
- [x] **Gỡ bỏ module KPI & Đội ngũ (KPI Module Cleanup - Mar 13)**:
    - **Tối giản hóa Tài chính**: Loại bỏ hoàn toàn tính năng lập kế hoạch KPI, theo dõi hiệu suất đội ngũ và bảng tính thưởng phạt để tinh gọn hệ thống theo yêu cầu thực tế.
    - **Dọn dẹp Giao diện**: Gỡ bỏ tab "Performance", các state biến liên quan, logic fetching dữ liệu KPI và các modal lập kế hoạch cũ.
    - **Phân quyền truy cập Tài chính**: Thiết lập thông báo "Truy cập bị hạn chế" chuyên nghiệp cho tài khoản nhân viên khi cố gắng truy cập module Tài chính, đảm bảo bảo mật số liệu doanh nghiệp.
- [x] **Nâng cấp Hệ thống Tính Lợi nhuận & Bảo mật (Profit Logic & Security - Mar 19)**:
    - **Lợi nhuận theo Giá vốn Lịch sử**: Hệ thống tự động ghi nhận và lưu trữ `Giá nhập` (buyPrice) của từng sản phẩm ngay tại thời điểm lên đơn. Điều này đảm bảo báo cáo tài chính luôn chính xác 100%, không bị ảnh hưởng nếu sản phẩm sau này bị xoá hoặc thay đổi giá trong danh mục.
    - **Xem trước Lợi nhuận (Quick Order Preview)**: Bổ sung tính năng cho phép Admin xem trước "Tổng giá vốn" và "Lợi nhuận thực tế" ngay khi đang nhập số lượng đơn hàng. Tích hợp nút **Ẩn/Hiện (Eye icon)** để bảo mật thông tin khi có khách hàng đứng cạnh.
    - **Bảo mật Đa tầng (Admin Only)**: Cột "Lợi nhuận" trong Danh sách đơn hàng và bộ công cụ xem trước lợi nhuận được thiết lập ẩn hoàn toàn đối với tài khoản nhân viên (Employee), đảm bảo an toàn dữ liệu kinh doanh nhạy cảm.
    - **Tối ưu Module Tài chính (Finance Performance)**: Gỡ bỏ các cơ chế AI quét lỗi tự động (AI Auto-fix) gây nặng máy. Thay vào đó, báo cáo lợi nhuận lấy trực tiếp dữ liệu đã "đóng băng" từ các đơn hàng chốt, giúp trang Tài chính tải tức thì và số liệu luôn khớp với thực tế.
- [x] **Tối ưu Form Sổ quỹ (Cashbook Form Optimization - Mar 13)**:
    - **Giao diện Compact**: Thu gọn bố cục form ghi sổ, sử dụng Grid linh hoạt (1 cột trên Mobile, 2 cột trên Desktop) để giảm chiều dài trang.
    - **Hạng mục mới**: Thêm mục **"Chiết khấu"** 🎁 vào phần Thu vào theo yêu cầu người dùng.
    - **Visual UX**: Thêm các biểu tượng cảm xúc (emojis) vào danh sách hạng mục giúp người dùng nhận diện nhanh loại giao dịch.
    - **Conditional Layout**: Nhóm các trường liên quan đến khoản vay (Ngân hàng, Lãi suất, Kỳ hạn) vào các khối màu riêng biệt, chỉ hiện thị khi cần thiết.
- [x] **Xử lý trượt Form & Hiển thị Mobile (Modal Scroll Fix - Mar 13)**:
    - **Sticky Action Footer**: Chuyển đổi nút "Xác nhận ghi sổ" thành dạng cố định (Fixed Footer) ở đáy modal. Điều này giúp nút luôn luôn hiển thị trên màn hình bất kể bạn cuộn nội dung form tới đâu.
    - **Centered Modal Display**: Chuyển modal về vị trí trung tâm màn hình (Center) thay vì dạng Bottom Sheet để tránh hoàn toàn việc bị che khuất bởi thanh điều hướng (Bottom Navigation) của ứng dụng.
    - **Header/Body Split**: Tách riêng tiêu đề, thân form (cuộn được) và chân nút nhấn (cố định) để tạo cảm giác chuyên nghiệp và mượt mà hơn trên mọi thiết bị.
- [x] **Sửa lỗi tính Lợi nhuận (Profit Calculation Fix - Mar 13)**:
    - **Double Discount Fix**: Khắc phục lỗi trừ chiết khấu hai lần trong báo cáo lợi nhuận. Trước đó, hệ thống trừ chiết khấu vào Doanh thu, sau đó lại trừ thêm một lần nữa khi tính Lợi nhuận, dẫn đến số liệu bị âm sai lệch.
    - **Độ chính xác số liệu**: Đảm bảo lợi nhuận các đơn hàng (như đơn cô Lài) hiển thị đúng số dương thực tế sau khi đã trừ đi Giá vốn và Chiết khấu gốc.
- [x] **Nâng cấp Dashboard & Tối ưu Mobile Home (Home Mobile Optimization - Mar 13)**:
    - **Hoạt động mới nhất dạng Thẻ (Activity Card Layout)**: Chuyển đổi danh sách hoạt động trên điện thoại sang dạng thẻ (Card) trắng bo tròn, hiển thị đầy đủ: Người thực hiện, Thời gian, Loại tác vụ và Chi tiết nội dung.
    - **Hiệu ứng Tương tác (Haptic Feel)**: Tích hợp hiệu ứng nhấn (active scale) cho các thẻ hoạt động trên Mobile, mang lại trải nghiệm ứng dụng bản địa (Native app) cao cấp.
    - **Đồng bộ hóa Hiển thị (Cross-Platform UI)**: Tự động chuyển đổi thông minh giữa dạng Bảng (Desktop) và dạng Thẻ (Mobile) dựa trên kích thước màn hình mà không làm mất thông tin.
    - **Tính toán Doanh số Khách hàng gần nhất**: Nâng cấp biểu đồ "Doanh số khách hàng" để hiển thị chính xác 6 khách hàng có đơn hàng chốt gần đây nhất thay vì chỉ lọc theo tổng doanh số.
    - **Logic Sắp xếp Thời gian (Order Sorting Fix)**: Cải thiện hàm `getOrderTime` hỗ trợ xử lý chính xác các đơn hàng mới tạo (chưa có server timestamp) bằng cách lấy mốc thời gian hiện tại, đảm bảo đơn hàng mới luôn xuất hiện trên đầu danh sách.
    - **Đồng bộ Định danh (Loan ID Sync)**: Đồng bộ việc hiển thị mã ID khoản vay thay cho nhắc nợ trên cả Desktop và Mobile để thống nhất quy trình đối soát tài chính.
    - **Tinh chỉnh Hiệu suất Cá nhân**: Gỡ bỏ các nút dư thừa trong bảng hiệu suất để tối ưu không gian hiển thị trên màn hình nhỏ.
- [x] **Sửa lỗi Điều hướng Tồn kho & Bộ lọc nhanh (Inventory Navigation Fix - Mar 13)**:
    - **Fix Home Alert Nav**: Sửa lỗi nút "Xem" tại thông báo tồn kho thấp ở Trang chủ không hoạt động. Hiện đã chuyển hướng chính xác về trang Sản phẩm (`/inventory`).
    - **Quick Low Stock Filter**: Tích hợp bộ lọc tự động `?filter=low_stock`. Khi bấm từ Home, hệ thống sẽ tự động lọc ra danh sách các mặt hàng có tồn kho <= 10 để người dùng biết cần nhập thêm hàng gì ngay lập tức.
    - **UI Feedback**: Thêm nhãn thông báo "Đang xem: Tồn kho thấp" kèm nút bỏ lọc tại danh sách sản phẩm giúp người dùng dễ dàng quay lại danh sách đầy đủ.
### 7. Nexus AI Script Intelligence
- **AI Engine:** DeepSeek API (Paid Tier) - Highly stable integration within Google Apps Script.
- **AI Partner Insights:** Automatically analyzes affiliate registration notes, assesses potential, and provides a concise partner profile for admins.
- **AI Financial Advisor:** Generates personalized financial tips and encouraging statements for loan reminders and interest payment notifications.
- **AI Chat Action:** Provides a backend endpoint (`ai_chat`) for frontend applications to securely communicate with the AI engine.
- **Location:** `upload_script.gs` (Google Apps Script).
- **Status:** 🟢 Active & Verified.
- [x] **AI-Powered Training Module (Nexus AI - Mar 14)**:
    - **Nexus AI Training Generation**: Tự động soạn bài học và câu hỏi trắc nghiệm từ chủ đề bất kỳ. **Cập nhật Mar 14**: Prompt được tối ưu thuần Việt 100%, dễ hiểu như "dân sale", không dùng từ lóng IT.
    - **Nexus AI Adaptive Suggestion**: Tự động kiểm tra danh sách bài học cũ để đề xuất tiêu đề và nội dung mới không trùng lặp, giúp nhân sự tiến bộ mỗi ngày.
    - **Instructional "How & Why"**: AI giải thích rõ "Nút này ở đâu, bấm thế nào" (How) và "Tại sao phải làm đúng quy trình" (Why) để tránh sai sót vận hành.
    - **Terminology Alignment**: Đồng bộ tên gọi 100% với App: Trang chủ, Đơn hàng, Công nợ, Tài chính, Khách hàng, Sản phẩm, Báo giá.
    - **Bulk Import Training**: Hướng dẫn chi tiết cách chuẩn bị file Excel/Google Sheet với bộ từ khóa tiêu đề cột (Map Keys) chuẩn để Web nhận biết tự động.
    - **Knowledge Base File**: Cập nhật `NEXUS_AI_TRAINING_GUIDE.md` làm nguồn tri thức chuẩn cho AI.
    - **Automatic Testing**: Hệ thống chấm điểm trắc nghiệm, tích lũy điểm kỹ năng và xếp hạng bậc thầy (Skill Progression).
- [x] **Quản lý Tài chính & Vốn vay**: Thêm các trường Ngân hàng, Kỳ hạn, Lãi suất khi ghi chú các khoản vay.
    - **Bot Sinh Lãi (AI Interest)**: AI tự động tính toán lãi hàng tháng dự kiến, gộp vào chi phí vận hành để chủ cơ sở nắm được số liệu lợi nhuận ròng chính xác nhất.
    - **Giao diện động**: Form ghi chú Tài chính tự động thay đổi dựa trên loại thu/chi và hạng mục được chọn (Thu khách, Chi NCC, Lương NV...).
- [x] **Nâng cấp Nexus Control Pro & AI Management (Mar 13)**:
    - **UI/UX Optimization**: Giao diện thích ứng hoàn hảo trên mọi kích thước màn hình (Mobile, Tablet, Desktop). Sử dụng Sidebar hiện đại và các tab được tối ưu hóa cho thao tác chạm.
    - **Nexus AI Smart Import (AI-Driven Matching)**: 
        - **Phân loại Gói thông minh**: Khắc phục triệt để lỗi ghi đè dữ liệu khi người dùng nhập nhiều mốc giá (ví dụ: gói 4 kiện và gói 6 kiện). 
        - **Semantic Variant Detection**: AI tự động phân tích Mã SKU kết hợp với Danh mục và Tên sản phẩm. Nếu phát hiện sự khác biệt về "Gói" hoặc "Giá", hệ thống sẽ tự động tạo bản ghi mới thay vì ghi đè, bảo toàn 100% dữ liệu đa tầng của đơn vị.
    - **Autonomous AI Management (Nexus AI Auto-Enforcement - Mar 14)**:
        - **AI Auto-Approval (Trust Model)**: Quản lý tự động phê duyệt gia hạn gói cước dựa trên lịch sử tin cậy, mở khóa tính năng tức thì cho khách hàng.
        - **AI Auto-Lock (Customer Management)**: Trong bảng Khách hàng, AI tự động kiểm tra "Ngày vào trang" và "Hạn sử dụng". Khi hết hạn, hệ thống tự động bật nút **Khóa tính năng**, gán trạng thái `expired` và gửi thông báo trực tiếp cho người dùng yêu cầu gia hạn phí dịch vụ để tiếp tục sử dụng (Orders, Debts, Finance...).
        - **Khôi phục phòng ngự (Admin Revoke Lock)**: Trong trường hợp Admin không nhận được lệ phí từ ngân hàng theo lệnh Auto-Approve (gian lận), hệ thống trang bị nút "⛔ HUỶ ĐĂNG KÝ (KHÓA)" nằm ngay trong danh sách chọn gói của quản trị viên. Việc ấn vào nút này sẽ ngay lập tức xoè lệnh đóng chu kỳ, khoá sổ các tính năng và gửi cảnh báo đỏ thẳng tới User.
        - **Phân cấp Tài khoản (Role-based AI)**: Tự động phân biệt Super Admin (`dunvex.green@gmail.com`) và các tài khoản nhân viên để hiển thị cấu hình tương ứng.
        - **Cảnh báo Thông minh (Pocket-Touch Prevention)**: AI tự động gửi thông báo "Chuông báo" trực tiếp cho người dùng nếu phát hiện thao tác liên tục bất thường.
    - **AI-Friendly Audit Logs**: Bảng nhật ký được thiết kế chuẩn cấu hình cho Bot, giúp AI dễ dàng kiểm tra lịch sử thao tác, xác định vị trí nhấp chuột và chu trình sử dụng để hỗ trợ khách hàng tốt nhất.
    - **FIFO Inventory Logic**: Thực thi nghiêm ngặt cơ chế Nhập trước - Xuất trước cho toàn bộ sản phẩm theo SKU, đảm bảo tính toán giá vốn và lợi nhuận chính xác 100%.
    - **Finance AI Automation (Mar 13)**: 
        - **Auto-Note Generation**: Tự động kích hoạt AI phân tích khoản vay ngay khi người dùng nhập đủ thông tin (Số tiền, Ngân hàng, Kỳ hạn, Lãi suất).
        - **Smart UI**: Gỡ bỏ nút bấm thủ công, thay thế bằng quy trình xử lý ngầm (Background Processing) mượt mà hơn cho người mới.
        - **Intelligent Fallback**: AI tự động tra cứu lãi suất ngân hàng thời gian thực nếu người dùng bỏ trống.
    - [x] **Nexus AI Script Intelligence (Mar 13)**:
    - **Smart Cloud Notifications**: Tích hợp DeepSeek vào Google Apps Script để tự động phân tích hồ sơ đối tác và tư vấn tài chính trong email.
    - **AI Partner Insights**: Tự động đánh giá tiềm năng đối tác Affiliate và tóm tắt tính cách cho Admin dễ duyệt.
    - **Financial Advisor Email**: Tự động đính kèm lời khuyên tài chính thông minh vào email nhắc nợ/vay ngân hàng.
- [x] **Nexus AI Inventory Intelligence (Mar 13)**:
        - **Smart Grouping**: Ghép nhóm SKU thông minh (không phân biệt hoa thường/ký tự đặc biệt).
        - **Nexus AI Phân Tích**: Tích hợp DeepSeek phân tích tốc độ bán hàng, cảnh báo tồn đọng và gợi ý nhập hàng.
        - **Health Indicators**: Tự động gắn nhãn trạng thái (Bán chạy, Sắp hết, Đọng vốn) dựa trên phân tích FIFO.
    - [x] **Nexus AI Debt Intelligence (Mar 13)**:
        - **AI Risk Assessment**: Tự động gắn nhãn mức độ rủi ro công nợ (Rủi ro cao, Chậm trả, An toàn) dựa trên tuổi nợ và lịch sử thanh toán.
        - **Nexus AI Phân Tích**: Phân tích danh sách đối tác nợ và đề xuất chiến lược thu hồi nợ (nhắc nợ, giãn nợ, pháp lý).
    - [x] **Inventory Sync Reliability (Mar 13)**: 
        - **Existence Guard**: Sửa lỗi `NOT-FOUND` khi lưu đơn hàng bằng cách xác thực sự tồn tại của sản phẩm trước khi cập nhật kho.
        - **Safe Sync Logic**: Tối ưu hóa việc trừ kho FIFO khi ID sản phẩm bị thay đổi do Smart Import.
    - **Dọn dẹp hệ thống**: Gỡ bỏ các module Flag dư thừa, tập trung vào quản trị dữ liệu và nhật ký hoạt động thời gian thực.
- [x] **Email & Sao chép nhanh Thông tin (Quick Copy Upgrade - Mar 10)**:
    - **Email khách hàng**: Bổ sung khối hiển thị Email trong chi tiết khách hàng, hỗ trợ link mailto và nút sao chép nhanh.
    - **Đồng bộ nút Chép**: Bổ sung nút sao chép cho toàn bộ các trường contact nhạy cảm (Email, SĐT hóa đơn), đảm bảo trải nghiệm người dùng hiện đại và tiện lợi.
- [x] **Thông tin Hóa đơn & Chi tiết Khách hàng (Customer VAT Upgrade - Mar 9)**:
    - **Quản lý Thông tin VAT**: Bổ sung bộ 4 trường thông tin (Tên đơn vị, MST, SĐT hóa đơn, Địa chỉ VAT) vào hồ sơ khách hàng.
    - **Giao diện Modal Nâng cấp**: Phần thông tin hóa đơn trong Modal chi tiết luôn hiển thị tiêu đề, hỗ trợ nút gạt (Toggle) để ẩn/hiện chi tiết cực kỳ gọn gàng.
    - **Tiện ích Sao chép nhanh**: Tích hợp nút Copy cho từng trường dữ liệu hóa đơn, giúp nhân viên lấy thông tin xuất hóa đơn chỉ với 1 lần chạm.
    - **Đồng bộ Form & Schema**: Nâng cấp Form Thêm/Sửa với nút gạt bật/tắt mục Hóa đơn và cập nhật `CustomerSchema` để đảm bảo dữ liệu luôn được lưu trữ chính xác vào Firestore.
- [x] **Video Hướng dẫn & Bảo mật Nội dung (Training Upgrade - Mar 5)**:
    - **Thư viện Video**: Tích hợp danh sách video hướng dẫn từ YouTube với giao diện Card premium, hỗ trợ xem trực tiếp và hiển thị cho toàn bộ người dùng.
    - **Quản lý Bảo mật (Verification Gate)**: Triển khai cơ chế xác thực 2 lớp để mở khóa form cập nhật video. Mã xác minh (6 chữ số) được gửi tự động về email quản trị `dunvex.green@gmail.com`.
    - **Trình quản lý Video**: Form thêm/sửa video thông minh, tự động lấy ảnh thu nhỏ (thumbnail) từ link YouTube và lưu trữ an toàn trên Firestore.
- [x] **Phân trang & Chi tiết Thu nợ (Debt Collection Upgrade - Mar 5)**:
    - **Chi tiết Phiếu thu**: Bổ sung nút "Chi tiết" cho phép xem đầy đủ thông tin phiếu thu kèm ảnh bằng chứng (nếu có) trong Modal phong cách Glassmorphism.
    - **Phân trang Thông minh**: Triển khai hệ thống phân trang (10 dòng/trang) với logic hiển thị 1, 2, 3... giúp quản lý hàng nghìn phiếu thu mượt mà.
- [x] **Cập nhật Vị trí Khách hàng (Lat/Lng Manual Input - Mar 5)**:
    - **Nhập tọa độ thủ công**: Bổ sung 2 ô nhập liệu Vĩ độ (Lat) và Kinh độ (Lng) trong form Thêm/Sửa khách hàng.
    - **Pasting Thông minh**: Tự động nhận diện và phân tách tọa độ nếu người dùng dán chuỗi "lat, lng" vào ô Vĩ độ, giúp tiết kiệm thời gian khi copy từ Google Maps.
    - **Linh hoạt vận hành**: Cho phép tạo hồ sơ khách hàng có vị trí chính xác ngay cả khi Admin đang ở văn phòng.
- [x] **Cấu hình Thanh toán Hệ thống (Payment Admin Control - Mar 5)**:
    - **Quản lý Tài khoản nhận tiền**: Cho phép Admin hệ thống thay đổi Ngân hàng, STK và Tên chủ tài khoản nhận thanh toán nâng cấp.
    - **Bảo mật 2 lớp (OTP Mail)**: Việc thay đổi thông tin thanh toán yêu cầu mã xác minh OTP gửi về email tổng `dunvex.green@gmail.com`.
    - **QR Code Động**: Tự động cập nhật mã QR VietQR theo thông tin tài khoản mới nhất được cấu hình.
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
- [x] **Phiếu Giao Hàng & Đóng gói (Branding Upgrade - Mar 4)**:
    *   **Tính Kiện tự động**: Tự động tính toán tổng số Kiện dựa trên tỷ lệ đóng gói (`qty / packaging`) và hiển thị trên Phiếu giao hàng (Order Ticket).
    *   **Thương hiệu Chuyên nghiệp**: Tích hợp Thông tin Doanh nghiệp (Tên, Địa chỉ, SĐT, Email) và biểu tượng nhận diện vào đầu Phiếu giao hàng, mang lại diện mạo chuyên nghiệp đồng bộ với Báo giá hệ thống.
    - [x] **Logo Doanh Nghiệp**: Tích hợp trình tải lên logo qua Cloudinary, tự động hiển thị trên đầu phiếu giao hàng thay cho biểu tượng mặc định.
- [x] **Tái cấu trúc Danh sách Sản phẩm (Product List Refinement - Mar 4)**:
    *   **Giao diện Tab thông minh**: Triển khai 3 tab hiển thị chuyên biệt: **DANH SÁCH SP** (Toàn bộ mặt hàng), **TỒN KHO GỘP** (Gộp theo SKU) và **LỊCH SỬ KHO** (Lịch sử giao dịch).
    *   **Gộp SKU Tồn kho**: Tự động tính toán và hiển thị tồn kho gộp cho các sản phẩm có cùng mã SKU, giúp quản lý hàng hóa đa danh mục chính xác hơn.
    *   **Logic Trừ Kho Chính Xác**: Khắc phục lỗi trừ kho dựa trên số lượng ban đầu. Giờ đây hệ thống trừ trực tiếp vào số dư hiện tại và chỉ áp dụng cho đơn hàng trạng thái "Đơn chốt" và "Đang giao".
    *   **Tối ưu Search Bar**: Thanh tìm kiếm được thiết kế ẩn/hiện thông minh theo từng tab (ẩn tại Lịch sử kho) để tối ưu không gian hiển thị trên desktop.
    *   **Pagination & Syntax Fix**: Khắc phục các lỗi hiển thị phân trang và đảm bảo cấu trúc JSX chuẩn hóa, tránh treo ứng dụng khi duyệt danh mục lớn.
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
    - **Nhắc nợ Tự động (Debt Aging - 3 Days)**: Hệ thống tự động quét và gửi thông báo nhắc thu hồi công nợ cho các đơn hàng đã chốt quá **3 ngày** thông qua Nexus AI.
    - **Trung tâm Thông báo**: Tích hợp biểu tượng trực quan (⚠️, 💰) và ngôn ngữ tự nhiên AI vào nút chuông thông báo.
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
    *   **Ẩn Thông vị Lợi nhuận (Product List)**: Nhân viên không thể xem **Giá nhập** và **Lợi nhuận gộp** ước tính trong chi tiết sản phẩm. Chức năng sửa Giá nhập cũng bị khóa cho nhân viên.
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
    *   **Cô lập dữ liệu Admin (Admin Isolation)**: Cam kết 100% SKU được lọc theo `ownerId`. Dù nhiều công ty dùng chung một mã SKU, tồn kho vẫn hoàn toàn tách biệt, không bao giờ bị trừ nhầm sang đơn vị khác.
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
- [x] **Tối ưu Tìm kiếm & Giới hạn Truy vấn (Search & Scale Fix - Mar 3)**:
    *   **Mở rộng Giới hạn Hiển thị (Query Limits)**: Tăng giới hạn hiển thị từ 100 lên **1000 khách hàng/sản phẩm**, giải quyết triệt để lỗi "tìm không thấy" sản phẩm cũ khi kho dữ liệu lớn.
    *   **Tìm kiếm Thông minh (Vietnamese Robust Search)**: Nâng cấp bộ lọc phía Client hỗ trợ **Chuẩn hóa NFC** và **Xoá dấu tiếng Việt (Accent-insensitive)**. Giờ đây bạn có thể tìm "toan phat", "Toàn Phát" hay "toàn phát" đều ra kết quả chính xác 100%.
    *   **Đồng nhất Trải nghiệm**: Áp dụng bộ lọc tìm kiếm cao cấp này đồng bộ trên các module **Khách hàng, Sản phẩm & Kho, và Lên đơn nhanh (Quick Order)**.
    *   **Tối ưu Phân trang (Pagination Refresh)**: Cập nhật lại số bản ghi hiển thị (20 bản ghi/trang) giúp tra cứu nhanh hơn trên màn hình lớn.
- [x] **Lên đơn theo Danh mục (Category-Strict Search - Mar 3)**:
    *   **Ràng buộc Danh mục**: Khi chọn danh mục cụ thể tại trình Lên đơn nhanh (Quick Order), hệ thống sẽ lọc **duy nhất** các sản phẩm thuộc danh mục đó.
    *   **Loại bỏ Fallback**: Không còn tình trạng hiện sản phẩm từ danh mục khác khi tìm không thấy trong danh mục hiện tại, giúp tránh nhầm lẫn giữa các loại hàng có cùng SKU nhưng khác nhóm giá/đối tượng.
    *   **Tìm kiếm Toàn cục**: Nếu muốn tìm kiếm tất cả sản phẩm, người dùng chỉ cần để trống ô Danh mục hoặc chọn "-- Tất cả danh mục --".
- [x] **Vá lỗi Mobile UX (Mobile Focus & Zoom Fix - Mar 3)**:
    *   **Ngăn ngừa Auto-zoom**: Nâng cấp toàn bộ font-size của các ô nhập liệu lên **16px (text-base)**. Điều này giúp ngăn trình duyệt (đặc biệt là iOS Safari) tự động phóng to và gây hiện tượng "nhảy" layout khi người dùng nhấn vào ô tìm khách hàng hoặc nhập số lượng.
    *   **Click Outside**: Bổ sung cơ chế tự động đóng danh sách gợi ý khách hàng khi người dùng nhấn ra ngoài, giúp giao diện gọn gàng và ổn định hơn trên thiết bị di động.
- [x] **Tích hợp Dẫn đường Google Maps (Mar 4)**: Cập nhật nút "Xem vị trí" trong chi tiết khách hàng thành **"Tới vị trí"**. Khi nhấp vào, hệ thống tự động mở Google Maps và kích hoạt chế độ dẫn đường (Directions) đến tọa độ GPS của khách hàng.
- [x] **Nâng cấp Hệ thống Thông báo & AI Notification (Enhanced Notification System - Mar 16)**:
    - **Hiển thị Ngày tháng**: Mỗi thông báo hiện đã hiển thị đầy đủ ngày giờ cụ thể bên cạnh thời gian tương đối.
    - **Phân trang Thông minh (3 items/page)**: Tích hợp phân trang cho chuông thông báo, giới hạn tối đa 5 trang (15 tin mới nhất) để tối ưu hiệu suất.
    - **Tự động Dọn dẹp (3-day Retention)**: Hệ thống tự động xóa bỏ các thông báo cũ sau 3 ngày để đảm bảo dữ liệu luôn sạch sẽ.
    - **Rút ngắn Nhắc nợ (3-day threshold)**: Cập nhật ngưỡng nhắc thu công nợ từ 6 ngày xuống còn **3 ngày**.
    - **Nexus AI Natural Language**: Tích hợp DeepSeek AI để tự động soạn thảo tiêu đề và nội dung thông báo (Hết kho, Nhắc nợ, Đồng bộ) bằng ngôn ngữ tự nhiên. (Gỡ bỏ tính năng tóm tắt AI để tinh gọn giao diện).
- [x] **Tự động hóa AI Kế toán & Phân tích Lợi Nhuận (AI Auto-Fix Finance - Mar 16)**:
    *   **Background Checker**: Tự động rà soát ngầm dữ liệu đơn hàng ngay khi truy cập mục Lợi nhuận để phát hiện sai sót (giá vốn = 0, nhân viên chọn sai).
    *   **Tự Động Fix Số Liệu (JSON Override)**: AI DeepSeek lập tức phân tích và tự động ghi đè, hiển thị lại `doanh thu`, `giá vốn` và `lợi nhuận` cho các đơn hàng sai sót mà không chớp trang.
    *   **Sparkles UX**: Thêm hiệu ứng nhấp nháy ánh sao đánh dấu các đơn hàng đã được AI can thiệp để người dùng dễ nhận biết.
- [x] **Sửa lỗi Trùng lặp Dữ liệu khi Nhập Hàng loạt (Bulk Import Fix - Mar 15)**:
    *   **One-to-One Match Tracking**: Khắc phục lỗi các sản phẩm giống hệt nhau (chỉ khác giá nhập) bị ghi đè lên nhau và hiển thị sai số lượng. Hệ thống giờ đây theo dõi chính xác từng bản ghi đã khớp, đảm bảo mỗi dòng trong file Excel ánh xạ độc lập đến 1 dòng trên CSDL, hoặc tự động tạo mới nếu bản ghi vượt định mức (ví dụ nhập 3 dòng cùng SKU -> tạo đủ 3 records).
- [x] **Tối ưu Tính toán Lợi Nhuận Tài Chính (Dynamic Profit Calculation - Mar 15)**:
    *   **Áp dụng Giá Nhập Hiện Tại**: Cập nhật logic tính toán `Giá Vốn` (Cost) trong module Tài Chính (Finance) và Tổng Quan (Dashboard) để tự động ánh xạ với `Giá nhập` (priceBuy) MỚI NHẤT của sản phẩm trong danh mục. Điều này giúp các báo cáo lợi nhuận cập nhật chính xác ngay lập tức khi Admin điều chỉnh giá nhập qua Bulk Import hoặc chỉnh sửa tay, thay vì bị khóa chết lấy theo giá cũ lúc lên đơn.
- [x] **Tối ưu Danh sách Công nợ trên Di động (Debt List Mobile Optimization - Mar 17)**:
    - **Giao diện Thẻ (Card Layout)**: Thiết kế lại danh sách công nợ cho điện thoại, chuyển từ bảng trượt ngang sang dạng thẻ trắng bo tròn hiện đại, giúp dễ theo dõi và thao tác.
    - **Trạng thái Sức khỏe Nợ (Debt Health)**: Tự động phân loại và gắn nhãn mức độ rủi ro (Rủi ro cao, Chậm trả, Theo dõi, An toàn) bằng màu sắc trực quan ngay trên thẻ.
    - **Thông tin Tập trung**: Mỗi thẻ hiển thị đầy đủ Tổng mua, Đã trả, Dư nợ và ngày giao dịch cuối cùng, tối ưu hóa không gian hiển thị.
    - **Tương tác Nhanh**: Tích hợp các nút chức năng "Xem chi tiết" và "Thu nợ" trực tiếp trên từng thẻ, hỗ trợ thao tác một tay mượt mà.

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
