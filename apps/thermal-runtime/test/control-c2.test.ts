import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop C2: áp deaerator (pegging) · áp hơi chèn trục (gland)', () => {
  it('điểm vận hành: deaerator giữ ~0,9 MPa (pegging mở); gland giữ ~5 kPag (van chèn mở)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // Deaerator: hơi trích + pegging giữ 0,9 MPa; van pegging đang mở (bù hơi trích non tải).
    expect(rt.value('FW_DEA_PRESS_01')).toBeGreaterThan(0.86);
    expect(rt.value('FW_DEA_PRESS_01')).toBeLessThan(0.94);
    expect(rt.value('FW_DEA_PEG_VALVE_01')).toBeGreaterThan(10); // pegging đang cấp

    // Gland steam: tự chèn theo tải + van cấp giữ 5 kPag; van đang mở.
    expect(rt.value('TRB_GLAND_PRESS_01')).toBeGreaterThan(4.3);
    expect(rt.value('TRB_GLAND_PRESS_01')).toBeLessThan(5.7);
    expect(rt.value('TRB_GLAND_VALVE_01')).toBeGreaterThan(10); // van chèn đang cấp
  });

  it('hạ tải → hơi trích/tự chèn giảm → pegging & van chèn MỞ THÊM giữ setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const peg0 = rt.value('FW_DEA_PEG_VALVE_01');
    const gland0 = rt.value('TRB_GLAND_VALVE_01');

    rt.setLoadDemand(300); // hạ tải ~50%
    for (let i = 0; i < 2500; i++) rt.step();
    // Áp vẫn quanh setpoint; van mở THÊM đáng kể bù hơi trích/tự chèn giảm theo tải.
    expect(rt.value('FW_DEA_PRESS_01')).toBeGreaterThan(0.84);
    expect(rt.value('FW_DEA_PRESS_01')).toBeLessThan(0.96);
    expect(rt.value('FW_DEA_PEG_VALVE_01')).toBeGreaterThan(peg0 + 5);
    expect(rt.value('TRB_GLAND_PRESS_01')).toBeGreaterThan(4.0);
    expect(rt.value('TRB_GLAND_VALVE_01')).toBeGreaterThan(gland0 + 3);
  });

  it('zero-regression: mức deaerator & nhiệt econ giữ nguyên (chỉ thêm tag áp)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('FW_DEAERATOR_LEVEL_01')).toBeGreaterThan(42);
    expect(rt.value('FW_DEAERATOR_LEVEL_01')).toBeLessThan(58);
    expect(rt.value('FW_ECON_INLET_TEMP_01')).toBeGreaterThan(250); // ~283 °C
  });
});
