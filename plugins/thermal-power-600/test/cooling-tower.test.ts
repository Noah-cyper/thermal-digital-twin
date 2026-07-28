import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CoolingTowerModel } from '../src/sim/cooling-tower';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: CoolingTowerModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('CoolingTowerModel (doc 10 §6) — tháp làm mát khép vòng CW', () => {
  it('đầy tải: CW cấp = bầu ướt + approach; range từ bình ngưng; bốc hơi & nước bổ sung hợp lý', () => {
    const m = new CoolingTowerModel();
    m.init();
    const o = one(m, { COND_DUTY_01: 890, COND_CW_RISE_01: 12 });

    expect(o.CT_WETBULB_01).toBe(27); // bầu ướt nhiệt đới
    expect(o.CT_APPROACH_01).toBe(4);
    expect(o.CT_CW_SUPPLY_01).toBe(31); // = bầu ướt + approach
    expect(o.CT_RANGE_01).toBe(12); // = độ tăng nhiệt bình ngưng
    expect(o.CT_HEAT_REJECT_01).toBe(890); // = nhiệt thải bình ngưng
    expect(o.CT_EVAP_LOSS_01).toBeGreaterThan(1000); // ~1335 t/h bốc hơi
    expect(o.CT_EVAP_LOSS_01).toBeLessThan(1700);
    expect(o.CT_MAKEUP_01 ?? 0).toBeGreaterThan(o.CT_EVAP_LOSS_01 ?? 0); // bổ sung > bốc hơi (blowdown+drift)
  });

  it('bốc hơi tỷ lệ với nhiệt thải', () => {
    const m = new CoolingTowerModel();
    m.init();
    const lo = one(m, { COND_DUTY_01: 400, COND_CW_RISE_01: 8 });
    const hi = one(m, { COND_DUTY_01: 800, COND_CW_RISE_01: 12 });
    expect((hi.CT_EVAP_LOSS_01 ?? 0) / (lo.CT_EVAP_LOSS_01 ?? 1)).toBeCloseTo(2, 1);
  });

  it('không tải nhiệt (MFT): bốc hơi = 0, nước bổ sung = 0', () => {
    const m = new CoolingTowerModel();
    m.init();
    const o = one(m, { COND_DUTY_01: 0, COND_CW_RISE_01: 0 });
    expect(o.CT_EVAP_LOSS_01).toBe(0);
    expect(o.CT_MAKEUP_01).toBe(0);
  });
});
