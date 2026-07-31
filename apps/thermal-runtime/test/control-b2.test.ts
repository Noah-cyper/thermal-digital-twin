import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS loop B2: reheat temp · BFP recirc · coordinated sliding pressure', () => {
  it('điểm vận hành: reheat-temp giữ HRH ~541; BFP recirc đóng; áp SP = 17,5 MPa (≥55% tải)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 800; i++) rt.step();

    // reheat-temp: gas-biasing bù droop non tải → hot reheat giữ ~541 °C (không có loop sẽ ~526).
    const hrh = rt.value('TRB_HRH_TEMP_01');
    expect(hrh).toBeGreaterThan(535);
    expect(hrh).toBeLessThan(546);
    expect(rt.value('TRB_RH_BIAS_01')).toBeGreaterThan(5); // loop đang cấp gió biasing

    // BFP min-flow recirc: đóng ở tải (lưu lượng nước cấp >> ngưỡng 350 t/h).
    expect(rt.value('BLR_BFP_RECIRC_01')).toBeLessThan(5);

    // Coordinated master: áp SP = 17,5 MPa ở điểm vận hành (>55% tải) → điểm vận hành KHÔNG đổi.
    expect(rt.value('BLR_PRESS_SP')).toBeCloseTo(17.5, 1);
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeGreaterThan(16.5);
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeLessThan(18.5);
  });

  it('sliding pressure: hạ tải sâu → setpoint áp trượt xuống dưới 17,5 (coordinated master)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    rt.setLoadDemand(240); // ~40% tải < ngưỡng 55% → áp SP trượt
    for (let i = 0; i < 2000; i++) rt.step();
    expect(rt.value('BLR_PRESS_SP')).toBeLessThan(17.2); // setpoint đã trượt
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeLessThan(17.5); // áp thực bám setpoint trượt
  });
});
