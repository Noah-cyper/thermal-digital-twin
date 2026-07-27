import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Cause & Effect (doc 09 §4) trên CCS thật', () => {
  it('điểm vận hành: không trip; inject loss-of-vacuum → turbine trip CHỐT', () => {
    const rt = createThermalRuntime();
    expect(rt.causeEffectMatrices().length).toBe(2);

    for (let i = 0; i < 10; i++) rt.step();
    expect(rt.causeEffectState('boiler-mft')?.trippedEffects).toEqual([]);
    expect(rt.causeEffectState('turbine-trip')?.trippedEffects).toEqual([]);

    rt.injectMalfunction({ id: 'loss-of-vacuum' });
    for (let i = 0; i < 400; i++) rt.step();

    const ce = rt.causeEffectState('turbine-trip');
    expect(ce?.activeCauses).toContain('low-vacuum');
    expect(ce?.trippedEffects).toContain('trip-turbine');
    expect(ce?.trippedEffects).toContain('close-msv');
    expect(rt.value('TRB_TRIP')).toBe(1); // hệ quả đã ghi ra tag
  });

  it('trip đổi PHYSICS: loss-of-vacuum → turbine trip → MW sập (không chỉ đèn báo)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 10; i++) rt.step();
    expect(rt.value('GEN_MW_01')).toBeGreaterThan(300); // đang phát bình thường

    rt.injectMalfunction({ id: 'loss-of-vacuum' });
    for (let i = 0; i < 350; i++) rt.step();

    expect(rt.causeEffectState('turbine-trip')?.trippedEffects).toContain('trip-turbine');
    expect(rt.value('GEN_MW_01')).toBeLessThan(50); // MW sập vì turbine đã trip
  });
});
