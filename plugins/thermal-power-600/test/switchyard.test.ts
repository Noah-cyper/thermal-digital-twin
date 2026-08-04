import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { SwitchyardModel } from '../src/sim/switchyard';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: SwitchyardModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('SwitchyardModel (doc 10 §7 BOP) — trạm phân phối 500 kV', () => {
  it('điểm vận hành: xuất 412 MW → 2 đường dây chia đều, thanh cái ~500 kV, tần số 50 Hz, máy cắt đóng', () => {
    const m = new SwitchyardModel();
    m.init();
    const o = one(m, { ELEC_GRID_MW_01: 412, TRB_SPEED_01: 3000 });
    expect(o.SY_GSU_MW_01).toBe(412);
    expect(o.SY_FREQ_01).toBeCloseTo(50, 3);
    expect(o.SY_MAIN_BREAKER_01).toBe(1);
    expect(o.SY_LINES_INSERVICE_01).toBe(2);
    expect(o.SY_LINE1_MW_01).toBeCloseTo(206, 0);
    expect(o.SY_LINE2_MW_01).toBeCloseTo(206, 0);
    expect(o.SY_BUS_A_KV_01).toBeGreaterThan(495);
    expect(o.SY_BUS_A_KV_01).toBeLessThan(520);
    expect(o.SY_LINE1_CURRENT_01).toBeGreaterThan(100); // dòng hợp lý ở 500 kV
  });

  it('line-trip: 1 đường dây cắt → đường còn lại gánh toàn tải (dòng tăng gấp đôi)', () => {
    const m = new SwitchyardModel();
    m.init();
    const base = one(m, { ELEC_GRID_MW_01: 412, TRB_SPEED_01: 3000 });
    m.injectMalfunction({ id: 'line-trip' });
    const o = one(m, { ELEC_GRID_MW_01: 412, TRB_SPEED_01: 3000 });
    expect(o.SY_LINES_INSERVICE_01).toBe(1);
    expect(o.SY_LINE1_MW_01).toBeCloseTo(412, 0);
    expect(o.SY_LINE2_MW_01).toBe(0);
    expect(o.SY_LINE1_CURRENT_01).toBeGreaterThan(base.SY_LINE1_CURRENT_01 * 1.8);
  });

  it('không xuất công suất (MW=0): máy cắt mở', () => {
    const m = new SwitchyardModel();
    m.init();
    const o = one(m, { ELEC_GRID_MW_01: 0, TRB_SPEED_01: 0 });
    expect(o.SY_MAIN_BREAKER_01).toBe(0);
    expect(o.SY_LINE1_CURRENT_01).toBe(0);
  });

  it('snapshot/restore giữ trạng thái sự cố đường dây (OTS)', () => {
    const m = new SwitchyardModel();
    m.init();
    m.injectMalfunction({ id: 'line-trip' });
    const snap = m.snapshot();
    const m2 = new SwitchyardModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, { ELEC_GRID_MW_01: 412, TRB_SPEED_01: 3000 }).SY_LINES_INSERVICE_01).toBe(1);
  });
});
