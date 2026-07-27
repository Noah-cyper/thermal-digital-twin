import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Alarm wiring (đồng hồ sim + ISA-18.2)', () => {
  it('đồng hồ sim tiến theo dt (không Date.now trong vòng process)', () => {
    const rt = createThermalRuntime();
    const t0 = rt.nowIso();
    for (let i = 0; i < 100; i++) rt.step();
    expect(rt.nowIso()).not.toBe(t0);
  });

  it('vận hành ổn định ~448 MW → không có alarm P1 hoạt động', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.activeAlarms().filter((a) => a.priority === 'P1')).toHaveLength(0);
  });

  it('tube-leak mạnh → drum LOW alarm nổi; ack → AckAlarm', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    rt.injectMalfunction({ id: 'tube-leak', params: { rate: 800 } });
    for (let i = 0; i < 3000; i++) rt.step();
    const low = rt.activeAlarms().find((a) => a.alarmId.startsWith('BLR-DRUM-LVL-L'));
    expect(low).toBeDefined();
    if (low) expect(rt.ackAlarm(low.alarmId, 'op').state).toBe('AckAlarm');
  });
});
