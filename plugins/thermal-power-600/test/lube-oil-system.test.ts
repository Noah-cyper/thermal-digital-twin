import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { LubeOilSystemModel } from '../src/sim/lube-oil-system';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: LubeOilSystemModel, tags: Record<string, number>, n: number): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) { o = {}; for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value; }
  return o;
}
const OP = { GEN_MW_01: 448, TRB_BRG_TEMP_01: 75 };

describe('LubeOilSystemModel (doc 10 §7) — hệ dầu bôi trơn gối trục', () => {
  it('điểm vận hành: MOP chạy, header ~0,2 MPa, AOP/EOP tắt, nhiệt dầu <60°C, lành mạnh', () => {
    const m = new LubeOilSystemModel();
    m.init();
    const o = run(m, OP, 5);
    expect(o.LUBE_MOP_RUN_01).toBe(1);
    expect(o.LUBE_HEADER_PRESS_01).toBeCloseTo(0.2, 2);
    expect(o.LUBE_AOP_RUN_01).toBe(0);
    expect(o.LUBE_EOP_RUN_01).toBe(0);
    expect(o.LUBE_RESERVOIR_TEMP_01).toBeLessThan(60);
    expect(o.LUBE_BRG_MARGIN_01).toBeGreaterThan(30);
    expect(o.LUBE_HEALTHY_01).toBe(1);
  });

  it('mop-trip: bơm chính trip → áp tụt → AOP TỰ KHỞI giữ áp (bảo vệ màng dầu)', () => {
    const m = new LubeOilSystemModel();
    m.init();
    m.injectMalfunction({ id: 'mop-trip' });
    const o = run(m, OP, 5);
    expect(o.LUBE_MOP_RUN_01).toBe(0);
    expect(o.LUBE_AOP_RUN_01).toBe(1); // AOP đã tự khởi
    expect(o.LUBE_HEADER_PRESS_01).toBeGreaterThan(0.15); // AOP giữ được áp
  });

  it('oil-filter-clog ĐỘNG: ΔP lọc tăng → áp header tụt, hệ không lành mạnh', () => {
    const m = new LubeOilSystemModel();
    m.init();
    const base = run(m, OP, 5);
    m.injectMalfunction({ id: 'oil-filter-clog' });
    const o = run(m, OP, 3000);
    expect(o.LUBE_FILTER_DP_01).toBeGreaterThan(1.0);
    expect(o.LUBE_HEADER_PRESS_01).toBeLessThan(base.LUBE_HEADER_PRESS_01);
    expect(o.LUBE_HEALTHY_01).toBe(0);
  });

  it('oil-cooler-fouling: nhiệt dầu tăng vượt ngưỡng → không lành mạnh', () => {
    const m = new LubeOilSystemModel();
    m.init();
    m.injectMalfunction({ id: 'oil-cooler-fouling' });
    const o = run(m, OP, 5);
    expect(o.LUBE_RESERVOIR_TEMP_01).toBeGreaterThan(60);
    expect(o.LUBE_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ ΔP lọc + cờ sự cố (OTS)', () => {
    const m = new LubeOilSystemModel();
    m.init();
    m.injectMalfunction({ id: 'oil-filter-clog' });
    run(m, OP, 500);
    const snap = m.snapshot();
    const m2 = new LubeOilSystemModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.filterDp).toBeCloseTo(snap.state.filterDp as number, 6);
    expect(m2.snapshot().state.filterClog).toBe(1);
  });
});
