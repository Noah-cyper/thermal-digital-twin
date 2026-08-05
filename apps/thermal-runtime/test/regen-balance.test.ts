import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Nối drain vào cân bằng nhiệt sống trong runtime thật. Op: tổn thất=0 (0 hồi quy). Xả khẩn: coupling end-to-end.
describe('thermal-runtime — nối drain vào cân bằng nhiệt (chiều sâu physics)', () => {
  it('điểm vận hành: hồi nhiệt bình thường, tổn thất 0, heat rate hiệu dụng = chu trình (0 hồi quy)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('PLANT_REGEN_HEALTHY_01')).toBe(1);
    expect(rt.value('PLANT_REGEN_LOSS_MW_01')).toBe(0);
    expect(rt.value('PLANT_HR_REGEN_PENALTY_01')).toBe(0);
    // heat rate hiệu dụng = heat rate chu trình khi không mất hồi nhiệt.
    expect(rt.value('PLANT_CYCLE_HR_EFF_01')).toBeCloseTo(rt.value('PLANT_CYCLE_HR_01'), 3);
    // nước cấp econ hiệu dụng = danh nghĩa.
    expect(Math.abs(rt.value('FW_ECON_INLET_EFFECTIVE_01') - rt.value('FW_ECON_INLET_TEMP_01'))).toBeLessThan(0.01);
  });

  it('heater-drain-high → xả khẩn: tổn thất hồi nhiệt > 0, heat rate hiệu dụng xấu hơn chu trình (coupling)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    rt.injectMalfunction({ id: 'heater-drain-high' });
    for (let i = 0; i < 5200; i++) rt.step(); // ~8,7 phút sim → mức drain vượt 80% → van xả khẩn mở
    expect(rt.value('FWH_EMERG_DRAIN_01')).toBe(1);
    expect(rt.value('PLANT_REGEN_LOSS_MW_01')).toBeGreaterThan(1);
    expect(rt.value('PLANT_HR_REGEN_PENALTY_01')).toBeGreaterThan(0);
    expect(rt.value('PLANT_CYCLE_HR_EFF_01')).toBeGreaterThan(rt.value('PLANT_CYCLE_HR_01'));
  });
});
