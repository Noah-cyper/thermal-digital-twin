import { describe, it, expect } from 'vitest';
import { createWaterRuntime } from '../src/runtime';

// CHỨNG MINH lớp AI Cognitive Maintenance là GENERIC: cùng engine SimulationCognitiveMaintenanceProvider
// (@idtp/engines) mà thermal-power-600 dùng, áp lên nhà máy NƯỚC chỉ bằng SỔ khai báo waterAssetHealth —
// 0 dòng engine riêng. Op sạch → healthy; membrane-breach → màng RO suy giảm ra anomaly + chẩn đoán + RUL.
describe('water-runtime — AI Cognitive Maintenance (generic cross-plugin)', () => {
  it('provider mô phỏng phủ 2 tài sản nước; op sạch → healthy', () => {
    const rt = createWaterRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.cognitiveInfo().available).toBe(true);
    expect(rt.cognitiveInfo().mode).toBe('simulation');
    const f = rt.cognitiveFleet();
    expect(f.assets.length).toBe(2);
    const ro = rt.cognitiveAssess('RO-MEMBRANE')!;
    expect(ro.health.band).toBe('healthy');
    expect(ro.diagnosis).toBeNull();
    expect(ro.rul.simulated).toBe(true);
  });

  it('membrane-breach → RO-MEMBRANE suy giảm: điểm thấp + anomaly + WHAT/WHY/HOW + RUL(simulated)', () => {
    const rt = createWaterRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.injectMalfunction({ id: 'membrane-breach' });
    for (let i = 0; i < 120; i++) rt.step();
    const ro = rt.cognitiveAssess('RO-MEMBRANE')!;
    expect(ro.health.band).not.toBe('healthy');
    expect(ro.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(ro.diagnosis).not.toBeNull();
    expect(ro.diagnosis!.what.length).toBeGreaterThan(0);
    expect(ro.diagnosis!.why.length).toBeGreaterThan(0);
    const sumRc = ro.diagnosis!.rootCauses.reduce((s, r) => s + r.probability, 0);
    expect(sumRc).toBeCloseTo(1, 5);
    expect(ro.rul.simulated).toBe(true);
    expect(ro.recommendations.length).toBeGreaterThanOrEqual(1);
    // fleet: màng RO nằm trong nhóm tệ nhất
    expect(rt.cognitiveFleet().worst[0]!.assetId).toBe('RO-MEMBRANE');
  });
});
