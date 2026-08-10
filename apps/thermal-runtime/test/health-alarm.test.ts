import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// P-A1 — alarm SỨC KHOẺ TÀI SẢN (ISA-18.2): điểm cognitive < 40 (dải nguy cấp) → alarm P2 nổi (sau on-delay
// 5 s, có deadband); hồi phục → tự về Normal. READ-ONLY: alarm đọc tag chỉ thị, không tác động thiết bị.
describe('P-A1 — alarm theo sức khoẻ tài sản (deadband + delay)', () => {
  const active = (rt: ReturnType<typeof createThermalRuntime>): string[] => rt.activeAlarms().map((a) => a.alarmId);

  it('op sạch → KHÔNG alarm sức khoẻ; fd-fan-surge → AH-FAN-FD-LO nổi; clear → tắt', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    expect(active(rt).some((id) => id.startsWith('AH-'))).toBe(false); // mọi tài sản lành mạnh

    rt.injectMalfunction({ id: 'fd-fan-surge' });
    for (let i = 0; i < 90; i++) rt.step(); // > on-delay 5 s (50 bước) + chu kỳ publish
    expect(active(rt)).toContain('AH-FAN-FD-LO'); // P2 nổi (UnackAlarm)

    rt.ackAlarm('AH-FAN-FD-LO', 'test'); // vận hành xác nhận
    rt.clearMalfunction('fd-fan-surge');
    for (let i = 0; i < 160; i++) rt.step(); // hồi phục + off-delay 10 s → về Normal → rời danh sách active
    expect(active(rt)).not.toContain('AH-FAN-FD-LO');
  });
});
