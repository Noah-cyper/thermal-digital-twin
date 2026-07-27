import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Registry §10 (catalog ≥ 3.000 tag / ≥ 600 alarm)', () => {
  it('registrySummary đạt ngưỡng §10; registryTag tra cứu theo tên', () => {
    const rt = createThermalRuntime({ warmupSteps: 0 });
    const s = rt.registrySummary();
    expect(s.tags).toBeGreaterThanOrEqual(3000);
    expect(s.alarms).toBeGreaterThanOrEqual(600);
    expect(s.screens).toBeGreaterThanOrEqual(70);
    expect(s.loops).toBeGreaterThanOrEqual(25);
    expect(s.sequences).toBeGreaterThanOrEqual(8);
    expect(s.byCell['boiler']).toBe(600);

    const t = rt.registryTag('BLR_MILL_01_CURRENT');
    expect(t?.eu).toBe('A');
    expect(t?.uns).toMatch(/^[a-z0-9-]+(\/[a-z0-9-]+){6}$/);
    expect(rt.registryTag('KHONG_TON_TAI')).toBeUndefined();
  });

  it('SFC: sequenceList() ≥ 8; runSequenceToCompletion(mill-a-start) → done', () => {
    const rt = createThermalRuntime({ warmupSteps: 0 });
    expect(rt.sequenceList().length).toBeGreaterThanOrEqual(8);
    expect(rt.runSequenceToCompletion('mill-a-start').status).toBe('done');
    expect(rt.runSequenceToCompletion('khong-co').status).toBe('failed');
  });
});
