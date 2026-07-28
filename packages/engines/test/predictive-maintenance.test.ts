import { describe, it, expect } from 'vitest';
import type { PredictiveRule } from '@idtp/sdk';
import { PredictiveMaintenance, type PredictiveContext } from '../src/predictive-maintenance';

const rules: PredictiveRule[] = [
  { ruleId: 'thr', assetId: 'M', kind: 'threshold', tag: 'A', warn: 10, limit: 20, title: { vi: 'A', en: 'A' } },
  { ruleId: 'trd', assetId: 'M', kind: 'trend', tag: 'B', limit: 20, horizonH: 48, title: { vi: 'B', en: 'B' } },
  { ruleId: 'run', assetId: 'M', kind: 'runhours', pmHours: 100, horizonH: 500, title: { vi: 'PM', en: 'PM' } },
];
function ctx(tags: Record<string, number>, hours: number, now: number): PredictiveContext {
  return { nowMs: now, getTag: (t) => tags[t] ?? 0, runningHours: () => hours };
}

describe('PredictiveMaintenance (doc 05-18) — rule-based, read-only', () => {
  it('threshold: warn khi ≥ warn, alert khi ≥ limit', () => {
    const eng = new PredictiveMaintenance(rules);
    expect(eng.evaluate(ctx({ A: 15, B: 5 }, 50, 0)).find((a) => a.ruleId === 'thr')?.severity).toBe('warn');
    expect(eng.evaluate(ctx({ A: 25, B: 5 }, 50, 1000)).find((a) => a.ruleId === 'thr')?.severity).toBe('alert');
  });

  it('trend: rate dương → dự báo giờ tới limit', () => {
    const eng = new PredictiveMaintenance(rules);
    eng.evaluate(ctx({ A: 0, B: 5 }, 50, 0)); // seed
    const adv = eng.evaluate(ctx({ A: 0, B: 6 }, 50, 3_600_000)); // +1h, +1 → rate 1/h
    const trd = adv.find((a) => a.ruleId === 'trd');
    expect(trd).toBeDefined();
    expect(trd?.projectionH).toBeCloseTo(14, 0); // (20-6)/1
  });

  it('runhours: còn giờ tới PM (warn) → quá hạn (alert)', () => {
    const a1 = new PredictiveMaintenance(rules).evaluate(ctx({ A: 0, B: 5 }, 95, 0)).find((a) => a.ruleId === 'run');
    expect(a1?.severity).toBe('warn');
    expect(a1?.projectionH).toBe(5);
    const a2 = new PredictiveMaintenance(rules).evaluate(ctx({ A: 0, B: 5 }, 105, 0)).find((a) => a.ruleId === 'run');
    expect(a2?.severity).toBe('alert');
  });
});
