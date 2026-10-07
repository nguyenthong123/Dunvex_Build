# 🤖 NGUYÊN TẮC VẬN HÀNH & BẮT BUỘC DÀNH CHO AI AGENT (DUNVEX BUILD)

> **QUAN TRỌNG TỐI CAO**: Bất kỳ AI Agent / trợ lý lập trình nào khi bắt đầu phiên làm việc mới đều **BẮT BUỘC** đọc kỹ, ghi nhớ và tuân thủ tuyệt đối các nguyên tắc dưới đây.
> **KHÔNG ĐƯỢC PHÉP ĐOÁN MÒ, KHÔNG TIỆN TAY NÉM TÍNH NĂNG APP LÊN WEB, KHÔNG ĐƯỢC LÀM ẢNH HƯỞNG CHÉO GIỮA CÁC NỀN TẢNG.**

---

## 🚫 1. NGUYÊN TẮC BẤT DI BẤT DỊCH: TÁCH BIỆT HOÀN TOÀN CÁC NỀN TẢNG (PLATFORM ISOLATION)

Hệ thống **Dunvex Build** bao gồm 2 thế giới hoàn toàn khác biệt:
1. **NỀN TẢNG WEB (`https://dunvex.com` chạy trên trình duyệt Desktop/Mobile)**:
   - **Bản chất**: Thin Client chạy trong trình duyệt người dùng.
   - **Cơ chế**: Giao tiếp trực tiếp với SQLite VPS qua REST API nhẹ (`apiClient.ts`) và WebSocket sự kiện. Dữ liệu RAM tức thì (`ramStore.ts`).
   - **Tối ưu**: Trình duyệt tự động dùng HTTP Cache tiêu chuẩn. Nhẹ, mượt, không tốn tài nguyên thiết bị.
   - ⛔ **CÁC ĐIỀU CẤM TUYỆT ĐỐI TRÊN WEB**:
     * **CẤM** hiển thị UI Phân vùng bộ nhớ 5GB (`StoragePartitionManager`), dung lượng lưu trữ offline.
     * **CẤM** hiển thị UI / chạy luồng Đồng bộ ngang hàng P2P kiểu Zalo (`P2PSyncBanner`, WebRTC, Socket.io p2p).
     * **CẤM** chạy các timer vòng lặp ngầm (như `setInterval(15s)`), cấm lắng nghe `window.onfocus` hay `document.visibilitychange` để quét đồng bộ đè dữ liệu gây nghẽn Main Thread, đơ trình duyệt và lag chuyển tab.
     * **CẤM** ép nạp và giải mã hình ảnh vào IndexedDB (`offlineImageCache`) trên Web.
     * **CẤM TỰ Ý ĐƯA BẤT KỲ GIAO DIỆN HOẶC TÍNH NĂNG NÀO NGƯỜI DÙNG YÊU CẦU "CHO APP" VÀO TRANG WEB.**

2. **NỀN TẢNG APP NATIVE (Android APK, macOS Desktop, Windows Desktop)**:
   - **Bản chất**: Cài đặt trực tiếp trên hệ điều hành, truy cập được phần cứng, bộ nhớ máy và file system.
   - **Cơ chế**: Offline-First hoàn toàn. Lưu trữ SQLite nội bộ (`localDatabase` / Capacitor SQLite), phân vùng tối đa 5GB, đồng bộ hai chiều VPS (`syncEngine.ts`), đồng bộ P2P giữa các thiết bị cùng tài khoản (`p2pSync.ts`), chứng chỉ bản quyền offline (`licenseService.ts`), sao chép ảnh vào Clipboard hệ thống.
   - 🔒 **YÊU CẦU BẮT BUỘC TRONG CODE**:
     * Mọi thành phần UI, Component, Modal, Card hoặc Logic chỉ dành cho App **BẮT BUỘC PHẢI BỌC BẰNG KIỂM TRA NỀN TẢNG**:
       ```tsx
       import { isNativeApp } from '../utils/platform';
       
       // Trong JSX:
       {isNativeApp() && <StoragePartitionManager />}
       
       // Trong Service / Hook:
       if (!isNativeApp()) return;
       ```
     * Nếu tính năng chỉ dành cho nền tảng cụ thể (ví dụ chỉ Android hoặc chỉ Desktop): sử dụng `isAndroid()`, `isMac()`, `isWindows()`.

---

## 🧭 2. QUY TẮC XÁC ĐỊNH PHẠM VI YÊU CẦU (SCOPE IDENTIFICATION)

Trước khi viết hoặc sửa bất kỳ dòng code nào, AI Agent phải đối chiếu yêu cầu của người dùng:
1. **Người dùng ghi: "trên app", "cho app", "bản app", "tải app", "cài vào thiết bị", "endroi", "mac", "win"**:
   - 👉 **CHỈ ĐƯỢC TRIỂN KHAI CHO APP NATIVE**.
   - Phải bọc điều kiện `isNativeApp()` để chặn 100% không cho rò rỉ sang Web.
   - Kiểm tra kỹ xem code có vô tình làm nặng Web hay không.
2. **Người dùng ghi: "trên web", "cho web", "bản web"**:
   - 👉 **CHỈ ĐƯỢC TRIỂN KHAI CHO WEB**.
   - Không được đụng vào các gói cài đặt hoặc luồng offline của App.
3. **Người dùng ghi: "cả web và app", "trên cả hai", "tất cả nền tảng"**:
   - 👉 Triển khai cho cả hai, nhưng áp dụng đúng kiến trúc của từng bên (Web dùng API VPS trực tiếp, App dùng Local SQLite + Sync).
4. **Trường hợp yêu cầu chung chung chưa rõ nền tảng**:
   - 👉 **PHẢI XEM XÉT BẢN CHẤT TÍNH NĂNG**: Nếu liên quan đến phần cứng/bộ nhớ máy/offline/P2P -> chỉ dành cho App. Nếu là nghiệp vụ bán hàng chung -> làm cho cả hai nhưng giữ Web luôn là Thin Client nhẹ nhàng. Tuyệt đối không được "tiện đâu làm đó".

---

## 📦 3. NGUYÊN TẮC DEPLOY & PHÂN QUYỀN LỆNH ĐỘC LẬP (DEPLOYMENT ISOLATION)

- ⛔ **CẤM TUYỆT ĐỐI TỰ ĐỘNG DEPLOY & TỰ ĐỘNG BACKUP**:
  * **CẤM** tự ý chạy bất kỳ lệnh deploy nào (`npm run deploy:web`, `npm run deploy:android`, `npm run deploy:mac`, `npm run deploy:win`, `npm run deploy:apps`, `deploy_vps.sh`, rsync, ssh...) khi **CHƯA ĐƯỢC SỰ CHO PHÉP / YÊU CẦU CỤ THỂ TỪ NGƯỜI DÙNG**.
  * **CẤM** tự ý chạy các quy trình sao lưu (backup) tự động, tạo bản sao snapshot nếu chưa có yêu cầu hay sự đồng ý trực tiếp từ người dùng.
- Tuyệt đối không chạy lệnh deploy bừa bãi. Khi người dùng cho phép/chỉ định deploy, sử dụng chính xác lệnh phân quyền:
- `npm run deploy:web [release_notes]`: Triển khai **DUY NHẤT** web app lên VPS (`dist/`, `server/releases/web.json`). Tuyệt đối không đụng đến thư mục `downloads/` hay release của Android/Mac/Windows.
- `npm run deploy:android [release_notes]`: Build APK Android với `versionCode` mới, tải lên `/downloads/dunvex_app.apk` và cập nhật `server/releases/android.json`.
- `npm run deploy:mac [release_notes]`: Đóng gói DMG macOS và cập nhật kênh `mac.json`.
- `npm run deploy:win [release_notes]`: Đóng gói Installer Windows x64 và cập nhật kênh `windows.json`.
- `npm run deploy:apps [release_notes]`: Build và phát hành đồng loạt toàn bộ các app native (Android, Mac, Win) mà không làm ảnh hưởng `dist/` của Web.

---

## 📱 4. NGUYÊN TẮC CẬP NHẬT ỨNG DỤNG ANDROID (OTA IN-APP UPDATE)

1. **Cơ chế kiểm tra phiên bản**:
   - Khởi động app: tự động kiểm tra với endpoint `https://dunvex.com/api/app-version` (hoặc `server/releases/android.json`).
   - Nút kiểm tra thủ công: Tại `src/views/AppSettings.tsx` và `src/views/DownloadApp.tsx` luôn có nút **"Kiểm tra cập nhật ứng dụng"** dispatch sự kiện:
     `window.dispatchEvent(new CustomEvent('check_app_updates', { detail: { manual: true } }))`.
2. **Quy trình cập nhật**:
   - Khi phát hiện `availableBuild > installedBuild`: Hộp thoại xác nhận tải và mở trình cài đặt Android (`AndroidAppUpdater.downloadAndInstallApk`).

---

## 📋 5. NGUYÊN TẮC SAO CHÉP & BỘ NHỚ TẠM (CLIPBOARD / IMAGE SHARING)

- **Trên Android Native**: Sử dụng bridge `window.AndroidClipboard.copyImageBase64(base64Data)` để lưu vào `ClipData` (với `FileProvider`) và ghi vào `MediaStore.Images.Media` (`Pictures/Dunvex`). Người dùng có thể dán (Paste) ngay vào Zalo, Messenger, Telegram.
- **Trên Desktop (Mac / Windows)**: Dùng Electron/Tauri bridge hoặc Clipboard API (`navigator.clipboard.write([new ClipboardItem(...)])`) và fallback tải file tự động.
- **Trên Web**: Dùng tiêu chuẩn trình duyệt Clipboard API với fallback download nhẹ nhàng.

---

## 🖥️ 6. NGUYÊN TẮC BỐ CỤC GIAO DIỆN (RESPONSIVE & TABLET LAYOUT)

- Hỗ trợ chuẩn xác các dải kích thước: Mobile (<768px), Tablet / iPad (768px - 1024px), Desktop / Large (>1024px).
- Trong `src/components/layout/MainLayout.tsx`:
  - Khung nội dung chính `<main>` phải luôn có class `min-w-0 flex-1 overflow-x-hidden` để tránh lỗi màn hình trắng khi co hẹp cửa sổ trên macOS/Windows hoặc mở trên tablet.

---

## 🗄️ 7. NGUYÊN TẮC DỮ LIỆU & OFFLINE-FIRST

1. **Cơ sở dữ liệu chính (VPS SQLite) - BẢO VỆ TUYỆT ĐỐI**:
   - VPS sử dụng SQLite production đặt tại `/home/zomby/dunvex_app/data/dunvex.db`.
   - ⛔ **CẤM TUYỆT ĐỐI ĐỤNG TỚI FILE DỮ LIỆU SQLITE TRÊN VPS**:
     * **CẤM** can thiệp, xóa, ghi đè, thay thế hoặc chỉnh sửa trực tiếp file `dunvex.db` trên VPS bằng lệnh shell, script tự chế hay SSH.
     * **CẤM** tự ý chạy các lệnh DDL nguy hiểm (như DROP, TRUNCATE, ALTER đè dữ liệu) làm thay đổi cấu trúc hoặc rủi ro mất mát dữ liệu production. Mọi thay đổi dữ liệu bắt buộc phải qua server API chuẩn.
   - Client **KHÔNG** sử dụng Firestore SDK trực tiếp; toàn bộ kết nối đi qua API bridge `src/services/fakeFirestore.ts` và `src/services/apiClient.ts`.
2. **Offline trên App Native**:
   - Sử dụng SQLite cục bộ (`src/services/nativeSqlite.ts` / `@capacitor-community/sqlite`).
   - Khi mất mạng: Đọc & ghi vào SQLite nội bộ trên máy, đồng bộ lên VPS khi có kết nối mạng trở lại (`src/services/syncEngine.ts`).
3. **Web Client**:
   - Đọc & ghi trực tiếp qua REST API lên VPS SQLite, cập nhật tức thì vào RAM store (`ramStore.ts`) để hiển thị mượt mà không độ trễ.
   - Nút làm mới trên Web: Gọi trực tiếp `refreshCollection()` từ VPS SQLite, tuyệt đối không kích hoạt luồng đồng bộ 2 chiều cồng kềnh của app.

---

## 🚦 CHECKLIST BẮT BUỘC PHẢI DUYỆT TRƯỚC KHI BÀN GIAO MỖI PHIÊN

Trước khi trả lời người dùng hoặc chạy bất kỳ lệnh deploy nào, AI Agent **BẮT BUỘC** tích đủ checklist sau:
- [ ] **1. ĐÚNG PHẠM VI NỀN TẢNG**: Yêu cầu này là dành cho Web, App, hay cả hai? Đã kiểm tra xem có tính năng nào của App bị "lọt nhầm" sang Web không?
- [ ] **2. CÁCH LY GIAO DIỆN (`isNativeApp`)**: Các component đặc thù của App (bộ nhớ 5GB, P2P sync, offline license) đã được bọc `{isNativeApp() && ...}` chưa?
- [ ] **3. KHÔNG GÂY LAG WEB**: Code mới có tạo interval ngầm, listener `focus`/`visibilitychange`, hay precache hình ảnh nặng vào IndexedDB của Web không?
- [ ] **4. AN TOÀN DỮ LIỆU & ĐIỀU KIỆN DEPLOY/BACKUP**: 
  - Không tự ý can thiệp hay sửa đổi trực tiếp file `dunvex.db` trên VPS.
  - Không tự ý chạy bất kỳ lệnh backup hay deploy nào nếu người dùng CHƯA cho phép trực tiếp.
- [ ] **5. KIỂM THỬ CODE**: Đã chạy `npx tsc --noEmit` đạt 0 lỗi và `npm test` đạt 100% pass chưa?
- [ ] **6. ĐÚNG LỆNH DEPLOY**: Khi được phép deploy, triển khai nền tảng nào thì chỉ dùng đúng lệnh của nền tảng đó (`deploy:web`, `deploy:android`, `deploy:mac`, hoặc `deploy:win`).

