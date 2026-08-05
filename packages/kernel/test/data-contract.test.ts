import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DataContract, InMemoryAdapter } from '../src/data-contract';

const ctx = { user: 'engineer', ip: '10.0.0.1' };
const schema = z.object({ name: z.string(), value: z.number() });

describe('InMemoryAdapter (kernel L1)', () => {
  it('put/get; get thiếu → undefined', () => {
    const a = new InMemoryAdapter();
    a.put('asset', 'A1', { x: 1 });
    expect(a.get('asset', 'A1')).toEqual({ x: 1 });
    expect(a.get('asset', 'missing')).toBeUndefined();
    expect(a.get('other', 'A1')).toBeUndefined();
  });
});

describe('DataContract (kernel L1) — schema Zod ở biên, 1 đường ghi', () => {
  it('validate: chưa đăng ký → lỗi; hợp lệ → ok; sai schema → danh sách lỗi', () => {
    const dc = new DataContract();
    expect(dc.validate('asset', {}).ok).toBe(false); // chưa đăng ký
    dc.register('asset', schema);
    const ok = dc.validate('asset', { name: 'pump', value: 3 });
    expect(ok.ok).toBe(true);
    const bad = dc.validate('asset', { name: 123 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('persist: validate → adapter.put → onWrite; đọc lại đúng', async () => {
    const writes: string[] = [];
    const dc = new DataContract(new InMemoryAdapter(), (e) => writes.push(`${e.entity}/${e.id}`));
    dc.register('asset', schema);
    await dc.persist('asset', 'P1', { name: 'pump', value: 5 }, ctx);
    expect(writes).toEqual(['asset/P1']);
    expect(await dc.read('asset', 'P1')).toEqual({ name: 'pump', value: 5 });
  });

  it('persist bản ghi sai schema → throw (không ghi DB)', async () => {
    const dc = new DataContract();
    dc.register('asset', schema);
    await expect(dc.persist('asset', 'P2', { name: 1 }, ctx)).rejects.toThrow(/validate fail/);
  });

  it('read id không tồn tại → undefined', async () => {
    const dc = new DataContract();
    expect(await dc.read('asset', 'nope')).toBeUndefined();
  });
});
