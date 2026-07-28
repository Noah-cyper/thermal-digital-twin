import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — chu trình tái nhiệt sống trong vòng CCS (v1.18)', () => {
  it('reheat model chạy cạnh boiler/turbine: sinh tag đường reheat; tầng HP+IP+LP = GEN_MW (additive)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();

    const mw = rt.value('GEN_MW_01');
    expect(mw).toBeGreaterThan(0);

    // Đường reheat có dữ liệu neo Design Basis (điều nhiệt hot reheat về ~541; áp CRH ~4 MPa).
    expect(rt.value('TRB_HRH_TEMP_01')).toBeGreaterThan(450);
    expect(rt.value('TRB_CRH_PRESS_01')).toBeGreaterThan(2);
    expect(rt.value('TRB_REHEAT_DUTY_01')).toBeGreaterThan(50); // MWth

    // Tách tầng CỘNG LẠI = công suất trục → additive, GEN_MW_01 KHÔNG bị đổi.
    const stages = rt.value('TRB_HP_MW_01') + rt.value('TRB_IP_MW_01') + rt.value('TRB_LP_MW_01');
    expect(stages).toBeCloseTo(mw, 2);
  });
});
