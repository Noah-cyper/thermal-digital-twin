import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// (2) hiệu năng bình ngưng + (3) biểu đồ khả năng máy phát sống trong runtime. 0 hồi quy: chỉ sinh CNDP_*/GCAP_*.
describe('thermal-runtime — condenser perf & generator capability (chiều sâu 2-3)', () => {
  it('CNDP sống: điểm vận hành sạch (bpDev 0); condenser-tube-fouling → độ sạch giảm + phạt', () => {
    const rt = createThermalRuntime();
    const vacBefore = rt.value('TRB_COND_VACUUM_01');
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('CNDP_BP_DEVIATION_01')).toBeCloseTo(0, 2);
    expect(rt.value('CNDP_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'condenser-tube-fouling' });
    for (let i = 0; i < 3000; i++) rt.step();
    expect(rt.value('CNDP_CLEANLINESS_01')).toBeLessThan(80);
    expect(rt.value('CNDP_HR_PENALTY_01')).toBeGreaterThan(0);
    expect(rt.value('CNDP_HEALTHY_01')).toBe(0);
    // 0 hồi quy: chân không lõi không đổi.
    expect(Math.abs(rt.value('TRB_COND_VACUUM_01') - vacBefore)).toBeLessThan(0.5);
  });

  it('GCAP sống: điểm vận hành ~79% MVA, không ràng buộc; stator-cooling-loss → giới hạn stator', () => {
    const rt = createThermalRuntime();
    const mvarBefore = rt.value('GEN_MVAR_01');
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('GCAP_MVA_LOADING_01')).toBeGreaterThan(70);
    expect(rt.value('GCAP_MVA_LOADING_01')).toBeLessThan(85);
    expect(rt.value('GCAP_LIMIT_BINDING_01')).toBe(0);
    expect(rt.value('GCAP_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'stator-cooling-loss' });
    rt.step();
    expect(rt.value('GCAP_MVA_LOADING_01')).toBeGreaterThan(100);
    expect(rt.value('GCAP_LIMIT_BINDING_01')).toBe(1);
    expect(rt.value('GCAP_HEALTHY_01')).toBe(0);
    // 0 hồi quy: MVAr lõi không đổi.
    expect(Math.abs(rt.value('GEN_MVAR_01') - mvarBefore)).toBeLessThan(5);
  });

  it('2 màn D3 mới (condenser-perf · generator-capability) có trong screens + nav; tag sống', () => {
    const ids = ['D3-condenser-perf', 'D3-generator-capability'];
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    for (const id of ids) {
      const scr = boilerScreens.find((s) => s.screenId === id);
      expect(scr, `màn ${id}`).toBeDefined();
      expect(thermalNav.some((n) => n.screenId === id), `nav ${id}`).toBe(true);
      if (!scr) continue;
      for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t} (${id})`).toBe(true);
    }
  });
});
