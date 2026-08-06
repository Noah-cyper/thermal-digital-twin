import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// Vòng A1-A4 chiều sâu: AGC thứ cấp · tối ưu cháy · bình gia nhiệt per-heater · bao hơi shrink/swell.
// 0 hồi quy: models đọc-only sinh tag mới (AGC_*/CMB_*/HTR_*/DRM_*); không đụng tag lõi.
describe('thermal-runtime — AGC · combustion · heaters · drum-swell (chiều sâu A1-A4)', () => {
  it('A1 AGC sống: điểm vận hành ACE~0; tie-line-disturbance → AGC khôi phục ACE', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('AGC_ENABLED_01')).toBe(1);
    expect(Math.abs(rt.value('AGC_ACE_01'))).toBeLessThan(5);
    rt.injectMalfunction({ id: 'tie-line-disturbance' });
    for (let i = 0; i < 30; i++) rt.step();
    const aceEarly = Math.abs(rt.value('AGC_ACE_01'));
    expect(aceEarly).toBeGreaterThan(20);
    for (let i = 0; i < 3000; i++) rt.step();
    expect(Math.abs(rt.value('AGC_ACE_01'))).toBeLessThan(aceEarly); // đã khôi phục
  });

  it('A2 combustion sống: hiệu suất lò ~90% (tách M-06); o2-trim-low → hiệu suất tụt', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const effBase = rt.value('CMB_BOILER_EFF_EST_01');
    expect(effBase).toBeGreaterThan(88);
    expect(effBase).toBeLessThan(92);
    expect(rt.value('CMB_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'o2-trim-low' });
    rt.step();
    expect(rt.value('CMB_BOILER_EFF_EST_01')).toBeLessThan(effBase);
    expect(rt.value('CMB_LOI_01')).toBeGreaterThan(4);
  });

  it('A3 heaters sống: mọi bình ~50%; hp2-drain-stuck → mức HP2 dâng, TTD xấu', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('HTR_HEALTHY_01')).toBe(1);
    expect(rt.value('HTR_STUCK_COUNT_01')).toBe(0);
    rt.injectMalfunction({ id: 'hp2-drain-stuck' });
    for (let i = 0; i < 800; i++) rt.step();
    expect(rt.value('HTR_HP2_LEVEL_01')).toBeGreaterThan(80);
    expect(rt.value('HTR_WORST_TTD_01')).toBeGreaterThan(6);
    expect(rt.value('HTR_HEALTHY_01')).toBe(0);
  });

  it('A4 drum-swell sống: yên tĩnh ~0; rapid-loadup → swell dương (non-minimum-phase)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(Math.abs(rt.value('DRM_SWELL_MM_01'))).toBeLessThan(3);
    expect(rt.value('DRM_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'rapid-loadup' });
    let peak = 0;
    for (let i = 0; i < 200; i++) { rt.step(); peak = Math.max(peak, rt.value('DRM_SWELL_MM_01')); }
    expect(peak).toBeGreaterThan(4);
  });

  it('4 màn D3 mới có trong screens + nav; mọi tag của màn có giá trị sống', () => {
    const ids = ['D3-agc-secondary', 'D3-combustion-opt', 'D3-heater-detail', 'D3-drum-swell'];
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    for (const id of ids) {
      const scr = boilerScreens.find((s) => s.screenId === id);
      expect(scr, `màn ${id}`).toBeDefined();
      expect(thermalNav.some((n) => n.screenId === id), `nav ${id}`).toBe(true);
      if (!scr) continue;
      for (const t of screenTags(scr)) {
        expect(Number.isFinite(rt.value(t)), `tag ${t} (màn ${id}) phải sống`).toBe(true);
      }
    }
  });

  it('0 hồi quy: công suất & mức bao hơi lõi KHÔNG đổi đáng kể sau khi thêm 4 model', () => {
    const rt = createThermalRuntime();
    const mw0 = rt.value('GEN_MW_01');
    const lvl0 = rt.value('BLR_DRUM_LEVEL_01');
    for (let i = 0; i < 300; i++) rt.step();
    expect(Math.abs(rt.value('GEN_MW_01') - mw0)).toBeLessThan(10);
    expect(Math.abs(rt.value('BLR_DRUM_LEVEL_01') - lvl0)).toBeLessThan(30);
  });
});
