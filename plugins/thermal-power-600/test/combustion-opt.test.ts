import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CombustionOptModel } from '../src/sim/combustion-opt';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: CombustionOptModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}
const OP = { BLR_FLUE_O2_01: 3.2, FG_STACK_TEMP_01: 120, PVM_MIN_FINENESS_01: 75 };

describe('CombustionOptModel (doc 10 §6) — tối ưu cháy & bản đồ hiệu suất lò', () => {
  it('điểm vận hành: O₂ ~3,2%, hiệu suất lò ~90%, hụt tối ưu nhỏ, lành mạnh', () => {
    const m = new CombustionOptModel();
    m.init();
    const o = one(m, OP);
    expect(o.CMB_O2_MEAS_01).toBeCloseTo(3.2, 1);
    expect(o.CMB_EXCESS_AIR_01).toBeGreaterThan(15);
    expect(o.CMB_BOILER_EFF_EST_01).toBeGreaterThan(88);
    expect(o.CMB_BOILER_EFF_EST_01).toBeLessThan(92);
    expect(o.CMB_EFF_GAP_01).toBeLessThan(0.5);
    expect(o.CMB_HEALTHY_01).toBe(1);
  });

  it('o2-trim-low: thiếu gió → LOI/unburned TĂNG, hiệu suất TỤT, hụt tối ưu > 1%, không lành mạnh', () => {
    const m = new CombustionOptModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'o2-trim-low' });
    const o = one(m, OP);
    expect(o.CMB_O2_MEAS_01).toBeLessThan(2);
    expect(o.CMB_LOI_01).toBeGreaterThan(base.CMB_LOI_01);
    expect(o.CMB_UNBURNED_LOSS_01).toBeGreaterThan(base.CMB_UNBURNED_LOSS_01);
    expect(o.CMB_BOILER_EFF_EST_01).toBeLessThan(base.CMB_BOILER_EFF_EST_01);
    expect(o.CMB_EFF_GAP_01).toBeGreaterThan(1);
    expect(o.CMB_HEALTHY_01).toBe(0);
  });

  it('o2-trim-high: gió thừa cao → dry gas loss TĂNG, hiệu suất TỤT', () => {
    const m = new CombustionOptModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'o2-trim-high' });
    const o = one(m, OP);
    expect(o.CMB_O2_MEAS_01).toBeGreaterThan(5);
    expect(o.CMB_DRY_GAS_LOSS_01).toBeGreaterThan(base.CMB_DRY_GAS_LOSS_01);
    expect(o.CMB_BOILER_EFF_EST_01).toBeLessThan(base.CMB_BOILER_EFF_EST_01);
  });

  it('độ mịn nghiền kém → LOI tăng (liên kết per-mill)', () => {
    const m = new CombustionOptModel();
    m.init();
    const good = one(m, OP);
    const poor = one(m, { ...OP, PVM_MIN_FINENESS_01: 60 });
    expect(poor.CMB_LOI_01).toBeGreaterThan(good.CMB_LOI_01);
  });

  it('clear o2-trim: về lại điểm tối ưu, lành mạnh', () => {
    const m = new CombustionOptModel();
    m.init();
    m.injectMalfunction({ id: 'o2-trim-low' });
    one(m, OP);
    m.clearMalfunction('o2-trim-low');
    const o = one(m, OP);
    expect(o.CMB_O2_MEAS_01).toBeCloseTo(3.2, 1);
    expect(o.CMB_HEALTHY_01).toBe(1);
  });
});
