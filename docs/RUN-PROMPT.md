# PROMPT — Yêu cầu chạy dự án trên localhost:8080

> Dán prompt dưới đây cho một tài khoản/phiên Claude Code khác. Nhiệm vụ của phiên đó là **hướng dẫn
> người dùng dựng HMI tại http://localhost:8080 trên MÁY CỦA NGƯỜI DÙNG**, kiểm tra từng bước, xử lý lỗi.

---

```
NHIỆM VỤ: Giúp mình chạy được dự án IDTP — Digital Twin nhiệt điện than 600 MW — lên
http://localhost:8080 TRÊN MÁY CỦA MÌNH. Hãy hướng dẫn TỪNG BƯỚC, bảo mình chạy từng lệnh rồi
báo kết quả, và xử lý lỗi giúp mình. KHÔNG giả định công cụ đã cài sẵn. Máy mình là Windows
(cmd hoặc PowerShell) — lưu ý cú pháp Windows.

REPO: Noah-cyper/thermal-digital-twin
NHÁNH: claude/doc-analysis-lna6sz  (chứa toàn bộ công việc)

MỤC TIÊU: chạy được, dòng lệnh in ra "IDTP thermal-runtime: http://localhost:8080",
mở trình duyệt thấy HMI 99 màn hình.

LÀM THEO THỨ TỰ (đợi mình báo kết quả mỗi bước rồi mới sang bước sau):

1) Kiểm Node.js:   node -v
   - Ra v20 trở lên → sang bước 2.
   - "not recognized" → mình CHƯA có Node. Hướng dẫn mình tải Node.js LTS (≥20) tại
     https://nodejs.org , cài xong ĐÓNG và MỞ LẠI cửa sổ dòng lệnh, rồi kiểm lại node -v.

2) Bật pnpm (đi kèm Node qua corepack):
   corepack enable
   corepack prepare pnpm@9.7.0 --activate
   pnpm -v            (phải ra 9.7.0)
   - Nếu corepack "not recognized" → dùng:  npm i -g pnpm@9.7.0

3) Lấy mã nguồn đúng nhánh (nếu thư mục hiện tại chưa có file package.json):
   git clone https://github.com/Noah-cyper/thermal-digital-twin.git
   cd thermal-digital-twin
   git checkout claude/doc-analysis-lna6sz
   git pull
   - QUAN TRỌNG: dùng ĐÚNG link trên. ĐỪNG gõ "<repo>" (đó là chỗ điền mẫu); trên Windows cmd
     dấu < > là ký tự đặc biệt sẽ gây lỗi "&& was unexpected". Mỗi lệnh gõ 1 dòng, Enter từng dòng.
   - Nếu đã ở sẵn thư mục repo (dir package.json thấy file) → bỏ qua clone, chỉ checkout + pull.

4) Cài phụ thuộc & chạy:
   pnpm install
   pnpm --filter @idtp/app-thermal-runtime serve

5) Mở trình duyệt:  http://localhost:8080
   - Để cửa sổ dòng lệnh chạy; muốn dừng bấm Ctrl+C.
   - Đăng nhập demo (mật khẩu: p ):  viewer / operator / supervisor / engineer / maint / admin
     (server tự vào vai Operator khi kết nối).

XỬ LÝ LỖI THƯỜNG GẶP (chủ động chỉ mình):
   - "'pnpm' is not recognized"  → chưa cài Node/pnpm → quay lại bước 1–2.
   - "&& was unexpected at this time" / lỗi khi clone → do gõ "<repo>" hoặc dấu < > →
     dùng link thật, mỗi lệnh 1 dòng.
   - Cổng 8080 đang bận → đổi cổng:
        cmd:         set PORT=3010 && pnpm --filter @idtp/app-thermal-runtime serve
        PowerShell:  $env:PORT=3010; pnpm --filter @idtp/app-thermal-runtime serve
     rồi mở http://localhost:3010
   - "ERR_MODULE_NOT_FOUND" → phải chạy bằng lệnh "serve" ở trên (KHÔNG chạy node dist/server.js).
   - Clone/pull báo thiếu quyền → tài khoản này cần được cấp quyền truy cập repo GitHub trước.

Chi tiết dự án ở README.md và docs/HANDOVER.md trong repo.
Xác nhận với mình khi http://localhost:8080 mở được và hiện HMI, rồi chỉ mình 2–3 thao tác thử
(kéo đặt tải, tiêm sự cố mất chân không, ACK alarm).
```

---

**Ghi chú:** Nếu tài khoản kia là agent chạy trong container riêng (không phải máy người dùng), thì
`localhost:8080` là localhost của container đó — người dùng ngoài không truy cập được. Khi đó agent nên
**hướng dẫn người dùng tự chạy trên máy họ** (đúng như prompt trên), không tự mở trong container rồi báo
"đã chạy". Bản dashboard tự chứa `docs/dashboard/twin.html` là phương án xem nhanh không cần cài gì.
