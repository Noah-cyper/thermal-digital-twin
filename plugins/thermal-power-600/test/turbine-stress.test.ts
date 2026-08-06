import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { TurbineStressModel } from '../src/sim/turbine-stress';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: TurbineStressModel, tags: Record<string, number>, n: number): { last: Record<string, number>; peakStress: number; minHealthy: number } {
  let last: Record<string, number> = {};
  let peakStress = 0;
  let minHealthy = 1;
  for (let i = 0; i < n; i++) {
    last = {};
    for (const o of m.step(ctxOf(tags)).outputs) last[o.tagId] = o.value;
    peakStress = Math.max(peakStress, last.TSE_STRESS_PCT_01);
    minHealthy = Math.min(minHealthy, last.TSE_HEALTHY_01);
  }
  return { last, peakStress, minHealthy };
}
const OP = { GEN_MW_01: 448, BLR_MSTM_SH_TEMP_01: 541 };

describe('TurbineStressModel (doc 10 §7) — TSE ứng suất nhiệt rotor', () => {
  it('điểm vận hành thấm nhiệt: ΔT ~0, ứng suất thấp, ramp limit đầy, lành mạnh', () => {
    const m = new TurbineStressModel();
    m.init();
    const { last } = run(m, OP, 200);
    expect(Math.abs(last.TSE_ROTOR_DT_01)).toBeLessThan(2);
    expect(last.TSE_STRESS_PCT_01).toBeLessThan(5);
    expect(last.TSE_RAMP_LIMIT_01).toBeGreaterThan(28); // gần 30 MW/phút
    expect(last.TSE_MARGIN_01).toBeGreaterThan(95);
    expect(last.TSE_HEALTHY_01).toBe(1);
  });

  it('ĐỔI TẢI nhanh: metalTarget tăng → ΔT bề mặt–tâm dâng → ứng suất tăng, ramp limit GIẢM', () => {
    const m = new TurbineStressModel();
    m.init();
    run(m, OP, 100); // thấm nhiệt ở 448 MW
    // nhảy tải lên 560 MW (steamT giữ) → bề mặt bám nhanh, tâm trễ → ΔT.
    const hot = { GEN_MW_01: 560, BLR_MSTM_SH_TEMP_01: 541 };
    const r = run(m, hot, 400);
    expect(r.peakStress).toBeGreaterThan(20); // ứng suất do ramp
    expect(r.last.TSE_RAMP_LIMIT_01).toBeLessThan(28); // TSE thắt ramp lại
  });

  it('fast-startup: xung gia nhiệt bề mặt → ứng suất VƯỢT ngưỡng (>90%), không lành mạnh, tiêu hao tuổi thọ', () => {
    const m = new TurbineStressModel();
    m.init();
    run(m, OP, 100);
    m.injectMalfunction({ id: 'fast-startup' });
    const r = run(m, OP, 300);
    expect(r.peakStress).toBeGreaterThan(90);
    expect(r.minHealthy).toBe(0);
    expect(r.last.TSE_LIFE_USED_01).toBeGreaterThan(0); // đã tiêu hao tuổi thọ mỏi
  });

  it('thermal-shock: lệch nhiệt hơi đột ngột → ΔT offset → ứng suất vượt ngưỡng', () => {
    const m = new TurbineStressModel();
    m.init();
    run(m, OP, 100);
    m.injectMalfunction({ id: 'thermal-shock' });
    const r = run(m, OP, 120);
    expect(r.peakStress).toBeGreaterThan(90);
    expect(r.minHealthy).toBe(0);
  });

  it('clear fast-startup: xung tắt → ứng suất về thấp, lành mạnh lại', () => {
    const m = new TurbineStressModel();
    m.init();
    run(m, OP, 100);
    m.injectMalfunction({ id: 'fast-startup' });
    run(m, OP, 100);
    m.clearMalfunction('fast-startup');
    const r = run(m, OP, 400);
    expect(r.last.TSE_STRESS_PCT_01).toBeLessThan(20);
    expect(r.last.TSE_HEALTHY_01).toBe(1);
  });

  it('snapshot/restore giữ nhiệt bề mặt/tâm + tuổi thọ tích luỹ (OTS)', () => {
    const m = new TurbineStressModel();
    m.init();
    m.injectMalfunction({ id: 'fast-startup' });
    run(m, OP, 60);
    const snap = m.snapshot();
    const m2 = new TurbineStressModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.bore).toBeCloseTo(snap.state.bore as number, 6);
    expect(m2.snapshot().state.lifeUsed).toBeCloseTo(snap.state.lifeUsed as number, 9);
  });
});
