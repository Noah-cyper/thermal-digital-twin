import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FeedwaterDrainsModel } from '../src/sim/feedwater-drains';

const OP = {
  BLR_STEAM_FLOW_01: 1500,
  FW_CONDENSATE_TEMP_01: 34,
  FW_DEAERATOR_TEMP_01: 178,
  FW_HPH1_TEMP_01: 215,
  FW_HPH2_TEMP_01: 250,
  FW_LPH3_TEMP_01: 140,
};
function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: FeedwaterDrainsModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('FeedwaterDrainsModel (doc 10 §6) — drain cascade bình gia nhiệt', () => {
  it('điểm vận hành: nhiệt drain cascade giảm dần HP→LP (drain ra ≈ nước cấp vào + DCA), TTD/DCA hợp lý, xả khẩn đóng', () => {
    const m = new FeedwaterDrainsModel();
    m.init();
    const o = one(m, OP);
    expect(o.FWH_HPH3_DRAIN_TEMP_01).toBeCloseTo(250 + 5.5, 1); // HP2 ra + DCA
    expect(o.FWH_HPH1_DRAIN_TEMP_01).toBeCloseTo(178 + 5.5, 1); // deaerator + DCA
    expect(o.FWH_LPH1_DRAIN_TEMP_01).toBeCloseTo(34 + 5.5, 1); // condensate + DCA
    // cascade: drain HP nóng hơn drain LP.
    expect(o.FWH_HPH3_DRAIN_TEMP_01).toBeGreaterThan(o.FWH_HPH1_DRAIN_TEMP_01);
    expect(o.FWH_HPH1_DRAIN_TEMP_01).toBeGreaterThan(o.FWH_LPH1_DRAIN_TEMP_01);
    expect(o.FWH_HPH_DCA_01).toBe(5.5);
    expect(o.FWH_HPH_TTD_01).toBeGreaterThan(2);
    expect(o.FWH_HPH_TTD_01).toBeLessThan(6);
    expect(o.FWH_EMERG_DRAIN_01).toBe(0);
    expect(o.FWH_DRAIN_TO_COND_01).toBeCloseTo(1500 * 0.09, 0);
    expect(o.FWH_HPH_DRAIN_LEVEL_01).toBeCloseTo(50, 0);
  });

  it('TTD tăng ở non tải (áp trích thấp → truyền nhiệt kém)', () => {
    const m = new FeedwaterDrainsModel();
    m.init();
    const full = one(m, OP);
    const part = one(m, { ...OP, BLR_STEAM_FLOW_01: 750 });
    expect(part.FWH_HPH_TTD_01).toBeGreaterThan(full.FWH_HPH_TTD_01);
  });

  it('malfunction heater-drain-high: mức drain HP dâng → van xả khẩn MỞ → drain đổ về bình ngưng tăng vọt', () => {
    const m = new FeedwaterDrainsModel();
    m.init();
    m.injectMalfunction({ id: 'heater-drain-high' });
    let o: Record<string, number> = {};
    for (let i = 0; i < 30; i++) o = one(m, OP, 60_000); // vài chục phút → mức vượt 80%
    expect(o.FWH_HPH_DRAIN_LEVEL_01).toBeGreaterThan(EMERG_MARK);
    expect(o.FWH_EMERG_DRAIN_01).toBe(1);
    expect(o.FWH_DRAIN_TO_COND_01).toBeGreaterThan(1500 * 0.09 + 100); // + lưu lượng xả khẩn
    // Gỡ lỗi → mức về setpoint, van xả khẩn đóng.
    m.clearMalfunction('heater-drain-high');
    for (let i = 0; i < 30; i++) o = one(m, OP, 60_000);
    expect(o.FWH_EMERG_DRAIN_01).toBe(0);
    expect(o.FWH_HPH_DRAIN_LEVEL_01).toBeCloseTo(50, 0);
  });

  it('snapshot/restore giữ mức drain + latch xả khẩn (OTS)', () => {
    const m = new FeedwaterDrainsModel();
    m.init();
    m.injectMalfunction({ id: 'heater-drain-high' });
    for (let i = 0; i < 20; i++) one(m, OP, 60_000);
    const snap = m.snapshot();
    const m2 = new FeedwaterDrainsModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.hpDrainLevel).toBeCloseTo(snap.state.hpDrainLevel as number, 6);
    expect(m2.snapshot().state.emergOpen).toBe(snap.state.emergOpen);
  });
});

const EMERG_MARK = 60; // > ngưỡng đóng xả khẩn — xác nhận đã vào vùng xả khẩn
