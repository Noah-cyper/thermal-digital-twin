import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { ElectricalModel } from '../src/sim/electrical';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: ElectricalModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('ElectricalModel (doc 10 §7) — máy phát → GSU → lưới + tự dùng', () => {
  it('đầy tải điểm thiết kế (600 MW, cosφ 0,9): net ~558 (tự dùng ~7 %); MVA ~667; pf ~0,9', () => {
    const m = new ElectricalModel();
    m.init();
    // MVAr ứng cosφ 0,9: Q = 600·tan(acos 0,9) ≈ 290,6.
    const o = one(m, { GEN_MW_01: 600, GEN_MVAR_01: 290.6 });

    expect(o.ELEC_AUX_POWER_01).toBeCloseTo(42, 0); // ~7 % → net 558
    expect(o.ELEC_NET_MW_01).toBeCloseTo(558, 0); // Design Basis công suất tinh
    expect(o.ELEC_GEN_MVA_01).toBeCloseTo(667, -1); // ~667 MVA (rated)
    expect(o.ELEC_PF_01).toBeCloseTo(0.9, 1); // cosφ 0,9
    expect(o.ELEC_GEN_CURRENT_01).toBeGreaterThan(15); // kA ở 20 kV
    expect(o.ELEC_GSU_LOADING_01).toBeGreaterThan(80); // % của 720 MVA
    expect(o.ELEC_GSU_LOADING_01).toBeLessThan(100);
    expect(o.ELEC_GRID_MW_01).toBeLessThan(o.ELEC_NET_MW_01 ?? 0); // tổn thất GSU
    expect(o.ELEC_GRID_MW_01).toBeGreaterThan(550);
  });

  it('công suất tinh = gộp − tự dùng ở mọi tải; tự dùng % tăng khi non tải', () => {
    const m = new ElectricalModel();
    m.init();
    const full = one(m, { GEN_MW_01: 600, GEN_MVAR_01: 290 });
    const part = one(m, { GEN_MW_01: 300, GEN_MVAR_01: 145 });
    expect((full.ELEC_NET_MW_01 ?? 0)).toBeCloseTo(600 - (full.ELEC_AUX_POWER_01 ?? 0), 3);
    expect((part.ELEC_NET_MW_01 ?? 0)).toBeCloseTo(300 - (part.ELEC_AUX_POWER_01 ?? 0), 3);
    const fullAuxPct = (full.ELEC_AUX_POWER_01 ?? 0) / 600;
    const partAuxPct = (part.ELEC_AUX_POWER_01 ?? 0) / 300;
    expect(partAuxPct).toBeGreaterThan(fullAuxPct); // tự dùng % cao hơn khi non tải
  });

  it('ngừng máy (0 MW): tự dùng qua UAT tổ máy = 0, net = 0, không dòng stator', () => {
    const m = new ElectricalModel();
    m.init();
    const o = one(m, { GEN_MW_01: 0, GEN_MVAR_01: 0 });
    expect(o.ELEC_AUX_POWER_01).toBe(0);
    expect(o.ELEC_NET_MW_01).toBe(0);
    expect(o.ELEC_GEN_CURRENT_01).toBe(0);
  });
});
