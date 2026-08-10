import { describe, it, expect } from 'vitest';
import type { FieldDriver, FieldIoConfig, WriteResult } from '@idtp/sdk';
import { startFieldLink } from '../src/field-link';

class FakeDriver implements FieldDriver {
  readonly protocol = 'modbus-tcp' as const;
  connected = true;
  readonly endpoint = 'modbus://test:502';
  readonly raw = new Map<string, { value: number; ok: boolean }>();
  snapshot(): ReadonlyMap<string, { value: number; ok: boolean }> {
    return this.raw;
  }
  writeRaw(): WriteResult {
    return { ok: true };
  }
}

const cfg: FieldIoConfig = {
  protocol: 'modbus-tcp',
  endpoint: 'modbus://test:502',
  pollMs: 10,
  points: [{ tagId: 'BLR_DRUM_LVL_01', address: '40001', direction: 'in', scale: 0.1, offset: 5 }],
};

describe('startFieldLink', () => {
  it('không makeDriver → ngắt kết nối, samples rỗng', async () => {
    const link = await startFieldLink(cfg, { now: () => 1000 });
    expect(link.status().connected).toBe(false);
    expect(link.samples()).toEqual([]);
    await link.stop();
  });

  it("protocol 'none' → ngắt kết nối kể cả có makeDriver", async () => {
    const link = await startFieldLink(
      { protocol: 'none', points: [] },
      { makeDriver: async () => new FakeDriver() },
    );
    expect(link.status().connected).toBe(false);
    await link.stop();
  });

  it('có driver kết nối → thu mẫu inbound (stream riêng)', async () => {
    const d = new FakeDriver();
    d.raw.set('40001', { value: 100, ok: true }); // 100×0,1 + 5 = 15
    const link = await startFieldLink(cfg, { now: () => 2000, makeDriver: async () => d });
    const s = link.samples();
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ tagId: 'BLR_DRUM_LVL_01', value: 15, quality: 'Good' });
    expect(link.status().connected).toBe(true);
    await link.stop();
  });

  it('stop() dừng polling (không lỗi khi gọi 2 lần)', async () => {
    const link = await startFieldLink(cfg, { now: () => 3000, makeDriver: async () => new FakeDriver() });
    await link.stop();
    await link.stop();
    expect(link.status().protocol).toBe('modbus-tcp');
  });
});
