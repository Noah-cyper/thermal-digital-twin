import { describe, it, expect } from 'vitest';
import type { IWriteCommand, SequenceDef } from '@idtp/sdk';
import { SequenceEngine, type SequenceIo } from '../src/sequence-engine';

function mkIo(tags: Record<string, number>): SequenceIo & { clock: { t: number }; writes: { tag: string; value: number }[] } {
  const clock = { t: 0 };
  const writes: { tag: string; value: number }[] = [];
  return {
    clock,
    writes,
    getTag: (id) => tags[id] ?? 0,
    command: (c: IWriteCommand) => {
      const v = typeof c.value === 'number' ? c.value : c.value ? 1 : 0;
      writes.push({ tag: c.tagId, value: v });
      tags[c.tagId] = v;
    },
    now: () => clock.t,
  };
}

describe('SequenceEngine (doc 09, SFC) — generic', () => {
  it('chạy 2 bước theo holdMs → done; actions ghi có audit reason', () => {
    const def: SequenceDef = {
      sequenceId: 'S',
      title: { vi: '', en: '' },
      steps: [
        { stepId: 's1', title: { vi: '', en: '' }, permissive: [], actions: [{ tag: 'A', value: 1, reason: 'r1' }], transition: [], holdMs: 100, timeoutMs: 0 },
        { stepId: 's2', title: { vi: '', en: '' }, permissive: [], actions: [{ tag: 'B', value: 2, reason: 'r2' }], transition: [], holdMs: 100, timeoutMs: 0 },
      ],
    };
    const io = mkIo({});
    const eng = new SequenceEngine(def, io);
    expect(eng.start().status).toBe('running');
    io.clock.t = 100;
    expect(eng.tick().stepId).toBe('s2'); // bước 1 xong → sang bước 2
    io.clock.t = 200;
    expect(eng.tick().status).toBe('done');
    expect(io.writes).toEqual([{ tag: 'A', value: 1 }, { tag: 'B', value: 2 }]);
  });

  it('permissive không thoả → failed ngay khi start', () => {
    const def: SequenceDef = {
      sequenceId: 'S',
      title: { vi: '', en: '' },
      steps: [{ stepId: 's1', title: { vi: '', en: '' }, permissive: [{ tag: 'P', op: 'ge', value: 1 }], actions: [], transition: [], holdMs: 0, timeoutMs: 0 }],
    };
    expect(new SequenceEngine(def, mkIo({})).start().status).toBe('failed');
    expect(new SequenceEngine(def, mkIo({ P: 1 })).start().status).toBe('running');
  });

  it('transition không đạt trước timeout → failed', () => {
    const def: SequenceDef = {
      sequenceId: 'S',
      title: { vi: '', en: '' },
      steps: [{ stepId: 's1', title: { vi: '', en: '' }, permissive: [], actions: [], transition: [{ tag: 'X', op: 'ge', value: 1 }], holdMs: 0, timeoutMs: 500 }],
    };
    const io = mkIo({});
    const eng = new SequenceEngine(def, io);
    eng.start();
    io.clock.t = 600;
    expect(eng.tick().status).toBe('failed');
  });
});
