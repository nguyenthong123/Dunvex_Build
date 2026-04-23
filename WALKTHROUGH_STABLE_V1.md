# Dunvex Build - Phiên bản Ổn định & Tinh gọn (Stable & Lean v1.0)

Phiên bản này đánh dấu sự hoàn thiện của quá trình dọn dẹp "Technical Debt" liên quan đến các module AI không ổn định (Nexus AI) và ổn định hóa giao diện người dùng chuyên nghiệp.

## 1. Các thay đổi chính (Chế độ Tinh gọn)
- **Loại bỏ Nexus AI**: Đã gỡ bỏ toàn bộ module điều khiển Nexus, Chatbot Zenith và các tham chiếu đến Groq API. Hệ thống hiện chạy hoàn toàn dựa trên logic nghiệp vụ cục bộ (Deterministic Logic), đảm bảo tốc độ phản hồi tức thì và không phụ thuộc vào bên thứ ba.
- **Tái cấu trúc Tài chính (Finance)**:
  - Chuyển đổi "Finance Bot" thành **Auto-Calc System**.
  - Sửa lỗi hiển thị lợi nhuận và các biểu tượng lấp lánh (Sparkles) gây crash.
  - Tối ưu hóa logic tính toán nợ ngân hàng và nhắc nợ thủ công.
- **Cập nhật Phiếu công nợ (Debt Statement)**:
  - Thiết kế lại giao diện máy tính: Loại bỏ khung viền thừa, tăng độ bóng đổ (Premium Shadow).
  - Thêm bộ công cụ Zoom (Phóng to/Thu nhỏ) và tính năng "Vừa màn hình" để hỗ trợ chụp ảnh màn hình toàn bộ phiếu nợ.
- **Cải thiện Lên đơn (Quick Order)**:
  - Thay thế AI Smart Auditor bằng hệ thống đối soát kho cục bộ.
  - Ổn định hóa icon và nút bấm trên giao diện di động.

## 2. Hướng dẫn sử dụng tính năng mới
### Xem phiếu nợ toàn màn hình:
1. Mở chi tiết công nợ khách hàng.
2. Sử dụng nút **"Vừa màn hình"** trên thanh tiêu đề để thu nhỏ phiếu nợ cho đến khi thấy toàn bộ chiều dài.
3. Chụp ảnh màn hình để gửi cho khách hàng.

### Chạy hệ thống tính toán tự động:
- Hệ thống sẽ tự động tính lãi và dư nợ dựa trên ngày chốt (Ngày 25 hàng tháng) mà không cần can thiệp thủ công từ AI.

## 3. Trạng thái Build & Deploy
- Đã kiểm tra build production thành công.
- Loại bỏ toàn bộ code rác và file orphaned (ZenithChatbot, NexusControl).
- Hệ thống đã sẵn sàng đẩy lên GitHub.

---
*Ngày hoàn thiện: 23/04/2026*
*Tác giả: Antigravity AI Assistant*
