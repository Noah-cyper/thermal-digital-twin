import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CAPSTONE cân bằng năng lượng toàn nhà máy (v1.26)', () => {
  it('11 mô hình con NHẤT QUÁN: cân bằng năng lượng live KHÉP ~100 %; KPI toàn nhà máy hợp lý', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    // Kiểm chứng chéo: gộp + nhiệt thải + tổn thất lò ≈ nhiên liệu (mọi số từ mô hình con độc lập).
    const closure = rt.value('PLANT_ENERGY_CLOSURE_01');
    expect(closure).toBeGreaterThan(97);
    expect(closure).toBeLessThan(103);

    expect(rt.value('PLANT_ENERGY_IN_01')).toBeGreaterThan(800); // MWth nhiên liệu
    expect(rt.value('PLANT_HEAT_REJECT_01')).toBeCloseTo(rt.value('COND_DUTY_01'), 2);
    expect(rt.value('PLANT_NET_EFF_01')).toBeGreaterThan(25);
    expect(rt.value('PLANT_NET_EFF_01')).toBeLessThan(42);
    expect(rt.value('PLANT_UNIT_HR_NET_01')).toBeGreaterThan(8000);
    expect(rt.value('PLANT_CO2_INTENSITY_01')).toBeGreaterThan(800);
    expect(rt.value('PLANT_AIR_FLOW_01')).toBeGreaterThan(1000);
  });
});
