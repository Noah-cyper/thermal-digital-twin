import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CondenserCWModel } from '../src/sim/condenser-cw';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: CondenserCWModel, tags: Record<string, number>, steps: number): Record<string, number> {
  const out: Record<string, number> = {};
  const ctx = ctxOf(tags);
  for (let i = 0; i < steps; i++) for (const o of m.step(ctx).outputs) out[o.tagId] = o.value;
  return out;
}

describe('CondenserCWModel (doc 10 §6) — bình ngưng + nước tuần hoàn (cân bằng năng lượng)', () => {
  it('đầy tải: nhiệt thải = nhiệt cấp − công suất (> gross), ΔT_cw hợp lý, CW 64.000, sat ~34 °C', () => {
    const m = new CondenserCWModel();
    m.init();
    const o = run(m, { GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940, TRB_COND_VACUUM_01: 5.4 }, 600);

    // Nhiệt thải bình ngưng LỚN HƠN công suất phát (chu trình η<50% → phần lớn nhiệt bị thải).
    expect(o.COND_DUTY_01).toBeGreaterThan(600);
    expect(o.COND_DUTY_01).toBeLessThan(1050); // ~890 MWth
    expect(o.COND_CW_FLOW_01).toBe(64000); // Design Basis
    expect(o.COND_CW_RISE_01).toBeGreaterThan(8); // ΔT_cw ~12 °C
    expect(o.COND_CW_RISE_01).toBeLessThan(16);
    expect(o.COND_SAT_TEMP_01).toBeCloseTo(34, 0); // ứng chân không 5,4 kPa
    expect(o.COND_CW_OUT_TEMP_01).toBeGreaterThan(o.COND_CW_IN_TEMP_01 ?? 0); // CW ra nóng hơn vào
    expect(o.COND_TTD_01).toBeCloseTo(2.8, 5);
  });

  it('mất chân không (20 kPa): nhiệt bão hoà tăng mạnh → CW ra nóng lên (hiệu năng bình ngưng xấu)', () => {
    const m1 = new CondenserCWModel();
    m1.init();
    const nom = run(m1, { GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940, TRB_COND_VACUUM_01: 5.4 }, 400);
    const m2 = new CondenserCWModel();
    m2.init();
    const lov = run(m2, { GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940, TRB_COND_VACUUM_01: 20 }, 400);
    expect(lov.COND_SAT_TEMP_01 ?? 0).toBeGreaterThan((nom.COND_SAT_TEMP_01 ?? 0) + 10);
    expect(lov.COND_CW_OUT_TEMP_01 ?? 0).toBeGreaterThan(nom.COND_CW_OUT_TEMP_01 ?? 0);
  });

  it('MFT / mất tải: nhiệt thải = 0, ΔT_cw = 0', () => {
    const m = new CondenserCWModel();
    m.init();
    const o = run(m, { GEN_MW_01: 0, PLANT_CYCLE_HR_01: 0, TRB_COND_VACUUM_01: 5.4 }, 400);
    expect(o.COND_DUTY_01).toBe(0);
    expect(o.COND_CW_RISE_01).toBe(0);
  });

  it('snapshot/restore giữ nhiệt CW (OTS)', () => {
    const m = new CondenserCWModel();
    m.init();
    run(m, { GEN_MW_01: 600, PLANT_CYCLE_HR_01: 8940, TRB_COND_VACUUM_01: 5.4 }, 300);
    const snap = m.snapshot();
    const m2 = new CondenserCWModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tCwOut).toBeCloseTo(snap.state.tCwOut as number, 6);
  });
});
