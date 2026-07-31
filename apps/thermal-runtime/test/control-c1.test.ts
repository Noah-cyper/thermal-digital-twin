import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop C1: SCR deNOx (NH₃) · FGD SO₂ (slurry)', () => {
  it('điểm vận hành: SCR khử NOₓ 320→~150; FGD giữ SO₂ ~61; lệnh NH₃/slurry đang cấp', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // SCR: NOₓ ống khói (sau khử) ~150 mg/Nm³, THẤP hơn NOₓ vào SCR (nền cháy ~320) → SCR đang khử.
    const noxOut = rt.value('EMI_NOX_STACK_01');
    const noxIn = rt.value('EMI_NOX_SCR_IN_01');
    expect(noxOut).toBeGreaterThan(120);
    expect(noxOut).toBeLessThan(180);
    expect(noxIn).toBeGreaterThan(280); // nền cháy chưa khử (SCR inlet)
    expect(noxIn - noxOut).toBeGreaterThan(120); // SCR khử đáng kể
    expect(rt.value('EMI_SCR_EFF_01')).toBeGreaterThan(30); // % độ khử
    expect(rt.value('EMI_NH3_INJ_01')).toBeGreaterThan(5); // lệnh NH₃ đang cấp

    // FGD: SO₂ ống khói giữ ~61 mg/Nm³ bằng slurry đá vôi; hiệu suất ~95 %.
    expect(rt.value('EMI_SO2_STACK_01')).toBeGreaterThan(45);
    expect(rt.value('EMI_SO2_STACK_01')).toBeLessThan(80);
    expect(rt.value('EMI_FGD_SLURRY_01')).toBeGreaterThan(5); // lệnh slurry đang cấp
    expect(rt.value('EMI_FGD_EFF_01')).toBeGreaterThan(93);
  });

  it('điều khiển nồng độ bền vững khi hạ tải (448 → 300 MW): SCR/FGD giữ outlet quanh setpoint', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();

    rt.setLoadDemand(300); // hạ tải ~50 %
    for (let i = 0; i < 2000; i++) rt.step();
    // Vẫn đang đốt (NOₓ nền ~320 theo nồng độ, độc lập tải); SCR/FGD giữ nồng độ outlet quanh setpoint.
    expect(rt.value('EMI_NOX_SCR_IN_01')).toBeGreaterThan(50); // firing duy trì
    expect(rt.value('EMI_NOX_STACK_01')).toBeGreaterThan(110);
    expect(rt.value('EMI_NOX_STACK_01')).toBeLessThan(190);
    expect(rt.value('EMI_SO2_STACK_01')).toBeGreaterThan(20);
    expect(rt.value('EMI_SO2_STACK_01')).toBeLessThan(90);
  });

  it('MFT (cắt nhiên liệu): mọi phát thải → 0, gồm SCR-inlet & hiệu suất SCR', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    rt.manualTrip('mft');
    for (let i = 0; i < 500; i++) rt.step();
    expect(rt.value('EMI_NOX_STACK_01')).toBeLessThan(5);
    expect(rt.value('EMI_NOX_SCR_IN_01')).toBeLessThan(5);
    expect(rt.value('EMI_SO2_STACK_01')).toBeLessThan(5);
    expect(rt.value('EMI_SCR_EFF_01')).toBe(0);
  });
});
