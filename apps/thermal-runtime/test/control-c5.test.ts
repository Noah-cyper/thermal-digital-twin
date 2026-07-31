import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop C5: dầu bôi trơn (nhiệt · áp) · header hơi phụ trợ', () => {
  it('điểm vận hành: dầu ~45 °C (van CW mở) · áp dầu ~0,2 MPa · header phụ trợ ~1,3 MPa', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // Nhiệt dầu bôi trơn: van CW cooler dầu giữ 45 °C; van đang mở.
    expect(rt.value('TRB_LUBE_OIL_TEMP_01')).toBeGreaterThan(42);
    expect(rt.value('TRB_LUBE_OIL_TEMP_01')).toBeLessThan(48);
    expect(rt.value('TRB_OIL_CW_VALVE_01')).toBeGreaterThan(10);

    // Áp header dầu: bơm/van giữ 0,2 MPa (bảo vệ màng dầu gối).
    expect(rt.value('TRB_LUBE_OIL_PRESS_01')).toBeGreaterThan(0.17);
    expect(rt.value('TRB_LUBE_OIL_PRESS_01')).toBeLessThan(0.23);

    // Áp header hơi phụ trợ: PRDS giữ 1,3 MPa.
    expect(rt.value('FW_AUX_STEAM_PRESS_01')).toBeGreaterThan(1.2);
    expect(rt.value('FW_AUX_STEAM_PRESS_01')).toBeLessThan(1.4);
    expect(rt.value('FW_AUX_PRDS_VALVE_01')).toBeGreaterThan(10);
  });

  it('hạ tải → ma sát gối giảm → van CW cooler dầu ĐÓNG bớt; áp dầu & header phụ trợ giữ setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const oilCw0 = rt.value('TRB_OIL_CW_VALVE_01');

    rt.setLoadDemand(300);
    for (let i = 0; i < 2000; i++) rt.step();
    expect(rt.value('TRB_LUBE_OIL_TEMP_01')).toBeGreaterThan(42);
    expect(rt.value('TRB_LUBE_OIL_TEMP_01')).toBeLessThan(48);
    expect(rt.value('TRB_OIL_CW_VALVE_01')).toBeLessThan(oilCw0); // ít ma sát → đóng bớt van làm mát
    expect(rt.value('TRB_LUBE_OIL_PRESS_01')).toBeGreaterThan(0.17); // độc lập tải
    expect(rt.value('FW_AUX_STEAM_PRESS_01')).toBeGreaterThan(1.2); // độc lập tải
  });

  it('zero-regression: Stodola & tốc độ turbine giữ nguyên (chỉ thêm tag dầu/hơi phụ trợ)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('TRB_STODOLA_FLOW')).toBeGreaterThan(1000);
    expect(rt.value('TRB_SPEED_01')).toBeGreaterThan(2980);
    expect(rt.value('TRB_SPEED_01')).toBeLessThan(3020);
  });
});
