import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// P3 — provider cognitive nối vào runtime (READ-ONLY). Điểm vận hành sạch → healthy; tiêm sự cố →
// tài sản xấu → assess ra anomaly + RCA + RUL(simulated) + WHAT/WHY/HOW + khuyến nghị; clear → hồi phục.
describe('P3 — AI cognitive maintenance trong runtime', () => {
  it('provider mô phỏng khả dụng; phủ 14 tài sản; op sạch → healthy', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    expect(rt.cognitiveInfo().available).toBe(true);
    expect(rt.cognitiveInfo().mode).toBe('simulation');
    expect(rt.cognitiveAssets().length).toBeGreaterThanOrEqual(18);
    const a = rt.cognitiveAssess('FAN-FD')!;
    expect(a.health.band).toBe('healthy');
    expect(a.diagnosis).toBeNull();
    expect(a.anomalies.length).toBe(0);
    // RUL luôn gắn nhãn mô phỏng, kể cả khi lành mạnh.
    expect(a.rul.simulated).toBe(true);
  });

  it('tiêm fd-fan-surge → FAN-FD suy giảm: anomaly + diagnosis WHAT/WHY/HOW + RCA + khuyến nghị', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    rt.injectMalfunction({ id: 'fd-fan-surge' });
    for (let i = 0; i < 5; i++) rt.step();
    const a = rt.cognitiveAssess('FAN-FD')!;
    expect(a.health.band).not.toBe('healthy');
    expect(a.health.score).toBeLessThan(65);
    expect(a.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(a.diagnosis).not.toBeNull();
    expect(a.diagnosis!.what.length).toBeGreaterThan(0);
    expect(a.diagnosis!.why.length).toBeGreaterThan(0);
    expect(a.diagnosis!.how.length).toBeGreaterThan(0);
    const sumRc = a.diagnosis!.rootCauses.reduce((s, r) => s + r.probability, 0);
    expect(sumRc).toBeCloseTo(1, 5);
    expect(a.rul.simulated).toBe(true);
    expect(a.recommendations.length).toBeGreaterThanOrEqual(1);
    // fleet: FAN-FD nằm trong nhóm tệ nhất, có anomaly.
    const f = rt.cognitiveFleet();
    expect(f.assets.length).toBeGreaterThanOrEqual(18);
    expect(f.anomalyCount).toBeGreaterThanOrEqual(1);
    expect(f.worst[0]!.assetId).toBe('FAN-FD');
    expect(f.generatedTs).toMatch(/^\d{4}-/);
  });

  it('clear sự cố → FAN-FD hồi phục về healthy (read-only, không kẹt trạng thái)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 250; i++) rt.step();
    rt.injectMalfunction({ id: 'fd-fan-surge' });
    for (let i = 0; i < 5; i++) rt.step();
    expect(rt.cognitiveAssess('FAN-FD')!.health.band).not.toBe('healthy');
    rt.clearMalfunction('fd-fan-surge');
    for (let i = 0; i < 60; i++) rt.step();
    expect(rt.cognitiveAssess('FAN-FD')!.health.band).toBe('healthy');
  });

  it('assess tài sản lạ → undefined; diagnose op sạch → undefined', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.cognitiveAssess('NOPE')).toBeUndefined();
    expect(rt.cognitiveDiagnose('BFP')).toBeUndefined(); // healthy → không chẩn đoán
  });
});
