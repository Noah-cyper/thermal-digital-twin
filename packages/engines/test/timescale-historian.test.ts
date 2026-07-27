import { describe, it, expect } from 'vitest';
import type { SqlExecutor } from '../src/timescale-historian';
import { TimescaleHistorian } from '../src/timescale-historian';

class FakeSql implements SqlExecutor {
  calls: { sql: string; params: unknown[] }[] = [];
  rows: Record<string, unknown>[] = [];
  async exec(sql: string, params: ReadonlyArray<unknown>): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }> {
    this.calls.push({ sql, params: [...params] });
    return { rows: this.rows };
  }
}

describe('TimescaleHistorian (doc 05-04) — SQL qua executor inject (không cần DB)', () => {
  it('init: tạo bảng + hypertable + index', async () => {
    const sql = new FakeSql();
    await new TimescaleHistorian(sql).init();
    expect(sql.calls.length).toBe(3);
    expect(sql.calls[0]?.sql).toMatch(/CREATE TABLE IF NOT EXISTS tag_history/);
    expect(sql.calls[1]?.sql).toMatch(/create_hypertable\('tag_history'/);
    expect(sql.calls[2]?.sql).toMatch(/CREATE INDEX/);
  });

  it('write đệm đồng bộ; flush = 1 INSERT nhiều dòng, đúng số param, đệm về 0', async () => {
    const sql = new FakeSql();
    const h = new TimescaleHistorian(sql);
    h.write([
      { tagId: 'A', value: 1, quality: 'Good', ts: '2026-07-24T10:00:00Z' },
      { tagId: 'A', value: 2, quality: 'Bad', ts: '2026-07-24T10:00:01Z' },
    ]);
    expect(h.pending).toBe(2);
    expect(sql.calls.length).toBe(0); // chưa chạm DB

    const n = await h.flush();
    expect(n).toBe(2);
    expect(h.pending).toBe(0);
    expect(sql.calls.length).toBe(1);
    expect(sql.calls[0]?.sql).toMatch(/INSERT INTO tag_history .* VALUES \(\$1, \$2, \$3, \$4\), \(\$5, \$6, \$7, \$8\)/);
    expect(sql.calls[0]?.params).toEqual(['2026-07-24T10:00:00Z', 'A', 1, 0, '2026-07-24T10:00:01Z', 'A', 2, 2]); // Bad→2
  });

  it('query: time_bucket + hàm aggregate; map rows → HistPoint', async () => {
    const sql = new FakeSql();
    sql.rows = [{ bucket: '2026-07-24T10:00:00.000Z', v: 4.5 }];
    const h = new TimescaleHistorian(sql);
    const res = await h.query('A', '2026-07-24T10:00:00Z', '2026-07-24T11:00:00Z', 'avg', 60_000);
    expect(sql.calls[0]?.sql).toMatch(/time_bucket\(make_interval\(secs => \$1\), ts\)/);
    expect(sql.calls[0]?.sql).toMatch(/avg\(value\)/);
    expect(sql.calls[0]?.params[0]).toBe(60); // 60 s bucket
    expect(res).toEqual([{ ts: '2026-07-24T10:00:00.000Z', value: 4.5, quality: 'Good' }]);
  });

  it('valueAt: điểm cuối ≤ ts, map quality số → enum', async () => {
    const sql = new FakeSql();
    sql.rows = [{ ts: '2026-07-24T10:00:00Z', value: 7, quality: 3 }];
    const h = new TimescaleHistorian(sql);
    const p = await h.valueAt('A', '2026-07-24T10:05:00Z');
    expect(p).toEqual({ ts: '2026-07-24T10:00:00Z', value: 7, quality: 'Substituted' }); // 3→Substituted
  });
});
