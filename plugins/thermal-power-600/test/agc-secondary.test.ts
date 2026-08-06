import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { AgcSecondaryModel } from '../src/sim/agc-secondary';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function settle(m: AgcSecondaryModel, tags: Record<string, number>, n = 400): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    o = {};
    for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  }
  return o;
}
const RUN = { GEN_MW_01: 448, GOV_GRID_FREQ_01: 50 };

describe('AgcSecondaryModel (doc 10 §7) — điều tần thứ cấp AGC / tie-line bias', () => {
  it('điểm vận hành: ACE ~0, tie = lịch, điều tiết ~0, CPS đạt, lành mạnh', () => {
    const m = new AgcSecondaryModel();
    m.init();
    const o = settle(m, RUN);
    expect(o.AGC_ENABLED_01).toBe(1);
    expect(Math.abs(o.AGC_ACE_01)).toBeLessThan(5);
    expect(o.AGC_TIE_FLOW_01).toBeCloseTo(200, 0);
    expect(o.AGC_CPS_OK_01).toBe(1);
    expect(o.AGC_HEALTHY_01).toBe(1);
  });

  it('tie-line-disturbance: ACE bật lên → AGC điều tiết KHÔI PHỤC ACE về ~0 (vài phút)', () => {
    const m = new AgcSecondaryModel();
    m.init();
    settle(m, RUN, 100);
    m.injectMalfunction({ id: 'tie-line-disturbance' });
    const early = settle(m, RUN, 30); // ~3 s: ACE còn lớn
    expect(Math.abs(early.AGC_ACE_01)).toBeGreaterThan(20);
    const late = settle(m, RUN, 3000); // ~5 phút: đã khôi phục
    expect(Math.abs(late.AGC_ACE_01)).toBeLessThan(5);
    expect(late.AGC_REG_SIGNAL_01).toBeLessThan(-40); // điều tiết đã hạ để bù dòng tie thừa
    expect(late.AGC_CPS_OK_01).toBe(1);
    expect(late.AGC_HEALTHY_01).toBe(1);
  });

  it('agc-oos: AGC ngưng → ACE do nhiễu KHÔNG được khôi phục, không lành mạnh', () => {
    const m = new AgcSecondaryModel();
    m.init();
    m.injectMalfunction({ id: 'tie-line-disturbance' });
    m.injectMalfunction({ id: 'agc-oos' });
    const o = settle(m, RUN, 2000);
    expect(o.AGC_ENABLED_01).toBe(0);
    expect(Math.abs(o.AGC_ACE_01)).toBeGreaterThan(20); // không khôi phục (reg đóng băng ~0)
    expect(o.AGC_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ dòng tie + tích phân điều tiết (OTS)', () => {
    const m = new AgcSecondaryModel();
    m.init();
    m.injectMalfunction({ id: 'tie-line-disturbance' });
    settle(m, RUN, 300);
    const snap = m.snapshot();
    const m2 = new AgcSecondaryModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.reg).toBeCloseTo(snap.state.reg as number, 6);
    expect(m2.snapshot().state.tieDev).toBeCloseTo(snap.state.tieDev as number, 6);
  });
});
