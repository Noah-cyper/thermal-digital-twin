import { describe, it, expect } from 'vitest';
import { evalTransform, evalCondition, applyScreen, type TagRead } from '../src/graphics';

describe('graphics — evalTransform/evalCondition/applyScreen (nhánh chưa phủ)', () => {
  it('evalTransform: map hit/miss · linear default · non-number → String', () => {
    expect(evalTransform('x', { kind: 'map', map: { x: 'ON' } })).toBe('ON');
    expect(evalTransform('y', { kind: 'map', map: { x: 'ON' } })).toBe('y'); // miss → String(value)
    expect(evalTransform(2, { kind: 'linear' })).toBe('2'); // scale 1 / offset 0 mặc định
    expect(evalTransform(true, { kind: 'linear' })).toBe('true'); // linear trên non-number
  });

  it('evalCondition: lt · eq · uncertain=bad · non-number · value undefined', () => {
    expect(evalCondition({ value: 2, quality: 'Good' }, { when: 'lt', value: 3 })).toBe(true);
    expect(evalCondition({ value: 4, quality: 'Good' }, { when: 'lt', value: 3 })).toBe(false);
    expect(evalCondition({ value: 3, quality: 'Good' }, { when: 'eq', value: 3 } as never)).toBe(true);
    expect(evalCondition({ value: 1, quality: 'Uncertain' }, { when: 'bad' })).toBe(true);
    expect(evalCondition({ value: 'txt', quality: 'Good' }, { when: 'gt', value: 3 })).toBe(false);
    expect(evalCondition({ value: 3, quality: 'Good' }, { when: 'gt' })).toBe(false); // c.value undefined
  });

  it('applyScreen: trả map props theo element id', () => {
    const def = {
      screenId: 'S1',
      level: 'D3',
      title: { vi: 'x', en: 'x' },
      elements: [{ id: 'e1', symbol: 'box', x: 0, y: 0, bindings: [{ property: 'text', tag: 'T1', transform: { kind: 'linear' } }] }],
    } as never;
    const out = applyScreen(def, new Map<string, TagRead>([['T1', { value: 7, quality: 'Good' }]]));
    expect(out.get('e1')?.text).toBe('7');
  });
});
