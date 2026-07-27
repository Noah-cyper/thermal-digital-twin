import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — KPI (heat rate · hiệu suất · steam rate) từ Historian', () => {
  it('computeKpis trả 3 KPI với giá trị hợp lý ở ~448 MW', async () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const kpis = await rt.computeKpis();
    const hr = kpis.find((k) => k.kpiId === 'heat-rate');
    const eff = kpis.find((k) => k.kpiId === 'efficiency');
    const sr = kpis.find((k) => k.kpiId === 'steam-rate');
    expect(hr).toBeDefined();
    expect(eff).toBeDefined();
    expect(sr).toBeDefined();
    if (!hr || !eff || !sr) return;
    expect(hr.value).toBeGreaterThan(8000);
    expect(hr.value).toBeLessThan(13000);
    expect(hr.unit.symbol).toBe('kJ/kWh');
    expect(eff.value).toBeGreaterThan(25);
    expect(eff.value).toBeLessThan(45);
    expect(sr.value).toBeGreaterThan(2);
    expect(sr.value).toBeLessThan(5);
  });
});
