import { describe, it, expect } from 'vitest';
import type { ScreenBuildSpec } from '@idtp/sdk';
import { buildScreen } from '../src/screen-builder';

describe('buildScreen (doc 05-02, L5) — spec đơn giản → ScreenDef', () => {
  it('dàn lưới + sinh binding; value có fill bad; bar có transform; alarm → fill điều kiện', () => {
    const spec: ScreenBuildSpec = {
      screenId: 'D3-x',
      level: 'D3',
      title: { vi: 'X', en: 'X' },
      cols: 2,
      tiles: [
        { tag: 'A', label: 'a', unit: 'MW' },
        { tag: 'B', label: 'b', alarms: [{ when: 'gt', value: 5, sev: 2 }] },
        { tag: 'C', kind: 'bar', barScale: 2 },
      ],
    };
    const def = buildScreen(spec);
    expect(def.screenId).toBe('D3-x');
    expect(def.elements.length).toBe(3);
    // lưới 2 cột: t0 (24,24) · t1 (192,24) · t2 (24,124)
    expect({ x: def.elements[0]?.x, y: def.elements[0]?.y }).toEqual({ x: 24, y: 24 });
    expect({ x: def.elements[1]?.x, y: def.elements[1]?.y }).toEqual({ x: 192, y: 24 });
    expect({ x: def.elements[2]?.x, y: def.elements[2]?.y }).toEqual({ x: 24, y: 124 });
    // value: có binding text + fill(bad)
    expect(def.elements[0]?.symbol).toBe('value');
    expect(def.elements[0]?.bindings.some((b) => b.property === 'text')).toBe(true);
    expect(def.elements[0]?.bindings.some((b) => b.condition?.when === 'bad')).toBe(true);
    // alarm → fill điều kiện gt
    expect(def.elements[1]?.bindings.some((b) => b.property === 'fill' && b.condition?.when === 'gt')).toBe(true);
    // bar: symbol bar + transform scale
    expect(def.elements[2]?.symbol).toBe('bar');
    expect(def.elements[2]?.bindings[0]?.transform?.scale).toBe(2);
  });

  it('ném lỗi khi screenId rỗng hoặc không có tile', () => {
    expect(() => buildScreen({ screenId: '', level: 'D3', tiles: [{ tag: 'A' }] })).toThrow(/screenId/);
    expect(() => buildScreen({ screenId: 'x', level: 'D3', tiles: [] })).toThrow(/tile/);
  });
});
