import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { EmissionsModel } from '../src/sim/emissions';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: EmissionsModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

const FULL = { BLR_COAL_FLOW_01: 283, FG_FLOW_01: 3622, FG_EXCESS_AIR_01: 18 };

describe('EmissionsModel (doc 10 §6) — phát thải CEMS sau ESP + FGD', () => {
  it('đầy tải: bụi ra < 30 mg/Nm³ (mốc thiết kế); SO₂ sau FGD; CO₂ hợp lý; ESP/FGD hiệu quả', () => {
    const m = new EmissionsModel();
    m.init();
    const o = one(m, FULL);

    expect(o.EMI_DUST_STACK_01).toBeLessThan(30); // mốc Design Basis ESP
    expect(o.EMI_DUST_STACK_01).toBeGreaterThan(10); // gần mốc (thực tế)
    expect(o.EMI_SO2_STACK_01).toBeGreaterThan(20);
    expect(o.EMI_SO2_STACK_01).toBeLessThan(150); // sau FGD 95 %
    expect(o.EMI_NOX_STACK_01).toBeGreaterThan(200);
    expect(o.EMI_NOX_STACK_01).toBeLessThan(450);
    expect(o.EMI_CO2_RATE_01).toBeGreaterThan(400); // ~640 t/h CO₂ (600 MW than)
    expect(o.EMI_ESP_EFF_01).toBeGreaterThan(99);
    expect(o.EMI_FGD_EFF_01).toBeCloseTo(95, 0);
    expect(o.EMI_FG_VOLUME_01).toBeGreaterThan(1_000_000); // Nm³/h
  });

  it('CO₂ tỷ lệ với lưu lượng than (bảo toàn carbon)', () => {
    const m = new EmissionsModel();
    m.init();
    const lo = one(m, { ...FULL, BLR_COAL_FLOW_01: 150, FG_FLOW_01: 1920 });
    const hi = one(m, { ...FULL, BLR_COAL_FLOW_01: 300, FG_FLOW_01: 3840 });
    expect((hi.EMI_CO2_RATE_01 ?? 0) / (lo.EMI_CO2_RATE_01 ?? 1)).toBeCloseTo(2, 1); // gấp đôi than → gấp đôi CO₂
  });

  it('gió thừa cao → NOₓ tăng (NOₓ nhiệt)', () => {
    const m = new EmissionsModel();
    m.init();
    const nom = one(m, FULL);
    const hi = one(m, { ...FULL, FG_EXCESS_AIR_01: 40 });
    expect(hi.EMI_NOX_STACK_01 ?? 0).toBeGreaterThan(nom.EMI_NOX_STACK_01 ?? 0);
  });

  it('MFT / tắt lửa: mọi phát thải = 0', () => {
    const m = new EmissionsModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 0, FG_FLOW_01: 0, FG_EXCESS_AIR_01: 18 });
    expect(o.EMI_CO2_RATE_01).toBe(0);
    expect(o.EMI_DUST_STACK_01).toBe(0);
    expect(o.EMI_SO2_STACK_01).toBe(0);
    expect(o.EMI_NOX_STACK_01).toBe(0);
  });
});
