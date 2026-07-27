import { describe, it, expect } from 'vitest';
import type { CauseEffectMatrix } from '@idtp/sdk';
import { CauseEffectEngine } from '../src/cause-effect-engine';

const t = { vi: '', en: '' };
const def: CauseEffectMatrix = {
  matrixId: 'M',
  title: t,
  causes: [
    { id: 'c1', tag: 'A', op: 'gt', value: 10, title: t },
    { id: 'c2', tag: 'B', op: 'lt', value: 0, title: t },
  ],
  effects: [
    { id: 'e1', tag: 'T1', value: 1, title: t },
    { id: 'e2', tag: 'T2', value: 1, title: t },
  ],
  cells: [
    { cause: 'c1', effect: 'e1' },
    { cause: 'c1', effect: 'e2' },
    { cause: 'c2', effect: 'e1' },
  ],
};

describe('CauseEffectEngine (doc 09 §4) — generic, latch trip', () => {
  it('nguyên nhân active → hệ quả trip & ghi lệnh; latch giữ khi nguyên nhân hết; reset an toàn', () => {
    const tags: Record<string, number> = { A: 5, B: 5 };
    const writes: { tag: string; value: number }[] = [];
    const eng = new CauseEffectEngine(def, {
      command: (c) => writes.push({ tag: c.tagId, value: typeof c.value === 'number' ? c.value : 1 }),
    });

    expect(eng.evaluate((id) => tags[id] ?? 0).trippedEffects).toEqual([]); // chưa có nguyên nhân

    tags.A = 20; // c1 active → e1,e2
    const s1 = eng.evaluate((id) => tags[id] ?? 0);
    expect(s1.activeCauses).toEqual(['c1']);
    expect(new Set(s1.trippedEffects)).toEqual(new Set(['e1', 'e2']));
    expect(writes).toEqual([{ tag: 'T1', value: 1 }, { tag: 'T2', value: 1 }]);

    tags.A = 5; // nguyên nhân hết → latch giữ trip, KHÔNG ghi lại
    const s2 = eng.evaluate((id) => tags[id] ?? 0);
    expect(s2.activeCauses).toEqual([]);
    expect(new Set(s2.trippedEffects)).toEqual(new Set(['e1', 'e2']));
    expect(writes.length).toBe(2);

    expect(eng.reset()).toBe(true); // hết nguyên nhân → reset được
    expect(eng.state().trippedEffects).toEqual([]);
  });

  it('reset bị chặn khi còn nguyên nhân active', () => {
    const tags: Record<string, number> = { A: 20, B: 5 };
    const eng = new CauseEffectEngine(def);
    eng.evaluate((id) => tags[id] ?? 0);
    expect(eng.reset()).toBe(false); // c1 còn active
  });
});
