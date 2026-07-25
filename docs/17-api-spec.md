# 17 — API Specification (REST + WebSocket)

> Tài liệu #17/00–25 (§14). Nguồn: Phụ lục A §10.6. REST versioned + OpenAPI 3.1 + WS delta.
> Bảo mật: doc 05‑07/18. Lỗi RFC 7807; phân trang cursor.

## 1. REST `/api/v1`
| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` |
| Tag | `GET /tags` · `GET /tags/:id` · `GET /tags/:id/history` |
| Alarm | `GET /alarms` · `POST /alarms/:id/ack` · `POST /alarms/:id/shelve` |
| Trend | `GET /trends` · `POST /trends` |
| Report | `GET /reports` · `POST /reports` |
| Event/Equip | `GET /events` · `GET /equipment` · `GET /maintenance` |
| RBAC | `GET /users` · `GET /roles` |
| System/Sim | `GET /system/health` · `POST /sim/scenario` |

Lệnh ghi (`ack`/`shelve`/setpoint/mode) → audit + xác nhận 2 bước (doc 05‑07).

## 2. OpenAPI 3.1 (skeleton)
```yaml
openapi: 3.1.0
info: { title: IDTP API, version: 1.0.0 }
paths:
  /api/v1/tags/{id}/history:
    get:
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
        - { name: from, in: query, schema: { type: string, format: date-time } }
        - { name: to,   in: query, schema: { type: string, format: date-time } }
        - { name: agg,  in: query, schema: { enum: [avg,min,max,stddev,last,total] } }
      responses:
        "200": { description: OK }
        "400": { $ref: "#/components/responses/Problem" }   # RFC 7807
components:
  responses:
    Problem: { description: Problem Details, content: { application/problem+json: {} } }
```

## 3. WebSocket
- **1 kênh** duy nhất; client **subscribe theo màn hình** (chỉ nhận tag đang hiển thị).
- Server gửi **delta** (alias, binary); heartbeat 5 s; auto‑resubscribe khi reconnect.
- Event types: `tag.delta` · `alarm.transition` · `replay.tick` (banner tím/cam).
- **Lệnh ra thiết bị bị chặn cứng ở tầng API khi Replay** (doc 05‑04).

## 4. Chuẩn chung
- Lỗi: **RFC 7807** Problem Details.
- Phân trang: **cursor‑based**.
- Validate mọi biên bằng **Zod** (doc 02 N6).

## 5. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑27 | Chi tiết schema từng endpoint sinh tự động từ Zod → OpenAPI ở pha code |
