import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Alarm-shelf (ISA-18.2, HMI polish b): shelve có LÝ DO + hẹn giờ tự bung; unshelve thủ công.
describe('thermal-runtime — alarm-shelf (ISA-18.2)', () => {
  it('shelve có lý do → xuất hiện trong danh sách shelved; reason rỗng bị chặn', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();

    const bad = rt.shelveAlarm('SB-FOULING-HI', 60, '   ', 'operator');
    expect('blockedReason' in bad).toBe(true);

    const ok = rt.shelveAlarm('SB-FOULING-HI', 60, 'nhiễu do hiệu chỉnh', 'operator');
    expect('state' in ok && ok.state).toBe('Shelved');

    const shelved = rt.shelvedAlarms();
    const row = shelved.find((s) => s.alarmId === 'SB-FOULING-HI');
    expect(row).toBeDefined();
    expect(row?.reason).toBe('nhiễu do hiệu chỉnh');
    expect(row?.user).toBe('operator');
    expect(row?.remainingMin).toBeGreaterThan(0);
    expect(row?.remainingMin).toBeLessThanOrEqual(60);
  });

  it('quá 8 h bị chặn; unshelve thủ công gỡ khỏi danh sách', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();

    expect('blockedReason' in rt.shelveAlarm('SB-STEAM-PRESS-LO', 600, 'x', 'operator')).toBe(true);

    rt.shelveAlarm('SB-STEAM-PRESS-LO', 120, 'kiểm tra', 'supervisor');
    expect(rt.shelvedAlarms().some((s) => s.alarmId === 'SB-STEAM-PRESS-LO')).toBe(true);

    const un = rt.unshelveAlarm('SB-STEAM-PRESS-LO', 'supervisor');
    expect('state' in un && un.state).toBe('Normal');
    expect(rt.shelvedAlarms().some((s) => s.alarmId === 'SB-STEAM-PRESS-LO')).toBe(false);

    // unshelve khi không còn shelved bị chặn.
    expect('blockedReason' in rt.unshelveAlarm('SB-STEAM-PRESS-LO', 'supervisor')).toBe(true);
  });
});
