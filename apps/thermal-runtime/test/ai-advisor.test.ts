import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — AI advisor (read-only)', () => {
  it('explainAlarm trả advice có trích dẫn; alarm lạ → undefined', () => {
    const rt = createThermalRuntime({ warmupSteps: 0 });
    const a = rt.explainAlarm('BLR-DRUM-LVL-HH');
    expect(a).toBeDefined();
    expect(a?.citations.length).toBeGreaterThan(0);
    expect(a?.summary.length).toBeGreaterThan(0);
    expect(rt.explainAlarm('KHONG-CO')).toBeUndefined();
  });
});
