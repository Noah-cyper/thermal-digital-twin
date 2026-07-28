import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FeedwaterTrainModel } from '../src/sim/feedwater-train';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: FeedwaterTrainModel, tags: Record<string, number>, steps: number): Record<string, number> {
  const out: Record<string, number> = {};
  const ctx = ctxOf(tags);
  for (let i = 0; i < steps; i++) for (const o of m.step(ctx).outputs) out[o.tagId] = o.value;
  return out;
}

describe('FeedwaterTrainModel (doc 10 §6) — gia nhiệt hồi nhiệt + heat rate chu trình', () => {
  it('đầy tải: đoàn gia nhiệt đạt mốc DB (econ 283 · deaerator 178 · condensate 34); regen duty > 0; heat rate chu trình tốt hơn heat rate đơn vị 9.200', () => {
    const m = new FeedwaterTrainModel();
    m.init();
    const o = run(m, { BLR_STEAM_FLOW_01: 2008, GEN_MW_01: 600, TRB_COND_VACUUM_01: 5.4, TRB_REHEAT_DUTY_01: 293 }, 600);

    expect(o.FW_ECON_INLET_TEMP_01).toBeCloseTo(283, 0); // neo Design Basis
    expect(o.FW_DEAERATOR_TEMP_01).toBeCloseTo(178, 0);
    expect(o.FW_CONDENSATE_TEMP_01).toBeCloseTo(34, 0);
    expect(o.FW_FLOW_01).toBe(2008); // cân bằng khối lượng (= hơi)
    expect(o.FW_REGEN_DUTY_01).toBeGreaterThan(400); // MWth hồi nhiệt cấp cho nước cấp
    // Heat rate chu trình turbine < heat rate ĐƠN VỊ 9.200 (đơn vị gồm hiệu suất lò + tự dùng).
    expect(o.PLANT_CYCLE_HR_01).toBeGreaterThan(8000);
    expect(o.PLANT_CYCLE_HR_01).toBeLessThan(9200);
  });

  it('mất chân không → condensate nóng lên (heat rate xấu đi)', () => {
    const m = new FeedwaterTrainModel();
    m.init();
    const good = run(m, { BLR_STEAM_FLOW_01: 2008, GEN_MW_01: 600, TRB_COND_VACUUM_01: 5.4, TRB_REHEAT_DUTY_01: 293 }, 400);
    const m2 = new FeedwaterTrainModel();
    m2.init();
    const bad = run(m2, { BLR_STEAM_FLOW_01: 2008, GEN_MW_01: 600, TRB_COND_VACUUM_01: 20, TRB_REHEAT_DUTY_01: 293 }, 400);
    expect(bad.FW_CONDENSATE_TEMP_01 ?? 0).toBeGreaterThan(good.FW_CONDENSATE_TEMP_01 ?? 0);
  });

  it('MFT / mất tải: regen duty = 0, heat rate = 0, nhiệt econ suy dưới 283', () => {
    const m = new FeedwaterTrainModel();
    m.init();
    const o = run(m, { BLR_STEAM_FLOW_01: 0, GEN_MW_01: 0, TRB_COND_VACUUM_01: 5.4, TRB_REHEAT_DUTY_01: 0 }, 1500);
    expect(o.FW_REGEN_DUTY_01).toBe(0);
    expect(o.PLANT_CYCLE_HR_01).toBe(0); // không có công suất → không tính heat rate
    expect(o.FW_ECON_INLET_TEMP_01).toBeLessThan(283); // đoàn gia nhiệt nguội đi
  });

  it('snapshot/restore giữ nhiệt đoàn gia nhiệt (OTS)', () => {
    const m = new FeedwaterTrainModel();
    m.init();
    run(m, { BLR_STEAM_FLOW_01: 1500, GEN_MW_01: 448, TRB_COND_VACUUM_01: 5.4, TRB_REHEAT_DUTY_01: 219 }, 300);
    const snap = m.snapshot();
    const m2 = new FeedwaterTrainModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tEcon).toBeCloseTo(snap.state.tEcon as number, 6);
  });
});
