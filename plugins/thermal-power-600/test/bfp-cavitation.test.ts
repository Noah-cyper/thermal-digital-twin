import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { BfpCavitationModel } from '../src/sim/bfp-cavitation';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: BfpCavitationModel, tags: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  return o;
}
const OP = { FW_FLOW_01: 1498, FW_DEA_PRESS_01: 0.9, FW_DEAERATOR_TEMP_01: 160 };

describe('BfpCavitationModel (doc 10 §6) — BFP NPSH & chống xâm thực', () => {
  it('điểm vận hành: biên NPSH dương, van recirc đóng, không xâm thực, lành mạnh', () => {
    const m = new BfpCavitationModel();
    m.init();
    const o = one(m, OP);
    expect(o.BFP_NPSH_AVAIL_01).toBeGreaterThan(o.BFP_NPSH_REQ_01);
    expect(o.BFP_NPSH_MARGIN_01).toBeGreaterThan(2);
    expect(o.BFP_RECIRC_VALVE_01).toBe(0); // đầy tải → recirc đóng
    expect(o.BFP_CAVITATION_01).toBe(0);
    expect(o.BFP_HEALTHY_01).toBe(1);
  });

  it('bfp-suction-low: NPSH khả dụng tụt → biên ÂM → XÂM THỰC, không lành mạnh', () => {
    const m = new BfpCavitationModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'bfp-suction-low' });
    const o = one(m, OP);
    expect(o.BFP_NPSH_AVAIL_01).toBeLessThan(base.BFP_NPSH_AVAIL_01);
    expect(o.BFP_NPSH_MARGIN_01).toBeLessThan(0);
    expect(o.BFP_CAVITATION_01).toBe(1);
    expect(o.BFP_HEALTHY_01).toBe(0);
  });

  it('lưu lượng thấp: van recirc min-flow TỰ MỞ (bảo vệ bơm)', () => {
    const m = new BfpCavitationModel();
    m.init();
    const o = one(m, { ...OP, FW_FLOW_01: 200 }); // dưới ngưỡng min-flow 450
    expect(o.BFP_RECIRC_VALVE_01).toBeGreaterThan(50);
  });

  it('bfp-recirc-stuck-open: van recirc kẹt mở ở đầy tải → bất thường', () => {
    const m = new BfpCavitationModel();
    m.init();
    m.injectMalfunction({ id: 'bfp-recirc-stuck-open' });
    const o = one(m, OP);
    expect(o.BFP_RECIRC_VALVE_01).toBe(100);
    expect(o.BFP_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ cờ sự cố (OTS)', () => {
    const m = new BfpCavitationModel();
    m.init();
    m.injectMalfunction({ id: 'bfp-suction-low' });
    one(m, OP);
    const snap = m.snapshot();
    const m2 = new BfpCavitationModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, OP).BFP_CAVITATION_01).toBe(1);
    expect(m2.snapshot().state.suctionLow).toBe(1);
  });
});
