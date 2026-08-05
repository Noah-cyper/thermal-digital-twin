import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Drain cascade sống trong runtime thật (đọc nhiệt bình gia nhiệt tươi). 0 hồi quy: chỉ đọc FW_*, sinh FWH_*.
describe('thermal-runtime — drain cascade bình gia nhiệt (chiều sâu physics)', () => {
  it('điểm vận hành: nhiệt drain cascade hợp lý, TTD/DCA/mức drain sống, xả khẩn đóng', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('FWH_HPH1_DRAIN_TEMP_01')).toBeGreaterThan(rt.value('FWH_LPH1_DRAIN_TEMP_01'));
    expect(rt.value('FWH_HPH_DCA_01')).toBe(5.5);
    expect(rt.value('FWH_HPH_TTD_01')).toBeGreaterThan(2);
    expect(rt.value('FWH_EMERG_DRAIN_01')).toBe(0);
    expect(rt.value('FWH_HPH_DRAIN_LEVEL_01')).toBeCloseTo(50, 0);
    expect(rt.value('FWH_DRAIN_TO_COND_01')).toBeGreaterThan(0);
  });

  it('heater-drain-high: mức drain HP DÂNG; nhiệt econ inlet (FW_*) KHÔNG đổi đáng kể (0 hồi quy)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const econBefore = rt.value('FW_ECON_INLET_TEMP_01');
    rt.injectMalfunction({ id: 'heater-drain-high' });
    for (let i = 0; i < 1500; i++) rt.step(); // ~2,5 phút sim → mức drain dâng khỏi setpoint
    expect(rt.value('FWH_HPH_DRAIN_LEVEL_01')).toBeGreaterThan(55); // đang dâng (tiến tới xả khẩn)
    // model drain chỉ ĐỌC FW_* → nhiệt nước cấp vào econ không đổi (drain là tag mới, độc lập).
    expect(Math.abs(rt.value('FW_ECON_INLET_TEMP_01') - econBefore)).toBeLessThan(1);
  });
});
