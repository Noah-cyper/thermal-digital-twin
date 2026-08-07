import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// Hệ quạt gió-khói sống trong runtime. 0 hồi quy: chỉ sinh FAN_*, không đổi tag gió-khói lõi.
describe('thermal-runtime — hệ quạt gió-khói & surge (chiều sâu)', () => {
  it('điểm vận hành: biên surge dương rộng, lành mạnh; furnace draft lõi không đổi', () => {
    const rt = createThermalRuntime();
    const furnBefore = rt.value('BLR_FURN_PRESS_01');
    for (let i = 0; i < 250; i++) rt.step();
    expect(rt.value('FAN_MIN_SURGE_MARGIN_01')).toBeGreaterThan(10);
    expect(rt.value('FAN_HEALTHY_01')).toBe(1);
    expect(Math.abs(rt.value('BLR_FURN_PRESS_01') - furnBefore)).toBeLessThan(200); // 0 hồi quy (Pa)
  });

  it('fd-fan-surge: biên surge FD âm → hệ quạt không lành mạnh', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.injectMalfunction({ id: 'fd-fan-surge' });
    rt.step();
    expect(rt.value('FAN_FD_SURGE_MARGIN_01')).toBeLessThan(0);
    expect(rt.value('FAN_HEALTHY_01')).toBe(0);
  });

  it('màn D3-fan-system có trong screens + nav; mọi tag sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D3-fan-system');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-fan-system')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });
});
