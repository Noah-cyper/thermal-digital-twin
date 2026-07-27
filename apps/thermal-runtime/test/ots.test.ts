import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — OTS (freeze · snapshot/restore · loss-of-vacuum)', () => {
  it('freeze đóng băng toàn vòng; resume chạy lại', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    rt.setLoadDemand(560);
    for (let i = 0; i < 60; i++) rt.step(); // đang biến thiên
    rt.freeze(true);
    const mw = rt.value('GEN_MW_01');
    for (let i = 0; i < 300; i++) rt.step();
    expect(rt.value('GEN_MW_01')).toBe(mw); // đóng băng: bất biến
    expect(rt.isFrozen()).toBe(true);
    rt.freeze(false);
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('GEN_MW_01')).not.toBe(mw); // chạy lại → đổi
  });

  it('snapshot/restore đưa trạng thái sim về mốc đã lưu', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    const snap = rt.snapshot(); // chân không ~5,4 kPa
    rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: 30 } });
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('TRB_COND_VACUUM_01')).toBeGreaterThan(15);
    rt.restore(snap);
    for (let i = 0; i < 5; i++) rt.step();
    expect(rt.value('TRB_COND_VACUUM_01')).toBeLessThan(8); // đã khôi phục chân không tốt
  });

  it('loss-of-vacuum: chân không xấu → MW tụt (governor không bù nổi vì cạn công suất)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 800; i++) rt.step();
    const mw0 = rt.value('GEN_MW_01');
    rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: 30 } });
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('TRB_COND_VACUUM_01')).toBeGreaterThan(15);
    expect(rt.value('GEN_MW_01')).toBeLessThan(mw0 - 20);
  });
});
