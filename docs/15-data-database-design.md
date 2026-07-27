# 15 — Data & Database Design

> Tài liệu #15/00–25 (§14). Engine: doc 05‑11. Bảng lõi: Phụ lục A §10.4. TimescaleDB + PostgreSQL.
> Migration Prisma/TypeORM; seed từ tag registry (doc 07).

## 1. Bảng lõi (nhóm)
| Nhóm | Bảng |
|---|---|
| Tag | `tag_master` · `tag_value` (hypertable) |
| Alarm | `alarm_definition` · `alarm_event` · `alarm_state` · `shelve_log` |
| Sự kiện | `event_log` · `audit_trail` (append‑only) |
| RBAC | `user` · `role` · `permission` · `user_role` |
| Asset/Maint | `equipment` · `equipment_runtime` · `maintenance_order` |
| HMI/Report | `trend_group` · `trend_pen` · `report_template` · `report_instance` · `screen_registry` · `sim_scenario` |

## 2. Schema chính (rút gọn)
```sql
CREATE TABLE tag_master (
  id UUID PRIMARY KEY, kks TEXT, uns TEXT UNIQUE, name TEXT UNIQUE,
  datatype TEXT, eu TEXT, range_lo DOUBLE PRECISION, range_hi DOUBLE PRECISION,
  deadband DOUBLE PRECISION, scan_class TEXT, source TEXT,
  asset_id UUID REFERENCES equipment(id), retention_class TEXT,
  security_level INT, is_writable BOOL, sim_model_ref TEXT
);
CREATE TABLE tag_value (            -- TimescaleDB hypertable
  tag_id UUID REFERENCES tag_master(id), ts TIMESTAMPTZ, value DOUBLE PRECISION,
  quality SMALLINT
);
SELECT create_hypertable('tag_value','ts');
CREATE INDEX ON tag_value (tag_id, ts DESC);

CREATE TABLE audit_trail (         -- bất biến (append-only)
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ, "user" TEXT, ip INET,
  action TEXT, target TEXT, old_value JSONB, new_value JSONB, reason TEXT
);
```

## 3. Continuous aggregate + compression (doc 19)
Rollup 1m/15m/1h/1d qua `CREATE MATERIALIZED VIEW … WITH (timescaledb.continuous)`; compression policy trên raw.

## 4. Migration & seed (mẫu — được phép)
- Prisma schema ↔ bảng trên; `prisma migrate` versioned, idempotent.
- Seed: đọc `docs/07-tag-registry/*.tags.yaml` + templates → insert `tag_master`.

## 5. Yêu cầu
Khóa ngoại đầy đủ · index `(tag_id, ts DESC)` · mọi giá trị có quality · substituted đánh dấu vĩnh viễn + audit.

## 6. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑25 | Chọn Prisma (vs TypeORM) — chốt ở doc 23 (devflow) |
