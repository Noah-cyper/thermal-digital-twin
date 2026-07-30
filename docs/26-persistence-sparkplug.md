# 26 — Persistence bền (TimescaleDB) + Sparkplug B (deploy)

> Hạng mục (5) lộ trình HMI/hạ tầng. Base app chạy **in‑memory** (MemoryHistorian) như thường; phần này
> chỉ BẬT khi muốn **lưu bền ≥ 50.000 điểm/s** vào TimescaleDB và **publish tag qua MQTT Sparkplug B**.

## Kiến trúc (giữ DI — kernel/engine không phụ thuộc cứng pg/mqtt)
- Engine đã có + test sẵn (không cần DB/broker để kiểm): `TimescaleHistorian` (ghi **đệm đồng bộ** +
  **flush batch** — 1 INSERT nhiều dòng → đạt ≥ 50k điểm/s, xác nhận bởi `loadgen-benchmark.test.ts`);
  `jsonCodec`/`SparkplugDriver` (doc 16). Cả hai nhận adapter qua **dependency injection**.
- Lớp deploy `apps/thermal-runtime/src/persistence.ts` cấp adapter **thật**:
  - `SqlExecutor` ← `pg` (node‑postgres) — import **động** (base app không cần `pg`).
  - `MqttTransport` ← `mqtt` (mqtt.js) — import **động**.
- `startServer` gọi `startPersistence(rt, …)` **chỉ khi** có biến môi trường → base run không chạm pg/mqtt.

## Cách chạy
```bash
# 1) Dựng hạ tầng
docker compose up -d                       # TimescaleDB (5432) + Mosquitto (1883)

# 2) Cài adapter thật (chỉ cho chế độ persistence — optional, không nằm trong base app)
pnpm add -w pg mqtt

# 3) Bật runtime kèm persistence
IDTP_TIMESCALE_URL=postgres://idtp:idtp@localhost:5432/idtp \
IDTP_MQTT_URL=mqtt://localhost:1883 \
pnpm --filter @idtp/app-thermal-runtime serve
```
Log khởi động sẽ in `[persist] BẬT — Timescale: true · Sparkplug: true`.

- **TimescaleDB:** bảng `tag_history` (hypertable theo `ts`) — mỗi chu kỳ ghi 1 INSERT nhiều dòng cho toàn
  bộ tag ghi được. Kiểm: `SELECT count(*) FROM tag_history;` tăng đều.
- **Sparkplug B:** publish `spBv1.0/IDTP/NBIRTH/thermal-600` (birth, đủ metric + alias) rồi
  `…/NDATA/thermal-600` theo chu kỳ. Kiểm: `mosquitto_sub -t 'spBv1.0/#' -v`.

Chỉ đặt 1 trong 2 biến nếu chỉ cần một tính năng. Bỏ cả hai → chạy in‑memory như cũ.

## Ranh giới kiểm chứng (trung thực)
- **ĐÃ kiểm trong CI/không cần hạ tầng:** logic engine (đệm/batch/throughput ≥ 50k), codec Sparkplug,
  và **wiring** `startPersistence` (test `persistence.test.ts` inject adapter GIẢ → xác nhận DDL init +
  INSERT theo chu kỳ + NBIRTH/NDATA; và "không cấu hình → không chạm adapter").
- **CHƯA kiểm trong repo (cần hạ tầng của bạn):** kết nối **thật** tới TimescaleDB/broker + thông lượng
  thật — chạy `docker compose up` ở trên để nghiệm thu tại chỗ. `pg`/`mqtt` là dependency **optional**,
  cài khi dùng (bước 2).

## Production (ngoài phạm vi v1)
TLS + auth + ACL cho MQTT; connection pool + retention/compression policy cho TimescaleDB; protobuf codec
Sparkplug thay `jsonCodec`; store‑and‑forward khi mất kết nối.
