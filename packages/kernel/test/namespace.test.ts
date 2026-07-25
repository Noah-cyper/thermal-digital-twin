import { describe, it, expect } from 'vitest';
import { Namespace, type NameMap } from '../src/namespace';

const drum: NameMap = {
  tagId: 'uuid-drum-1',
  kks: '10HAD10CL001',
  uns: 'hoantran/haiphong/unit1/boiler/steam-drum/lt-001/pv',
  sparkplug: 'BOILER/BLR_DRUM_LEVEL_01',
};

describe('Namespace', () => {
  it('parse UNS 7 segment', () => {
    const ns = new Namespace();
    const p = ns.parse(drum.uns);
    expect('error' in p).toBe(false);
    if (!('error' in p)) {
      expect(p.cell).toBe('boiler');
      expect(p.equipment).toBe('lt-001');
      expect(p.signal).toBe('pv');
    }
  });

  it('loại UNS sai (≠ 7 segment)', () => {
    const ns = new Namespace();
    expect('error' in ns.parse('a/b/c')).toBe(true);
  });

  it('resolve 3 chiều', () => {
    const ns = new Namespace();
    ns.register(drum, 'thermal-power-600');
    expect(ns.resolve({ uns: drum.uns })).toBe('uuid-drum-1');
    expect(ns.resolve({ kks: drum.kks })).toBe('uuid-drum-1');
    expect(ns.resolve({ sparkplug: drum.sparkplug })).toBe('uuid-drum-1');
    expect(ns.toSparkplug('uuid-drum-1')).toBe(drum.sparkplug);
  });

  it('loại trùng UNS chéo plugin (cách ly L-P5)', () => {
    const ns = new Namespace();
    ns.register(drum, 'thermal-power-600');
    const r = ns.register({ ...drum, tagId: 'uuid-x' }, 'water-treatment-demo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/plugin khác/);
  });
});
