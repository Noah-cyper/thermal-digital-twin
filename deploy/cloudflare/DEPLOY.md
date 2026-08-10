# Đưa IDTP Digital Twin lên `hoantrantdh.com/digital-twin-factory`

Bản web tĩnh (`apps/web-static`) chạy TOÀN BỘ digital twin **trong trình duyệt** — không cần server.
Deploy bằng **Cloudflare Workers + Static Assets** (một project duy nhất, tự deploy mỗi lần push):

```
hoantrantdh.com/digital-twin-factory/*  ──(route Worker)──>  site-worker.js  ──(bóc tiền tố)──>  ASSETS (apps/web-static/dist)
        (site chính mọi path khác: KHÔNG đụng)                                                   index.html · hmi.html · idtp-local.js · /screen/<id>
```

Cấu hình nằm sẵn trong repo:
- **`wrangler.toml`** (gốc repo): tên Worker, binding `ASSETS` = `apps/web-static/dist`, route subpath.
- **`deploy/cloudflare/site-worker.js`**: bóc tiền tố `/digital-twin-factory` rồi trả file tĩnh qua `ASSETS`.

---

## Sửa lỗi build vừa rồi
Build trước **fail ở bước Deploying** vì repo chưa có `wrangler.toml` ở gốc → `npx wrangler deploy` không biết
deploy gì. Nay đã thêm `wrangler.toml`. **Chỉ cần bấm `Retry build`** (hoặc push commit này) là deploy chạy.

Cấu hình build của project (đã đúng, giữ nguyên):
| Trường | Giá trị |
|---|---|
| Build command | `pnpm install && pnpm build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| Branch | `claude/doc-analysis-lna6sz` |

> pnpm tự nhận (repo có `"packageManager": "pnpm@9.7.0"`); Node lấy từ `.node-version` = 20.

---

## Sau khi deploy thành công

### Nếu route tự gắn được (build token đủ quyền)
Mở thẳng **https://hoantrantdh.com/digital-twin-factory** → xong.

### Nếu deploy log báo lỗi quyền route (`workers routes`), làm 1 bước tay:
1. Tạm bỏ route: xoá khối `routes = [...]` trong `wrangler.toml`, push lại → deploy sẽ qua (Worker có URL `*.workers.dev`).
2. Vào **Workers & Pages → thermal-digital-twin → Settings → Domains & Routes → Add → Route:**
   - **Route:** `hoantrantdh.com/digital-twin-factory*`
   - **Zone:** `hoantrantdh.com`
   → Add route.
3. (Tuỳ chọn) đưa `routes` lại vào `wrangler.toml` cho lần sau khai báo bằng code.

---

## Kiểm tra
Mở **https://hoantrantdh.com/digital-twin-factory** → landing tiếng Việt → **"Mở HMI đầy đủ"** →
sơ đồ tổng thể nhà máy chạy live trong trình duyệt (tự đăng nhập vai Operator).
- ~32 thiết bị, số liệu nhảy (MW/hơi/áp/O₂ trên banner).
- Click **Máy phát** → drill xuống màn D3.
- F12 → Console: không lỗi đỏ (ngoài favicon 404 vô hại).

> Lưu ý: URL `*.workers.dev` (không có `/digital-twin-factory`) sẽ hiển thị lệch vì trang neo `base href`
> vào subpath — hãy test trên `hoantrantdh.com/digital-twin-factory`.

## Tự cập nhật mỗi lần push
Push vào `claude/doc-analysis-lna6sz` → Workers Builds tự `pnpm install && pnpm build` → `npx wrangler deploy`
→ subpath có bản mới sau ~1–3 phút. Worker chỉ cần deploy lại khi đổi logic (hiếm).

## Build thử tại máy
```bash
pnpm install && pnpm build            # gồm apps/web-static
npx wrangler deploy --dry-run         # kiểm cấu hình + đọc assets (không cần đăng nhập)
```

## Ghi chú
- Muốn **subdomain** (`digital-twin-factory.hoantrantdh.com`) thay vì subpath: bỏ `routes`, thêm Custom Domain
  cho Worker, rồi đổi `BASE` trong `apps/web-static/build.mjs` về `'/'` và `PREFIX` xử lý tương ứng.
- Bản web là **demo chỉ đọc**, chạy client-side; không có dữ liệu/hạ tầng thật (Timescale/MQTT/OPC-UA).
