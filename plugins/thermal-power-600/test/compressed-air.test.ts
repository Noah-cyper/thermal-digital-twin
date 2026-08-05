import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { CompressedAirModel } from '../src/sim/compressed-air';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-08-01T10:00:00+07:00' };
}
function run(tags: Record<string, number>, n: number): CompressedAirModel {
  const m = new CompressedAirModel();
  m.init();
  const ctx = mkCtx(tags);
  for (let i = 0; i < n; i++) m.step(ctx);
  return m;
}
function val(m: CompressedAirModel, tags: Record<string, number>, tagId: string): number {
  return m.step(mkCtx(tags)).outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}

describe('CompressedAirModel (doc 10 §10 BOP) — khí nén & khí điều khiển', () => {
  it('ở tải: nhu cầu > nền, bình chứa trong dải, header IA thấp hơn SA (sụt sấy), lead luôn chạy', () => {
    const tags = { GEN_MW_01: 448 };
    const m = run(tags, 300);
    expect(val(m, tags, 'CA_DEMAND_01')).toBeGreaterThan(25); // 25 + 55·loadFrac
    expect(val(m, tags, 'CA_RECEIVER_PRESS_01')).toBeGreaterThan(6);
    expect(val(m, tags, 'CA_RECEIVER_PRESS_01')).toBeLessThan(8);
    expect(val(m, tags, 'CA_IA_HEADER_PRESS_01')).toBeLessThan(val(m, tags, 'CA_SA_HEADER_PRESS_01'));
    expect(val(m, tags, 'CA_IA_DEWPOINT_01')).toBeLessThan(0); // sấy → dewpoint âm
    expect(val(m, tags, 'CA_COMP_RUNNING_01')).toBeGreaterThanOrEqual(1); // lead-lag: ≥1
  });

  it('MW 0 vẫn còn nhu cầu NỀN (khí điều khiển luôn cần) → lead vẫn chạy, dewpoint sấy giữ', () => {
    const tags = { GEN_MW_01: 0 };
    const m = run(tags, 5);
    expect(val(m, tags, 'CA_DEMAND_01')).toBeCloseTo(25, 5); // nền 25 Nm³/min
    expect(val(m, tags, 'CA_COMP_RUNNING_01')).toBeGreaterThanOrEqual(1);
    expect(val(m, tags, 'CA_IA_DEWPOINT_01')).toBeLessThan(0);
  });

  it('snapshot/restore giữ áp bình chứa + trạng thái trim', () => {
    const tags = { GEN_MW_01: 448 };
    const m = run(tags, 120);
    const snap = m.snapshot();
    const p = val(m, tags, 'CA_RECEIVER_PRESS_01');
    const m2 = new CompressedAirModel();
    m2.init();
    m2.restore(snap);
    expect(val(m2, tags, 'CA_RECEIVER_PRESS_01')).toBeCloseTo(p, 2);
  });
});
