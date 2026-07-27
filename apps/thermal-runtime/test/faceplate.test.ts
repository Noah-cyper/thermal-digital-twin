import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Faceplate (4 tab từ engine chung)', () => {
  it('faceplate drum-level: list có pvTag; overview có PV + mode AUTO; 4 alarm', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();

    const list = rt.faceplateList();
    const item = list.find((f) => f.assetId === 'PID-DRUM-LEVEL');
    expect(item).toBeDefined();
    expect(item?.pvTag).toBe('BLR_DRUM_LEVEL_01');

    const data = rt.faceplateData('PID-DRUM-LEVEL');
    expect(data).toBeDefined();
    if (!data) return;
    expect(typeof data.overview.pv).toBe('number');
    expect(data.overview.mode).toBe('AUTO');
    expect(data.def.kks).toBe('10HAD10CL001');
    expect(data.alarms.length).toBe(4);
    expect(data.detail.blockedReason).toBeNull();
  });

  it('faceplate trend trả min/max/last theo tag', async () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    const tr = await rt.faceplateTrend('PID-DRUM-LEVEL', 1);
    expect(Object.keys(tr).length).toBeGreaterThan(0);
    expect(typeof tr['BLR_DRUM_LEVEL_01']?.last).toBe('number');
  });
});
