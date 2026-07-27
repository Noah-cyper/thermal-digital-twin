import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import type { ScenarioPhaseResult } from '@idtp/sdk';

describe('thermal-runtime — kịch bản §10 (cold-start → ramp → mill trip → runback → coast-down)', () => {
  it('chạy hết 10 pha: SFC khởi động done; quỹ đạo MW ramp lên rồi coast-down xuống', () => {
    const rt = createThermalRuntime(); // warm-start ở điểm vận hành
    expect(rt.scenarioList().length).toBe(1);

    const res = rt.runScenario('unit-startup-to-coastdown');
    const by: Record<string, ScenarioPhaseResult> = {};
    for (const r of res) by[r.phaseId] = r;

    // 10 pha, 6 pha SFC khởi động phải 'ok'
    expect(res.length).toBe(10);
    for (const id of ['purge', 'light-off', 'fw-fill', 'mill-start', 'turbine-roll', 'sync']) {
      expect(by[id]?.status).toBe('ok');
    }

    const mw = (id: string): number => by[id]?.tags['GEN_MW_01'] ?? 0;
    // ramp 550 → MW cao hơn lúc khởi động; coast-down (tải 0) → MW thấp hơn đỉnh ramp
    expect(mw('ramp-up')).toBeGreaterThan(mw('purge'));
    expect(mw('coast-down')).toBeLessThan(mw('ramp-up'));
    // mill trip: steam vẫn hữu hạn (không phân kỳ)
    expect(Number.isFinite(by['mill-trip']?.tags['BLR_STEAM_FLOW_01'] ?? NaN)).toBe(true);
  });
});
