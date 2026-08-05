import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import type { ScenarioPhaseResult } from '@idtp/sdk';

function byPhase(res: ScenarioPhaseResult[]): Record<string, ScenarioPhaseResult> {
  const by: Record<string, ScenarioPhaseResult> = {};
  for (const r of res) by[r.phaseId] = r;
  return by;
}

describe('thermal-runtime — kịch bản vận hành two-shift & island', () => {
  it('two-shift-cycle (10 pha): tách lưới về tự dùng → ủ lò → hoà lại → ramp về tải ngày', () => {
    const rt = createThermalRuntime();
    const res = rt.runScenario('two-shift-cycle');
    const by = byPhase(res);
    expect(res.length).toBe(10);
    for (const id of ['desync', 'bank', 'mill-restart', 'resync']) {
      expect(by[id]?.status).toBe('ok');
    }
    // Tách lưới: chuyển tải tự dùng + mở máy cắt.
    expect(by['desync']?.tags['UNIT_HOUSE_LOAD_CMD'] ?? 0).toBe(1);
    expect(by['desync']?.tags['GEN_BREAKER_CMD'] ?? 1).toBe(0);
    // Ramp về tải ngày: MW cao hơn lúc qua đêm (nóng-chờ tải thấp).
    const mw = (id: string): number => by[id]?.tags['GEN_MW_01'] ?? 0;
    expect(mw('ramp-back')).toBeGreaterThan(mw('overnight'));
    expect(Number.isFinite(mw('ramp-back'))).toBe(true);
  });

  it('grid-island-runback (8 pha): mất lưới → island tự dùng → hoà lại → ramp về tải', () => {
    const rt = createThermalRuntime();
    const res = rt.runScenario('grid-island-runback');
    const by = byPhase(res);
    expect(res.length).toBe(8);
    for (const id of ['island', 'resync']) {
      expect(by[id]?.status).toBe('ok');
    }
    // Mất lưới: 1 đường dây 500 kV bị cắt (còn 1).
    expect(by['grid-loss']?.tags['SY_LINES_INSERVICE_01'] ?? 2).toBe(1);
    // Island: chuyển cấp tải tự dùng.
    expect(by['island']?.tags['UNIT_HOUSE_LOAD_CMD'] ?? 0).toBe(1);
    // Ramp về tải sau khi hoà lại.
    const mw = (id: string): number => by[id]?.tags['GEN_MW_01'] ?? 0;
    expect(mw('ramp-back')).toBeGreaterThan(mw('island-hold'));
  });
});
