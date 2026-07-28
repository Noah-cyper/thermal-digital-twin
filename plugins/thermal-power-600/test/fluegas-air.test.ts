import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FlueGasAirModel } from '../src/sim/fluegas-air';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: FlueGasAirModel, tags: Record<string, number>, steps: number): Record<string, number> {
  const out: Record<string, number> = {};
  const ctx = ctxOf(tags);
  for (let i = 0; i < steps; i++) for (const o of m.step(ctx).outputs) out[o.tagId] = o.value;
  return out;
}

describe('FlueGasAirModel (doc 10 §6) — đường khói + gió cháy + hiệu suất lò', () => {
  it('đầy tải: hiệu suất lò ~88 %; gió thừa/λ từ O₂; nhiệt ống khói ~130; tổn thất khói khô hợp lý', () => {
    const m = new FlueGasAirModel();
    m.init();
    // than 283 t/h, O₂ 3,2 %, 600 MW, HR chu trình 8940.
    const o = run(m, { BLR_COAL_FLOW_01: 283, BLR_FLUE_O2_01: 3.2, GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940 }, 600);

    expect(o.BLR_EFF_01).toBeGreaterThan(82); // hiệu suất lò
    expect(o.BLR_EFF_01).toBeLessThan(93);
    expect(o.FG_EXCESS_AIR_01).toBeGreaterThan(10); // ~18 % gió thừa ở O₂ 3,2
    expect(o.FG_EXCESS_AIR_01).toBeLessThan(30);
    expect(o.FG_LAMBDA_01).toBeCloseTo(1.18, 1);
    expect(o.FG_FLOW_01).toBeGreaterThan(3000); // t/h khói
    expect(o.FG_STACK_TEMP_01).toBeGreaterThan(110);
    expect(o.FG_STACK_TEMP_01).toBeLessThan(145);
    expect(o.AH_AIR_OUT_TEMP_01).toBeGreaterThan(250); // gió cháy được air heater hâm nóng
    expect(o.FG_DRYGAS_LOSS_01).toBeGreaterThan(3);
    expect(o.FG_DRYGAS_LOSS_01).toBeLessThan(10);
  });

  it('O₂ cao (gió thừa lớn) → λ tăng, lưu lượng khói tăng, tổn thất khói khô tăng', () => {
    const m1 = new FlueGasAirModel();
    m1.init();
    const nom = run(m1, { BLR_COAL_FLOW_01: 283, BLR_FLUE_O2_01: 3.2, GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940 }, 400);
    const m2 = new FlueGasAirModel();
    m2.init();
    const hi = run(m2, { BLR_COAL_FLOW_01: 283, BLR_FLUE_O2_01: 6.5, GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940 }, 400);
    expect(hi.FG_LAMBDA_01 ?? 0).toBeGreaterThan(nom.FG_LAMBDA_01 ?? 0);
    expect(hi.FG_FLOW_01 ?? 0).toBeGreaterThan(nom.FG_FLOW_01 ?? 0);
    expect(hi.FG_DRYGAS_LOSS_01 ?? 0).toBeGreaterThan(nom.FG_DRYGAS_LOSS_01 ?? 0);
  });

  it('MFT / tắt lửa: lưu lượng khói = 0, hiệu suất = 0, nhiệt khói nguội về môi trường', () => {
    const m = new FlueGasAirModel();
    m.init();
    const o = run(m, { BLR_COAL_FLOW_01: 0, BLR_FLUE_O2_01: 18, GEN_MW_01: 0, PLANT_CYCLE_HR_01: 0 }, 2000);
    expect(o.FG_FLOW_01).toBe(0);
    expect(o.BLR_EFF_01).toBe(0);
    expect(o.FG_STACK_TEMP_01).toBeLessThan(60); // nguội về ~30
  });

  it('snapshot/restore giữ nhiệt đường khói (OTS)', () => {
    const m = new FlueGasAirModel();
    m.init();
    run(m, { BLR_COAL_FLOW_01: 211, BLR_FLUE_O2_01: 3.2, GEN_MW_01: 448, PLANT_CYCLE_HR_01: 8940 }, 300);
    const snap = m.snapshot();
    const m2 = new FlueGasAirModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tStack).toBeCloseTo(snap.state.tStack as number, 6);
  });
});
