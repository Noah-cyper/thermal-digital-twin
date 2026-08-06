import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// CEMS Hg/CO sống trong runtime thật (đọc khói/FGD/O₂ tươi). 0 hồi quy: sinh tag CEMS_* mới.
describe('thermal-runtime — CEMS mở rộng Hg & CO (chiều sâu phát thải)', () => {
  it('điểm vận hành: Hg thu hồi cao, CO thấp, hiệu suất cháy cao; phát thải cũ (bụi/CO₂) không đổi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('CEMS_HG_CAPTURE_01')).toBeGreaterThan(80);
    expect(rt.value('CEMS_HG_ACI_01')).toBeGreaterThan(0);
    expect(rt.value('CEMS_CO_STACK_01')).toBeGreaterThan(0);
    expect(rt.value('CEMS_CO_STACK_01')).toBeLessThan(200);
    expect(rt.value('CEMS_COMBUSTION_EFF_01')).toBeGreaterThan(98);
    // tag emissions cũ vẫn có giá trị hợp lệ (CEMS mới chỉ đọc, không đụng).
    expect(rt.value('EMI_CO2_RATE_01')).toBeGreaterThan(0);
    expect(rt.value('EMI_DUST_STACK_01')).toBeLessThan(30); // vẫn dưới mốc thiết kế
  });

  it('hg-sorbent-loss: thu hồi Hg giảm, Hg ống khói tăng (0 hồi quy phát thải khác)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const cap = rt.value('CEMS_HG_CAPTURE_01');
    const hg = rt.value('CEMS_HG_STACK_01');
    const co2 = rt.value('EMI_CO2_RATE_01');
    rt.injectMalfunction({ id: 'hg-sorbent-loss' });
    for (let i = 0; i < 20; i++) rt.step();
    expect(rt.value('CEMS_HG_CAPTURE_01')).toBeLessThan(cap);
    expect(rt.value('CEMS_HG_STACK_01')).toBeGreaterThan(hg);
    expect(Math.abs(rt.value('EMI_CO2_RATE_01') - co2)).toBeLessThan(1); // CO₂ không đổi
  });
});
