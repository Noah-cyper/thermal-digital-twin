import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — phía điện (máy phát/GSU/lưới/tự dùng) sống trong vòng CCS (v1.23)', () => {
  it('electrical model: net < gộp (tự dùng), MVA/pf/dòng hợp lý, xuất lưới sau GSU', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    const gross = rt.value('GEN_MW_01');
    const net = rt.value('ELEC_NET_MW_01');
    const aux = rt.value('ELEC_AUX_POWER_01');
    expect(gross).toBeGreaterThan(0);
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThan(gross); // tự dùng làm net < gộp
    expect(net).toBeCloseTo(gross - aux, 2); // net = gộp − tự dùng
    expect(aux).toBeGreaterThan(10); // tự dùng MW

    expect(rt.value('ELEC_GEN_MVA_01')).toBeGreaterThan(net); // biểu kiến > tác dụng
    expect(rt.value('ELEC_PF_01')).toBeGreaterThan(0.7);
    expect(rt.value('ELEC_PF_01')).toBeLessThanOrEqual(1);
    expect(rt.value('ELEC_GEN_CURRENT_01')).toBeGreaterThan(5); // kA
    expect(rt.value('ELEC_GRID_MW_01')).toBeGreaterThan(0);
  });
});
