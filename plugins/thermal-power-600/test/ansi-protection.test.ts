import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { AnsiProtectionModel } from '../src/sim/ansi-protection';

const OP = { ELEC_FIELD_CURRENT_01: 3000, ELEC_TERM_VOLT_PU_01: 1.0, SY_FREQ_01: 50 };
function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: AnsiProtectionModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('AnsiProtectionModel (doc 10 §7) — bảo vệ máy phát ANSI', () => {
  it('điểm vận hành: mọi phần tử KHÔNG pickup, bảo vệ bình thường, không trip', () => {
    const m = new AnsiProtectionModel();
    m.init();
    const o = one(m, OP);
    expect(o.ANSI_PROT_HEALTHY_01).toBe(1);
    expect(o.ANSI_TRIP_ANY_01).toBe(0);
    expect(o.ANSI_87_TRIP_01).toBe(0);
    expect(o.ANSI_40_PICKUP_01).toBe(0);
    expect(o.ANSI_46_PICKUP_01).toBe(0);
    expect(o.ANSI_81_PICKUP_01).toBe(0);
    expect(o.ANSI_24_PICKUP_01).toBe(0);
    expect(o.ANSI_40_MARGIN_01).toBeGreaterThan(25);
    expect(o.ANSI_24_VHZ_01).toBeCloseTo(100, 0);
    expect(o.ANSI_81_FREQ_01).toBe(50);
  });

  it('87G chạm chập trong cuộn (gen-internal-fault): dòng vi sai vọt → 87 trip → có lệnh trip', () => {
    const m = new AnsiProtectionModel();
    m.init();
    m.injectMalfunction({ id: 'gen-internal-fault' });
    const o = one(m, OP);
    expect(o.ANSI_87_DIFF_01).toBeGreaterThan(10);
    expect(o.ANSI_87_TRIP_01).toBe(1);
    expect(o.ANSI_TRIP_ANY_01).toBe(1);
    expect(o.ANSI_PROT_HEALTHY_01).toBe(0);
    m.clearMalfunction('gen-internal-fault');
    expect(one(m, OP).ANSI_87_TRIP_01).toBe(0);
  });

  it('40 mất kích từ: biên sập dưới ngưỡng → pickup', () => {
    const m = new AnsiProtectionModel();
    m.init();
    m.injectMalfunction({ id: 'gen-loss-field' });
    const o = one(m, OP);
    expect(o.ANSI_40_MARGIN_01).toBeLessThan(25);
    expect(o.ANSI_40_PICKUP_01).toBe(1);
    expect(o.ANSI_TRIP_ANY_01).toBe(1);
  });

  it('46 mất cân bằng (gen-unbalance): I₂ vượt giới hạn liên tục → pickup', () => {
    const m = new AnsiProtectionModel();
    m.init();
    m.injectMalfunction({ id: 'gen-unbalance' });
    const o = one(m, OP);
    expect(o.ANSI_46_I2_01).toBeGreaterThan(8);
    expect(o.ANSI_46_PICKUP_01).toBe(1);
  });

  it('81 tần số thấp + 24 quá kích thích theo đại lượng thực', () => {
    const m = new AnsiProtectionModel();
    m.init();
    expect(one(m, { ...OP, SY_FREQ_01: 48 }).ANSI_81_PICKUP_01).toBe(1); // < 49 Hz
    expect(one(m, { ...OP, SY_FREQ_01: 52 }).ANSI_81_PICKUP_01).toBe(1); // > 51 Hz
    const o = one(m, { ...OP, ELEC_TERM_VOLT_PU_01: 1.2 }); // V/Hz = 120% > 110
    expect(o.ANSI_24_VHZ_01).toBeGreaterThan(110);
    expect(o.ANSI_24_PICKUP_01).toBe(1);
  });

  it('snapshot/restore giữ trạng thái sự cố bảo vệ (OTS)', () => {
    const m = new AnsiProtectionModel();
    m.init();
    m.injectMalfunction({ id: 'gen-loss-field' });
    const snap = m.snapshot();
    const m2 = new AnsiProtectionModel();
    m2.init();
    m2.restore(snap);
    expect(one(m2, OP).ANSI_40_PICKUP_01).toBe(1);
  });
});
