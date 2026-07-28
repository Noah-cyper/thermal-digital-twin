import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Turbine/Generator (chiều sâu vật lý, cạnh boiler)', () => {
  it('sinh tag turbine/generator ở điểm vận hành: tốc độ ~3000 · tần số ~50 · Stodola · nhiệt stator', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();
    expect(rt.value('TRB_SPEED_01')).toBeGreaterThan(2900);
    expect(rt.value('TRB_SPEED_01')).toBeLessThan(3100);
    expect(Math.abs(rt.value('GEN_FREQ_01') - 50)).toBeLessThan(1);
    expect(rt.value('TRB_STODOLA_FLOW')).toBeGreaterThan(1000);
    expect(rt.value('GEN_STATOR_TEMP_01')).toBeGreaterThan(45);
    expect(rt.value('GEN_MVAR_01')).toBeGreaterThan(100);
  });
});
