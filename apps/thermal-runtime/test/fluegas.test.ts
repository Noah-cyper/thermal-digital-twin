import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — đường khói + hiệu suất lò sống trong vòng CCS (v1.21)', () => {
  it('flue gas model khép kín phía khói-gió: hiệu suất lò hợp lý, gió thừa từ O₂, khói có lưu lượng', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    const eff = rt.value('BLR_EFF_01');
    expect(eff).toBeGreaterThan(80); // hiệu suất lò
    expect(eff).toBeLessThan(93);

    expect(rt.value('FG_EXCESS_AIR_01')).toBeGreaterThan(5); // gió thừa từ O₂ danh định ~3,2 %
    expect(rt.value('FG_FLOW_01')).toBeGreaterThan(1500); // t/h khói
    expect(rt.value('FG_STACK_TEMP_01')).toBeGreaterThan(90);
    expect(rt.value('FG_STACK_TEMP_01')).toBeLessThan(150);
    expect(rt.value('AH_AIR_OUT_TEMP_01')).toBeGreaterThan(200); // gió cháy được hâm nóng
  });
});
