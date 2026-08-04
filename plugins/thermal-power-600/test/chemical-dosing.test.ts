import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { ChemicalDosingModel } from '../src/sim/chemical-dosing';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: ChemicalDosingModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('ChemicalDosingModel (doc 10 §10 BOP) — hoá chất điều hoà chu trình', () => {
  it('điểm vận hành: pH nước cấp ~9,3 & bao hơi ~9,6, phosphate ~5 ppm, độ dẫn cation thấp, bơm định lượng chạy', () => {
    const m = new ChemicalDosingModel();
    m.init();
    const o = one(m, { BLR_STEAM_FLOW_01: 1500 });
    expect(o.CHEM_FW_PH_01).toBeCloseTo(9.3, 1);
    expect(o.CHEM_DRUM_PH_01).toBeCloseTo(9.6, 1);
    expect(o.CHEM_DRUM_PHOSPHATE_01).toBeCloseTo(5, 0);
    expect(o.CHEM_CATION_COND_01).toBeLessThan(0.3);
    expect(o.CHEM_AMMONIA_DOSE_01).toBeGreaterThan(0);
    expect(o.CHEM_PHOSPHATE_DOSE_01).toBeGreaterThan(0);
  });

  it('liều bơm tỉ lệ lưu lượng hơi (hạ tải → liều giảm)', () => {
    const m = new ChemicalDosingModel();
    m.init();
    const full = one(m, { BLR_STEAM_FLOW_01: 1500 });
    const half = one(m, { BLR_STEAM_FLOW_01: 750 });
    expect(half.CHEM_AMMONIA_DOSE_01).toBeLessThan(full.CHEM_AMMONIA_DOSE_01);
    expect(half.CHEM_AMMONIA_DOSE_01).toBeCloseTo(full.CHEM_AMMONIA_DOSE_01 / 2, 1);
  });

  it('malfunction chem-dosing-fail: mất điều hoá → pH tụt vùng ăn mòn, độ dẫn cation tăng', () => {
    const m = new ChemicalDosingModel();
    m.init();
    m.injectMalfunction({ id: 'chem-dosing-fail' });
    const o = one(m, { BLR_STEAM_FLOW_01: 1500 });
    expect(o.CHEM_FW_PH_01).toBeLessThan(8.8);
    expect(o.CHEM_CATION_COND_01).toBeGreaterThan(0.5);
    expect(o.CHEM_AMMONIA_DOSE_01).toBe(0);
    m.clearMalfunction('chem-dosing-fail');
    expect(one(m, { BLR_STEAM_FLOW_01: 1500 }).CHEM_FW_PH_01).toBeCloseTo(9.3, 1);
  });

  it('dừng lò (hơi = 0): không định lượng', () => {
    const m = new ChemicalDosingModel();
    m.init();
    const o = one(m, { BLR_STEAM_FLOW_01: 0 });
    expect(o.CHEM_AMMONIA_DOSE_01).toBe(0);
    expect(o.CHEM_PHOSPHATE_DOSE_01).toBe(0);
  });

  it('snapshot/restore giữ mức bồn hoá chất (OTS)', () => {
    const m = new ChemicalDosingModel();
    m.init();
    for (let i = 0; i < 200; i++) one(m, { BLR_STEAM_FLOW_01: 1500 }, 60_000);
    const snap = m.snapshot();
    const m2 = new ChemicalDosingModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tankPct).toBeCloseTo(snap.state.tankPct as number, 6);
  });
});
