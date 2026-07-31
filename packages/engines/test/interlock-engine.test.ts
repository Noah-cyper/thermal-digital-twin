import { describe, it, expect } from 'vitest';
import type { InterlockRule } from '@idtp/sdk';
import { InterlockEngine } from '../src/interlock-engine';

const rules: ReadonlyArray<InterlockRule> = [
  { id: 'r-mft', target: 'load', when: [{ tag: 'MFT', op: 'gt', value: 0 }], message: { vi: 'đang MFT', en: 'MFT active' } },
  { id: 'r-press', target: 'load', when: [{ tag: 'P', op: 'lt', value: 14 }], message: { vi: 'áp thấp', en: 'low pressure' } },
  { id: 'r-drum', target: 'drum-level', when: [{ tag: 'DL', op: 'gt', value: 250 }], message: { vi: 'mức HH', en: 'level HH' } },
];

describe('InterlockEngine (W6 DoD) — permissive first-class, chặn kèm lý do', () => {
  it('điểm vận hành bình thường: KHÔNG chặn target nào', () => {
    const tags: Record<string, number> = { MFT: 0, P: 17.5, DL: 0 };
    const eng = new InterlockEngine(rules);
    expect(eng.check('load', (t) => tags[t] ?? 0).blocked).toBe(false);
    expect(eng.check('drum-level', (t) => tags[t] ?? 0).blocked).toBe(false);
    expect(eng.active((t) => tags[t] ?? 0)).toEqual([]);
  });

  it('MFT active → chặn lệnh tải, trả đúng lý do (vi); tag khác vẫn cho', () => {
    const tags: Record<string, number> = { MFT: 1, P: 17.5, DL: 0 };
    const eng = new InterlockEngine(rules);
    const r = eng.check('load', (t) => tags[t] ?? 0);
    expect(r.blocked).toBe(true);
    expect(r.reasons).toContain('đang MFT');
    expect(r.ids).toContain('r-mft');
    expect(eng.check('drum-level', (t) => tags[t] ?? 0).blocked).toBe(false);
  });

  it('nhiều interlock cùng target → gộp mọi lý do; active() liệt kê toàn bộ', () => {
    const tags: Record<string, number> = { MFT: 1, P: 10, DL: 300 };
    const eng = new InterlockEngine(rules);
    const r = eng.check('load', (t) => tags[t] ?? 0);
    expect(r.ids.sort()).toEqual(['r-mft', 'r-press']);
    expect(r.reasons.length).toBe(2);
    expect(eng.active((t) => tags[t] ?? 0).map((a) => a.id).sort()).toEqual(['r-drum', 'r-mft', 'r-press']);
  });

  it('lang en trả message tiếng Anh; target không có luật → không chặn', () => {
    const tags: Record<string, number> = { MFT: 1 };
    const eng = new InterlockEngine(rules);
    expect(eng.check('load', (t) => tags[t] ?? 0, 'en').reasons).toContain('MFT active');
    expect(eng.check('unknown-target', (t) => tags[t] ?? 0).blocked).toBe(false);
  });
});
