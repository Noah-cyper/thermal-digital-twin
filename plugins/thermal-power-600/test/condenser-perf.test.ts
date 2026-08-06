import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CondenserPerfModel } from '../src/sim/condenser-perf';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: CondenserPerfModel, tags: Record<string, number>, n: number): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) { o = {}; for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value; }
  return o;
}
const OP = { GEN_MW_01: 448, CT_CW_SUPPLY_01: 31 };

describe('CondenserPerfModel (doc 10 §6) — hiệu năng bình ngưng & back-pressure', () => {
  it('điểm vận hành sạch: TTD ~3°C, lệch back-pressure 0, phạt 0, lành mạnh', () => {
    const m = new CondenserPerfModel();
    m.init();
    const o = run(m, OP, 5);
    expect(o.CNDP_CW_INLET_01).toBeCloseTo(31, 0);
    expect(o.CNDP_TTD_01).toBeCloseTo(3, 1);
    expect(o.CNDP_BP_DEVIATION_01).toBeCloseTo(0, 3);
    expect(o.CNDP_HR_PENALTY_01).toBeCloseTo(0, 3);
    expect(o.CNDP_CLEANLINESS_01).toBe(100);
    expect(o.CNDP_HEALTHY_01).toBe(1);
  });

  it('condenser-tube-fouling ĐỘNG: độ sạch giảm → TTD tăng → back-pressure lệch + phạt heat rate, không lành mạnh', () => {
    const m = new CondenserPerfModel();
    m.init();
    const base = run(m, OP, 5);
    m.injectMalfunction({ id: 'condenser-tube-fouling' });
    const o = run(m, OP, 3000);
    expect(o.CNDP_CLEANLINESS_01).toBeLessThan(80);
    expect(o.CNDP_TTD_01).toBeGreaterThan(base.CNDP_TTD_01 + 1);
    expect(o.CNDP_BP_DEVIATION_01).toBeGreaterThan(0);
    expect(o.CNDP_HR_PENALTY_01).toBeGreaterThan(0);
    expect(o.CNDP_HEALTHY_01).toBe(0);
  });

  it('cw-temp-high: CW vào tăng 6°C → back-pressure lệch ~1,8 kPa → phạt heat rate rõ, không lành mạnh', () => {
    const m = new CondenserPerfModel();
    m.init();
    m.injectMalfunction({ id: 'cw-temp-high' });
    const o = run(m, OP, 5);
    expect(o.CNDP_CW_INLET_01).toBeCloseTo(37, 0);
    expect(o.CNDP_BP_DEVIATION_01).toBeGreaterThan(1.5);
    expect(o.CNDP_HR_PENALTY_01).toBeGreaterThan(2);
    expect(o.CNDP_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ độ sạch + cờ sự cố (OTS)', () => {
    const m = new CondenserPerfModel();
    m.init();
    m.injectMalfunction({ id: 'condenser-tube-fouling' });
    run(m, OP, 500);
    const snap = m.snapshot();
    const m2 = new CondenserPerfModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.cleanliness).toBeCloseTo(snap.state.cleanliness as number, 6);
    expect(m2.snapshot().state.fouling).toBe(1);
  });
});
