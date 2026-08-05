import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { BypassAirRemovalModel } from '../src/sim/bypass-airremoval';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-08-01T10:00:00+07:00' };
}
function step(tags: Record<string, number>): ISimStepResult {
  const m = new BypassAirRemovalModel();
  m.init();
  return m.step(mkCtx(tags));
}
const v = (r: ISimStepResult, t: string): number => r.outputs.find((o) => o.tagId === t)?.value ?? NaN;

describe('BypassAirRemovalModel (doc 10 §6/§7) — SJAE hút khí + HP/LP turbine bypass', () => {
  it('SJAE: O₂ hoà tan giảm theo van hút khí (van 72% → ~7 ppb)', () => {
    expect(v(step({ COND_SJAE_VALVE_01: 72 }), 'COND_O2_01')).toBeCloseTo(7, 1);
    expect(v(step({ COND_SJAE_VALVE_01: 100 }), 'COND_O2_01')).toBeCloseTo(0, 5);
    expect(v(step({ COND_SJAE_VALVE_01: 0 }), 'COND_O2_01')).toBeCloseTo(25, 5);
  });

  it('HP bypass: van đóng → xả 0; van mở → xả = van × cap (800 t/h)', () => {
    expect(v(step({ BLR_HP_BYPASS_VALVE_01: 0 }), 'BLR_HP_BYPASS_FLOW_01')).toBe(0);
    expect(v(step({ BLR_HP_BYPASS_VALVE_01: 50 }), 'BLR_HP_BYPASS_FLOW_01')).toBeCloseTo(400, 5);
    expect(v(step({ BLR_HP_BYPASS_VALVE_01: 10 }), 'BLR_HP_BYPASS_OPEN_01')).toBe(10);
  });

  it('LP bypass: van đóng → xả 0; van mở → xả = van × cap (1200 t/h)', () => {
    expect(v(step({ TRB_LP_BYPASS_VALVE_01: 0 }), 'TRB_LP_BYPASS_FLOW_01')).toBe(0);
    expect(v(step({ TRB_LP_BYPASS_VALVE_01: 50 }), 'TRB_LP_BYPASS_FLOW_01')).toBeCloseTo(600, 5);
    expect(v(step({ TRB_LP_BYPASS_VALVE_01: 25 }), 'TRB_LP_BYPASS_OPEN_01')).toBe(25);
  });

  it('snapshot/restore không lỗi (model đại số, không trạng thái)', () => {
    const m = new BypassAirRemovalModel();
    m.init();
    m.restore(m.snapshot());
    expect(m.step(mkCtx({ COND_SJAE_VALVE_01: 50 })).outputs.length).toBeGreaterThan(0);
  });
});
