import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — cung cấp than sống trong vòng CCS (v1.25)', () => {
  it('coal handling: tiêu thụ = lưu lượng than lò, mill chạy hợp lý, bunker & yard có giá trị', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    const coal = rt.value('BLR_COAL_FLOW_01');
    expect(coal).toBeGreaterThan(0);
    expect(rt.value('COAL_CONSUMPTION_01')).toBeCloseTo(coal, 2); // = lưu lượng than lò

    const mills = rt.value('COAL_MILLS_RUNNING_01');
    expect(mills).toBeGreaterThanOrEqual(3);
    expect(mills).toBeLessThanOrEqual(6);
    expect(rt.value('COAL_FEEDER_RATE_01')).toBeGreaterThan(0);

    const bunker = rt.value('COAL_BUNKER_LEVEL_01');
    expect(bunker).toBeGreaterThan(0);
    expect(bunker).toBeLessThanOrEqual(100);
    expect(rt.value('COAL_YARD_DAYS_01')).toBeGreaterThan(5);
  });
});
