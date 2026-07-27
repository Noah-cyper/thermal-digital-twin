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
function stepN(tags: Record<string, number>, n: number): ISimStepResult {
  const ctx = mkCtx(tags);
  const m = new BoilerIslandModel();
  m.init(ctx, { warmStart: WARM });
  let r = m.step(ctx);
  for (let i = 1; i < n; i++) r = m.step(ctx);
  return r;
}

// SFC nối vào sim (v1.2): sim đọc tag lệnh của chuỗi để đổi physics.
describe('BoilerIslandModel — SFC nối vào sim (doc 09/10)', () => {
  it('feedwater-fill: BLR_FW_FILL_CMD=1 → bơm điền → mức cao hơn (so cùng fwCv thấp)', () => {
    const base = { BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 60, BLR_TURBINE_DEMAND_01: 1490 };
    const noFill = out(stepN({ ...base }, 2000), 'BLR_DRUM_LEVEL_01');
    const fill = out(stepN({ ...base, BLR_FW_FILL_CMD: 1 }, 2000), 'BLR_DRUM_LEVEL_01');
    expect(fill).toBeGreaterThan(noFill + 50); // điền lò nâng mức
  });

  it('mill-a-stop: BLR_MILL_A_STOP_CMD=1 → bớt 1 mill → hơi thấp hơn (ở lệnh tải cao)', () => {
    const base = { BLR_FUEL_DEMAND_01: 100, BLR_FD_DAMPER_01: 90, BLR_FW_CV_01: 80, BLR_TURBINE_DEMAND_01: 1990 };
    const full = out(stepN({ ...base }, 2000), 'BLR_STEAM_FLOW_01');
    const stop = out(stepN({ ...base, BLR_MILL_A_STOP_CMD: 1 }, 2000), 'BLR_STEAM_FLOW_01');
    expect(stop).toBeLessThan(full - 100); // 1 mill công suất ít hơn → hơi giảm
  });
});
