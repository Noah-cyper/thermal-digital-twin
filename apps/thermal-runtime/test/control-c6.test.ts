import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerControlLoops } from '@idtp/plugin-thermal-power-600';

describe('thermal-runtime — CCS loop C6 (MỐC 25): H₂ gas temp · seal oil dP · closed cooling water temp', () => {
  it('MỐC: CCS đúng 25 vòng điều khiển, id duy nhất, mỗi vòng có outTag', () => {
    expect(boilerControlLoops.length).toBeGreaterThanOrEqual(25); // ≥ 25 (25 lõi + vòng bảo vệ/khởi động thêm sau)
    const ids = boilerControlLoops.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length); // không trùng id
    expect(boilerControlLoops.every((l) => typeof l.outTag === 'string' && l.outTag.length > 0)).toBe(true);
    for (const id of ['generator-h2-temp', 'seal-oil-dp', 'closed-cooling-water-temp']) {
      expect(ids).toContain(id);
    }
  });

  it('điểm vận hành: H₂ ~40 °C (van CW mở) · seal oil dP ~0,08 MPa · CCW ~38 °C (van mở)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    expect(rt.value('ELEC_H2_TEMP_01')).toBeGreaterThan(37);
    expect(rt.value('ELEC_H2_TEMP_01')).toBeLessThan(43);
    expect(rt.value('ELEC_H2_CW_VALVE_01')).toBeGreaterThan(8);

    expect(rt.value('ELEC_SEAL_OIL_DP_01')).toBeGreaterThan(0.06);
    expect(rt.value('ELEC_SEAL_OIL_DP_01')).toBeLessThan(0.1);

    expect(rt.value('COND_CCW_TEMP_01')).toBeGreaterThan(35);
    expect(rt.value('COND_CCW_TEMP_01')).toBeLessThan(41);
    expect(rt.value('COND_CCW_CW_VALVE_01')).toBeGreaterThan(8);
  });

  it('hạ tải → nhiệt máy phát/phụ trợ giảm → van CW H₂ & CCW ĐÓNG bớt; seal oil dP giữ setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const h2cw0 = rt.value('ELEC_H2_CW_VALVE_01');
    const ccw0 = rt.value('COND_CCW_CW_VALVE_01');

    rt.setLoadDemand(300);
    for (let i = 0; i < 2000; i++) rt.step();
    expect(rt.value('ELEC_H2_TEMP_01')).toBeGreaterThan(37);
    expect(rt.value('ELEC_H2_TEMP_01')).toBeLessThan(43);
    expect(rt.value('ELEC_H2_CW_VALVE_01')).toBeLessThan(h2cw0);
    expect(rt.value('COND_CCW_CW_VALVE_01')).toBeLessThan(ccw0);
    expect(rt.value('ELEC_SEAL_OIL_DP_01')).toBeGreaterThan(0.06); // độc lập tải
  });

  it('zero-regression: net MW & hotwell level giữ nguyên (chỉ thêm tag làm mát)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('ELEC_NET_MW_01')).toBeGreaterThan(380);
    expect(rt.value('COND_HOTWELL_LEVEL_01')).toBeGreaterThan(40);
    expect(rt.value('COND_HOTWELL_LEVEL_01')).toBeLessThan(60);
  });
});
