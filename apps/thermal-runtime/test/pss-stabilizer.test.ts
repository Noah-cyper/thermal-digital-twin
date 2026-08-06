import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// PSS sống trong runtime thật. 0 hồi quy: chỉ sinh tag PSS_*; màn D3-pss-stabilizer + nav có mặt.
describe('thermal-runtime — PSS ổn định hệ thống điện (chiều sâu physics)', () => {
  it('điểm vận hành: PSS bật, yên tĩnh, dập đủ margin; công suất lõi KHÔNG đổi (0 hồi quy)', () => {
    const rt = createThermalRuntime();
    const mwBefore = rt.value('GEN_MW_01');
    for (let i = 0; i < 600; i++) rt.step();
    expect(rt.value('PSS_ENABLED_01')).toBe(1);
    expect(rt.value('PSS_HEALTHY_01')).toBe(1);
    expect(rt.value('PSS_OSC_AMPLITUDE_01')).toBeLessThan(0.5); // yên tĩnh
    expect(rt.value('PSS_MODE_FREQ_01')).toBeCloseTo(1.05, 2);
    // 0 hồi quy: model đọc-only → công suất lõi không đổi đáng kể.
    expect(Math.abs(rt.value('GEN_MW_01') - mwBefore)).toBeLessThan(5);
  });

  it('grid-oscillation: PSS bật dập nhỏ, khi PSS ngưng biên độ dai hơn nhiều', () => {
    const on = createThermalRuntime();
    for (let i = 0; i < 100; i++) on.step();
    on.injectMalfunction({ id: 'grid-oscillation' });
    for (let i = 0; i < 600; i++) on.step();
    const ampOn = on.value('PSS_OSC_AMPLITUDE_01');
    expect(on.value('PSS_OSC_ACTIVE_01')).toBe(1);

    const off = createThermalRuntime();
    for (let i = 0; i < 100; i++) off.step();
    off.injectMalfunction({ id: 'grid-oscillation' });
    off.injectMalfunction({ id: 'pss-out-of-service' });
    for (let i = 0; i < 600; i++) off.step();
    expect(off.value('PSS_HEALTHY_01')).toBe(0);
    expect(off.value('PSS_OSC_AMPLITUDE_01')).toBeGreaterThan(ampOn * 1.5);
  });

  it('màn D3-pss-stabilizer có trong screens + nav; mọi tag của màn có giá trị sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D3-pss-stabilizer');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-pss-stabilizer')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    for (const t of screenTags(scr)) {
      expect(Number.isFinite(rt.value(t)), `tag ${t} phải sống`).toBe(true);
    }
  });
});
