import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { RegenBalanceModel } from '../src/sim/regen-balance';

const BASE = {
  BLR_STEAM_FLOW_01: 1500,
  FWH_DRAIN_TO_COND_01: 135, // = 9% × 1500 (cascade nền, van xả khẩn ĐÓNG)
  FW_ECON_INLET_TEMP_01: 283,
  FW_DEAERATOR_TEMP_01: 178,
  PLANT_CYCLE_HR_01: 8000,
};
function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: RegenBalanceModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('RegenBalanceModel (doc 10 §6) — nối drain vào cân bằng nhiệt', () => {
  it('vận hành bình thường (drain = nền): tổn thất = 0, nước cấp econ hiệu dụng = danh nghĩa, heat rate không phạt (GUARD 0 hồi quy)', () => {
    const m = new RegenBalanceModel();
    m.init();
    const o = one(m, BASE);
    expect(o.PLANT_REGEN_LOSS_MW_01).toBe(0);
    expect(o.PLANT_FW_TEMP_DEPRESSION_01).toBe(0);
    expect(o.FW_ECON_INLET_EFFECTIVE_01).toBeCloseTo(283, 3);
    expect(o.PLANT_HR_REGEN_PENALTY_01).toBe(0);
    expect(o.PLANT_CYCLE_HR_EFF_01).toBeCloseTo(8000, 3); // = PLANT_CYCLE_HR (không phạt)
    expect(o.PLANT_REGEN_HEALTHY_01).toBe(1);
  });

  it('van xả khẩn mở (drain chuyển hướng): tổn thất hồi nhiệt > 0 → nước cấp nguội → heat rate hiệu dụng XẤU đi', () => {
    const m = new RegenBalanceModel();
    m.init();
    const o = one(m, { ...BASE, FWH_DRAIN_TO_COND_01: 255 }); // 135 nền + 120 xả khẩn
    expect(o.PLANT_REGEN_LOSS_MW_01).toBeGreaterThan(1);
    expect(o.PLANT_FW_TEMP_DEPRESSION_01).toBeGreaterThan(2);
    expect(o.FW_ECON_INLET_EFFECTIVE_01).toBeLessThan(283); // nước cấp vào econ nguội hơn
    expect(o.PLANT_HR_REGEN_PENALTY_01).toBeGreaterThan(0.5);
    expect(o.PLANT_CYCLE_HR_EFF_01).toBeGreaterThan(8000); // heat rate hiệu dụng xấu hơn
    expect(o.PLANT_REGEN_HEALTHY_01).toBe(0);
  });
});
