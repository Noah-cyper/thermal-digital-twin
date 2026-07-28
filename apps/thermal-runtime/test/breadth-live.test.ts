import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Breadth "sống" (§10 catalog có dữ liệu)', () => {
  it('breadthLive: tag breadth có giá trị trong dải; tắt thì không', () => {
    const live = createThermalRuntime({ breadthLive: true, warmupSteps: 0 });
    for (let i = 0; i < 20; i++) live.step();
    const v = live.value('BLR_MILL_01_CURRENT'); // eu A, dải [0,1000] → ~400
    expect(v).toBeGreaterThan(300);
    expect(v).toBeLessThan(500);

    const off = createThermalRuntime({ warmupSteps: 0 });
    for (let i = 0; i < 20; i++) off.step();
    expect(off.value('BLR_MILL_01_CURRENT')).toBe(0); // không bật → không có dữ liệu breadth

    expect(live.catalogScreens().length).toBeGreaterThanOrEqual(70); // 87 màn hình catalog
  });
});
