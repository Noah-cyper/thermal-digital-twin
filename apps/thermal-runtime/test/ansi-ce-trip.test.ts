import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Nối bảo vệ ANSI vào Cause&Effect ACTUATION thật: cờ trip rơle → C&E chốt → trip turbine (MW sập) + mở
// máy cắt + triệt kích từ. Điểm vận hành: không trip (0 hồi quy).
describe('thermal-runtime — bảo vệ ANSI → Cause&Effect → trip thật', () => {
  it('điểm vận hành: ma trận generator-protection không chốt, máy phát bình thường', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();
    expect(rt.causeEffectState('generator-protection')?.trippedEffects).toEqual([]);
    expect(rt.value('GEN_MW_01')).toBeGreaterThan(300);
    expect(rt.value('ANSI_TRIP_ANY_01')).toBe(0);
  });

  it('87G chạm chập (gen-internal-fault): rơle 87 trip → C&E CHỐT → turbine trip → MW sập + máy cắt mở + triệt kích từ', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();
    expect(rt.value('GEN_MW_01')).toBeGreaterThan(300);

    rt.injectMalfunction({ id: 'gen-internal-fault' });
    for (let i = 0; i < 400; i++) rt.step();

    // Rơle 87 pickup → ma trận generator-protection chốt các hệ quả.
    expect(rt.value('ANSI_87_TRIP_01')).toBe(1);
    const ce = rt.causeEffectState('generator-protection');
    expect(ce?.activeCauses).toContain('diff-87');
    expect(ce?.trippedEffects).toContain('trip-turbine');
    expect(ce?.trippedEffects).toContain('gen-breaker');
    expect(ce?.trippedEffects).toContain('field-suppress');
    // Hệ quả ghi ra tag + trip PHYSICS (turbine đọc TRB_TRIP → MW sập).
    expect(rt.value('TRB_TRIP')).toBe(1);
    expect(rt.value('GEN_BREAKER_TRIP')).toBe(1);
    expect(rt.value('GEN_FIELD_SUPPRESS')).toBe(1);
    expect(rt.value('GEN_MW_01')).toBeLessThan(50);
  });

  it('reset sau khi gỡ sự cố: hết cờ rơle → resetCauseEffect chốt lại được → phục hồi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();
    rt.injectMalfunction({ id: 'gen-internal-fault' });
    for (let i = 0; i < 100; i++) rt.step();
    expect(rt.causeEffectState('generator-protection')?.trippedEffects.length).toBeGreaterThan(0);

    rt.clearMalfunction('gen-internal-fault'); // hết chạm chập → 87 nhả
    for (let i = 0; i < 20; i++) rt.step();
    expect(rt.value('ANSI_87_TRIP_01')).toBe(0);
    expect(rt.resetCauseEffect('generator-protection')).toBe(true); // hết nguyên nhân → reset được
    expect(rt.value('TRB_TRIP')).toBe(0);
  });
});
