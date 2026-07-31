import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — OTS/điều khiển: interlock permissive + trip tay + malfunction', () => {
  it('điểm vận hành KHÔNG interlock; MFT tay → C&E chốt → cắt nhiên liệu; interlock chặn tải; reset phục hồi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();

    // Điểm vận hành: không permissive nào chặn.
    expect(rt.interlockCheck('load').blocked).toBe(false);
    expect(rt.activeInterlocks()).toEqual([]);
    expect(rt.value('GEN_MW_01')).toBeGreaterThan(300);

    // Nút MFT tay → cause C&E BLR_MFT_PB → chốt BLR_MFT_TRIP → boiler cắt than THẬT (tức thì).
    rt.manualTrip('mft');
    for (let i = 0; i < 220; i++) rt.step();
    expect(rt.value('BLR_MFT_TRIP')).toBeGreaterThan(0);
    expect(rt.value('BLR_COAL_FLOW_01')).toBeLessThan(30); // than về ~0 (quán tính feeder 8 s)

    // Interlock giờ CHẶN lệnh tải, kèm lý do MFT (W6 DoD: lệnh bị chặn hiện lý do).
    const il = rt.interlockCheck('load');
    expect(il.blocked).toBe(true);
    expect(il.reasons.join(' ')).toMatch(/MFT/i);
    expect(rt.activeInterlocks().some((a) => a.id === 'il-load-mft')).toBe(true);

    // Reset C&E (nhả nút + hết nguyên nhân) → trip xoá → CCS ramp nhiên liệu lại → phục hồi.
    expect(rt.resetCauseEffect('boiler-mft')).toBe(true);
    for (let i = 0; i < 900; i++) rt.step();
    expect(rt.value('BLR_MFT_TRIP')).toBe(0);
    expect(rt.value('BLR_COAL_FLOW_01')).toBeGreaterThan(80); // than đã cấp lại
    expect(rt.interlockCheck('load').blocked).toBe(false);
  });

  it('MFT giữ lâu → sụp nhiệt: công suất tụt sâu (quán tính hơi τ 40 s + θ 20 s)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    const mw0 = rt.value('GEN_MW_01');
    rt.manualTrip('mft');
    for (let i = 0; i < 700; i++) rt.step(); // 70 s — hơi sụp hẳn
    expect(rt.value('GEN_MW_01')).toBeLessThan(mw0 - 100);
  });

  it('malfunction sh-spray-fail (van giảm ôn kẹt) → nhiệt hơi SH leo cao; gỡ → hạ lại', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const t0 = rt.value('BLR_MSTM_SH_TEMP_01');

    rt.injectMalfunction({ id: 'sh-spray-fail' });
    for (let i = 0; i < 500; i++) rt.step();
    const tFail = rt.value('BLR_MSTM_SH_TEMP_01');
    expect(tFail).toBeGreaterThan(t0 + 5); // mất phun giảm ôn → nhiệt tăng

    rt.clearMalfunction('sh-spray-fail');
    for (let i = 0; i < 700; i++) rt.step();
    expect(rt.value('BLR_MSTM_SH_TEMP_01')).toBeLessThan(tFail); // phun lại → hạ nhiệt
  });

  it('malfunction cw-pump-trip → lưu lượng CW giảm nửa, độ tăng nhiệt CW tăng', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const rise0 = rt.value('COND_CW_RISE_01');
    const flow0 = rt.value('COND_CW_FLOW_01');

    rt.injectMalfunction({ id: 'cw-pump-trip' });
    for (let i = 0; i < 300; i++) rt.step();
    expect(rt.value('COND_CW_FLOW_01')).toBeLessThan(flow0 * 0.6); // ~50% lưu lượng
    expect(rt.value('COND_CWP_A_FLOW_01')).toBe(0); // bơm A dừng
    expect(rt.value('COND_CW_RISE_01')).toBeGreaterThan(rise0 * 1.5); // ΔT tăng mạnh
  });

  it('turbine trip tay → C&E: turbine coast-down + MỞ máy cắt máy phát (tách lưới, xuất lưới 0, net âm)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    const spd0 = rt.value('TRB_SPEED_01');
    expect(spd0).toBeGreaterThan(2900); // ~3000 rpm hoà lưới
    expect(rt.value('ELEC_BREAKER_01')).toBe(1); // máy cắt đóng
    expect(rt.value('ELEC_GRID_MW_01')).toBeGreaterThan(100); // đang xuất lưới

    rt.manualTrip('turbine');
    for (let i = 0; i < 300; i++) rt.step();
    // Turbine đọc TRB_TRIP → MSV đóng → coast-down (tốc độ tụt khỏi 3000 + Stodola về 0).
    expect(rt.value('TRB_SPEED_01')).toBeLessThan(spd0 - 200);
    expect(rt.value('TRB_STODOLA_FLOW')).toBeLessThan(50);
    // C&E mở máy cắt máy phát → tách lưới: xuất lưới 0, tổ máy NHẬP tự dùng nền (net âm).
    expect(rt.value('ELEC_BREAKER_01')).toBe(0);
    expect(rt.value('ELEC_GRID_MW_01')).toBe(0);
    expect(rt.value('ELEC_NET_MW_01')).toBeLessThan(0);
  });
});
