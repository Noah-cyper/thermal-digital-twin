import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// AVR/kích từ sống trong runtime thật (đọc GEN_MVAR_01 tươi). Kiểm điểm vận hành + đỡ áp khi lưới sụt +
// 0 hồi quy phía điện (GEN_MW/GEN_MVAR không đổi — model AVR chỉ đọc, sinh tag mới).
describe('thermal-runtime — AVR/kích từ (chiều sâu physics)', () => {
  it('điểm vận hành: điện áp cực ~20 kV, AUTO, kích từ hợp lý, phản kháng AVR ≈ GEN_MVAR (nhất quán)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('ELEC_TERM_VOLT_01')).toBeCloseTo(20, 0);
    expect(rt.value('ELEC_AVR_MODE_01')).toBe(1);
    expect(rt.value('ELEC_FIELD_CURRENT_01')).toBeGreaterThan(2000);
    expect(rt.value('ELEC_FIELD_CURRENT_01')).toBeLessThan(4000);
    // Phản kháng AVR bám sát GEN_MVAR thực (lưới danh định → không thêm đỡ áp).
    expect(rt.value('ELEC_REACTIVE_AVR_01')).toBeCloseTo(rt.value('GEN_MVAR_01'), 0);
  });

  it('grid-undervoltage: AVR tăng kích từ + đỡ áp, giữ điện áp cực; GEN_MVAR/GEN_MW KHÔNG đổi (0 hồi quy)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const mwBefore = rt.value('GEN_MW_01');
    const mvarBefore = rt.value('GEN_MVAR_01');
    const fieldBefore = rt.value('ELEC_FIELD_CURRENT_01');

    rt.injectMalfunction({ id: 'grid-undervoltage' });
    for (let i = 0; i < 200; i++) rt.step();

    expect(rt.value('ELEC_FIELD_CURRENT_01')).toBeGreaterThan(fieldBefore); // kích từ tăng đỡ áp
    expect(rt.value('ELEC_TERM_VOLT_PU_01')).toBeCloseTo(1.0, 2); // vẫn giữ điện áp cực
    // 0 hồi quy: grid-undervoltage chỉ AVR (read-only) xử lý → MW/MVAr không đổi ĐÁNG KỂ
    // (chỉ jitter sim tự nhiên theo thời gian, < 1 MW/MVAr — không phải tác động điện).
    expect(Math.abs(rt.value('GEN_MW_01') - mwBefore)).toBeLessThan(1);
    expect(Math.abs(rt.value('GEN_MVAR_01') - mvarBefore)).toBeLessThan(1);
  });
});
