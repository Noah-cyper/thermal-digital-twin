import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav, thermalSequences } from '@idtp/plugin-thermal-power-600';

// (2) SFC mang tải ràng buộc TSE + (3) bảng D1 sức khoẻ nhà máy.
describe('thermal-runtime — loading-seq TSE + plant-health dashboard', () => {
  it('(2) SFC turbine-loading-stress-limited: mỗi khối tải có permissive TSE_STRESS_PCT_01 ≤ 85', () => {
    const seq = thermalSequences.find((s) => s.sequenceId === 'turbine-loading-stress-limited');
    expect(seq).toBeDefined();
    if (!seq) return;
    expect(seq.steps.length).toBe(3);
    for (const step of seq.steps) {
      const perm = step.permissive.find((p) => p.tag === 'TSE_STRESS_PCT_01');
      expect(perm, `bước ${step.stepId} phải có permissive TSE`).toBeDefined();
      expect(perm?.op).toBe('le');
      expect(perm?.value).toBe(85);
      // action ghi tải BLR_MW_DEMAND.
      expect(step.actions.some((a) => a.tag === 'BLR_MW_DEMAND')).toBe(true);
    }
    // runtime liệt kê được sequence này.
    const rt = createThermalRuntime();
    expect(rt.sequenceList().some((s) => s.sequenceId === 'turbine-loading-stress-limited')).toBe(true);
  });

  it('(3) D1-plant-health có trong screens + nav; ≥15 cờ/KPI; mọi tag sống; điểm vận hành đa số lành mạnh', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D1-plant-health');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D1-plant-health')).toBe(true);
    if (!scr) return;
    const tags = screenTags(scr);
    expect(tags.length).toBeGreaterThanOrEqual(15);
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    for (const t of tags) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
    // các cờ sức khoẻ cốt lõi = 1 ở điểm vận hành.
    for (const h of ['ANSI_PROT_HEALTHY_01', 'TSE_HEALTHY_01', 'LUBE_HEALTHY_01', 'ECTL_SCR_HEALTHY_01', 'GCAP_HEALTHY_01']) {
      expect(rt.value(h), `cờ ${h} phải lành mạnh ở điểm vận hành`).toBe(1);
    }
  });
});
