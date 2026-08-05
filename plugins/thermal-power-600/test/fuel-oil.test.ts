import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { FuelOilModel } from '../src/sim/fuel-oil';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-08-01T10:00:00+07:00' };
}
function last(tags: Record<string, number>, n: number): ISimStepResult {
  const m = new FuelOilModel();
  m.init();
  const ctx = mkCtx(tags);
  let r = m.step(ctx);
  for (let i = 1; i < n; i++) r = m.step(ctx);
  return r;
}
const v = (r: ISimStepResult, t: string): number => r.outputs.find((o) => o.tagId === t)?.value ?? NaN;

describe('FuelOilModel (doc 10 §10 BOP) — dầu đốt khởi động', () => {
  it('tải than cao (211 > ngưỡng 60) → lưu lượng dầu 0, súng rút, HFO hâm ~120 °C, bồn còn nhiều', () => {
    const r = last({ BLR_COAL_FLOW_01: 211 }, 100);
    expect(v(r, 'FO_FLOW_01')).toBe(0);
    expect(v(r, 'FO_PUMP_RUNNING_01')).toBe(0);
    expect(v(r, 'FO_HFO_TEMP_01')).toBeGreaterThan(110);
    expect(v(r, 'FO_HFO_TANK_LEVEL_01')).toBeGreaterThan(50);
  });

  it('khởi động (coal 20 < 60) → đốt dầu bù, bơm chạy, áp cấp > 0', () => {
    const r = last({ BLR_COAL_FLOW_01: 20 }, 10);
    expect(v(r, 'FO_FLOW_01')).toBeGreaterThan(0);
    expect(v(r, 'FO_PUMP_RUNNING_01')).toBe(1);
    expect(v(r, 'FO_SUPPLY_PRESS_01')).toBeGreaterThan(0);
  });

  it('snapshot/restore giữ mức bồn + nhiệt HFO', () => {
    const m = new FuelOilModel();
    m.init();
    const ctx = mkCtx({ BLR_COAL_FLOW_01: 20 });
    for (let i = 0; i < 50; i++) m.step(ctx);
    const snap = m.snapshot();
    const hfo = m.step(ctx).outputs.find((o) => o.tagId === 'FO_HFO_TANK_LEVEL_01')?.value ?? NaN;
    const m2 = new FuelOilModel();
    m2.init();
    m2.restore(snap);
    const hfo2 = m2.step(ctx).outputs.find((o) => o.tagId === 'FO_HFO_TANK_LEVEL_01')?.value ?? NaN;
    expect(hfo2).toBeCloseTo(hfo, 3);
  });
});
