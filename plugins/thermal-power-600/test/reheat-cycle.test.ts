import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { ReheatCycleModel } from '../src/sim/reheat-cycle';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(model: ReheatCycleModel, tags: Record<string, number>, steps: number): Record<string, number> {
  const out: Record<string, number> = {};
  const ctx = ctxOf(tags);
  for (let i = 0; i < steps; i++) for (const o of model.step(ctx).outputs) out[o.tagId] = o.value;
  return out;
}

describe('ReheatCycleModel (doc 10 §6) — chu trình tái nhiệt + turbine nhiều tầng', () => {
  it('điểm đầy tải: CRH/HRH áp trượt theo hơi chính (neo DB); HRH nhiệt ~541; HP+IP+LP = MW; reheat duty hợp lý', () => {
    const m = new ReheatCycleModel();
    m.init();
    const o = run(m, { BLR_MSTM_SH_PRESS_01: 17.5, BLR_MSTM_SH_TEMP_01: 541, BLR_STEAM_FLOW_01: 2008, GEN_MW_01: 600 }, 600);

    // Áp neo Design Basis: CRH ≈ 4,2 MPa (RH in), HRH ≈ 3,8 MPa (RH out).
    expect(o.TRB_CRH_PRESS_01).toBeCloseTo(4.2, 1);
    expect(o.TRB_HRH_PRESS_01).toBeCloseTo(3.8, 1);
    // Hot reheat điều về ~541 ở đầy tải; cold reheat ~330 (= 541 − ΔT_HP).
    expect(o.TRB_HRH_TEMP_01).toBeGreaterThan(535);
    expect(o.TRB_HRH_TEMP_01).toBeLessThanOrEqual(541.5);
    expect(o.TRB_CRH_TEMP_01).toBeCloseTo(330, 0);
    // Tách tầng CỘNG LẠI = công suất trục → additive, không đổi GEN_MW_01.
    expect((o.TRB_HP_MW_01 ?? 0) + (o.TRB_IP_MW_01 ?? 0) + (o.TRB_LP_MW_01 ?? 0)).toBeCloseTo(600, 3);
    expect(o.TRB_HP_MW_01).toBeGreaterThan(0);
    // Nhiệt lượng reheater (MWth) hợp lý ở BMCR (~290).
    expect(o.TRB_REHEAT_DUTY_01).toBeGreaterThan(200);
    expect(o.TRB_REHEAT_DUTY_01).toBeLessThan(350);
  });

  it('MFT / mất lưu lượng: reheat duty = 0, công suất tầng = 0, nhiệt đường hơi suy về idle', () => {
    const m = new ReheatCycleModel();
    m.init();
    const o = run(m, { BLR_MSTM_SH_PRESS_01: 2, BLR_MSTM_SH_TEMP_01: 250, BLR_STEAM_FLOW_01: 0, GEN_MW_01: 0 }, 2000);
    expect(o.TRB_REHEAT_DUTY_01).toBe(0);
    expect(o.TRB_HP_MW_01).toBe(0);
    expect(o.TRB_HRH_TEMP_01).toBeLessThan(260); // suy về ~200 (idle metal)
    expect(o.TRB_HRH_TEMP_01).toBeGreaterThanOrEqual(199);
  });

  it('snapshot/restore giữ trạng thái nhiệt (OTS)', () => {
    const m = new ReheatCycleModel();
    m.init();
    run(m, { BLR_MSTM_SH_PRESS_01: 17.5, BLR_MSTM_SH_TEMP_01: 541, BLR_STEAM_FLOW_01: 2008, GEN_MW_01: 600 }, 300);
    const snap = m.snapshot();
    const m2 = new ReheatCycleModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.hrhTemp).toBeCloseTo(snap.state.hrhTemp as number, 6);
  });
});
