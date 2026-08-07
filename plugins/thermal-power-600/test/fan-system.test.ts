import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FanSystemModel } from '../src/sim/fan-system';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: FanSystemModel, tags: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  return o;
}
const OP = { BLR_FD_DAMPER_01: 62, BLR_ID_VANE_01: 62, COAL_PA_HEADER_PRESS_01: 9 };

describe('FanSystemModel (doc 10 §6) — hệ quạt FD/ID/PA & biên surge', () => {
  it('điểm vận hành: FD/ID trên đường đặc tính, biên surge dương rộng, lành mạnh', () => {
    const m = new FanSystemModel();
    m.init();
    const o = one(m, OP);
    expect(o.FAN_FD_FLOW_01).toBeCloseTo(62, 0);
    expect(o.FAN_FD_HEAD_01).toBeGreaterThan(0);
    expect(o.FAN_FD_SURGE_MARGIN_01).toBeGreaterThan(20);
    expect(o.FAN_MIN_SURGE_MARGIN_01).toBeGreaterThan(10);
    expect(o.FAN_FD_CURRENT_01).toBeGreaterThan(0);
    expect(o.FAN_HEALTHY_01).toBe(1);
  });

  it('fd-fan-surge: lưu lượng FD tụt → biên surge ÂM (vào vùng surge), không lành mạnh', () => {
    const m = new FanSystemModel();
    m.init();
    m.injectMalfunction({ id: 'fd-fan-surge' });
    const o = one(m, OP);
    expect(o.FAN_FD_FLOW_01).toBeLessThan(25);
    expect(o.FAN_FD_SURGE_MARGIN_01).toBeLessThan(0);
    expect(o.FAN_MIN_SURGE_MARGIN_01).toBeLessThan(0);
    expect(o.FAN_HEALTHY_01).toBe(0);
  });

  it('id-fan-stall: biên surge ID âm, không lành mạnh', () => {
    const m = new FanSystemModel();
    m.init();
    m.injectMalfunction({ id: 'id-fan-stall' });
    const o = one(m, OP);
    expect(o.FAN_ID_SURGE_MARGIN_01).toBeLessThan(0);
    expect(o.FAN_HEALTHY_01).toBe(0);
  });

  it('fan-inlet-block: tắc cửa hút → lưu lượng cả FD & ID tụt → biên surge giảm mạnh', () => {
    const m = new FanSystemModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'fan-inlet-block' });
    const o = one(m, OP);
    expect(o.FAN_FD_FLOW_01).toBeLessThan(base.FAN_FD_FLOW_01);
    expect(o.FAN_MIN_SURGE_MARGIN_01).toBeLessThan(base.FAN_MIN_SURGE_MARGIN_01);
  });

  it('snapshot/restore giữ cờ sự cố (OTS)', () => {
    const m = new FanSystemModel();
    m.init();
    m.injectMalfunction({ id: 'fd-fan-surge' });
    one(m, OP);
    const snap = m.snapshot();
    const m2 = new FanSystemModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, OP).FAN_FD_SURGE_MARGIN_01).toBeLessThan(0);
    expect(m2.snapshot().state.fdSurge).toBe(1);
  });
});
