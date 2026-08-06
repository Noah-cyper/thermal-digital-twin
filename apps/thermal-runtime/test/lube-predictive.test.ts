import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// (3) hệ dầu bôi trơn + (2) predictive cho các hệ chiều sâu mới. 0 hồi quy: chỉ sinh LUBE_*; predictive read-only.
describe('thermal-runtime — lube oil & predictive mở rộng (chiều sâu)', () => {
  it('hệ dầu sống: điểm vận hành MOP chạy, header ~0,2 MPa, lành mạnh; mop-trip → AOP tự khởi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('LUBE_MOP_RUN_01')).toBe(1);
    expect(rt.value('LUBE_HEADER_PRESS_01')).toBeCloseTo(0.2, 1);
    expect(rt.value('LUBE_HEALTHY_01')).toBe(1);
    rt.injectMalfunction({ id: 'mop-trip' });
    for (let i = 0; i < 5; i++) rt.step();
    expect(rt.value('LUBE_MOP_RUN_01')).toBe(0);
    expect(rt.value('LUBE_AOP_RUN_01')).toBe(1);
    expect(rt.value('LUBE_HEADER_PRESS_01')).toBeGreaterThan(0.15);
  });

  it('predictive: điểm vận hành KHÔNG cảnh báo hệ mới; fast-startup → cảnh báo ứng suất rotor', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.evaluatePredictive();
    const baseAdv = rt.predictiveAdvisories().map((a) => a.ruleId);
    // các luật hệ mới KHÔNG kích ở điểm vận hành (0 cảnh báo giả).
    expect(baseAdv).not.toContain('PRD-TSE-STRESS');
    expect(baseAdv).not.toContain('PRD-COND-PENALTY');
    expect(baseAdv).not.toContain('PRD-GEN-LOADING');

    rt.injectMalfunction({ id: 'fast-startup' });
    for (let i = 0; i < 250; i++) rt.step();
    rt.evaluatePredictive();
    const adv = rt.predictiveAdvisories();
    expect(adv.some((a) => a.ruleId === 'PRD-TSE-STRESS')).toBe(true);
  });

  it('predictive: stator-cooling-loss → cảnh báo tải MVA máy phát', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.injectMalfunction({ id: 'stator-cooling-loss' });
    for (let i = 0; i < 5; i++) rt.step();
    rt.evaluatePredictive();
    expect(rt.predictiveAdvisories().some((a) => a.ruleId === 'PRD-GEN-LOADING')).toBe(true);
  });

  it('màn D3-lube-oil có trong screens + nav; D2-physics-depth mở rộng ≥30 ô; mọi tag sống', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const lube = boilerScreens.find((s) => s.screenId === 'D3-lube-oil');
    expect(lube).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D3-lube-oil')).toBe(true);
    if (lube) for (const t of screenTags(lube)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);

    const pd = boilerScreens.find((s) => s.screenId === 'D2-physics-depth');
    expect(pd).toBeDefined();
    if (pd) {
      const tags = screenTags(pd);
      expect(tags.length).toBeGreaterThanOrEqual(30);
      for (const t of tags) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
    }
  });
});
