import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CemsHgCoModel } from '../src/sim/cems-hg-co';

const OP = { BLR_COAL_FLOW_01: 211, EMI_FG_VOLUME_01: 2_500_000, BLR_FLUE_O2_01: 3.2 };
function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: CemsHgCoModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('CemsHgCoModel (doc 10 §6) — CEMS mở rộng thuỷ ngân & CO', () => {
  it('điểm vận hành: Hg thu ~90% (ACI bật), CO thấp ở O₂ danh định, hiệu suất cháy cao', () => {
    const m = new CemsHgCoModel();
    m.init();
    const o = one(m, OP);
    expect(o.CEMS_HG_CAPTURE_01).toBeCloseTo(90, 0);
    expect(o.CEMS_HG_ACI_01).toBeGreaterThan(0);
    expect(o.CEMS_HG_STACK_01).toBeGreaterThan(0);
    expect(o.CEMS_HG_RATE_01).toBeCloseTo(2.11, 1); // 21,1 g/h × (1−0,90)
    expect(o.CEMS_CO_STACK_01).toBeCloseTo(30, 0);
    expect(o.CEMS_COMBUSTION_EFF_01).toBeGreaterThan(99);
  });

  it('mất than hoạt tính (hg-sorbent-loss): thu hồi Hg giảm → Hg thoát tăng, ACI = 0', () => {
    const m = new CemsHgCoModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'hg-sorbent-loss' });
    const o = one(m, OP);
    expect(o.CEMS_HG_CAPTURE_01).toBeLessThan(base.CEMS_HG_CAPTURE_01);
    expect(o.CEMS_HG_STACK_01).toBeGreaterThan(base.CEMS_HG_STACK_01);
    expect(o.CEMS_HG_ACI_01).toBe(0);
  });

  it('CO tăng khi O₂ khói thấp (thiếu gió → cháy không hết)', () => {
    const m = new CemsHgCoModel();
    m.init();
    const nom = one(m, OP);
    const low = one(m, { ...OP, BLR_FLUE_O2_01: 1.5 });
    expect(low.CEMS_CO_STACK_01).toBeGreaterThan(nom.CEMS_CO_STACK_01);
    expect(low.CEMS_CO_STACK_01).toBeGreaterThan(100);
    expect(low.CEMS_COMBUSTION_EFF_01).toBeLessThan(nom.CEMS_COMBUSTION_EFF_01);
  });

  it('malfunction co-excursion: CO cao cố định (cháy không hết), hiệu suất cháy giảm', () => {
    const m = new CemsHgCoModel();
    m.init();
    m.injectMalfunction({ id: 'co-excursion' });
    const o = one(m, OP);
    expect(o.CEMS_CO_STACK_01).toBeGreaterThanOrEqual(900);
    expect(o.CEMS_COMBUSTION_EFF_01).toBeLessThan(98);
  });

  it('dừng lò (than = 0): không phát thải, ACI tắt', () => {
    const m = new CemsHgCoModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 0, EMI_FG_VOLUME_01: 0, BLR_FLUE_O2_01: 0 });
    expect(o.CEMS_HG_STACK_01).toBe(0);
    expect(o.CEMS_CO_STACK_01).toBe(0);
    expect(o.CEMS_HG_ACI_01).toBe(0);
  });

  it('snapshot/restore giữ trạng thái malfunction (OTS)', () => {
    const m = new CemsHgCoModel();
    m.init();
    m.injectMalfunction({ id: 'hg-sorbent-loss' });
    const snap = m.snapshot();
    const m2 = new CemsHgCoModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, OP).CEMS_HG_ACI_01).toBe(0); // vẫn mất ACI sau restore
  });
});
