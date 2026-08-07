import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// Chất lượng điều khiển SCR/FGD sống trong runtime. 0 hồi quy: chỉ sinh ECTL_*, không đổi EMI_* lõi.
describe('thermal-runtime — điều khiển SCR/FGD (chiều sâu phát thải)', () => {
  it('điểm vận hành: SCR khử NOₓ + slip thấp lành mạnh; FGD khử SO₂ lành mạnh; NOx/SO2 lõi không đổi', () => {
    const rt = createThermalRuntime();
    const noxBefore = rt.value('EMI_NOX_STACK_01');
    const so2Before = rt.value('EMI_SO2_STACK_01');
    for (let i = 0; i < 250; i++) rt.step();
    expect(rt.value('ECTL_SCR_HEALTHY_01')).toBe(1);
    expect(rt.value('ECTL_NH3_SLIP_01')).toBeLessThan(3);
    expect(rt.value('ECTL_FGD_HEALTHY_01')).toBe(1);
    // 0 hồi quy: tag phát thải lõi không đổi đáng kể.
    expect(Math.abs(rt.value('EMI_NOX_STACK_01') - noxBefore)).toBeLessThan(20);
    expect(Math.abs(rt.value('EMI_SO2_STACK_01') - so2Before)).toBeLessThan(20);
  });

  it('scr-catalyst-deactivation → rò NH₃ vọt, SCR không lành mạnh', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.injectMalfunction({ id: 'scr-catalyst-deactivation' });
    rt.step();
    expect(rt.value('ECTL_NH3_SLIP_01')).toBeGreaterThan(10);
    expect(rt.value('ECTL_SCR_HEALTHY_01')).toBe(0);
  });

  it('màn D3-emissions-control có trong screens + nav; mọi tag sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D3-emissions-control');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-emissions-control')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });
});
