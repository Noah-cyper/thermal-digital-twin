import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Historian ghi + truy vấn + replay frame', () => {
  it('ghi tag vào historian; truy vấn lịch sử có rollup', async () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.historian.size()).toBeGreaterThan(0);

    const range = rt.historian.dataRange();
    expect(range).toBeDefined();
    if (!range) return;
    const hist = await rt.historian.query('GEN_MW_01', range.from, range.to, 'avg', 1000);
    expect(hist.length).toBeGreaterThan(0);
    expect(hist[0]?.value).toBeGreaterThan(300); // ~448 MW
  });

  it('replay frame dựng lại giá trị quá khứ tại đồng hồ replay', async () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    const range = rt.historian.dataRange();
    if (!range) throw new Error('no data');
    const s = rt.historian.openReplay(range.from, range.to, 10);
    rt.historian.seek(s.id, range.from);
    const frame = rt.historian.frameAt(Date.parse(range.from), rt.recordedTags());
    expect(Object.keys(frame).length).toBeGreaterThan(0);
    expect(typeof frame.GEN_MW_01?.value).toBe('number');
  });
});
