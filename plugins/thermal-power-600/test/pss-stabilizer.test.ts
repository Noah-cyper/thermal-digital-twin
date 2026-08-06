import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { PssStabilizerModel } from '../src/sim/pss-stabilizer';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: PssStabilizerModel, tags: Record<string, number>, n: number): { last: Record<string, number>; peak: number } {
  let last: Record<string, number> = {};
  let peak = 0;
  for (let i = 0; i < n; i++) {
    last = {};
    for (const o of m.step(ctxOf(tags)).outputs) last[o.tagId] = o.value;
    peak = Math.max(peak, last.PSS_OSC_AMPLITUDE_01);
  }
  return { last, peak };
}
const ONLINE = { GEN_MW_01: 448 };

describe('PssStabilizerModel (doc 10 §7) — Power System Stabilizer (dập dao động)', () => {
  it('điểm vận hành (không nhiễu): yên tĩnh — biên độ ~0, Vs ~0, ζ=0,15, dập đủ margin', () => {
    const m = new PssStabilizerModel();
    m.init();
    const { last } = run(m, ONLINE, 300);
    expect(last.PSS_ENABLED_01).toBe(1);
    expect(last.PSS_MODE_FREQ_01).toBeCloseTo(1.05, 2);
    expect(last.PSS_OSC_AMPLITUDE_01).toBeLessThan(0.05); // yên tĩnh (0 hồi quy)
    expect(Math.abs(last.PSS_OUTPUT_01)).toBeLessThan(1e-3);
    expect(last.PSS_DAMPING_RATIO_01).toBeCloseTo(0.15, 3);
    expect(last.PSS_OSC_ACTIVE_01).toBe(0);
    expect(last.PSS_HEALTHY_01).toBe(1);
  });

  it('grid-oscillation + PSS BẬT: dao động bị DẬP (biên độ nhỏ), Vs hoạt động, vẫn đủ margin', () => {
    const m = new PssStabilizerModel();
    m.init();
    m.injectMalfunction({ id: 'grid-oscillation' });
    const { last } = run(m, ONLINE, 600);
    expect(last.PSS_OSC_ACTIVE_01).toBe(1);
    expect(last.PSS_OSC_AMPLITUDE_01).toBeGreaterThan(0.5); // có dao động
    expect(last.PSS_OSC_AMPLITUDE_01).toBeLessThan(10); // nhưng bị dập nhỏ
    expect(Math.abs(last.PSS_OUTPUT_01)).toBeGreaterThan(1e-3); // Vs đang điều biến kích từ
    expect(last.PSS_HEALTHY_01).toBe(1); // ζ=0,15 ≥ ngưỡng
  });

  it('grid-oscillation + PSS NGƯNG: dao động DAI hơn NHIỀU (ζ tụt 0,03), mất margin dập', () => {
    const on = new PssStabilizerModel();
    on.init();
    on.injectMalfunction({ id: 'grid-oscillation' });
    const onR = run(on, ONLINE, 600);

    const off = new PssStabilizerModel();
    off.init();
    off.injectMalfunction({ id: 'grid-oscillation' });
    off.injectMalfunction({ id: 'pss-out-of-service' });
    const offR = run(off, ONLINE, 600);

    expect(offR.last.PSS_ENABLED_01).toBe(0);
    expect(offR.last.PSS_DAMPING_RATIO_01).toBeCloseTo(0.03, 3);
    expect(offR.last.PSS_OSC_AMPLITUDE_01).toBeGreaterThan(onR.last.PSS_OSC_AMPLITUDE_01 * 2); // dai hơn ≥ 2×
    expect(offR.last.PSS_HEALTHY_01).toBe(0);
    expect(offR.last.PSS_OUTPUT_01).toBe(0); // PSS ngưng → không bơm Vs
  });

  it('pss-gain-high (mis-tune): ζ ÂM → dao động TĂNG (mất ổn định), không lành mạnh', () => {
    const m = new PssStabilizerModel();
    m.init();
    m.injectMalfunction({ id: 'grid-oscillation' });
    m.injectMalfunction({ id: 'pss-gain-high' });
    const { last, peak } = run(m, ONLINE, 600);
    expect(last.PSS_DAMPING_RATIO_01).toBeLessThan(0); // ζ âm
    expect(peak).toBeGreaterThan(30); // dao động leo lớn
    expect(last.PSS_HEALTHY_01).toBe(0);
  });

  it('clear malfunction: gỡ nhiễu → dao động tắt dần về yên tĩnh', () => {
    const m = new PssStabilizerModel();
    m.init();
    m.injectMalfunction({ id: 'grid-oscillation' });
    run(m, ONLINE, 300);
    m.clearMalfunction('grid-oscillation');
    const { last } = run(m, ONLINE, 600);
    expect(last.PSS_OSC_ACTIVE_01).toBe(0);
    expect(last.PSS_OSC_AMPLITUDE_01).toBeLessThan(0.5); // đã tắt dần
  });

  it('snapshot/restore giữ trạng thái dao động + cờ PSS (OTS)', () => {
    const m = new PssStabilizerModel();
    m.init();
    m.injectMalfunction({ id: 'grid-oscillation' });
    m.injectMalfunction({ id: 'pss-out-of-service' });
    run(m, ONLINE, 40);
    const snap = m.snapshot();
    const m2 = new PssStabilizerModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.oscAngle).toBeCloseTo(snap.state.oscAngle as number, 6);
    expect(m2.snapshot().state.oscVel).toBeCloseTo(snap.state.oscVel as number, 6);
    expect(m2.snapshot().state.enabled).toBe(snap.state.enabled);
  });
});
