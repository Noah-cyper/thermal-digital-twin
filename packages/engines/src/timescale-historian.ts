// L2 — Historian adapter TIMESCALEDB (doc 05-04 / doc 19). Cùng chữ ký write/query như MemoryHistorian
// nhưng bền hoá vào hypertable. Đạt mốc ghi ≥ 50.000 điểm/s bằng: write() ĐỆM đồng bộ (chỉ push,
// rất nhanh) + flush() BATCH bất đồng bộ (một INSTANCE nhiều dòng → DB theo kịp). Không phụ thuộc
// cứng 'pg': SQL chạy qua SqlExecutor INJECT (deploy dùng pg; test dùng executor giả) → kiểm được
// không cần DB thật.
import type { Iso8601, Quality } from '@idtp/sdk';
import type { HistAggregate, HistPoint, WritePoint } from './historian';

/** Thực thi SQL — deploy: adapter node-postgres; test: executor giả ghi lại SQL. */
export interface SqlExecutor {
  exec(sql: string, params: ReadonlyArray<unknown>): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}

export interface TimescaleOptions {
  table?: string; // mặc định 'tag_history'
  snapshotTable?: string;
}

const Q_TO_INT: Record<Quality, number> = { Good: 0, Uncertain: 1, Bad: 2, Substituted: 3 };
const INT_TO_Q: ReadonlyArray<Quality> = ['Good', 'Uncertain', 'Bad', 'Substituted'];

// Ánh xạ aggregate → biểu thức SQL (last dùng hàm Timescale last(value, ts)).
const AGG_SQL: Record<HistAggregate, string> = {
  avg: 'avg(value)',
  min: 'min(value)',
  max: 'max(value)',
  stddev: 'coalesce(stddev_samp(value), 0)',
  count: 'count(*)',
  total: 'sum(value)',
  last: 'last(value, ts)',
};

function toIso(v: unknown): Iso8601 {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export class TimescaleHistorian {
  private readonly table: string;
  private buffer: WritePoint[] = [];

  constructor(
    private readonly sql: SqlExecutor,
    opts: TimescaleOptions = {},
  ) {
    this.table = opts.table ?? 'tag_history';
  }

  /** DDL: bảng + hypertable + index (tag, ts) — idempotent. */
  async init(): Promise<void> {
    await this.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${this.table} (ts timestamptz NOT NULL, tag_id text NOT NULL, value double precision, quality smallint NOT NULL)`,
      [],
    );
    await this.sql.exec(`SELECT create_hypertable('${this.table}', 'ts', if_not_exists => TRUE)`, []);
    await this.sql.exec(`CREATE INDEX IF NOT EXISTS ${this.table}_tag_ts ON ${this.table} (tag_id, ts DESC)`, []);
  }

  /** Ghi = ĐỆM đồng bộ (không chạm DB) → nhanh, đạt ≥ 50k điểm/s. flush() mới đẩy xuống DB. */
  write(values: ReadonlyArray<WritePoint>): void {
    for (const v of values) this.buffer.push(v);
  }

  get pending(): number {
    return this.buffer.length;
  }

  /** Đẩy đệm xuống DB bằng MỘT INSERT nhiều dòng (parametrized). Trả số điểm đã ghi. */
  async flush(): Promise<number> {
    if (this.buffer.length === 0) return 0;
    const batch = this.buffer;
    this.buffer = [];
    const tuples: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const p of batch) {
      tuples.push(`($${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(p.ts, p.tagId, p.value, Q_TO_INT[p.quality]);
    }
    await this.sql.exec(`INSERT INTO ${this.table} (ts, tag_id, value, quality) VALUES ${tuples.join(', ')}`, params);
    return batch.length;
  }

  /** Truy vấn rollup theo time_bucket. bucketMs mặc định 60 s. */
  async query(
    tagId: string,
    from: Iso8601,
    to: Iso8601,
    agg: HistAggregate,
    bucketMs = 60_000,
  ): Promise<ReadonlyArray<HistPoint>> {
    const bucketSec = Math.max(1, Math.round(bucketMs / 1000));
    const res = await this.sql.exec(
      `SELECT time_bucket(make_interval(secs => $1), ts) AS bucket, ${AGG_SQL[agg]} AS v ` +
        `FROM ${this.table} WHERE tag_id = $2 AND ts >= $3 AND ts < $4 GROUP BY bucket ORDER BY bucket`,
      [bucketSec, tagId, from, to],
    );
    return res.rows.map((r) => ({ ts: toIso(r.bucket), value: Number(r.v ?? 0), quality: 'Good' as Quality }));
  }

  /** Giá trị gần nhất tại một mốc (điểm cuối ≤ ts) — cho DATA REPLAY / valueAt. */
  async valueAt(tagId: string, tsIso: Iso8601): Promise<HistPoint | undefined> {
    const res = await this.sql.exec(
      `SELECT ts, value, quality FROM ${this.table} WHERE tag_id = $1 AND ts <= $2 ORDER BY ts DESC LIMIT 1`,
      [tagId, tsIso],
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return { ts: toIso(row.ts), value: Number(row.value ?? 0), quality: INT_TO_Q[Number(row.quality ?? 0)] ?? 'Good' };
  }
}
