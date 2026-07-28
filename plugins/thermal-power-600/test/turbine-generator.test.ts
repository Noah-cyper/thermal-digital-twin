import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { TurbineGeneratorModel } from '../src/sim/turbine-generator';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-07-24T10:00:00+07:00' };
}
function out(res: ISimStepResult, tagId: string): number {
  return res.outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}
function run(tags: Record<string, number>, n: number): ISimStepResult {
  const m = new TurbineGeneratorModel();
  m.init();
  const ctx = mkCtx(tags);
  let r = m.step(ctx);
  for (let i = 1; i < n; i++) r = m.step(ctx);
  return r;
}

describe('TurbineGeneratorModel (doc 10) — Stodola + generator', () => {
  it('điểm vận hành: Stodola ~ hơi danh định · tốc độ ~3000 · tần số ~50 · MVAr theo tải', () => {
    const r = run({ BLR_MSTM_SH_PRESS_01: 17.5, TRB_COND_VACUUM_01: 5.4, BLR_STEAM_FLOW_01: 1500, GEN_MW_01: 448 }, 100);
    expect(out(r, 'TRB_STODOLA_FLOW')).toBeGreaterThan(1400);
    expect(out(r, 'TRB_STODOLA_FLOW')).toBeLessThan(1600);
    expect(out(r, 'TRB_SPEED_01')).toBeGreaterThan(2980);
    expect(out(r, 'TRB_SPEED_01')).toBeLessThan(3020);
    expect(Math.abs(out(r, 'GEN_FREQ_01') - 50)).toBeLessThan(0.5);
    expect(out(r, 'GEN_MVAR_01')).toBeCloseTo(448 * 0.62, 0);
  });

  it('Stodola giảm khi áp vào thấp; nhiệt stator tăng theo tải', () => {
    const hiP = out(run({ BLR_MSTM_SH_PRESS_01: 17.5, TRB_COND_VACUUM_01: 5.4, BLR_STEAM_FLOW_01: 1500, GEN_MW_01: 448 }, 5), 'TRB_STODOLA_FLOW');
    const loP = out(run({ BLR_MSTM_SH_PRESS_01: 10, TRB_COND_VACUUM_01: 5.4, BLR_STEAM_FLOW_01: 1500, GEN_MW_01: 448 }, 5), 'TRB_STODOLA_FLOW');
    expect(loP).toBeLessThan(hiP - 200);

    const hiLoad = out(run({ BLR_MSTM_SH_PRESS_01: 17.5, TRB_COND_VACUUM_01: 5.4, BLR_STEAM_FLOW_01: 2000, GEN_MW_01: 600 }, 200), 'GEN_STATOR_TEMP_01');
    const loLoad = out(run({ BLR_MSTM_SH_PRESS_01: 17.5, TRB_COND_VACUUM_01: 5.4, BLR_STEAM_FLOW_01: 700, GEN_MW_01: 200 }, 200), 'GEN_STATOR_TEMP_01');
    expect(hiLoad).toBeGreaterThan(loLoad + 5);
  });
});
