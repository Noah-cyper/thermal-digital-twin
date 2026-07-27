import { describe, it, expect } from 'vitest';
import { applyElement, type ScreenElement, type TagRead } from '../src/graphics';

const drum: ScreenElement = {
  id: 'drum',
  symbol: 'Drum',
  x: 0,
  y: 0,
  bindings: [
    { property: 'text', tag: 'BLR_DRUM_LEVEL_01', transform: { kind: 'linear', scale: 1, offset: 0 } },
    { property: 'color', tag: 'BLR_DRUM_LEVEL_01', condition: { when: 'gt', value: 250, then: { color: 'var(--alarm-1)' } } },
    { property: 'color', tag: 'BLR_DRUM_LEVEL_01', condition: { when: 'bad', then: { color: 'var(--bad-quality)' } } },
  ],
};

function reads(value: number, quality: TagRead['quality'] = 'Good'): Map<string, TagRead> {
  return new Map([['BLR_DRUM_LEVEL_01', { value, quality }]]);
}

describe('Graphics binding', () => {
  it('transform linear → text', () => {
    expect(applyElement(drum, reads(123)).text).toBe('123');
  });

  it('condition gt: đổi màu khi vượt +250', () => {
    expect(applyElement(drum, reads(300)).color).toBe('var(--alarm-1)');
    expect(applyElement(drum, reads(100)).color).toBeUndefined();
  });

  it('condition bad: màu bad-quality', () => {
    expect(applyElement(drum, reads(0, 'Bad')).color).toBe('var(--bad-quality)');
  });
});
