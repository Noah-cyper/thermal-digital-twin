import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { HvacModel } from '../src/sim/hvac';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: HvacModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('HvacModel (doc 10 §10 BOP) — điều hoà & thông gió', () => {
  it('điểm vận hành: phòng điều khiển ~23 °C, nước lạnh 7 °C, chiller có tải, 4 quạt', () => {
    const m = new HvacModel();
    m.init();
    const o = one(m, { GEN_MW_01: 448 });
    expect(o.HVAC_CR_TEMP_01).toBeCloseTo(23, 1);
    expect(o.HVAC_CHW_SUPPLY_01).toBe(7);
    expect(o.HVAC_CHILLER_LOAD_01).toBeGreaterThan(0);
    expect(o.HVAC_FANS_RUNNING_01).toBe(4);
    expect(o.HVAC_SWGR_TEMP_01).toBeGreaterThan(26);
  });

  it('trip chiller: mất làm mát → nhiệt phòng điều khiển trôi lên, chiller tải 0, nước lạnh ấm lên', () => {
    const m = new HvacModel();
    m.init();
    m.injectMalfunction({ id: 'hvac-chiller-trip' });
    for (let i = 0; i < 300; i++) one(m, { GEN_MW_01: 448 }, 1000); // 300 s > quán tính 120 s
    const o = one(m, { GEN_MW_01: 448 });
    expect(o.HVAC_CR_TEMP_01).toBeGreaterThan(28);
    expect(o.HVAC_CHILLER_LOAD_01).toBe(0);
    expect(o.HVAC_CHW_SUPPLY_01).toBeGreaterThan(7);
    expect(o.HVAC_FANS_RUNNING_01).toBe(2);
  });

  it('khôi phục chiller: nhiệt phòng điều khiển về ~23 °C', () => {
    const m = new HvacModel();
    m.init();
    m.injectMalfunction({ id: 'hvac-chiller-trip' });
    for (let i = 0; i < 300; i++) one(m, { GEN_MW_01: 448 }, 1000);
    m.clearMalfunction('hvac-chiller-trip');
    for (let i = 0; i < 500; i++) one(m, { GEN_MW_01: 448 }, 1000); // 500 s → về đích
    expect(one(m, { GEN_MW_01: 448 }).HVAC_CR_TEMP_01).toBeCloseTo(23, 0);
  });

  it('snapshot/restore giữ nhiệt phòng điều khiển (OTS)', () => {
    const m = new HvacModel();
    m.init();
    m.injectMalfunction({ id: 'hvac-chiller-trip' });
    for (let i = 0; i < 300; i++) one(m, { GEN_MW_01: 448 });
    const snap = m.snapshot();
    const m2 = new HvacModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.crTemp).toBeCloseTo(snap.state.crTemp as number, 6);
  });
});
