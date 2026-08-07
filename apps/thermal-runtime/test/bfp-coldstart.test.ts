import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav, thermalScenarios, thermalSequences } from '@idtp/plugin-thermal-power-600';

// (3) BFP NPSH/xâm thực + (1) scenario cold-start ràng buộc TSE.
describe('thermal-runtime — BFP cavitation + cold-start stress-limited', () => {
  it('(3) BFP sống: điểm vận hành biên NPSH dương, không xâm thực; bfp-suction-low → xâm thực', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    expect(rt.value('BFP_NPSH_MARGIN_01')).toBeGreaterThan(2);
    expect(rt.value('BFP_CAVITATION_01')).toBe(0);
    expect(rt.value('BFP_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'bfp-suction-low' });
    rt.step();
    expect(rt.value('BFP_NPSH_MARGIN_01')).toBeLessThan(0);
    expect(rt.value('BFP_CAVITATION_01')).toBe(1);
    expect(rt.value('BFP_HEALTHY_01')).toBe(0);
  });

  it('(3) màn D3-bfp-cavitation có trong screens + nav; mọi tag sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D3-bfp-cavitation');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-bfp-cavitation')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });

  it('(1) scenario cold-start-stress-limited có mặt, dùng SFC turbine-loading-stress-limited', () => {
    const sc = thermalScenarios.find((s) => s.scenarioId === 'cold-start-stress-limited');
    expect(sc).toBeDefined();
    if (!sc) return;
    // pha loading tham chiếu SFC ràng buộc TSE.
    const loadPhase = sc.phases.find((p) => p.ref === 'turbine-loading-stress-limited');
    expect(loadPhase, 'phải có pha dùng SFC loading ràng buộc TSE').toBeDefined();
    expect(loadPhase?.action).toBe('sequence');
    // SFC đó tồn tại.
    expect(thermalSequences.some((s) => s.sequenceId === 'turbine-loading-stress-limited')).toBe(true);
    // sampleTags gồm ứng suất TSE (theo dõi trong kịch bản).
    expect(sc.sampleTags).toContain('TSE_STRESS_PCT_01');
  });
});
