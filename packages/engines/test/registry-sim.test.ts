import { describe, it, expect } from 'vitest';
import type { ISimModelContext, TagDatatype, TagRecord } from '@idtp/sdk';
import { RegistrySimModel } from '../src/registry-sim';

function rec(name: string, datatype: TagDatatype, lo: number, hi: number): TagRecord {
  return {
    id: name, kks: 'K', uns: 'a/b/c/d/e/f/g', name, descVi: '', descEn: '', datatype, eu: '',
    rangeLo: lo, rangeHi: hi, deadband: 0, scanClass: 'process', source: 'opcua', assetId: 'A',
    alarmIds: [], retentionClass: 'standard', securityLevel: 0, isWritable: false, simModelRef: '',
  };
}
const ctx: ISimModelContext = { dtMs: 100, getTag: () => 0, now: () => '2026-07-24T10:00:00+07:00' };

describe('RegistrySimModel (doc 05-05) — breadth "sống", placeholder có seed', () => {
  it('float ~40% dải + nhiễu; bool = 0 (bình thường)', () => {
    const m = new RegistrySimModel([rec('F1', 'float', 0, 100), rec('B1', 'bool', 0, 1)], 1);
    m.init();
    const r = m.step(ctx);
    const f1 = r.outputs.find((o) => o.tagId === 'F1')?.value ?? NaN;
    expect(f1).toBeGreaterThan(37);
    expect(f1).toBeLessThan(43);
    expect(r.outputs.find((o) => o.tagId === 'B1')?.value).toBe(0);
  });

  it('stride: chỉ phát mỗi N bước (nhẹ ingest)', () => {
    const m = new RegistrySimModel([rec('F1', 'float', 0, 100)], 3);
    m.init();
    expect(m.step(ctx).outputs.length).toBe(1); // tick 0
    expect(m.step(ctx).outputs.length).toBe(0); // tick 1
    expect(m.step(ctx).outputs.length).toBe(0); // tick 2
    expect(m.step(ctx).outputs.length).toBe(1); // tick 3
  });

  it('tất định: cùng seed → cùng chuỗi (không Math.random)', () => {
    const a = new RegistrySimModel([rec('F1', 'float', 0, 100)], 1); a.init();
    const b = new RegistrySimModel([rec('F1', 'float', 0, 100)], 1); b.init();
    expect(a.step(ctx).outputs[0]?.value).toBe(b.step(ctx).outputs[0]?.value);
  });
});
