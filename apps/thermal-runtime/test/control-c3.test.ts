import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop C3: nhiệt ra máy nghiền · áp header gió sơ cấp (PA)', () => {
  it('điểm vận hành: mill outlet ~70 °C (van gió nóng mở); PA header ~9 kPa (van quạt mở)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 700; i++) rt.step();

    // Mill outlet temp: trộn gió nóng/tempering giữ ~70 °C (sấy bột than, không quá nhiệt); van đang mở.
    expect(rt.value('COAL_MILL_OUT_TEMP_01')).toBeGreaterThan(64);
    expect(rt.value('COAL_MILL_OUT_TEMP_01')).toBeLessThan(76);
    expect(rt.value('COAL_HOT_AIR_DMPR_01')).toBeGreaterThan(5);
    expect(rt.value('COAL_HOT_AIR_DMPR_01')).toBeLessThan(95);

    // PA header pressure: quạt PA giữ ~9 kPa vận chuyển bột than; van hướng đang mở.
    expect(rt.value('COAL_PA_HEADER_PRESS_01')).toBeGreaterThan(7.5);
    expect(rt.value('COAL_PA_HEADER_PRESS_01')).toBeLessThan(10.5);
    expect(rt.value('COAL_PA_FAN_VANE_01')).toBeGreaterThan(20);
  });

  it('giữ setpoint qua hạ tải (448 → 300 MW): mill temp & PA header bám setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();

    rt.setLoadDemand(300);
    for (let i = 0; i < 2500; i++) rt.step();
    expect(rt.value('COAL_MILL_OUT_TEMP_01')).toBeGreaterThan(63);
    expect(rt.value('COAL_MILL_OUT_TEMP_01')).toBeLessThan(77);
    expect(rt.value('COAL_PA_HEADER_PRESS_01')).toBeGreaterThan(7);
    expect(rt.value('COAL_PA_HEADER_PRESS_01')).toBeLessThan(11);
  });

  it('zero-regression: số mill chạy & tải mill giữ nguyên (chỉ thêm tag nhiệt/áp)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 700; i++) rt.step();
    expect(rt.value('COAL_MILLS_RUNNING_01')).toBeGreaterThan(2);
    expect(rt.value('COAL_MILL_LOADING_01')).toBeGreaterThan(50);
    expect(rt.value('COAL_MILL_LOADING_01')).toBeLessThan(100);
  });
});
