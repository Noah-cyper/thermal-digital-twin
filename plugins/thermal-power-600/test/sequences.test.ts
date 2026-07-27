import { describe, it, expect } from 'vitest';
import type { IWriteCommand, SequenceDef } from '@idtp/sdk';
import { SequenceEngine } from '@idtp/engines';
import { thermalSequences } from '../src/sequences/defs';
import { thermalScenarios } from '../src/scenarios/defs';

function run(def: SequenceDef, tags: Record<string, number> = {}): string {
  const clock = { t: 0 };
  const io = {
    getTag: (id: string) => tags[id] ?? 0,
    command: (c: IWriteCommand) => {
      tags[c.tagId] = typeof c.value === 'number' ? c.value : c.value ? 1 : 0;
    },
    now: () => clock.t,
  };
  const eng = new SequenceEngine(def, io);
  eng.start();
  for (let i = 0; i < 5000 && eng.state().status === 'running'; i++) {
    clock.t += 100;
    eng.tick();
  }
  return eng.state().status;
}

describe('thermal SFC (doc 09) — 8 chuỗi khai báo, §10', () => {
  it('có đúng ≥ 8 chuỗi; stepId duy nhất trong mỗi chuỗi; mọi action có reason', () => {
    expect(thermalSequences.length).toBeGreaterThanOrEqual(8);
    for (const s of thermalSequences) {
      expect(s.steps.length).toBeGreaterThan(0);
      const ids = new Set(s.steps.map((st) => st.stepId));
      expect(ids.size).toBe(s.steps.length);
      for (const st of s.steps) for (const a of st.actions) expect(a.reason.length).toBeGreaterThan(0);
    }
  });

  it('mill-a-start chạy tới done (bước theo thời gian)', () => {
    const def = thermalSequences.find((s) => s.sequenceId === 'mill-a-start');
    expect(def).toBeDefined();
    if (def) expect(run(def)).toBe('done');
  });

  it('boiler-light-off bị chặn khi chưa purge; chạy được khi BLR_PURGE_COMPLETE=1', () => {
    const def = thermalSequences.find((s) => s.sequenceId === 'boiler-light-off');
    expect(def).toBeDefined();
    if (def) {
      expect(run(def, {})).toBe('failed'); // permissive purge chưa đạt
      expect(run(def, { BLR_PURGE_COMPLETE: 1 })).toBe('done');
    }
  });

  it('kịch bản §10: mọi pha action=sequence trỏ tới SFC tồn tại', () => {
    const seqIds = new Set(thermalSequences.map((s) => s.sequenceId));
    expect(thermalScenarios.length).toBeGreaterThanOrEqual(1);
    for (const sc of thermalScenarios)
      for (const p of sc.phases) if (p.action === 'sequence') expect(seqIds.has(p.ref ?? '')).toBe(true);
  });
});
