import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FoulingAirIngressModel } from '../src/sim/fouling-air-ingress';

function ctxOf(tags: Record<string, number>, dtMs = 60_000): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: FoulingAirIngressModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}
function runN(m: FoulingAirIngressModel, tags: Record<string, number>, n: number): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) o = one(m, tags);
  return o;
}

describe('FoulingAirIngressModel (doc 10 §6) — bám bẩn & lọt khí động', () => {
  it('khởi đầu: bám AH thấp, lọt khí nền, biên SJAE cao, bình thường', () => {
    const m = new FoulingAirIngressModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 211 }, 100);
    expect(o.FA_AH_FOULING_01).toBeLessThan(12);
    expect(o.FA_COND_AIR_INLEAK_01).toBeCloseTo(5, 0);
    expect(o.FA_SJAE_MARGIN_01).toBeGreaterThan(80);
    expect(o.FA_COND_VAC_PENALTY_01).toBe(0);
    expect(o.FA_FOULING_HEALTHY_01).toBe(1);
  });

  it('ĐỘNG: bám AH tích theo thời gian khi không thổi bụi; giảm khi chu trình thổi bụi chạy', () => {
    const m = new FoulingAirIngressModel();
    m.init();
    const grown = runN(m, { BLR_COAL_FLOW_01: 211 }, 30); // 30 phút không thổi bụi
    expect(grown.FA_AH_FOULING_01).toBeGreaterThan(10.5); // đã tích lên
    const cleaned = runN(m, { BLR_COAL_FLOW_01: 211, SB_CYCLE_ACTIVE_01: 1 }, 20); // thổi bụi làm sạch
    expect(cleaned.FA_AH_FOULING_01).toBeLessThan(grown.FA_AH_FOULING_01);
  });

  it('ah-fouling-accelerated: bám AH tích NHANH hơn (gấp bội)', () => {
    const mA = new FoulingAirIngressModel(); mA.init();
    const mB = new FoulingAirIngressModel(); mB.init();
    mB.injectMalfunction({ id: 'ah-fouling-accelerated' });
    const a = runN(mA, { BLR_COAL_FLOW_01: 211 }, 20);
    const b = runN(mB, { BLR_COAL_FLOW_01: 211 }, 20);
    expect(b.FA_AH_FOULING_01).toBeGreaterThan(a.FA_AH_FOULING_01);
  });

  it('condenser-air-leak: lọt khí TIẾN HOÁ tăng → vượt năng lực SJAE → xấu chân không + biên tụt', () => {
    const m = new FoulingAirIngressModel();
    m.init();
    m.injectMalfunction({ id: 'condenser-air-leak' });
    const o = runN(m, { BLR_COAL_FLOW_01: 211 }, 60); // ~1h tiến tới đích
    expect(o.FA_COND_AIR_INLEAK_01).toBeGreaterThan(40);
    expect(o.FA_SJAE_MARGIN_01).toBeLessThan(20);
    expect(o.FA_COND_VAC_PENALTY_01).toBeGreaterThan(0);
    expect(o.FA_FOULING_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ chỉ số bám AH + suất lọt khí (OTS)', () => {
    const m = new FoulingAirIngressModel();
    m.init();
    m.injectMalfunction({ id: 'condenser-air-leak' });
    runN(m, { BLR_COAL_FLOW_01: 211 }, 30);
    const snap = m.snapshot();
    const m2 = new FoulingAirIngressModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.airInleak).toBeCloseTo(snap.state.airInleak as number, 6);
    expect(m2.snapshot().state.ahFouling).toBeCloseTo(snap.state.ahFouling as number, 6);
  });
});
