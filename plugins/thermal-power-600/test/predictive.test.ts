import { describe, it, expect } from 'vitest';
import { thermalPredictiveRules } from '../src/maintenance/predictive';

describe('thermal predictive rules (doc 05-18)', () => {
  it('luật hợp lệ: kind đúng, threshold/trend có tag, runhours có pmHours', () => {
    expect(thermalPredictiveRules.length).toBeGreaterThanOrEqual(3);
    for (const r of thermalPredictiveRules) {
      expect(['threshold', 'trend', 'runhours']).toContain(r.kind);
      expect(r.ruleId.length).toBeGreaterThan(0);
      expect(r.title.vi.length).toBeGreaterThan(0);
      if (r.kind === 'threshold' || r.kind === 'trend') expect(r.tag).toBeDefined();
      if (r.kind === 'runhours') expect(r.pmHours).toBeGreaterThan(0);
    }
  });
});
