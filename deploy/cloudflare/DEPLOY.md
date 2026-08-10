# Đưa IDTP Digital Twin lên `hoantrantdh.com/digital-twin-factory`

Bản web tĩnh (`apps/web-static`) chạy TOÀN BỘ digital twin **trong trình duyệt** — không cần server.
Deploy gồm 2 phần trên Cloudflare (DNS của `hoantrantdh.com` đã ở Cloudflare):

```
Người dùng ──> hoantrantdh.com/digital-twin-factory/*  ──(Worker route)──>  <project>.pages.dev/*  (Cloudflare Pages)
             (site chính mọi path khác: KHÔNG đụng)          bóc tiền tố           site tĩnh: index.html + hmi.html + idtp-local.js + /screen/<id>
```

- **Cloudflare Pages** = build & host site tĩnh, **tự deploy mỗi lần push** (Git-integration).
- **Cloudflare Worker** = chen site vào **subpath** `/digital-twin-factory` mà không ảnh hưởng site chính.

---

## PHẦN A — Tạo Cloudflare Pages (build + auto-deploy)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Chọn repo `Noah-cyper/thermal-digital-twin`. **Production branch:** `claude/doc-analysis-lna6sz`.
3. **Build settings:**
   | Trường | Giá trị |
   |---|---|
   | Framework preset | **None** |
   | Build command | `pnpm install && pnpm build` |
   | Build output directory | `apps/web-static/dist` |
   | Root directory | *(để trống — gốc repo)* |
   - pnpm tự nhận (repo có `"packageManager": "pnpm@9.7.0"`). Node lấy từ `.node-version` = 20 ở gốc repo.
   - Nếu build lỗi thiếu Node mới: thêm **Environment variable** `NODE_VERSION=20`.
4. **Save and Deploy.** Chờ build (~1–3 phút). Xong sẽ có domain dạng `https://<project>.pages.dev`.
5. **Kiểm tra tạm** (trước khi gắn subpath): mở `https://<project>.pages.dev/hmi.html` —
   sẽ thấy sơ đồ nhà máy chạy live (đường dẫn `/digital-twin-factory/...` chưa chạy ở bước này là bình thường
   vì base path trỏ subpath; nhưng `hmi.html` mở trực tiếp vẫn nạp được HMI).

> Từ giờ **mỗi lần push vào `claude/doc-analysis-lna6sz` → Pages tự build lại + deploy.** Không cần làm gì thêm.

---

## PHẦN B — Gắn Worker chen subpath `/digital-twin-factory`

**Cách 1 — Dashboard (khỏi cài gì):**
1. **Workers & Pages** → **Create** → **Create Worker** → đặt tên `digital-twin-factory` → **Deploy** (code mặc định).
2. **Edit code** → dán toàn bộ `deploy/cloudflare/worker.js`, **đổi** `PAGES_ORIGIN` thành domain Pages ở Phần A
   (ví dụ `https://idtp-thermal.pages.dev`) → **Deploy**.
3. Vào Worker → tab **Settings → Domains & Routes → Add → Route:**
   - **Route:** `hoantrantdh.com/digital-twin-factory*`
   - **Zone:** `hoantrantdh.com`
   → **Add route.**

**Cách 2 — Wrangler (CLI):**
```bash
cd deploy/cloudflare
# sửa PAGES_ORIGIN trong worker.js trước
npx wrangler login
npx wrangler deploy        # dùng wrangler.toml (đã khai route sẵn)
```

---

## PHẦN C — Kiểm tra

Mở **https://hoantrantdh.com/digital-twin-factory** → trang giới thiệu (landing) tiếng Việt →
bấm **"Mở HMI đầy đủ"** → sơ đồ tổng thể nhà máy chạy live ngay trong trình duyệt (tự đăng nhập vai Operator).

Kiểm nhanh:
- Sơ đồ hiển thị ~32 thiết bị, số liệu nhảy (MW/hơi/áp/O₂ trên banner).
- Click một thiết bị (vd **Máy phát**) → drill xuống màn D3.
- F12 → Console: không có lỗi đỏ (ngoài favicon 404 vô hại).

---

## Tự cập nhật mỗi lần push
- **Pages (site) tự động:** push code → Cloudflare build lại + deploy (~1–3 phút) → subpath tự có bản mới.
- **Worker chỉ set 1 lần:** chỉ deploy lại khi đổi logic proxy (hiếm) — không đổi khi cập nhật nội dung twin.

## Build thử tại máy (tuỳ chọn)
```bash
pnpm install && pnpm build            # build cả monorepo, gồm apps/web-static
ls apps/web-static/dist               # index.html · hmi.html · idtp-local.js · screen/ · _headers
```

## Ghi chú
- Nếu sau này muốn **subdomain** (`digital-twin-factory.hoantrantdh.com`) thay vì subpath: bỏ Worker,
  vào Pages → **Custom domains** → thêm subdomain; rồi đổi `BASE` trong `apps/web-static/build.mjs` về `'/'`.
- Bản web là **demo chỉ đọc**, chạy client-side; không có dữ liệu/hạ tầng thật (Timescale/MQTT/OPC-UA).
