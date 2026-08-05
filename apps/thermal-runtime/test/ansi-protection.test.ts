import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Bảo vệ ANSI sống trong runtime thật (đọc dòng kích từ/điện áp cực/tần số tươi). Read-only, 0 hồi quy.
describe('thermal-runtime — bảo vệ máy phát ANSI (chiều sâu physics)', () => {
  it('điểm vận hành: bảo vệ bình thường (không pickup), tần số ~50 Hz, V/Hz ~100%', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('ANSI_PROT_HEALTHY_01')).toBe(1);
    expect(rt.value('ANSI_TRIP_ANY_01')).toBe(0);
    expect(rt.value('ANSI_81_FREQ_01')).toBeCloseTo(50, 0);
    expect(rt.value('ANSI_24_VHZ_01')).toBeGreaterThan(90);
    expect(rt.value('ANSI_24_VHZ_01')).toBeLessThan(110);
    expect(rt.value('ANSI_40_MARGIN_01')).toBeGreaterThan(25);
  });

  it('gen-internal-fault: rơle 87G phát hiện → cờ trip; ACTUATION đi qua Cause&Effect (xem ansi-ce-trip)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    rt.injectMalfunction({ id: 'gen-internal-fault' });
    for (let i = 0; i < 20; i++) rt.step();
    // Bản thân MODEL rơle là read-only (chỉ sinh cờ ANSI_*); cắt máy cắt/turbine do ma trận C&E
    // 'generator-protection' thực hiện (kiểm end-to-end MW sập ở ansi-ce-trip.test.ts, GĐ-112).
    expect(rt.value('ANSI_87_TRIP_01')).toBe(1);
    expect(rt.value('ANSI_TRIP_ANY_01')).toBe(1);
  });
});
