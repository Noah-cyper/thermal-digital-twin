import { describe, it, expect } from 'vitest';
import type { AssetHealthSpec, CognitiveInput, PredictiveRule, TagId } from '@idtp/sdk';
import { COGNITIVE_HEALTH_BANDS } from '@idtp/sdk';
import { SimulationCognitiveMaintenanceProvider, GroundupCognitiveMaintenanceProvider, createCognitiveProvider } from '../src/index';

// Spec 2 tài sản: bơm (rung TĂNG=xấu, dầu GIẢM=xấu) + quạt (biên surge GIẢM=xấu).
const SPECS: AssetHealthSpec[] = [
  {
    assetId: 'PUMP-A',
    name: { vi: 'Bơm A', en: 'Pump A' },
    kind: 'pump',
    runTag: 'PUMP_A_RUN',
    designLifeH: 40000,
    signals: [
      { tag: 'PUMP_A_VIB', label: { vi: 'Độ rung', en: 'Vibration' }, good: 2, bad: 11, weight: 3, unit: 'mm/s' },
      { tag: 'PUMP_A_OIL', label: { vi: 'Áp dầu', en: 'Oil pressure' }, good: 4, bad: 1, weight: 1, unit: 'bar' },
    ],
  },
  {
    assetId: 'FAN-FD',
    name: { vi: 'Quạt FD', en: 'FD Fan' },
    kind: 'fan',
    signals: [{ tag: 'FAN_FD_SURGE', label: { vi: 'Biên surge', en: 'Surge margin' }, good: 35, bad: 0, weight: 1, unit: '%' }],
  },
];

const RULES: PredictiveRule[] = [
  { ruleId: 'pump-a-vib-trend', assetId: 'PUMP-A', kind: 'trend', tag: 'PUMP_A_VIB', limit: 11, horizonH: 500, title: { vi: 'Rung bơm A', en: 'Pump A vib' } },
];

function inputFrom(tags: Record<string, number>, nowMs = 1000, hours: Record<string, number> = {}): CognitiveInput {
  return {
    nowMs,
    getTag: (t: TagId) => tags[t] ?? 0,
    runningHours: (a: string) => hours[a] ?? 0,
    formatTs: (ms: number) => new Date(ms).toISOString() as never,
  };
}

const HEALTHY = { PUMP_A_VIB: 2, PUMP_A_OIL: 4, FAN_FD_SURGE: 35, PUMP_A_RUN: 1 };
const DEGRADED = { PUMP_A_VIB: 10.5, PUMP_A_OIL: 1.4, FAN_FD_SURGE: 35, PUMP_A_RUN: 1 };

describe('SimulationCognitiveMaintenanceProvider (P1)', () => {
  it('lành mạnh → điểm cao, band healthy, diagnosis null, không anomaly', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS, rules: RULES });
    const a = p.assess('PUMP-A', inputFrom(HEALTHY))!;
    expect(a.health.score).toBeGreaterThanOrEqual(COGNITIVE_HEALTH_BANDS.healthy);
    expect(a.health.band).toBe('healthy');
    expect(a.diagnosis).toBeNull();
    expect(a.anomalies.length).toBe(0);
    expect(a.recommendations.length).toBe(0);
  });

  it('suy giảm → điểm thấp, anomaly, diagnosis what/why/how, ΣrootCause≈1, có recommendation', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS, rules: RULES });
    const a = p.assess('PUMP-A', inputFrom(DEGRADED))!;
    expect(a.health.score).toBeLessThan(COGNITIVE_HEALTH_BANDS.watch);
    expect(a.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(a.diagnosis).not.toBeNull();
    expect(a.diagnosis!.what.length).toBeGreaterThan(0);
    expect(a.diagnosis!.why.length).toBeGreaterThan(0);
    expect(a.diagnosis!.how.length).toBeGreaterThan(0);
    const sumRc = a.diagnosis!.rootCauses.reduce((s, r) => s + r.probability, 0);
    expect(sumRc).toBeCloseTo(1, 5);
    expect(a.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('minh bạch: Σ trọng số chuẩn hoá ≈ 1 và Σ contribution ≈ score', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS });
    const h = p.assess('PUMP-A', inputFrom(DEGRADED))!.health;
    const sumW = h.factors.reduce((s, f) => s + f.weight, 0);
    const sumC = h.factors.reduce((s, f) => s + f.contribution, 0);
    expect(sumW).toBeCloseTo(1, 6);
    expect(sumC).toBeCloseTo(h.score, 6);
  });

  it('tất định: cùng input → deep-equal', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS, rules: RULES });
    const a1 = p.assess('PUMP-A', inputFrom(DEGRADED));
    const a2 = p.assess('PUMP-A', inputFrom(DEGRADED));
    expect(a2).toEqual(a1);
  });

  it('RUL luôn simulated=true; xu hướng cho projectionH khi rung tăng dần', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS, rules: RULES });
    // 2 mẫu tăng theo thời gian → rule trend sinh projectionH.
    p.assess('PUMP-A', inputFrom({ ...HEALTHY, PUMP_A_VIB: 6 }, 0));
    const rul = p.estimateRul('PUMP-A', inputFrom({ ...HEALTHY, PUMP_A_VIB: 7 }, 3_600_000))!;
    expect(rul.simulated).toBe(true);
    expect(rul.hours).not.toBeNull();
    expect(rul.basis).toMatch(/[Xx]u hướng/);
    // Không rule/không tuổi thọ cho FAN-FD → hours null nhưng vẫn simulated.
    const rulFan = p.estimateRul('FAN-FD', inputFrom(HEALTHY))!;
    expect(rulFan.simulated).toBe(true);
    expect(rulFan.hours).toBeNull();
  });

  it('RUL theo tuổi thọ khi có designLifeH và không xu hướng', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS });
    const rul = p.estimateRul('PUMP-A', inputFrom(HEALTHY, 1000, { 'PUMP-A': 5000 }))!;
    expect(rul.hours).toBe(35000);
    expect(rul.basis).toMatch(/tuổi thọ/);
  });

  it('fleetOverview: average + worst-sort + anomalyCount', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS, rules: RULES });
    const f = p.fleetOverview(inputFrom(DEGRADED));
    expect(f.assets.length).toBe(2);
    expect(f.averageScore).toBeGreaterThanOrEqual(0);
    expect(f.averageScore).toBeLessThanOrEqual(100);
    // worst sắp tăng dần → phần tử đầu điểm thấp nhất (PUMP-A suy giảm).
    expect(f.worst[0]!.score).toBeLessThanOrEqual(f.worst[f.worst.length - 1]!.score);
    expect(f.worst[0]!.assetId).toBe('PUMP-A');
    expect(f.anomalyCount).toBeGreaterThanOrEqual(1);
    expect(f.generatedTs).toMatch(/^\d{4}-/);
  });

  it('assess tài sản không tồn tại → undefined; các method khác trả rỗng an toàn', () => {
    const p = new SimulationCognitiveMaintenanceProvider({ specs: SPECS });
    expect(p.assess('NOPE', inputFrom(HEALTHY))).toBeUndefined();
    expect(p.diagnose('NOPE', inputFrom(HEALTHY))).toBeUndefined();
    expect(p.estimateRul('NOPE', inputFrom(HEALTHY))).toBeUndefined();
    expect(p.detectAnomalies('NOPE', inputFrom(HEALTHY))).toEqual([]);
    expect(p.recommend('NOPE', inputFrom(HEALTHY))).toEqual([]);
    expect(p.assets()).toEqual(['PUMP-A', 'FAN-FD']);
  });
});

describe('GroundupCognitiveMaintenanceProvider (seam) + factory', () => {
  it('chưa cấu hình → available:false, decline sạch, không throw', () => {
    const g = new GroundupCognitiveMaintenanceProvider();
    expect(g.info.available).toBe(false);
    expect(g.info.mode).toBe('external-demo');
    expect(g.assets()).toEqual([]);
    expect(g.assess('PUMP-A', inputFrom(HEALTHY))).toBeUndefined();
    expect(g.diagnose()).toBeUndefined();
    expect(g.estimateRul()).toBeUndefined();
    expect(g.detectAnomalies()).toEqual([]);
    expect(g.recommend()).toEqual([]);
    const f = g.fleetOverview(inputFrom(HEALTHY));
    expect(f.assets).toEqual([]);
    expect(f.averageScore).toBe(0);
  });

  it('factory: simulation khả dụng, groundup không', () => {
    const sim = createCognitiveProvider('simulation', { specs: SPECS, rules: RULES });
    const gnd = createCognitiveProvider('groundup');
    expect(sim.info.available).toBe(true);
    expect(sim.assets().length).toBe(2);
    expect(gnd.info.available).toBe(false);
    expect(gnd.assets()).toEqual([]);
  });
});
