import { describe, it, expect } from 'vitest';
import type { IWriteCommand, SequenceDef } from '@idtp/sdk';
import { SequenceEngine } from '@idtp/engines';
import { thermalSequences } from '../src/sequences/defs';
import { thermalScenarios } from '../src/scenarios/defs';

function run(def: SequenceDef, tags: Record<string, number> = {}): { status: string; tags: Record<string, number> } {
  const clock = { t: 0 };
  const io = {
    getTag: (id: string) => tags[id] ?? 0,
    command: (c: IWriteCommand) => { tags[c.tagId] = typeof c.value === 'number' ? c.value : c.value ? 1 : 0; },
    now: () => clock.t,
  };
  const eng = new SequenceEngine(def, io);
  eng.start();
  for (let i = 0; i < 5000 && eng.state().status === 'running'; i++) { clock.t += 100; eng.tick(); }
  return { status: eng.state().status, tags };
}
const seq = (id: string): SequenceDef => {
  const d = thermalSequences.find((s) => s.sequenceId === id);
  if (!d) throw new Error('không có SFC ' + id);
  return d;
};

describe('thermal — vận hành two-shift & island (SFC + scenario)', () => {
  it('generator-desync: giảm tải → mở máy cắt → chuyển tải tự dùng (done)', () => {
    // transition unload cần GEN_MW_01 ≤ 120 → cấp sẵn (đã giảm tải).
    const r = run(seq('generator-desync'), { GEN_MW_01: 40 });
    expect(r.status).toBe('done');
    expect(r.tags.GEN_BREAKER_CMD).toBe(0); // đã mở máy cắt
    expect(r.tags.UNIT_HOUSE_LOAD_CMD).toBe(1); // đã chuyển tải tự dùng
  });

  it('boiler-bank: ủ lò nóng-chờ (done, đặt cờ banking/hot-standby)', () => {
    const r = run(seq('boiler-bank'));
    expect(r.status).toBe('done');
    expect(r.tags.BLR_BANK_CMD).toBe(1);
    expect(r.tags.BLR_HOT_STANDBY_CMD).toBe(1);
  });

  it('≥ 13 SFC & 4 scenario; mọi pha action=sequence trỏ SFC tồn tại; action=set/malfunction/clear có ref', () => {
    expect(thermalSequences.length).toBeGreaterThanOrEqual(13);
    expect(thermalScenarios.length).toBe(4);
    const ids = new Set(thermalSequences.map((s) => s.sequenceId));
    for (const sc of thermalScenarios)
      for (const p of sc.phases) {
        if (p.action === 'sequence') expect(ids.has(p.ref ?? '')).toBe(true);
        if (p.action === 'set' || p.action === 'malfunction' || p.action === 'clear') expect((p.ref ?? '').length).toBeGreaterThan(0);
      }
    // 2 kịch bản mới có mặt.
    const scIds = new Set(thermalScenarios.map((s) => s.scenarioId));
    expect(scIds.has('two-shift-cycle')).toBe(true);
    expect(scIds.has('grid-island-runback')).toBe(true);
  });
});
