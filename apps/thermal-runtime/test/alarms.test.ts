import { describe, it, expect } from 'vitest';
import { AlarmEngine } from '@idtp/engines';
import { boilerAlarms } from '@idtp/plugin-thermal-power-600';

describe('boiler alarms (khai báo) + AlarmEngine', () => {
  it('mọi alarm có deadband + on/off delay + priority hợp lệ (EEMUA 191)', () => {
    expect(boilerAlarms.length).toBeGreaterThanOrEqual(8);
    for (const a of boilerAlarms) {
      expect(a.deadband).toBeGreaterThan(0);
      expect(a.onDelayMs).toBeGreaterThan(0);
      expect(a.offDelayMs).toBeGreaterThan(0);
      expect(['P1', 'P2', 'P3', 'P4']).toContain(a.priority);
      expect(a.consequence.vi.length).toBeGreaterThan(0);
    }
  });

  it('mức bao hơi 300 mm → BLR-DRUM-LVL-HH (P1) raise sau on-delay', () => {
    const eng = new AlarmEngine(boilerAlarms, { formatTs: (ms) => `t${ms}` });
    eng.evaluate('BLR_DRUM_LEVEL_01', 300, 'Good', 0);
    eng.evaluate('BLR_DRUM_LEVEL_01', 300, 'Good', 3000);
    const hh = eng.getActive().find((e) => e.alarmId === 'BLR-DRUM-LVL-HH');
    expect(hh).toBeDefined();
    expect(hh?.priority).toBe('P1');
  });
});
