import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop mức: deaerator + hotwell (đóng vòng, ổn định)', () => {
  it('mức bể khử khí & hotwell được giữ ~50% ở điểm vận hành; LCV bám lưu lượng hơi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 800; i++) rt.step();

    const dea = rt.value('FW_DEAERATOR_LEVEL_01');
    const hw = rt.value('COND_HOTWELL_LEVEL_01');
    // Loop giữ mức quanh setpoint 50% (không phân kỳ, không cạn/tràn).
    expect(dea).toBeGreaterThan(42);
    expect(dea).toBeLessThan(58);
    expect(hw).toBeGreaterThan(42);
    expect(hw).toBeLessThan(58);
    // Van mức ở dải điều khiển hợp lý (bám hơi ~1500 t/h → ~68%), không bão hoà 0/100.
    expect(rt.value('FW_DEA_LCV_01')).toBeGreaterThan(30);
    expect(rt.value('FW_DEA_LCV_01')).toBeLessThan(100);
    expect(rt.value('COND_CEP_LCV_01')).toBeGreaterThan(30);
    expect(rt.value('COND_CEP_LCV_01')).toBeLessThan(100);
  });

  it('nhiễu loạn: hạ tải → mức vẫn được kéo về ~50% (loop bám)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    rt.setLoadDemand(360); // hạ tải → hơi giảm → LCV phải giảm theo để giữ mức
    for (let i = 0; i < 1500; i++) rt.step();
    expect(rt.value('FW_DEAERATOR_LEVEL_01')).toBeGreaterThan(40);
    expect(rt.value('FW_DEAERATOR_LEVEL_01')).toBeLessThan(60);
    expect(rt.value('COND_HOTWELL_LEVEL_01')).toBeGreaterThan(40);
    expect(rt.value('COND_HOTWELL_LEVEL_01')).toBeLessThan(60);
  });
});
