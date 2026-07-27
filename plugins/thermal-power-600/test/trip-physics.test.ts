import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { BoilerIslandModel } from '../src/sim/boiler-island';

const WARM = { coalFlow: 211, steamGen: 1500, pressure: 17.5, o2: 3.2, shTemp: 541 };
function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-07-24T10:00:00+07:00' };
}
function out(res: ISimStepResult, tagId: string): number {
  return res.outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}
function stepN(m: BoilerIslandModel, ctx: ISimModelContext, n: number): ISimStepResult {
  let r = m.step(ctx);
  for (let i = 1; i < n; i++) r = m.step(ctx);
  return r;
}

// Trip từ Cause&Effect đổi PHYSICS thật (v1.1): flag do engine chốt, sim đọc để phản ứng vật lý.
describe('BoilerIslandModel — trip đổi physics (doc 09 §4)', () => {
  it('MFT: BLR_MFT_TRIP=1 → than về 0, hơi sập, MW tụt', () => {
    const tags: Record<string, number> = { BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 70, BLR_TURBINE_DEMAND_01: 1490 };
    const ctx = mkCtx(tags);
    const m = new BoilerIslandModel();
    m.init(ctx, { warmStart: WARM });
    const coal0 = out(stepN(m, ctx, 100), 'BLR_COAL_FLOW_01');
    expect(coal0).toBeGreaterThan(150); // đang cấp than bình thường

    tags.BLR_MFT_TRIP = 1; // Master Fuel Trip
    const r = stepN(m, ctx, 1000);
    expect(out(r, 'BLR_COAL_FLOW_01')).toBeLessThan(5); // than cắt
    expect(out(r, 'BLR_STEAM_FLOW_01')).toBeLessThan(500); // hơi sập
    expect(out(r, 'GEN_MW_01')).toBeLessThan(150); // MW tụt theo hơi
  });

  it('turbine trip: TRB_TRIP=1 → MW=0; xoá trip → MW phục hồi', () => {
    const tags: Record<string, number> = { BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 70, BLR_TURBINE_DEMAND_01: 1490 };
    const ctx = mkCtx(tags);
    const m = new BoilerIslandModel();
    m.init(ctx, { warmStart: WARM });
    const mwBefore = out(stepN(m, ctx, 100), 'GEN_MW_01');
    expect(mwBefore).toBeGreaterThan(300);

    tags.TRB_TRIP = 1;
    expect(Math.abs(out(m.step(ctx), 'GEN_MW_01'))).toBeLessThan(1); // MW = 0 tức thì

    tags.TRB_TRIP = 0; // reset trip
    expect(out(stepN(m, ctx, 100), 'GEN_MW_01')).toBeGreaterThan(300); // phục hồi
  });
});
