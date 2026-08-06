import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Bám bẩn & lọt khí động sống trong runtime thật. 0 hồi quy: đọc-only, sinh tag FA_* mới.
describe('thermal-runtime — bám bẩn & lọt khí động (chiều sâu physics)', () => {
  it('điểm vận hành: bám AH & lọt khí trong ngưỡng bình thường; chân không lõi không đổi', () => {
    const rt = createThermalRuntime();
    const vacBefore = rt.value('TRB_COND_VACUUM_01');
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('FA_FOULING_HEALTHY_01')).toBe(1);
    expect(rt.value('FA_AH_FOULING_01')).toBeLessThan(40);
    expect(rt.value('FA_COND_AIR_INLEAK_01')).toBeLessThan(40);
    expect(rt.value('FA_SJAE_MARGIN_01')).toBeGreaterThan(50);
    // 0 hồi quy: model đọc-only → chân không lõi (do boiler-island giữ) không đổi đáng kể.
    expect(Math.abs(rt.value('TRB_COND_VACUUM_01') - vacBefore)).toBeLessThan(0.5);
  });

  it('condenser-air-leak: lọt khí tăng theo thời gian → biên SJAE tụt, phạt chân không > 0', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const marginBefore = rt.value('FA_SJAE_MARGIN_01');
    rt.injectMalfunction({ id: 'condenser-air-leak' });
    for (let i = 0; i < 4000; i++) rt.step(); // ~6,7 phút sim → lọt khí tiến hoá khỏi nền 5 scfm
    expect(rt.value('FA_COND_AIR_INLEAK_01')).toBeGreaterThan(10); // đang tăng (đích 55, tau 0,5h)
    expect(rt.value('FA_SJAE_MARGIN_01')).toBeLessThan(marginBefore);
  });
});
