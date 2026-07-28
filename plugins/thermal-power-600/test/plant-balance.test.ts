import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { PlantBalanceModel } from '../src/sim/plant-balance';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: PlantBalanceModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

// Đầu vào NHẤT QUÁN đầy tải: Q_to_steam = qFuel·η = 1690·0,8816 = 1490; cond = 1490 − gross(600) = 890.
const CONSISTENT = {
  BLR_COAL_FLOW_01: 283, GEN_MW_01: 600, ELEC_NET_MW_01: 558, COND_DUTY_01: 890,
  BLR_EFF_01: 88.16, FG_FLOW_01: 3622, EMI_CO2_RATE_01: 643,
};

describe('PlantBalanceModel (doc 10 §6) — CAPSTONE cân bằng khối lượng-năng lượng', () => {
  it('đầu vào nhất quán: cân bằng năng lượng KHÉP ~100 %; KPI net hợp lý', () => {
    const m = new PlantBalanceModel();
    m.init();
    const o = one(m, CONSISTENT);

    expect(o.PLANT_ENERGY_CLOSURE_01).toBeGreaterThan(98);
    expect(o.PLANT_ENERGY_CLOSURE_01).toBeLessThan(102); // gộp + thải + tổn thất lò = nhiên liệu
    expect(o.PLANT_ENERGY_IN_01).toBeGreaterThan(1500); // ~1690 MWth
    expect(o.PLANT_BOILER_LOSS_01).toBeGreaterThan(100);
    expect(o.PLANT_NET_EFF_01).toBeGreaterThan(28); // ~33 % (thấp hơn 39 % DB — GĐ-73)
    expect(o.PLANT_NET_EFF_01).toBeLessThan(42);
    expect(o.PLANT_UNIT_HR_NET_01).toBeGreaterThan(9000);
    expect(o.PLANT_CO2_INTENSITY_01).toBeGreaterThan(900); // g/kWh
    expect(o.PLANT_CO2_INTENSITY_01).toBeLessThan(1400);
    expect(o.PLANT_AIR_FLOW_01).toBeGreaterThan(2000); // gió cháy (khói − than)
  });

  it('KIỂM CHỨNG thật: đầu vào KHÔNG nhất quán (nhiệt thải sai) → khép LỆCH khỏi 100 %', () => {
    const m = new PlantBalanceModel();
    m.init();
    const bad = one(m, { ...CONSISTENT, COND_DUTY_01: 500 }); // cố ý sai
    expect(bad.PLANT_ENERGY_CLOSURE_01).toBeLessThan(90); // phát hiện bất nhất (không phải tautology)
  });

  it('MFT / dừng máy (mọi đầu vào 0): không lỗi chia, khép & KPI = 0', () => {
    const m = new PlantBalanceModel();
    m.init();
    const o = one(m, {});
    expect(o.PLANT_ENERGY_CLOSURE_01).toBe(0);
    expect(o.PLANT_NET_EFF_01).toBe(0);
    expect(o.PLANT_UNIT_HR_NET_01).toBe(0);
    expect(o.PLANT_CO2_INTENSITY_01).toBe(0);
  });
});
