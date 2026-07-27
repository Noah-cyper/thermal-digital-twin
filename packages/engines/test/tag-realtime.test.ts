import { describe, it, expect } from 'vitest';
import { TagRealtimeEngine } from '../src/tag-realtime';

const ts = '2026-07-24T10:00:00+07:00';

describe('TagRealtimeEngine', () => {
  it('RBE: chỉ phát khi vượt deadband', () => {
    const e = new TagRealtimeEngine();
    e.setDeadband('T', 5);
    const got: number[] = [];
    e.onDelta((_s, d) => {
      for (const x of d) if (typeof x.value === 'number') got.push(x.value);
    });
    e.subscribeScreen('s', 'scr', ['T']);
    e.ingest([{ tagId: 'T', value: 10, quality: 'Good', ts }]); // lần đầu → phát
    e.ingest([{ tagId: 'T', value: 12, quality: 'Good', ts }]); // Δ2 < 5 → bỏ
    e.ingest([{ tagId: 'T', value: 20, quality: 'Good', ts }]); // Δ10 ≥ 5 → phát
    expect(got).toEqual([10, 20]);
  });

  it('subscribe theo màn hình phát snapshot ban đầu + alias', () => {
    const e = new TagRealtimeEngine();
    e.ingest([{ tagId: 'A', value: 1, quality: 'Good', ts }]);
    let count = 0;
    let alias = -1;
    e.onDelta((_s, d) => {
      count += d.length;
      const first = d[0];
      if (first) alias = first.alias;
    });
    e.subscribeScreen('s', 'scr', ['A']);
    expect(count).toBe(1);
    expect(alias).toBeGreaterThan(0);
  });

  it('không phát cho tag không subscribe', () => {
    const e = new TagRealtimeEngine();
    const got: unknown[] = [];
    e.onDelta((_s, d) => {
      for (const x of d) got.push(x.value);
    });
    e.subscribeScreen('s', 'scr', ['A']);
    e.ingest([{ tagId: 'B', value: 9, quality: 'Good', ts }]);
    expect(got).toEqual([]);
  });
});
