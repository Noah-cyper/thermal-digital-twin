import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { DrumSwellModel } from '../src/sim/drum-swell';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function run(m: DrumSwellModel, tags: Record<string, number>, n: number): { last: Record<string, number>; peakPos: number; peakNeg: number } {
  let last: Record<string, number> = {};
  let peakPos = 0;
  let peakNeg = 0;
  for (let i = 0; i < n; i++) {
    last = {};
    for (const o of m.step(ctxOf(tags)).outputs) last[o.tagId] = o.value;
    peakPos = Math.max(peakPos, last.DRM_SWELL_MM_01);
    peakNeg = Math.min(peakNeg, last.DRM_SWELL_MM_01);
  }
  return { last, peakPos, peakNeg };
}
// Lưu lượng hơi ỔN ĐỊNH (không đổi) → tốc độ 0 → swell 0.
const STEADY = { BLR_STEAM_FLOW_01: 1500, BLR_DRUM_LEVEL_01: -14 };

describe('DrumSwellModel (doc 10 §6) — động học 2 pha bao hơi shrink/swell', () => {
  it('lưu lượng hơi ổn định: tốc độ ~0, swell ~0, mức thật ≈ biểu kiến, lành mạnh', () => {
    const m = new DrumSwellModel();
    m.init();
    const { last } = run(m, STEADY, 200);
    expect(Math.abs(last.DRM_STEAM_RATE_01)).toBeLessThan(1);
    expect(Math.abs(last.DRM_SWELL_MM_01)).toBeLessThan(1);
    expect(last.DRM_APPARENT_LEVEL_01).toBeCloseTo(-14, 0);
    expect(last.DRM_TRUE_LEVEL_EST_01).toBeCloseTo(-14, 0);
    expect(last.DRM_SWELL_ACTIVE_01).toBe(0);
    expect(last.DRM_HEALTHY_01).toBe(1);
  });

  it('TĂNG tải THẬT (hơi ramp lên): mức SWELL DÂNG dù đang thêm tải (non-minimum-phase)', () => {
    const m = new DrumSwellModel();
    m.init();
    run(m, STEADY, 50);
    // ramp lưu lượng hơi lên 60 t/h trong ~6 s → tốc độ dương lớn → swell dương.
    let last: Record<string, number> = {};
    let steam = 1500;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      steam += 1; // +1 t/h mỗi bước (0,1 s) = 600 t/h/phút thô, lọc lại
      last = {};
      for (const o of m.step(ctxOf({ BLR_STEAM_FLOW_01: steam, BLR_DRUM_LEVEL_01: -14 })).outputs) last[o.tagId] = o.value;
      peak = Math.max(peak, last.DRM_SWELL_MM_01);
    }
    expect(last.DRM_STEAM_RATE_01).toBeGreaterThan(0); // đang tăng tải
    expect(peak).toBeGreaterThan(3); // mức swell DÂNG rõ
    expect(last.DRM_SWELL_ACTIVE_01).toBe(1);
  });

  it('rapid-loadup (xung ép): swell DƯƠNG rồi phân rã; rapid-loaddown: SHRINK âm', () => {
    const up = new DrumSwellModel();
    up.init();
    run(up, STEADY, 50);
    up.injectMalfunction({ id: 'rapid-loadup' });
    const upR = run(up, STEADY, 200);
    expect(upR.peakPos).toBeGreaterThan(4); // swell dương rõ
    expect(upR.last.DRM_SWELL_PEAK_01).toBeGreaterThan(4);

    const down = new DrumSwellModel();
    down.init();
    run(down, STEADY, 50);
    down.injectMalfunction({ id: 'rapid-loaddown' });
    const downR = run(down, STEADY, 200);
    expect(downR.peakNeg).toBeLessThan(-3); // shrink âm rõ
  });

  it('snapshot/restore giữ swell + tốc độ lọc (OTS)', () => {
    const m = new DrumSwellModel();
    m.init();
    run(m, STEADY, 30);
    m.injectMalfunction({ id: 'rapid-loadup' });
    run(m, STEADY, 20);
    const snap = m.snapshot();
    const m2 = new DrumSwellModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.swell).toBeCloseTo(snap.state.swell as number, 6);
    expect(m2.snapshot().state.eventRate).toBeCloseTo(snap.state.eventRate as number, 6);
  });
});
