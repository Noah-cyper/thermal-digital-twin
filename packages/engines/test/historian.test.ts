import { describe, it, expect } from 'vitest';
import { MemoryHistorian } from '../src/historian';

const deps = { formatTs: (ms: number): string => new Date(ms).toISOString() };
const BASE = Date.parse('2026-07-24T00:00:00.000Z');
const iso = (sec: number): string => new Date(BASE + sec * 1000).toISOString();

describe('MemoryHistorian + Replay (doc 05-04)', () => {
  it('write + query raw trong dải thời gian', async () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 10; i++) h.write([{ tagId: 'T', value: i, quality: 'Good', ts: iso(i) }]);
    const raw = await h.query('T', iso(2), iso(5), 'last');
    expect(raw.map((p) => p.value)).toEqual([2, 3, 4, 5]);
  });

  it('query bucket + aggregate (avg/max/count)', async () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 10; i++) h.write([{ tagId: 'T', value: i, quality: 'Good', ts: iso(i) }]);
    expect((await h.query('T', iso(0), iso(9), 'avg', 5000)).map((p) => p.value)).toEqual([2, 7]);
    expect((await h.query('T', iso(0), iso(9), 'max', 5000)).map((p) => p.value)).toEqual([4, 9]);
    expect((await h.query('T', iso(0), iso(9), 'count', 5000)).map((p) => p.value)).toEqual([5, 5]);
  });

  it('valueAt: last ≤ ts (binary search) + biên', () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 10; i++) h.write([{ tagId: 'T', value: i * 10, quality: 'Good', ts: iso(i) }]);
    expect(h.valueAt('T', BASE + 3500)?.value).toBe(30);
    expect(h.valueAt('T', BASE - 1000)).toBeUndefined();
    expect(h.valueAt('T', BASE + 100_000)?.value).toBe(90);
  });

  it('replay: openReplay + advance theo speed + seek clamp + speed 0,25–60×', () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i <= 60; i++) h.write([{ tagId: 'T', value: i, quality: 'Good', ts: iso(i) }]);
    const s = h.openReplay(iso(0), iso(60), 10);
    expect(s.speed).toBe(10);
    const c1 = h.advanceReplay(s.id, 1000); // 1 s thực × 10 = 10 s replay
    expect(Date.parse(c1 ?? '') - BASE).toBe(10_000);
    h.seek(s.id, iso(999)); // ngoài dải → clamp về to
    expect(Date.parse(h.session(s.id)?.clockTs ?? '') - BASE).toBe(60_000);
    h.setSpeed(s.id, 500);
    expect(h.session(s.id)?.speed).toBe(60);
    h.setSpeed(s.id, 0.01);
    expect(h.session(s.id)?.speed).toBe(0.25);
  });

  it('frameAt: dựng khung nhiều tag tại thời điểm replay', () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 5; i++) {
      h.write([{ tagId: 'A', value: i, quality: 'Good', ts: iso(i) }]);
      h.write([{ tagId: 'B', value: i * 2, quality: 'Good', ts: iso(i) }]);
    }
    const frame = h.frameAt(BASE + 3000, ['A', 'B']);
    expect(frame.A?.value).toBe(3);
    expect(frame.B?.value).toBe(6);
  });

  it('substituteMark: quality → Substituted (vĩnh viễn) + audit', () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 5; i++) h.write([{ tagId: 'T', value: i, quality: 'Good', ts: iso(i) }]);
    h.substituteMark('T', iso(2), 'eng', 'hiệu chỉnh cảm biến');
    expect(h.valueAt('T', BASE + 2000)?.quality).toBe('Substituted');
    expect(h.auditLog()).toHaveLength(1);
    expect(h.auditLog()[0]?.user).toBe('eng');
  });
});
