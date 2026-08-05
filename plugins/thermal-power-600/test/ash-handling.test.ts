import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { AshHandlingModel } from '../src/sim/ash-handling';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-08-01T10:00:00+07:00' };
}
function out(m: AshHandlingModel, ctx: ISimModelContext, tagId: string): number {
  return m.step(ctx).outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}

describe('AshHandlingModel (doc 10 §10 BOP) — thải tro', () => {
  it('tổng tro = than × 15%; đáy 20% < bay 80%; phễu ESP giảm dần A→B→C', () => {
    const m = new AshHandlingModel();
    m.init();
    const ctx = mkCtx({ BLR_COAL_FLOW_01: 200 });
    m.step(ctx);
    expect(out(m, ctx, 'ASH_TOTAL_01')).toBeCloseTo(30, 5); // 200 × 0,15
    expect(out(m, ctx, 'ASH_BOTTOM_FLOW_01')).toBeCloseTo(6, 5); // 30 × 0,2
    expect(out(m, ctx, 'ASH_FLY_FLOW_01')).toBeCloseTo(24, 5); // 30 × 0,8
    expect(out(m, ctx, 'ASH_BOTTOM_FLOW_01')).toBeLessThan(out(m, ctx, 'ASH_FLY_FLOW_01'));
    const a = out(m, ctx, 'ASH_ESP_HOP_A_01');
    const b = out(m, ctx, 'ASH_ESP_HOP_B_01');
    const c = out(m, ctx, 'ASH_ESP_HOP_C_01');
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('không cháy (coal 0) → sản lượng tro 0', () => {
    const m = new AshHandlingModel();
    m.init();
    const ctx = mkCtx({ BLR_COAL_FLOW_01: 0 });
    expect(out(m, ctx, 'ASH_TOTAL_01')).toBe(0);
  });

  it('snapshot/restore giữ mức silo + phễu tro đáy', () => {
    const m = new AshHandlingModel();
    m.init();
    const ctx = mkCtx({ BLR_COAL_FLOW_01: 260 });
    for (let i = 0; i < 50; i++) m.step(ctx);
    const snap = m.snapshot();
    const silo = m.step(ctx).outputs.find((o) => o.tagId === 'ASH_SILO_LEVEL_01')?.value ?? NaN;
    const m2 = new AshHandlingModel();
    m2.init();
    m2.restore(snap);
    const silo2 = m2.step(ctx).outputs.find((o) => o.tagId === 'ASH_SILO_LEVEL_01')?.value ?? NaN;
    expect(silo2).toBeCloseTo(silo, 3);
  });
});
