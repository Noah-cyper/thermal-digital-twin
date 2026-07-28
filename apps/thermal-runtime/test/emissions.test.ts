import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — phát thải CEMS sống trong vòng CCS (v1.22)', () => {
  it('emissions model khép kín CEMS: bụi trong mốc, CO₂/SO₂/NOₓ có giá trị, ESP/FGD hiệu quả', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    expect(rt.value('EMI_DUST_STACK_01')).toBeLessThan(35); // quanh mốc thiết kế < 30
    expect(rt.value('EMI_DUST_STACK_01')).toBeGreaterThan(5);
    expect(rt.value('EMI_CO2_RATE_01')).toBeGreaterThan(300); // t/h CO₂
    expect(rt.value('EMI_SO2_STACK_01')).toBeGreaterThan(15);
    expect(rt.value('EMI_NOX_STACK_01')).toBeGreaterThan(100);
    expect(rt.value('EMI_FG_VOLUME_01')).toBeGreaterThan(500_000); // Nm³/h
    expect(rt.value('EMI_ESP_EFF_01')).toBeGreaterThan(99);
  });
});
