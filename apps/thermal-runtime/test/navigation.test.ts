import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Navigation (cây + alarm→D3 + breadcrumb)', () => {
  it('home D1, cây ≥ 3 node, breadcrumb, alarm→D3 chứa tag', () => {
    const rt = createThermalRuntime();
    expect(rt.navHome()).toBe('D1-plant-overview');
    expect(rt.navTree().length).toBeGreaterThanOrEqual(3);
    expect(rt.navBreadcrumb('D3-steam-drum').map((n) => n.screenId)).toEqual(['D1-plant-overview', 'D3-steam-drum']);

    const idx = rt.navAlarmIndex();
    expect(idx['BLR-DRUM-LVL-HH']).toBe('D3-steam-drum');
    expect(idx['BLR-FLUE-O2-LO']).toBe('D3-boiler-combustion');
  });
});
