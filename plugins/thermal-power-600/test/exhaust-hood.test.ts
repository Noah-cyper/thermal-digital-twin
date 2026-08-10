import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { ExhaustHoodModel } from '../src/sim/exhaust-hood';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: ExhaustHoodModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('ExhaustHoodModel (doc 10 §6/§7) — hood xả LP & phun làm mát', () => {
  it('tải thường (~448 MW): hood mát (~nền), không phun → 0 hồi quy', () => {
    const m = new ExhaustHoodModel();
    m.init();
    const o = one(m, { GEN_MW_01: 448 });
    expect(o.TRB_EXH_HOOD_TEMP_01).toBeCloseTo(40, 0); // = nền, không windage
    expect(o.TRB_HOOD_SPRAY_FLOW_01).toBe(0);
  });

  it('tải rất thấp (~30 MW), chưa phun: windage → hood quá nhiệt (> ngưỡng 80 °C)', () => {
    const m = new ExhaustHoodModel();
    m.init();
    const o = one(m, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 0 });
    expect(o.TRB_EXH_HOOD_TEMP_01).toBeGreaterThan(80);
  });

  it('tải thấp + van phun mở: hood được làm mát + có lưu lượng phun', () => {
    const m = new ExhaustHoodModel();
    m.init();
    const hot = one(m, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 0 }).TRB_EXH_HOOD_TEMP_01;
    const o = one(m, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 100 });
    expect(o.TRB_EXH_HOOD_TEMP_01).toBeLessThan(hot);
    expect(o.TRB_HOOD_SPRAY_FLOW_01).toBeGreaterThan(0);
  });

  it('malfunction hood-spray-fail: van bị bỏ qua → hood vẫn nóng dù lệnh mở van', () => {
    const m = new ExhaustHoodModel();
    m.init();
    m.injectMalfunction({ id: 'hood-spray-fail' });
    const o = one(m, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 100 });
    expect(o.TRB_EXH_HOOD_TEMP_01).toBeGreaterThan(80); // phun vô hiệu
    expect(o.TRB_HOOD_SPRAY_FLOW_01).toBe(0);
    m.clearMalfunction('hood-spray-fail');
    expect(one(m, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 100 }).TRB_HOOD_SPRAY_FLOW_01).toBeGreaterThan(0);
  });

  it('snapshot/restore giữ trạng thái sự cố (OTS)', () => {
    const m = new ExhaustHoodModel();
    m.init();
    m.injectMalfunction({ id: 'hood-spray-fail' });
    const snap = m.snapshot();
    const m2 = new ExhaustHoodModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, { GEN_MW_01: 30, TRB_HOOD_SPRAY_VALVE_01: 100 }).TRB_HOOD_SPRAY_FLOW_01).toBe(0);
  });
});
