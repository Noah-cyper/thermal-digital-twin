import { describe, it, expect } from 'vitest';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';
import { createThermalRuntime } from '../src/runtime';

// P4 — màn hình JSON cognitive + tô màu mimic. Kiểm: màn tồn tại, nav có mục, mọi tag SỐNG (AH_* công bố),
// và điểm sức khoẻ trên mimic phản ứng malfunction (fd-fan-surge → AH_FAN_FD_SCORE tụt < ngưỡng cảnh báo).
describe('P4 — màn AI maintenance + tô màu sức khoẻ mimic', () => {
  it('D2-ai-maintenance & D3-asset-health có trong screens + nav', () => {
    expect(boilerScreens.some((s) => s.screenId === 'D2-ai-maintenance')).toBe(true);
    expect(boilerScreens.some((s) => s.screenId === 'D3-asset-health')).toBe(true);
    expect(thermalNav.some((n) => n.screenId === 'D2-ai-maintenance')).toBe(true);
    expect(thermalNav.some((n) => n.screenId === 'D3-asset-health')).toBe(true);
  });

  it('mọi tag của 2 màn cognitive SỐNG (hữu hạn) sau warmup', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    for (const id of ['D2-ai-maintenance', 'D3-asset-health']) {
      const scr = boilerScreens.find((s) => s.screenId === id)!;
      for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `${id}:${t}`).toBe(true);
    }
    // Tag chỉ thị fleet công bố sau warmup, hợp lệ 0..100.
    expect(rt.value('AH_FLEET_AVG_01')).toBeGreaterThan(0);
    expect(rt.value('AH_FLEET_HEALTHY_01')).toBe(14); // op sạch → 14 lành mạnh
  });

  it('mimic D1 tô màu sức khoẻ: fd-fan-surge → AH_FAN_FD_SCORE tụt dưới ngưỡng cảnh báo', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    expect(rt.value('AH_FAN_FD_SCORE_01')).toBeGreaterThan(65); // healthy
    rt.injectMalfunction({ id: 'fd-fan-surge' });
    for (let i = 0; i < 15; i++) rt.step(); // > chu kỳ publish (10 bước)
    expect(rt.value('AH_FAN_FD_SCORE_01')).toBeLessThan(65); // tô cảnh báo trên mimic
    // Mimic D1 tham chiếu tag sức khoẻ → nằm trong screenTags.
    const mimic = boilerScreens.find((s) => s.screenId === 'D1-plant-mimic')!;
    expect(screenTags(mimic)).toContain('AH_FAN_FD_SCORE_01');
  });
});
