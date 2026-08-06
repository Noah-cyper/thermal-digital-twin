import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { HeaterDetailModel } from '../src/sim/heater-detail';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function settle(m: HeaterDetailModel, tags: Record<string, number>, n = 400): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    o = {};
    for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  }
  return o;
}
const OP = { GEN_MW_01: 448 };

describe('HeaterDetailModel (doc 10 §6) — bình gia nhiệt PER-HEATER', () => {
  it('điểm vận hành: mọi bình mức ~50%, TTD ~3°C, không kẹt, lành mạnh', () => {
    const m = new HeaterDetailModel();
    m.init();
    const o = settle(m, OP);
    expect(o.HTR_HP1_LEVEL_01).toBeCloseTo(50, 0);
    expect(o.HTR_WORST_TTD_01).toBeLessThan(6);
    expect(o.HTR_MAX_LEVEL_01).toBeCloseTo(50, 0);
    expect(o.HTR_STUCK_COUNT_01).toBe(0);
    expect(o.HTR_HEALTHY_01).toBe(1);
  });

  it('hp2-drain-stuck: van drain kẹt → mức HP2 DÂNG → TTD HP2 xấu, hụt nhiệt nước cấp, không lành mạnh', () => {
    const m = new HeaterDetailModel();
    m.init();
    const base = settle(m, OP);
    m.injectMalfunction({ id: 'hp2-drain-stuck' });
    const o = settle(m, OP, 800); // ~80 s: mức tiến tới ngập
    expect(o.HTR_HP2_LEVEL_01).toBeGreaterThan(80);
    expect(o.HTR_HP2_DRAIN_01).toBe(0); // van kẹt đóng
    expect(o.HTR_HP2_TTD_01).toBeGreaterThan(base.HTR_HP2_TTD_01 + 3);
    expect(o.HTR_WORST_TTD_01).toBeGreaterThan(6);
    expect(o.HTR_STUCK_COUNT_01).toBe(1);
    expect(o.HTR_FW_TEMP_PENALTY_01).toBeGreaterThan(base.HTR_FW_TEMP_PENALTY_01);
    expect(o.HTR_HEALTHY_01).toBe(0);
  });

  it('lp3-drain-stuck: chỉ bình LP3 bị ảnh hưởng; các bình khác vẫn ~50%', () => {
    const m = new HeaterDetailModel();
    m.init();
    m.injectMalfunction({ id: 'lp3-drain-stuck' });
    const o = settle(m, OP, 800);
    expect(o.HTR_LP3_LEVEL_01).toBeGreaterThan(80);
    expect(o.HTR_HP1_LEVEL_01).toBeCloseTo(50, 0); // không lây
    expect(o.HTR_LP4_LEVEL_01).toBeCloseTo(50, 0);
  });

  it('clear hp2-drain-stuck: van hồi phục → mức về ~50%, lành mạnh', () => {
    const m = new HeaterDetailModel();
    m.init();
    m.injectMalfunction({ id: 'hp2-drain-stuck' });
    settle(m, OP, 400);
    m.clearMalfunction('hp2-drain-stuck');
    const o = settle(m, OP, 3000); // ~5 phút: mức về định mức (tau 40 s)
    expect(o.HTR_HP2_LEVEL_01).toBeCloseTo(50, 0);
    expect(o.HTR_HEALTHY_01).toBe(1);
  });

  it('snapshot/restore giữ mức từng bình + bình kẹt (OTS)', () => {
    const m = new HeaterDetailModel();
    m.init();
    m.injectMalfunction({ id: 'hp3-drain-stuck' });
    settle(m, OP, 200);
    const snap = m.snapshot();
    const m2 = new HeaterDetailModel();
    m2.init();
    m2.restore(snap);
    // So sánh NGAY sau restore (chưa step) → trạng thái khớp.
    expect(m2.snapshot().state.lvl_HP3).toBeCloseTo(snap.state.lvl_HP3 as number, 6);
    expect(m2.snapshot().state.stuck_HP3).toBe(1);
    const o = settle(m2, OP, 1);
    expect(o.HTR_HP3_DRAIN_01).toBe(0); // HP3 vẫn kẹt sau restore
  });
});
