import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { PulverizerMillsModel } from '../src/sim/pulverizer-mills';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: PulverizerMillsModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}
const COAL = { BLR_COAL_FLOW_01: 211 }; // t/h điểm vận hành → 4 máy chạy (A–D), F dự phòng

describe('PulverizerMillsModel (doc 10 §6) — máy nghiền than PER-MILL', () => {
  it('điểm vận hành: 4 máy chạy ~88% tải, độ mịn ~75%, F dự phòng, lành mạnh', () => {
    const m = new PulverizerMillsModel();
    m.init();
    const o = one(m, COAL);
    expect(o.PVM_RUNNING_01).toBe(4);
    expect(o.PVM_A_STATUS_01).toBe(1); // A chạy
    expect(o.PVM_F_STATUS_01).toBe(0); // F dự phòng
    expect(o.PVM_A_LOAD_01).toBeCloseTo(88, 0);
    expect(o.PVM_MIN_FINENESS_01).toBeGreaterThan(72);
    expect(o.PVM_MIN_FINENESS_01).toBeLessThan(78);
    expect(o.PVM_MAX_LOAD_01).toBeLessThan(100);
    expect(o.PVM_HEALTHY_01).toBe(1);
    expect(o.PVM_PA_TOTAL_01).toBeCloseTo(211 * 1.8, 0);
  });

  it('mill-a-trip: máy A trip → 3 máy còn lại GÁNH → quá tải >100%, độ mịn TỤT <70, không lành mạnh', () => {
    const m = new PulverizerMillsModel();
    m.init();
    const base = one(m, COAL);
    m.injectMalfunction({ id: 'mill-a-trip' });
    const o = one(m, COAL);
    expect(o.PVM_A_STATUS_01).toBe(2); // A trip
    expect(o.PVM_RUNNING_01).toBe(3);
    expect(o.PVM_TRIPPED_01).toBe(1);
    expect(o.PVM_MAX_LOAD_01).toBeGreaterThan(100); // quá tải
    expect(o.PVM_MIN_FINENESS_01).toBeLessThan(70); // grind thô
    expect(o.PVM_MIN_FINENESS_01).toBeLessThan(base.PVM_MIN_FINENESS_01);
    expect(o.PVM_HEALTHY_01).toBe(0);
  });

  it('mill-classifier-wear: mòn phân ly → độ mịn TỤT toàn dàn (không quá tải)', () => {
    const m = new PulverizerMillsModel();
    m.init();
    const base = one(m, COAL);
    m.injectMalfunction({ id: 'mill-classifier-wear' });
    const o = one(m, COAL);
    expect(o.PVM_MIN_FINENESS_01).toBeLessThan(base.PVM_MIN_FINENESS_01 - 5); // tụt rõ
    expect(o.PVM_MAX_LOAD_01).toBeCloseTo(base.PVM_MAX_LOAD_01, 0); // tải không đổi
  });

  it('clear mill-a-trip: khôi phục → 4 máy chạy lại, lành mạnh', () => {
    const m = new PulverizerMillsModel();
    m.init();
    m.injectMalfunction({ id: 'mill-a-trip' });
    one(m, COAL);
    m.clearMalfunction('mill-a-trip');
    const o = one(m, COAL);
    expect(o.PVM_RUNNING_01).toBe(4);
    expect(o.PVM_TRIPPED_01).toBe(0);
    expect(o.PVM_HEALTHY_01).toBe(1);
  });

  it('snapshot/restore giữ tập máy trip + mòn phân ly (OTS)', () => {
    const m = new PulverizerMillsModel();
    m.init();
    m.injectMalfunction({ id: 'mill-b-trip' });
    m.injectMalfunction({ id: 'mill-classifier-wear' });
    one(m, COAL);
    const snap = m.snapshot();
    const m2 = new PulverizerMillsModel();
    m2.init();
    m2.restore(snap);
    const o = one(m2, COAL);
    expect(o.PVM_B_STATUS_01).toBe(2); // B vẫn trip sau restore
    expect(m2.snapshot().state.classifierWear).toBe(1);
  });
});
