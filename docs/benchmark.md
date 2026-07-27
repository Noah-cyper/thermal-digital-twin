# Benchmark — Historian throughput (doc 19 / doc 24 W12)

> Mốc CLAUDE.md: **ghi historian ≥ 50.000 điểm/s**. Đo bằng `loadgen` (điểm tất định, không
> `Math.random`) trên đường ĐỆM đồng bộ; bền hoá xuống TimescaleDB bằng `flush()` batch bất đồng bộ.

## 1. Kiến trúc đạt ≥ 50k điểm/s

- `write(points)` = **đệm đồng bộ** (chỉ push vào mảng) → rất nhanh, không chặn vòng process.
- `flush()` = **một INSERT nhiều dòng** (parametrized) → TimescaleDB nuốt cả lô, hypertable chunk
  theo thời gian → ghi tuần tự hiệu quả. Ứng dụng gọi flush theo chu kỳ (vd mỗi 1 s hoặc khi đệm đầy).
- Cùng chữ ký `write/query` như `MemoryHistorian` → đổi adapter không sửa vòng runtime (L-kernel).

## 2. Cách chạy

```bash
pnpm -F @idtp/engines test loadgen-benchmark   # in throughput ra console ([bench] …)
```

Kết quả tham chiếu (CI, in-process, không DB) — `packages/engines/test/loadgen-benchmark.test.ts`:

| Đường ghi | Quy mô | Throughput |
|---|---|---|
| `MemoryHistorian.write` | 100k điểm (1000 tag × 100 mẫu) | **≫ 50.000 điểm/s** (đệm mảng) |
| `TimescaleHistorian.write` (đệm) | 100k điểm | **≫ 50.000 điểm/s** |

> Con số tuyệt đối phụ thuộc máy; test **assert ≥ 50.000 điểm/s** với biên rộng. Throughput ghi
> XUỐNG DB thật phụ thuộc TimescaleDB (batch size, chunk interval, đĩa) — đo tại triển khai.

## 3. Nối TimescaleDB thật (deploy)

1. `docker compose up -d timescale` (xem `docker-compose.yml`).
2. Cấp `SqlExecutor` bằng node-postgres:

```ts
import { Pool } from 'pg';
import { TimescaleHistorian } from '@idtp/engines';

const pool = new Pool({ host: 'localhost', database: 'idtp', user: 'idtp', password: 'idtp' });
const hist = new TimescaleHistorian({
  exec: async (sql, params) => pool.query(sql, [...params]),
});
await hist.init();                    // bảng + hypertable + index
// trong vòng runtime: hist.write(points);  // đệm
// theo chu kỳ:        await hist.flush();   // batch xuống DB
```

`pg` là dependency của **tầng triển khai** (không nằm trong `@idtp/engines` để lõi không phụ thuộc
DB); adapter chỉ cần một `SqlExecutor`.

## 4. Giả định

Tham chiếu `GĐ-51` (doc 25): kiến trúc đệm+flush; ngưỡng bucket/chu kỳ flush hiệu chỉnh khi tải thực.
