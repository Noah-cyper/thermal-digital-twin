import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { EmissionsControlModel } from '../src/sim/emissions-control';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: EmissionsControlModel, tags: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  return o;
}
const OP = { EMI_NH3_INJ_01: 62, EMI_FGD_SLURRY_01: 56 };

describe('EmissionsControlModel (doc 10 §6) — chất lượng điều khiển SCR & FGD', () => {
  it('điểm vận hành: SCR khử ~56% + slip <3 ppm lành mạnh; FGD pH ~5,6 + khử >90% lành mạnh', () => {
    const m = new EmissionsControlModel();
    m.init();
    const o = one(m, OP);
    expect(o.ECTL_SCR_ACTIVITY_01).toBe(100);
    expect(o.ECTL_SCR_REMOVAL_01).toBeGreaterThan(45);
    expect(o.ECTL_NH3_SLIP_01).toBeLessThan(3);
    expect(o.ECTL_SCR_HEALTHY_01).toBe(1);
    expect(o.ECTL_FGD_PH_01).toBeCloseTo(5.6, 1);
    expect(o.ECTL_FGD_REMOVAL_01).toBeGreaterThan(90);
    expect(o.ECTL_FGD_HEALTHY_01).toBe(1);
  });

  it('scr-catalyst-deactivation: hoạt tính tụt → khử NOₓ giảm + rò NH₃ VỌT, không lành mạnh', () => {
    const m = new EmissionsControlModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'scr-catalyst-deactivation' });
    const o = one(m, OP);
    expect(o.ECTL_SCR_ACTIVITY_01).toBeLessThan(60);
    expect(o.ECTL_SCR_REMOVAL_01).toBeLessThan(base.ECTL_SCR_REMOVAL_01);
    expect(o.ECTL_NH3_SLIP_01).toBeGreaterThan(10);
    expect(o.ECTL_SCR_HEALTHY_01).toBe(0);
  });

  it('scr-ammonia-overdose: dư NH₃ → rò NH₃ vượt ngưỡng, không lành mạnh', () => {
    const m = new EmissionsControlModel();
    m.init();
    m.injectMalfunction({ id: 'scr-ammonia-overdose' });
    const o = one(m, OP);
    expect(o.ECTL_NH3_SLIP_01).toBeGreaterThan(3);
    expect(o.ECTL_SCR_HEALTHY_01).toBe(0);
  });

  it('fgd-ph-low: pH tụt → độ khử SO₂ giảm, không lành mạnh', () => {
    const m = new EmissionsControlModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'fgd-ph-low' });
    const o = one(m, OP);
    expect(o.ECTL_FGD_PH_01).toBeLessThan(base.ECTL_FGD_PH_01);
    expect(o.ECTL_FGD_REMOVAL_01).toBeLessThan(base.ECTL_FGD_REMOVAL_01);
    expect(o.ECTL_FGD_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ cờ sự cố (OTS)', () => {
    const m = new EmissionsControlModel();
    m.init();
    m.injectMalfunction({ id: 'scr-catalyst-deactivation' });
    one(m, OP);
    const snap = m.snapshot();
    const m2 = new EmissionsControlModel();
    m2.init();
    m2.restore(snap);
    const o = one(m2, OP);
    expect(o.ECTL_SCR_ACTIVITY_01).toBeLessThan(60);
    expect(m2.snapshot().state.catalystDeact).toBe(1);
  });
});
