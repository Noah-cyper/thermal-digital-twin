import { describe, it, expect } from 'vitest';
import { EventJournal } from '../src/event-journal';

describe('EventJournal (SOE / Event Log) — nhật ký sự kiện generic', () => {
  it('record gán seq tăng dần; query mới-nhất-trước + lọc category/severity/sinceSeq/limit', () => {
    const j = new EventJournal();
    const a = j.record({ at: 'T1', category: 'alarm', severity: 'warn', message: 'a' });
    const b = j.record({ at: 'T2', category: 'command', severity: 'info', message: 'b', actor: 'op' });
    const c = j.record({ at: 'T3', category: 'trip', severity: 'critical', message: 'c' });
    expect([a.seq, b.seq, c.seq]).toEqual([1, 2, 3]);
    expect(j.lastSeq).toBe(3);

    expect(j.query().map((e) => e.seq)).toEqual([3, 2, 1]); // mới nhất trước
    expect(j.query({ category: 'command' }).map((e) => e.message)).toEqual(['b']);
    expect(j.query({ severity: 'critical' }).map((e) => e.message)).toEqual(['c']);
    expect(j.query({ sinceSeq: 1 }).map((e) => e.seq)).toEqual([3, 2]); // chỉ entry mới hơn
    expect(j.query({ limit: 1 }).map((e) => e.seq)).toEqual([3]);
    expect(j.query({ category: 'command' })[0]?.actor).toBe('op');
  });

  it('summary đếm theo category/severity + notable là trip/critical mới nhất', () => {
    const j = new EventJournal();
    j.record({ at: 'T', category: 'alarm', severity: 'info', message: '1' });
    j.record({ at: 'T', category: 'alarm', severity: 'warn', message: '2' });
    j.record({ at: 'T', category: 'trip', severity: 'critical', message: 'MFT' });
    const s = j.summary();
    expect(s.total).toBe(3);
    expect(s.byCategory.alarm).toBe(2);
    expect(s.byCategory.trip).toBe(1);
    expect(s.bySeverity.critical).toBe(1);
    expect(s.notable[0]?.message).toBe('MFT'); // sự kiện đáng chú ý nổi lên trước
  });

  it('ring buffer: vượt sức chứa bỏ entry cũ nhất, seq vẫn đơn điệu', () => {
    const j = new EventJournal(3);
    for (let i = 1; i <= 5; i++) j.record({ at: 'T', category: 'system', severity: 'info', message: String(i) });
    const all = j.query();
    expect(all.length).toBe(3);
    expect(all.map((e) => e.message)).toEqual(['5', '4', '3']); // 1,2 bị đẩy ra
    expect(j.lastSeq).toBe(5);
  });
});
