import { describe, it, expect } from 'vitest';
import type { InstanceGroup, PlantSeedSpec } from '@idtp/sdk';
import { generateRegistry } from '../src/seed-generator';
import { generateScreens } from '../src/screen-generator';

const spec: PlantSeedSpec = {
  enterprise: 'e',
  site: 's',
  idNamespace: 'x',
  templates: [
    {
      type: 'pump',
      tags: [
        { suffix: 'RUN', datatype: 'bool', scan: 'process' },
        { suffix: 'CURRENT', datatype: 'float', eu: 'A', scan: 'process', alarm: true },
      ],
    },
    { type: 'xmtr', tags: [{ suffix: 'PV', datatype: 'float', scan: 'process', alarm: true }] },
  ],
  instances: [
    { template: 'pump', area: 'a', cell: 'c1', unit: 'u', equip: 'p', count: 3, namePrefix: 'C1_P', kksSystem: 'ABC', descVi: 'Bơm', descEn: 'Pump' },
    { template: 'xmtr', area: 'a', cell: 'c2', unit: 'u', equip: 'x', count: 2, namePrefix: 'C2_X', kksSystem: 'DEF', descVi: 'Đo', descEn: 'Xmtr' },
  ],
  alarmTemplates: [{ suffix: 'CURRENT', condition: 'HH', priority: 'P2', setpointRule: 'rangeHi', onDelayMs: 1, offDelayMs: 1, consequenceVi: '', consequenceEn: '' }],
};

describe('ScreenGenerator (doc 12) — generic: D3/nhóm + D2/D4/cell', () => {
  it('mỗi nhóm → D3; mỗi cell → D2 + D4; screenId duy nhất; tag hợp lệ', () => {
    const reg = generateRegistry(spec);
    const screens = generateScreens(reg, spec.instances);
    // 2 nhóm → 2 D3; 2 cell → 2 D2 + 2 D4 = 6 màn hình
    expect(screens.length).toBe(6);
    expect(screens.filter((s) => s.level === 'D3').length).toBe(2);
    expect(screens.filter((s) => s.level === 'D2').length).toBe(2);
    expect(screens.filter((s) => s.level === 'D4').length).toBe(2);
    const d3 = screens.find((s) => s.screenId === 'D3-c1-p');
    expect(d3?.elements.length).toBe(3); // 3 instance bơm
    // tag trong binding tồn tại trong registry
    const names = new Set(reg.tags.map((t) => t.name));
    for (const s of screens) for (const el of s.elements) for (const b of el.bindings) expect(names.has(b.tag)).toBe(true);
    // screenId duy nhất
    expect(new Set(screens.map((s) => s.screenId)).size).toBe(screens.length);
  });

  it('ném lỗi khi trùng namePrefix (trùng screenId D3)', () => {
    const g: InstanceGroup = { template: 'xmtr', area: 'a', cell: 'c9', unit: 'u', equip: 'x', count: 1, namePrefix: 'C2_X', kksSystem: 'DEF', descVi: '', descEn: '' };
    const reg = generateRegistry(spec);
    expect(() => generateScreens(reg, [...spec.instances, g])).toThrow(/trùng screenId/);
  });
});
