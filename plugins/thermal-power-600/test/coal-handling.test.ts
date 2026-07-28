import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CoalHandlingModel } from '../src/sim/coal-handling';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: CoalHandlingModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('CoalHandlingModel (doc 10 §6) — cung cấp than: bunker/feeder/mill/yard', () => {
  it('tải danh định 283 t/h: 5 mill chạy (Design Basis), tải mill & feeder hợp lý, yard nhiều ngày', () => {
    const m = new CoalHandlingModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 283 });
    expect(o.COAL_CONSUMPTION_01).toBe(283);
    expect(o.COAL_MILLS_RUNNING_01).toBe(5); // 5 chạy + 1 dự phòng
    expect(o.COAL_MILL_LOADING_01).toBeGreaterThan(85);
    expect(o.COAL_MILL_LOADING_01).toBeLessThanOrEqual(100);
    expect(o.COAL_FEEDER_RATE_01).toBeCloseTo(56.6, 0);
    expect(o.COAL_YARD_DAYS_01).toBeGreaterThan(10);
  });

  it('tải thấp → ít mill chạy hơn', () => {
    const m = new CoalHandlingModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 150 });
    expect(o.COAL_MILLS_RUNNING_01).toBe(3); // ceil(150/60) = 3
  });

  it('bunker: tiêu thụ khi băng tải tắt → mức giảm; dưới ngưỡng → băng tải bật (hysteresis)', () => {
    const m = new CoalHandlingModel();
    m.init(); // 75 %
    for (let i = 0; i < 600; i++) m.step(ctxOf({ BLR_COAL_FLOW_01: 283 }));
    const o = one(m, { BLR_COAL_FLOW_01: 283 });
    expect(o.COAL_BUNKER_LEVEL_01).toBeLessThan(75); // đã tiêu thụ
    expect(o.COAL_CONVEYOR_FEED_01).toBe(0); // vẫn > 60 % → tắt

    const m2 = new CoalHandlingModel();
    m2.init();
    m2.restore({ state: { bunkerPct: 55, conveyorOn: 0 } });
    const lo = one(m2, { BLR_COAL_FLOW_01: 283 });
    expect(lo.COAL_CONVEYOR_FEED_01).toBe(800); // < 60 % → băng tải bật cấp bunker
  });

  it('MFT / dừng đốt: không mill chạy, tiêu thụ = 0', () => {
    const m = new CoalHandlingModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 0 });
    expect(o.COAL_MILLS_RUNNING_01).toBe(0);
    expect(o.COAL_CONSUMPTION_01).toBe(0);
    expect(o.COAL_FEEDER_RATE_01).toBe(0);
  });

  it('snapshot/restore giữ mức bunker (OTS)', () => {
    const m = new CoalHandlingModel();
    m.init();
    for (let i = 0; i < 300; i++) m.step(ctxOf({ BLR_COAL_FLOW_01: 283 }));
    const snap = m.snapshot();
    const m2 = new CoalHandlingModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.bunkerPct).toBeCloseTo(snap.state.bunkerPct as number, 6);
  });
});
