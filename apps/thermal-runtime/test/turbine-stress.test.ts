import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// TSE ứng suất nhiệt rotor sống trong runtime. 0 hồi quy: chỉ sinh TSE_*, không đụng tag turbine lõi.
describe('thermal-runtime — TSE ứng suất nhiệt rotor turbine (chiều sâu)', () => {
  it('điểm vận hành: ứng suất thấp, ramp limit đầy, lành mạnh; công suất lõi không đổi', () => {
    const rt = createThermalRuntime();
    const mw0 = rt.value('GEN_MW_01');
    for (let i = 0; i < 300; i++) rt.step();
    expect(rt.value('TSE_STRESS_PCT_01')).toBeLessThan(10);
    expect(rt.value('TSE_RAMP_LIMIT_01')).toBeGreaterThan(25);
    expect(rt.value('TSE_HEALTHY_01')).toBe(1);
    expect(Math.abs(rt.value('GEN_MW_01') - mw0)).toBeLessThan(10); // 0 hồi quy
  });

  it('đổi tải 448→560: ứng suất rotor tăng → ramp limit thắt lại', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const rampBase = rt.value('TSE_RAMP_LIMIT_01');
    rt.setLoadDemand(560);
    let peakStress = 0;
    for (let i = 0; i < 1500; i++) { rt.step(); peakStress = Math.max(peakStress, rt.value('TSE_STRESS_PCT_01')); }
    expect(peakStress).toBeGreaterThan(15);
    expect(rt.value('TSE_RAMP_LIMIT_01')).toBeLessThan(rampBase); // TSE giảm ramp cho phép
  });

  it('fast-startup: ứng suất vượt ngưỡng → không lành mạnh, tiêu hao tuổi thọ', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.injectMalfunction({ id: 'fast-startup' });
    let peak = 0;
    let minHealthy = 1;
    for (let i = 0; i < 300; i++) { rt.step(); peak = Math.max(peak, rt.value('TSE_STRESS_PCT_01')); minHealthy = Math.min(minHealthy, rt.value('TSE_HEALTHY_01')); }
    expect(peak).toBeGreaterThan(90);
    expect(minHealthy).toBe(0);
    expect(rt.value('TSE_LIFE_USED_01')).toBeGreaterThan(0);
  });

  it('màn D3-turbine-stress có trong screens + nav; mọi tag sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D3-turbine-stress');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-turbine-stress')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });
});
