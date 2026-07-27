import { describe, it, expect } from 'vitest';
import type { PlantSeedSpec } from '@idtp/sdk';
import { generateRegistry } from '../src/seed-generator';
import { generateControlLoops } from '../src/loop-generator';

const spec: PlantSeedSpec = {
  enterprise: 'e',
  site: 's',
  idNamespace: 'x',
  templates: [
    {
      type: 'loop',
      tags: [
        { suffix: 'PV', datatype: 'float', eu: 'MPa', scan: 'process' },
        { suffix: 'OP', datatype: 'float', eu: '%', scan: 'process', writable: true },
      ],
    },
    { type: 'xmtr', tags: [{ suffix: 'PV', datatype: 'float', scan: 'process' }] }, // chỉ PV → KHÔNG là loop
  ],
  instances: [
    { template: 'loop', area: 'a', cell: 'c', unit: 'u', equip: 'l', count: 2, namePrefix: 'C_L', kksSystem: 'ABC', descVi: 'Vòng', descEn: 'Loop' },
    { template: 'xmtr', area: 'a', cell: 'c', unit: 'u', equip: 'x', count: 5, namePrefix: 'C_X', kksSystem: 'DEF', descVi: 'Đo', descEn: 'Xmtr' },
  ],
  alarmTemplates: [],
};

describe('LoopGenerator (doc 09) — generic: loop = instance có cả _PV và _OP', () => {
  it('chỉ sinh loop cho instance có PV+OP; SP = trung điểm dải PV; outTag = OP', () => {
    const reg = generateRegistry(spec);
    const loops = generateControlLoops(reg);
    expect(loops.length).toBe(2); // 2 loop; 5 transmitter bị loại
    const l1 = loops.find((l) => l.id === 'C_L_01');
    expect(l1?.pvTag).toBe('C_L_01_PV');
    expect(l1?.outTag).toBe('C_L_01_OP');
    expect(l1?.sp).toBe(12.5); // MPa range [0,25] → trung điểm
    expect(l1?.mode).toBe('MAN');
    expect(l1?.outLo).toBe(0);
    expect(l1?.outHi).toBe(100);
  });
});
