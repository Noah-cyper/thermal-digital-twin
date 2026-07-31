import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop C4: áp H₂ máy phát · nhiệt nước làm mát stator', () => {
  it('điểm vận hành: H₂ ~0,4 MPa (van cấp mở); nước làm mát stator ~45 °C (van làm mát mở)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // Áp khí H₂ làm mát: van cấp giữ 0,4 MPa bù rò seal; van đang cấp.
    expect(rt.value('ELEC_H2_PRESS_01')).toBeGreaterThan(0.37);
    expect(rt.value('ELEC_H2_PRESS_01')).toBeLessThan(0.43);
    expect(rt.value('ELEC_H2_VALVE_01')).toBeGreaterThan(10);

    // Nhiệt nước làm mát stator: van nước làm mát giữ 45 °C; van đang mở.
    expect(rt.value('ELEC_STATOR_CW_TEMP_01')).toBeGreaterThan(42);
    expect(rt.value('ELEC_STATOR_CW_TEMP_01')).toBeLessThan(48);
    expect(rt.value('ELEC_STATOR_CW_VALVE_01')).toBeGreaterThan(10);
  });

  it('hạ tải → I²R giảm → van nước làm mát ĐÓNG bớt; nhiệt & áp H₂ giữ setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const cwValve0 = rt.value('ELEC_STATOR_CW_VALVE_01');

    rt.setLoadDemand(300);
    for (let i = 0; i < 2000; i++) rt.step();
    expect(rt.value('ELEC_STATOR_CW_TEMP_01')).toBeGreaterThan(42);
    expect(rt.value('ELEC_STATOR_CW_TEMP_01')).toBeLessThan(48);
    expect(rt.value('ELEC_STATOR_CW_VALVE_01')).toBeLessThan(cwValve0); // tải thấp → ít I²R → đóng bớt van
    expect(rt.value('ELEC_H2_PRESS_01')).toBeGreaterThan(0.37); // độc lập tải
    expect(rt.value('ELEC_H2_PRESS_01')).toBeLessThan(0.43);
  });

  it('zero-regression: net & grid MW giữ nguyên (chỉ thêm tag làm mát)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('ELEC_NET_MW_01')).toBeGreaterThan(380); // ~448 − tự dùng
    expect(rt.value('ELEC_GRID_MW_01')).toBeGreaterThan(380);
  });
});
