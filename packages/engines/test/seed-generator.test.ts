import { describe, it, expect } from 'vitest';
import type { PlantSeedSpec } from '@idtp/sdk';
import { generateRegistry } from '../src/seed-generator';

// Spec tổng hợp (KHÔNG thermal) — chứng minh generator là GENERIC: expand template × instance đúng,
// kế thừa ref, UNS/name hợp lệ, alarm suy từ range, tất định, chống trùng khoá.
const spec: PlantSeedSpec = {
  enterprise: 'ent',
  site: 'site',
  idNamespace: 'test',
  templates: [
    {
      type: 'pump',
      tags: [
        { suffix: 'RUN', datatype: 'bool', scan: 'process' },
        { suffix: 'VIB', datatype: 'float', eu: 'mm/s', scan: 'fast', alarm: true },
        { suffix: 'TRIP', datatype: 'bool', scan: 'fast', alarm: true },
      ],
    },
    { type: 'bigpump', ref: 'pump', tags: [{ suffix: 'EXTRA', datatype: 'int', scan: 'slow' }] },
  ],
  instances: [
    { template: 'pump', area: 'a1', cell: 'c1', unit: 'u1', equip: 'p', count: 3, namePrefix: 'C1_P', kksSystem: 'ABC', descVi: 'Bơm', descEn: 'Pump' },
    { template: 'bigpump', area: 'a1', cell: 'c2', unit: 'u2', equip: 'bp', count: 2, namePrefix: 'C2_BP', kksSystem: 'DEF', descVi: 'Bơm lớn', descEn: 'Big pump' },
  ],
  alarmTemplates: [
    { suffix: 'VIB', condition: 'HH', priority: 'P2', setpointRule: 'rangeHi', onDelayMs: 1000, offDelayMs: 5000, consequenceVi: 'x', consequenceEn: 'x' },
    { suffix: 'TRIP', condition: 'DISCRETE', priority: 'P1', setpointRule: 'discreteTrue', onDelayMs: 100, offDelayMs: 1000, consequenceVi: 'y', consequenceEn: 'y' },
  ],
};

const UNS_RE = /^[a-z0-9-]+(\/[a-z0-9-]+){6}$/;
const NAME_RE = /^[A-Z0-9_]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SeedGenerator (doc 07 §5) — generic template × instance expander', () => {
  it('expand đúng số: pump 3×3 + bigpump 2×(3+1) = 17 tag; kế thừa ref', () => {
    const reg = generateRegistry(spec);
    expect(reg.tags.length).toBe(17);
    expect(reg.byCell['c1']).toBe(9);
    expect(reg.byCell['c2']).toBe(8);
    // bigpump kế thừa RUN/VIB/TRIP + EXTRA
    const bp01 = reg.tags.filter((t) => t.name.startsWith('C2_BP_01_')).map((t) => t.name);
    expect(bp01).toContain('C2_BP_01_RUN');
    expect(bp01).toContain('C2_BP_01_EXTRA');
  });

  it('UNS/name/UUID hợp lệ; writable=false → securityLevel 0', () => {
    const reg = generateRegistry(spec);
    for (const t of reg.tags) {
      expect(t.uns).toMatch(UNS_RE);
      expect(t.name).toMatch(NAME_RE);
      expect(t.id).toMatch(UUID_RE);
    }
    const run = reg.tags.find((t) => t.name === 'C1_P_01_RUN');
    expect(run?.uns).toBe('ent/site/a1/c1/u1/p-01/run');
    expect(run?.securityLevel).toBe(0);
  });

  it('alarm suy từ range: VIB HH = rangeHi(30); TRIP DISCRETE = 1; back-link vào tag.alarmIds', () => {
    const reg = generateRegistry(spec);
    // pump 3×(VIB+TRIP) + bigpump 2×(VIB+TRIP) = 10
    expect(reg.alarms.length).toBe(10);
    const vib = reg.alarms.find((a) => a.alarmId === 'C1_P_01_VIB-HH');
    expect(vib?.setpoint).toBe(30); // mm/s range [0,30] → rangeHi
    expect(vib?.priority).toBe('P2');
    const trip = reg.alarms.find((a) => a.alarmId === 'C1_P_01_TRIP-DISCRETE');
    expect(trip?.setpoint).toBe(1);
    const vibTag = reg.tags.find((t) => t.name === 'C1_P_01_VIB');
    expect(vibTag?.alarmIds).toContain('C1_P_01_VIB-HH');
  });

  it('tất định: hai lần expand → id giống hệt (không Math.random)', () => {
    const a = generateRegistry(spec);
    const b = generateRegistry(spec);
    expect(a.tags.map((t) => t.id)).toEqual(b.tags.map((t) => t.id));
  });

  it('ném lỗi khi trùng tag name (bất biến khoá duy nhất)', () => {
    const dup: PlantSeedSpec = {
      ...spec,
      instances: [
        { template: 'pump', area: 'a', cell: 'c', unit: 'u', equip: 'p', count: 1, namePrefix: 'DUP', kksSystem: 'ABC', descVi: '', descEn: '' },
        { template: 'pump', area: 'a', cell: 'c', unit: 'u', equip: 'p', count: 1, namePrefix: 'DUP', kksSystem: 'ABC', descVi: '', descEn: '' },
      ],
    };
    expect(() => generateRegistry(dup)).toThrow(/trùng tag name/);
  });
});
