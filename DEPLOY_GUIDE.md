# HƯỚNG DẪN TRIỂN KHAI DROP60.LIVE LÊN PRODUCTION (GITHUB, RENDER & VERCEL)

Tài liệu này hướng dẫn chi tiết từng bước đưa dự án **DROP60.LIVE** từ máy tính cá nhân lên GitHub, triển khai Backend lên Render và Frontend lên Vercel đảm bảo **100% không gặp lỗi CORS, không đứt kết nối WebSocket**, và cơ sở dữ liệu tự động đồng bộ.

---

## BƯỚC 1: ĐẨY TOÀN BỘ CODE TỪ LOCAL LÊN GITHUB

Mở terminal tại thư mục gốc dự án (`drop60-live`) và thực hiện lần lượt các lệnh sau:

```bash
# 1. Kiểm tra trạng thái Git
git status

# 2. Thêm toàn bộ file vào staging
git add .

# 3. Tạo commit
git commit -m "feat: complete production deployment configurations for Render and Vercel"

# 4. Đổi tên branch chính thành main (nếu đang ở master)
git branch -M main

# 5. Thêm remote repository GitHub của bạn (thay thế URL bằng repo thật của bạn)
git remote add origin https://github.com/<tai-khoan-cua-ban>/drop60-live.git

# 6. Push mã nguồn lên GitHub
git push -u origin main
```

---

## BƯỚC 2: TRIỂN KHAI BACKEND LÊN RENDER (`/server`)

Hệ thống hỗ trợ 2 cách triển khai: **Cách A (Khuyên dùng - 1 Click Blueprint)** hoặc **Cách B (Thiết lập thủ công)**.

### Cách A: Dùng Render Blueprint tự động qua file `render.yaml` (Khuyên dùng)
1. Truy cập [dashboard.render.com](https://dashboard.render.com/) -> Chọn **Blueprints** -> Bấm **New Blueprint Instance**.
2. Chọn repository `drop60-live` của bạn.
3. Render sẽ tự động đọc file [`render.yaml`](./render.yaml) ở thư mục gốc:
   - Tự động tạo cơ sở dữ liệu **PostgreSQL** (`drop60-db`).
   - Tự động tạo **Web Service** trỏ vào thư mục `/server`.
   - Tự động liên kết `DATABASE_URL` từ PostgreSQL vào Web Service.
4. Bấm **Apply**. Sau khoảng 2-3 phút, server sẽ build và khởi động thành công.

---

### Cách B: Tạo thủ công trên Render Dashboard

Nếu bạn muốn tự tạo từng dịch vụ thủ công:

#### 1. Tạo Database PostgreSQL trước:
- Bấm **New +** -> Chọn **PostgreSQL**.
- Name: `drop60-db`
- Database: `drop60_live`
- User: `drop60_user`
- Region: Chọn **Singapore** (độ trễ thấp nhất về Việt Nam).
- Plan: **Free**.
- Bấm **Create Database**. Sau khi tạo xong, copy chuỗi **Internal Database URL** (hoặc External Database URL).

#### 2. Tạo Web Service cho Backend:
- Bấm **New +** -> Chọn **Web Service** -> Kết nối repo GitHub của bạn.
- Điền các thông số cấu hình:
  - **Name:** `drop60-live-server`
  - **Root Directory:** `server`
  - **Runtime:** `Node`
  - **Region:** `Singapore` (cùng vùng với Database)
  - **Build Command:**
    ```bash
    npm install && npm run build
    ```
  - **Start Command:**
    ```bash
    npm run start
    ```
  - **Health Check Path:** `/health`

#### 3. Cấu hình Biến Môi Trường (Environment Variables) trên Render:
Tại mục **Environment** của Web Service, thêm các cặp Key - Value sau:

| Tên biến (Key) | Giá trị mẫu (Value) | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Chạy ở chế độ production |
| `PORT` | `10000` | Port mặc định của Render |
| `DATABASE_URL` | `postgresql://...` | Dán connection string PostgreSQL vừa copy |
| `ALLOWED_ORIGINS` | `https://drop60-live.vercel.app,http://localhost:3000` | Danh sách domain được phép gọi API/Socket (hỗ trợ nhiều domain cách nhau bởi dấu phẩy) |
| `CLIENT_URL` | `https://drop60-live.vercel.app` | Domain Frontend chính thức của bạn |
| `SERVER_BASE_URL` | `https://drop60-live-server.onrender.com` | URL chính của server Render (dùng sinh link TTS) |
| `JWT_SECRET` | `tao_chuoi_bi_mat_ngau_nhien_dai_32_ky_tu` | Mã khóa bảo mật xác thực tài khoản |
| `TTS_PROVIDER` | `google` | Mặc định miễn phí (`google`), hoặc điền `openai` / `elevenlabs` nếu có key |
| `BANK_ID` | `MB` | Mã ngân hàng nhận tiền VietQR (MB, VCB, TCB, ACB,...) |
| `BANK_ACCOUNT_NO` | `0123456789` | Số tài khoản ngân hàng nhận tiền |
| `BANK_ACCOUNT_NAME` | `NGUYEN VAN A` | Tên chủ tài khoản in hoa không dấu |
| `WEBHOOK_SECRET_KEY` | `drop60_secret_webhook_key` | Khóa bí mật đối soát Webhook ngân hàng |

> **Cơ chế Tự Động Hóa Thông Minh:** Khi phát hiện `DATABASE_URL` bắt đầu bằng `postgresql:`, script `prepare-db.js` sẽ tự động chuyển schema Prisma sang `postgresql`, chạy `prisma db push` để tạo toàn bộ bảng và nạp 5 bài viết mẫu tự động mà bạn không cần sửa code thủ công!

Sau khi Deploy xong, hãy lưu lại URL Backend của bạn (ví dụ: `https://drop60-live-server.onrender.com`).

---

## BƯỚC 3: TRIỂN KHAI FRONTEND LÊN VERCEL (`/client`)

1. Truy cập [vercel.com](https://vercel.com/) -> Bấm **Add New...** -> Chọn **Project**.
2. Chọn repository `drop60-live` của bạn -> Bấm **Import**.
3. Tại giao diện **Configure Project**:
   - **Framework Preset:** `Next.js` (Vercel tự động nhận diện).
   - **Root Directory:** Bấm nút **Edit** và chọn thư mục **`client`** -> Bấm **Continue**.
4. Tại mục **Environment Variables**, thêm biến sau:
   - **Key:** `NEXT_PUBLIC_SOCKET_URL`
   - **Value:** `https://drop60-live-server.onrender.com` *(Điền URL Backend Render ở Bước 2, **LƯU Ý:** KHÔNG để dấu gạch chéo `/` ở cuối)*.
5. Bấm **Deploy**. Vercel sẽ tự động build Next.js trong khoảng 1 phút và cấp cho bạn một domain dạng `https://drop60-live.vercel.app`.

---

## BƯỚC 4: BẢO ĐẢM 100% KHÔNG LỖI CORS & WEBSOCKET

Hệ thống DROP60.LIVE đã được tích hợp sẵn các cơ chế phòng thủ đa tầng:

1. **Tự động nhận diện mọi domain Vercel:**
   - Backend đã tích hợp bộ lọc Regex: Mọi domain có đuôi `.vercel.app` (kể cả các bản Preview branches của Vercel) đều tự động được cấp quyền truy cập CORS mà bạn không cần phải thêm thủ công từng sub-domain vào `ALLOWED_ORIGINS`.
2. **WebSocket Resilient Fallback:**
   - Socket.io được cấu hình cả 2 phương thức vận chuyển: `transports: ["websocket", "polling"]`.
   - Nếu đường truyền mạng của khách hàng hoặc proxy của nhà mạng chặn WebSocket, kết nối sẽ tự động lùi về HTTP Long-Polling mượt mà mà không làm gián đoạn buổi phát trực tiếp.
3. **Cấu hình Webhook Tự Động Nạp Tiền (SePay / Casso):**
   - Khi đăng ký dịch vụ thông báo biến động số dư tại [SePay.vn](https://sepay.vn) hoặc [Casso.vn](https://casso.vn):
   - Cài đặt Webhook URL nhận thông báo: `https://<ten-backend-render>.onrender.com/api/webhook/payment`
   - Phương thức: `POST`

---

## BƯỚC 5: KIỂM TRA SAU KHI TRIỂN KHAI (VERIFICATION CHECKLIST)

- [ ] **Kiểm tra Health Check Backend:**
  Mở trình duyệt truy cập: `https://<ten-backend-render>.onrender.com/health`
  Kết quả trả về JSON có dạng:
  ```json
  {
    "status": "ok",
    "uptime": 12.45,
    "service": "DROP60.LIVE Backend",
    "database": "connected"
  }
  ```
- [ ] **Kiểm tra Giao diện Sân khấu Frontend:**
  Mở domain Vercel của bạn trên điện thoại hoặc máy tính:
  - Đồng hồ đếm ngược nhảy mỗi 200ms mượt mà.
  - Chấm tròn xanh lá/đỏ báo hiệu trạng thái Socket.io `LIVE` kết nối thành công.
  - Nhạc nền (BGM) và giọng đọc thuyết minh tiêu đề bài viết phát to rõ ràng.
  - Đăng ký tài khoản, nạp tiền VietQR và bấm `KEEP` / `DROP` thời gian thực hoạt động trơn tru.

Chúc mừng bạn! Dự án **DROP60.LIVE** hiện đã sẵn sàng phục vụ hàng nghìn khán giả trên toàn thế giới 24/7!
