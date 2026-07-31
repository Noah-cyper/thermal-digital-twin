import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — physics chiều sâu B3: SH tầng · gối turbine · fill tháp', () => {
  it('SH tầng tăng đơn điệu (LTSH < platen < final); fill tháp nguội dần; gối/rung hợp lý ở định mức', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();

    // Nhiệt hơi qua các tầng quá nhiệt: bão hoà → LTSH → platen → final, tăng đơn điệu.
    const ltsh = rt.value('BLR_SH_LTSH_TEMP_01');
    const platen = rt.value('BLR_SH_PLATEN_TEMP_01');
    const final = rt.value('BLR_MSTM_SH_TEMP_01');
    expect(ltsh).toBeGreaterThan(355); // > nhiệt bão hoà
    expect(ltsh).toBeLessThan(platen);
    expect(platen).toBeLessThan(final + 2); // final có nhiễu đo

    // Profile fill tháp làm mát: CW nóng (spray) > giữa fill > CW cấp (bể).
    const hot = rt.value('CT_CW_HOT_01');
    const mid = rt.value('CT_FILL_MID_01');
    const sup = rt.value('CT_CW_SUPPLY_01');
    expect(hot).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(sup - 0.1);

    // Gối trục & rung ở định mức: nhiệt hợp lý, rung thấp (xa tốc độ tới hạn).
    expect(rt.value('TRB_BRG_TEMP_01')).toBeGreaterThan(55);
    expect(rt.value('TRB_BRG_TEMP_01')).toBeLessThan(95);
    expect(rt.value('TRB_VIB_01')).toBeLessThan(4);
  });

  it('rung trục ĐỈNH khi coast-down qua tốc độ tới hạn (turbine trip)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    rt.manualTrip('turbine');
    let vibMax = 0;
    for (let i = 0; i < 700; i++) { rt.step(); vibMax = Math.max(vibMax, rt.value('TRB_VIB_01')); }
    expect(vibMax).toBeGreaterThan(6); // cộng hưởng khi tốc độ đi qua ~1500 rpm
  });
});
