import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — CCS closed loop (9 control loops quanh BoilerIslandModel)', () => {
  it('khởi động & giữ điểm vận hành: áp ~17,5 MPa · O₂ ~3,2% · SH ~541 °C · mức bao hơi bám 0', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 3000; i++) rt.step();

    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeGreaterThan(16.5);
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeLessThan(18.5);
    expect(rt.value('BLR_FLUE_O2_01')).toBeGreaterThan(2.5);
    expect(rt.value('BLR_FLUE_O2_01')).toBeLessThan(4.0);
    expect(rt.value('BLR_MSTM_SH_TEMP_01')).toBeGreaterThan(534);
    expect(rt.value('BLR_MSTM_SH_TEMP_01')).toBeLessThan(548);
    expect(Math.abs(rt.value('BLR_DRUM_LEVEL_01'))).toBeLessThan(60);
    expect(rt.value('BLR_FURN_PRESS_01')).toBeGreaterThan(-200);
    expect(rt.value('BLR_FURN_PRESS_01')).toBeLessThan(200);
  });

  it('ramp tải: tăng lệnh tải → MW & hơi tăng, áp/nhiệt vẫn trong dải (CCS coordinated)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 2000; i++) rt.step();
    const mw0 = rt.value('GEN_MW_01');

    rt.setLoadDemand(560);
    for (let i = 0; i < 5000; i++) rt.step();
    const mw1 = rt.value('GEN_MW_01');

    expect(mw1).toBeGreaterThan(mw0 + 60); // tải tăng thực sự
    expect(rt.value('BLR_STEAM_FLOW_01')).toBeGreaterThan(1750); // hơi tăng theo tải
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeGreaterThan(16.5); // áp vẫn được giữ
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeLessThan(18.5);
    expect(rt.value('BLR_MSTM_SH_TEMP_01')).toBeLessThan(552); // nhiệt không vượt xa
  });

  it('mill trip: công suất than bị giới hạn (≤ 4 mill) và hệ vẫn hữu hạn/ổn định', () => {
    const rt = createThermalRuntime({ loadMw: 560 });
    for (let i = 0; i < 3000; i++) rt.step();

    rt.injectMalfunction({ id: 'mill-trip' });
    for (let i = 0; i < 4000; i++) rt.step();

    expect(rt.value('BLR_COAL_FLOW_01')).toBeLessThanOrEqual(4 * 60 + 5); // mất 1 mill → trần 240 t/h
    expect(Number.isFinite(rt.value('BLR_MSTM_SH_PRESS_01'))).toBe(true);
    expect(rt.value('BLR_MSTM_SH_PRESS_01')).toBeGreaterThan(0);
  });
});
