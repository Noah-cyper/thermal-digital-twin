import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { GovernorDroopModel } from '../src/sim/governor-droop';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function settle(m: GovernorDroopModel, tags: Record<string, number>, n = 400): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    o = {};
    for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  }
  return o;
}
const RUN = { GEN_MW_01: 448, GEN_FREQ_01: 50 };

describe('GovernorDroopModel (doc 10 §7) — điều tốc droop & đáp ứng tần số sơ cấp', () => {
  it('điểm vận hành (50 Hz): trong deadband → không PFR, van ~tải, droop 5%, lành mạnh', () => {
    const m = new GovernorDroopModel();
    m.init();
    const o = settle(m, RUN);
    expect(o.GOV_ENABLED_01).toBe(1);
    expect(o.GOV_DROOP_PCT_01).toBeCloseTo(5, 3);
    expect(o.GOV_DEADBAND_ACTIVE_01).toBe(1); // trong deadband
    expect(Math.abs(o.GOV_PFR_MW_01)).toBeLessThan(0.5); // không đáp ứng
    expect(o.GOV_VALVE_POS_01).toBeCloseTo(74.7, 0); // ~ tải/MCR
    expect(o.GOV_HEALTHY_01).toBe(1);
  });

  it('grid-underfrequency: tần số tụt 49,8 Hz → điều tốc TĂNG tải (PFR > 0), van mở thêm', () => {
    const m = new GovernorDroopModel();
    m.init();
    const base = settle(m, RUN);
    m.injectMalfunction({ id: 'grid-underfrequency' });
    const o = settle(m, RUN);
    expect(o.GOV_GRID_FREQ_01).toBeLessThan(49.9);
    expect(o.GOV_DEADBAND_ACTIVE_01).toBe(0);
    expect(o.GOV_PFR_MW_01).toBeGreaterThan(20); // droop 5%: ~ -(−0,17/50)/0,05 ×600
    expect(o.GOV_VALVE_POS_01).toBeGreaterThan(base.GOV_VALVE_POS_01);
  });

  it('grid-overfrequency: tần số leo 50,2 Hz → điều tốc GIẢM tải (PFR < 0)', () => {
    const m = new GovernorDroopModel();
    m.init();
    m.injectMalfunction({ id: 'grid-overfrequency' });
    const o = settle(m, RUN);
    expect(o.GOV_GRID_FREQ_01).toBeGreaterThan(50.1);
    expect(o.GOV_PFR_MW_01).toBeLessThan(-20);
  });

  it('droop-mistuned: droop 2% → cùng lệch tần số nhưng PFR LỚN hơn (quá nhạy)', () => {
    const normal = new GovernorDroopModel();
    normal.init();
    normal.injectMalfunction({ id: 'grid-underfrequency' });
    const nR = settle(normal, RUN);

    const mis = new GovernorDroopModel();
    mis.init();
    mis.injectMalfunction({ id: 'grid-underfrequency' });
    mis.injectMalfunction({ id: 'droop-mistuned' });
    const mR = settle(mis, RUN);
    expect(mR.GOV_DROOP_PCT_01).toBeCloseTo(2, 3);
    expect(Math.abs(mR.GOV_PFR_MW_01)).toBeGreaterThan(Math.abs(nR.GOV_PFR_MW_01)); // nhạy hơn (nhưng bị PFR_MAX chặn)
  });

  it('governor-oos: điều tốc ngưng → dù under-frequency vẫn KHÔNG PFR, không lành mạnh', () => {
    const m = new GovernorDroopModel();
    m.init();
    m.injectMalfunction({ id: 'grid-underfrequency' });
    m.injectMalfunction({ id: 'governor-oos' });
    const o = settle(m, RUN);
    expect(o.GOV_ENABLED_01).toBe(0);
    expect(o.GOV_PFR_MW_01).toBe(0);
    expect(o.GOV_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ tần số lưới nội + cờ điều tốc (OTS)', () => {
    const m = new GovernorDroopModel();
    m.init();
    m.injectMalfunction({ id: 'grid-underfrequency' });
    settle(m, RUN, 50);
    const snap = m.snapshot();
    const m2 = new GovernorDroopModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.gridFreq).toBeCloseTo(snap.state.gridFreq as number, 6);
    expect(m2.snapshot().state.underFreq).toBe(snap.state.underFreq);
  });
});
