import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — bình ngưng + nước tuần hoàn sống trong vòng CCS (v1.20)', () => {
  it('condenser model cân bằng năng lượng: nhiệt thải > 0, CW nóng lên qua bình ngưng, lưu lượng DB', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    const duty = rt.value('COND_DUTY_01');
    const mw = rt.value('GEN_MW_01');
    expect(mw).toBeGreaterThan(0);
    expect(duty).toBeGreaterThan(300); // nhiệt thải MWth (cân bằng năng lượng)
    expect(duty).toBeGreaterThan(mw); // phần lớn nhiệt bị thải (η < 50%)

    expect(rt.value('COND_CW_FLOW_01')).toBe(64000); // Design Basis
    expect(rt.value('COND_CW_OUT_TEMP_01')).toBeGreaterThan(rt.value('COND_CW_IN_TEMP_01')); // CW ra > vào
    expect(rt.value('COND_CW_RISE_01')).toBeGreaterThan(3); // độ tăng nhiệt CW
    expect(rt.value('COND_SAT_TEMP_01')).toBeGreaterThan(25); // nhiệt bão hoà ~34 ở chân không danh định
    expect(rt.value('COND_SAT_TEMP_01')).toBeLessThan(50);
  });
});
