import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — đoàn gia nhiệt nước cấp + heat rate chu trình (v1.19)', () => {
  it('feedwater model sống trong vòng CCS: nước cấp được hồi nhiệt; heat rate chu trình < đơn vị 9.200', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    const econ = rt.value('FW_ECON_INLET_TEMP_01');
    const cond = rt.value('FW_CONDENSATE_TEMP_01');
    expect(econ).toBeGreaterThan(200); // đã hồi nhiệt đáng kể
    expect(econ).toBeGreaterThan(cond + 100); // cao hơn condensate rõ rệt
    expect(rt.value('FW_REGEN_DUTY_01')).toBeGreaterThan(50); // MWth

    const hr = rt.value('PLANT_CYCLE_HR_01');
    expect(hr).toBeGreaterThan(7000);
    expect(hr).toBeLessThan(9200); // chu trình turbine tốt hơn heat rate đơn vị Design Basis
  });
});
