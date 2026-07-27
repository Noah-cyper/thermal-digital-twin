# 18 — Security (IEC 62443)

> Tài liệu #18/00–25 (§14). Nguồn: §13 + doc 05‑07 (RBAC engine). Nguyên tắc IEC 62443 (không trích số điều khoản).

## 1. Zone & Conduit (Purdue)
```
L0–L1 Process (sim/field)  ─┐
L2 Supervisory  ← IDTP chạy ở đây
L3 Site Ops                 │  conduit có kiểm soát
IDMZ  ← dữ liệu ra ngoài MỘT CHIỀU
L4–L5 Enterprise / AI cloud ─┘ (nếu có)
```
Dữ liệu process ra ngoài **chỉ qua IDMZ, một chiều**. AI cloud (nếu dùng) ở L4–L5, không ghi ngược.

## 2. RBAC 6 vai — ma trận (doc 05‑07)
Viewer · Operator · Shift Supervisor · Engineer · Maintenance · Admin × hành động
(`view/ack/shelve/setpoint/mode/override/oos/engineer/admin`) — bảng đầy đủ ở **doc 05‑07 §3**.

## 3. Kiểm soát bắt buộc
| Hạng mục | Chuẩn |
|---|---|
| Lệnh ghi | xác nhận 2 bước + audit bất biến (user·IP·cũ/mới·lý do·UTC+offset) |
| Token | JWT access 15' + refresh xoay vòng |
| Session | lock sau 10' không thao tác (**không** khóa hiển thị alarm) |
| Biên I/O | validate Zod · rate limit · không tin client |
| Audit | fail‑closed, giữ ≥ 1 năm |

## 4. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑28 | Sơ đồ zone/conduit chi tiết theo hạ tầng triển khai thực |
