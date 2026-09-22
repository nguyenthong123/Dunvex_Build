# Thông Tin Máy Chủ Chuyên Dụng n8n (Dedicated n8n Server)

Tài liệu này lưu trữ toàn bộ thông số kỹ thuật, thông tin kết nối và kế hoạch triển khai cụm tự động hóa n8n trên máy chủ mới, hoàn toàn tách biệt với máy chủ chính `dunvex.com`.

---

## 1. Thông Tin Máy Chủ (Server Specifications)

| Mục | Chi tiết |
| :--- | :--- |
| **Instance Name** | `instance-20260904-071000` |
| **Zone / Region** | `us-central1-a` (Google Cloud Platform) |
| **External IP (Công khai)** | `34.133.127.214` |
| **Internal IP (Nội bộ)** | `10.128.0.2` |
| **Hệ điều hành (OS)** | Debian GNU/Linux 13 (trixie) - 64-bit |
| **Kernel** | `6.12.107+deb13-cloud-amd64` |
| **CPU** | **2 vCPUs** (mạnh gấp đôi VPS cũ 1 vCPU, xử lý workflow n8n rất nhanh) |
| **RAM vật lý** | 964 MB (~1 GB) |
| **Swap hiện tại** | 0 MB (Kế hoạch: tạo 4 GB Swap để n8n chạy vĩnh viễn không bị OOM) |
| **Dung lượng ổ cứng (SSD)**| 30 GB SSD (Hiện dùng 2.6 GB, còn trống **26 GB** / 90%) |
| **User đăng nhập** | `ubuntu` (có toàn quyền `sudo` không cần mật khẩu) |

---

## 2. Thông Tin Kết Nối SSH

* **Đường dẫn Private Key trên máy tính của bạn**:
  ```bash
  ~/.ssh/vps_n8n
  ```
* **Lệnh kết nối SSH trực tiếp từ máy cá nhân**:
  ```bash
  ssh -i ~/.ssh/vps_n8n ubuntu@34.133.127.214
  ```
* **Trạng thái kết nối**: ✅ **Đã kiểm tra & kết nối thành công 100%**.

---

## 3. Vai Trò Kiến Trúc Trong Hệ Thống Dunvex

```
               [ Khách hàng & Nhân viên ]
                           │
                           ▼
             ┌───────────────────────────┐
             │     VPS 1 (App chính)     │
             │       dunvex.com          │
             │     136.109.194.84        │
             │                           │
             │ • Web Dunvex Build        │
             │ • Express Backend API     │
             │ • Cơ sở dữ liệu SQLite    │
             │ ⚡ Tốc độ phản hồi: 0.18s │
             └─────────────▲─────────────┘
                           │ (Gọi API bảo mật qua HTTPS)
                           │ Header: x-api-key, x-owner-id
                           │
             ┌─────────────┴─────────────┐
             │    VPS 2 (Máy chủ mới)    │
             │  instance-20260904-071000 │
             │      34.133.127.214       │
             │                           │
             │ • n8n Engine (Docker)     │
             │ • Webhook Nhận Đơn Web    │
             │ • Auto-Pilot Đối Soát Bank│
             │ • Nexus AI Agent          │
             └─────────────▲─────────────┘
                           │
              [ Web Bán Hàng zbuild ]
        (Bắn webhook đơn hàng về n8n)
```

### Lợi ích của kiến trúc 2 máy chủ:
1. **Bảo vệ tuyệt đối cho `dunvex.com`**: Web chính và app nhân viên luôn mượt mà (0.18s), không bao giờ bị giật lag hay treo do tác vụ nặng.
2. **n8n có 2 vCPU + 4GB Swap**: Xử lý logic webhook, parse dữ liệu, chạy AI Agent độc lập mà không bị thắt cổ chai tài nguyên.
3. **An toàn dữ liệu**: Đơn hàng sau khi n8n tiếp nhận và chuẩn hóa sẽ tự động đẩy qua API bảo mật vào `dunvex.com`.

---

## 4. Kế Hoạch Triển Khai n8n (Các bước tiếp theo)

1. **Tạo 4GB Swap**: Tận dụng 26GB SSD trống để mở rộng bộ nhớ đệm, đảm bảo n8n chạy ổn định 24/7.
2. **Cài đặt Docker & Nginx**: Chuẩn bị môi trường container và reverse proxy.
3. **Cấu hình SSL HTTPS**: Dùng Let's Encrypt cho domain `https://34-133-127-214.nip.io`.
4. **Khởi chạy n8n & nạp 3 Workflows**:
   - `Dunvex - Webhook Nhận Đơn Từ Web Khác (Chống Rớt Đơn)`
   - `Dunvex Nexus - Tự Động Đối Soát Thanh Toán & Quét Hết Hạn (Auto-Pilot)`
   - `Dunvex Nexus - Super Admin AI Agent`
5. **Cập nhật Webhook URL trong `zbuild`** sang máy chủ mới.
