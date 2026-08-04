import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — vòng bảo vệ/khởi động (d, v1.43): SJAE hút khí + HP turbine bypass', () => {
  it('SJAE hoạt động liên tục ở tải: O₂ hoà tan ~7 ppb, van hút khí mở', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    expect(rt.value('COND_O2_01')).toBeGreaterThan(4);
    expect(rt.value('COND_O2_01')).toBeLessThan(10);
    expect(rt.value('COND_SJAE_VALVE_01')).toBeGreaterThan(20);
  });

  it('HP bypass ĐÓNG ở tải bình thường (áp SH 17,5 < ngưỡng 18,5)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeLessThan(18.5);
    expect(rt.value('BLR_HP_BYPASS_OPEN_01')).toBeLessThan(2); // van đóng
    expect(rt.value('BLR_HP_BYPASS_FLOW_01')).toBeLessThan(20);
  });

  it('HP bypass MỞ khi trip turbine đẩy áp SH vượt ngưỡng → xả hơi bảo vệ lò (actuator path thật)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    rt.manualTrip('turbine');
    for (let i = 0; i < 800; i++) rt.step();
    // Turbine ngừng lấy hơi → áp SH tăng > 18,5 → vòng hp-bypass mở van → xả hơi thật.
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeGreaterThan(18.5);
    expect(rt.value('BLR_HP_BYPASS_OPEN_01')).toBeGreaterThan(3);
    expect(rt.value('BLR_HP_BYPASS_FLOW_01')).toBeGreaterThan(20);
  });

  it('LP bypass ĐÓNG ở tải bình thường (áp hot reheat 3,8 < ngưỡng 4,0)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    expect(rt.value('TRB_HRH_PRESS_01')).toBeLessThan(4.0);
    expect(rt.value('TRB_LP_BYPASS_OPEN_01')).toBeLessThan(2); // van đóng → 0 hồi quy
    expect(rt.value('TRB_LP_BYPASS_FLOW_01')).toBeLessThan(30);
  });

  it('LP bypass MỞ khi trip đẩy áp reheat vượt ngưỡng → xả hot reheat về bình ngưng (actuator path thật)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();
    rt.manualTrip('turbine');
    for (let i = 0; i < 800; i++) rt.step();
    // Trip đẩy áp hơi chính → áp reheat (theo turbine-follow) tăng > 4,0 → vòng lp-bypass mở van → xả thật.
    expect(rt.value('TRB_HRH_PRESS_01')).toBeGreaterThan(4.0);
    expect(rt.value('TRB_LP_BYPASS_OPEN_01')).toBeGreaterThan(3);
    expect(rt.value('TRB_LP_BYPASS_FLOW_01')).toBeGreaterThan(20);
  });
});
