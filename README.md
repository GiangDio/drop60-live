# DROP60.LIVE - Single-Screen Live Stage (24/7)

Hệ thống phát sóng trực tiếp một màn hình duy nhất (**Single-screen Live Stage**) hoạt động 24/7 với kiến trúc Fullstack hiện đại, phân tách độc lập giữa `/client` và `/server` trong cùng một repository.

---

## 🏗️ Cấu trúc thư mục (Monorepo - Dual Independent Projects)

```
drop60-live/
├── .gitignore               # Root gitignore chuẩn (node_modules, build, SQLite db, env)
├── README.md                # Tài liệu chi tiết tính năng & khởi chạy
├── client/                  # Frontend Next.js 16 (Deploy Vercel)
│   ├── .env.example         # Template biến môi trường frontend
│   ├── .env.local           # Biến môi trường local (NEXT_PUBLIC_SOCKET_URL)
│   ├── package.json         # Next.js 16, Tailwind CSS, Lucide, Howler, Socket.io-client
│   ├── tsconfig.json
│   └── src/
│       ├── app/             # App Router & giao diện chính 4 tầng
│       ├── components/      # AuthScreen, TopTierModal, CreatePostModal
│       └── lib/             # api.ts, socket.ts, soundEngine.ts (Web Audio Synthesizer)
└── server/                  # Backend Node.js / Express (Deploy Render)
    ├── .env.example         # Template biến môi trường backend
    ├── .env                 # Biến môi trường local (PORT, DATABASE_URL, CLIENT_URL, JWT_SECRET)
    ├── package.json         # Express, Socket.io, TypeScript, Prisma, TSX
    ├── tsconfig.json
    ├── prisma/
    │   ├── schema.prisma    # Prisma schema (SQLite dev -> PostgreSQL prod)
    │   └── dev.db           # SQLite database chạy local lập tức
    └── src/
        ├── index.ts         # Express server + Socket.io gateway + Health check
        ├── prisma.ts        # Prisma client singleton
        ├── middleware/      # JWT auth middleware cho HTTP & Socket.io
        ├── routes/          # authRoutes, walletRoutes, postRoutes
        └── services/        # stageEngine.ts (Game Loop 200ms), seedService.ts
```

---

## 🎮 Cơ chế Vận hành Cốt lõi (Core Game Loop)

1. **Chu kỳ phát sóng 24/7 (200ms Server Tick):**
   - Mỗi bài đăng lên sóng có mặc định `60.0s` (`remainingMs = 60000`).
   - Server tick mỗi `200ms`: broadcast `STAGE_TICK` tới toàn bộ client.
   - Nút `🔴 DROP`: Giảm ngay `-0.2s` (`-200ms`).
   - Nút `🟢 KEEP`: Tăng ngay `+0.2s` (`+200ms`). Trần sống sót tối đa là **180 giây**.
2. **Kết thúc phiên:**
   - **DROPPED:** Nếu đồng hồ về 0s trước mốc 180s -> Đóng dấu đỏ `DROPPED` (kèm thời gian sống sót), nghỉ 3s rồi nạp bài kế tiếp.
   - **TOP TIER (Hall of Fame):** Nếu sống sót đủ 180s -> Đóng dấu vàng kim `TOP TIER`, lưu vào Bảng Vàng vinh danh, nghỉ 4s rồi chuyển bài mới.
3. **Ưu tiên hàng chờ (Priority Queue):**
   - Bài đăng nộp phí ưu tiên (10.000 VNĐ) sẽ được phát sóng trước bài thường.
   - Nếu hàng chờ hết bài, hệ thống tự động xoay vòng lại 5 bài mẫu có sẵn.

---

## 📱 Giao diện 4 Tầng Mobile-First (9:16)

1. **Top Bar (10% chiều cao):**
   - Logo `DROP60.LIVE` phát sáng + đèn đỏ nhấp nháy + số người xem trực tiếp.
   - Đồng hồ đếm ngược cực lớn định dạng `MM:SS.ms` (ví dụ `00:58.4`), đổi sang màu đỏ và rung lắc dữ dội khi dưới 10 giây.
   - Tên người dùng, số dư ví VNĐ, nút `[+ Nạp 20k]` và nút `[🏆 Top Tier]`.
2. **Main Stage (65% chiều cao):**
   - Ảnh bài đăng tràn viền chuẩn Unsplash sắc nét + Tag thể loại BGM + Tiêu đề + Poster.
   - **Lớp phủ Danmaku:** Tin nhắn bình luận bay ngang màn hình từ phải sang trái theo thời gian thực.
   - **Lớp phủ Con dấu Kết thúc:** Hiệu ứng đóng dấu khổng lồ "DROPPED" (kèm số giây trụ được) hoặc "TOP TIER" (180s).
3. **Sub-bar (10% chiều cao):**
   - Ô nhập chat Danmaku tức thì + Nút `[🔊 Ghim 5k]` (tin nhắn chữ vàng viền neon nổi bật) + Nút `[➕ Đăng bài]`.
4. **Cụm nút Thao túng Thời gian (15% chiều cao ở đáy):**
   - Chia đôi 50/50: `🔴 DROP (-0.2s)` với hiệu ứng lún nút vật lý và `🟢 KEEP (+0.2s)` với hào quang xanh.
   - Hỗ trợ phím tắt bàn phím: Bấm `[D]` để DROP, bấm `[K]` hoặc `[Space]` để KEEP.

---

## 🔊 Động cơ Âm thanh Thuần Web Audio API & Web Speech API

Không phụ thuộc file `.mp3` ngoài, toàn bộ hiệu ứng âm thanh được tổng hợp thời gian thực bằng bộ dao động tần số (Oscillators):
- **DROP:** Tiếng bíp trầm trượt tần số nhanh (`sawtooth` 160Hz -> 55Hz).
- **KEEP:** Tiếng ting tinh thể pha lê (`sine` hài âm kép 880Hz + 1760Hz).
- **Danmaku Chat:** Tiếng gõ phím nhẹ phản hồi tương tác.
- **Ghim 5k:** Hợp âm rải Sparkle lấp lánh (C5 - E5 - G5 - C6).
- **Đóng dấu DROPPED:** Tiếng dập búa nặng (`sawtooth` 120Hz -> 20Hz bass impact).
- **Vinh danh TOP TIER:** Tiếng kèn lệnh Fanfare hợp âm A Major hào hùng.
- **Web Speech API (`window.speechSynthesis`):** Tự động đọc to tiêu đề bài viết mới bằng giọng tiếng Việt trong 10 giây đầu khi bài vừa lên sóng.

---

## 🚀 Hướng dẫn Khởi chạy Local

### 1. Khởi động Backend Server (Port 4000)
```bash
cd server
npm install
npm run dev
```
- **Health check:** `http://localhost:4000/health`
- **Socket.io Endpoint:** `http://localhost:4000`
- **Tài khoản test có sẵn:** `curator` / `curator123` (hoặc Đăng ký tài khoản mới được tặng sẵn **50.000 VNĐ**).

### 2. Khởi động Frontend Client (Port 3000)
```bash
cd client
npm install
npm run dev
```
- **Truy cập Giao diện:** Mở trình duyệt tại `http://localhost:3000`

---

## 🌐 Hướng dẫn Triển khai Production

### 1. Frontend (`/client`) -> Vercel
1. Kết nối repo GitHub với Vercel.
2. Thiết lập **Root Directory**: `client`.
3. Framework Preset: **Next.js**.
4. Biến môi trường: `NEXT_PUBLIC_SOCKET_URL=https://<your-render-backend-url>`.
5. Bấm **Deploy**.

### 2. Backend (`/server`) -> Render
1. Tạo một **Web Service** mới trên Render trỏ vào repo GitHub.
2. Thiết lập **Root Directory**: `server`.
3. Environment: **Node**.
4. Build Command: `npm install && npx prisma generate && npm run build`.
5. Start Command: `npm run start`.
6. Biến môi trường:
   - `PORT=4000`
   - `CLIENT_URL=https://<your-vercel-domain>`
   - `JWT_SECRET=<chuoi_bi_mat_ngau_nhien>`
   - `DATABASE_URL=<postgres_connection_string_tu_render_postgres>`
7. *Chuyển đổi Database sang PostgreSQL*:
   Trong file `server/prisma/schema.prisma`, đổi `provider = "sqlite"` thành `provider = "postgresql"`.
