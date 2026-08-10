import { describe, it, expect } from 'vitest';
import type { FieldDriver, FieldIoConfig, IWriteCommand, WriteResult } from '@idtp/sdk';
import { DisconnectedFieldIoAdapter, FieldIoBridge, createFieldIo, type FieldIoDeps } from '../src/field-io';

const deps: FieldIoDeps = { formatTs: (ms) => new Date(ms).toISOString() };

/** Driver giả (in-memory) đứng thay thư viện OPC-UA/Modbus thật — DI-test cho bridge. */
class FakeDriver implements FieldDriver {
  readonly protocol = 'modbus-tcp' as const;
  connected = true;
  readonly endpoint = 'modbus://test:502';
  readonly raw = new Map<string, { value: number; ok: boolean }>();
  readonly written: Array<{ address: string; value: number }> = [];
  private failWrite = false;
  snapshot(): ReadonlyMap<string, { value: number; ok: boolean }> {
    return this.raw;
  }
  writeRaw(address: string, value: number): WriteResult {
    if (this.failWrite) return { ok: false, blockedReason: 'driver từ chối' };
    this.written.push({ address, value });
    return { ok: true };
  }
  setFailWrite(v: boolean): void {
    this.failWrite = v;
  }
}

const cfg: FieldIoConfig = {
  protocol: 'modbus-tcp',
  endpoint: 'modbus://test:502',
  points: [
    { tagId: 'BLR_DRUM_LVL_01', address: '40001', direction: 'in', scale: 0.1, offset: 5 },
    { tagId: 'BLR_FD_DAMPER_01', address: '40010', direction: 'out', scale: 0.1, offset: 0 },
  ],
};

const wc = (over: Partial<IWriteCommand>): IWriteCommand => ({ tagId: 'x', value: 0, user: 'op', reason: 'test', ...over });

describe('DisconnectedFieldIoAdapter — mặc định an toàn', () => {
  it('không đọc/ghi, không bịa dữ liệu', () => {
    const a = new DisconnectedFieldIoAdapter('none');
    const s = a.status();
    expect(s.connected).toBe(false);
    expect(s.mode).toBe('disconnected');
    expect(a.poll(1000)).toEqual([]);
    const w = a.write(wc({ tagId: 'BLR_FD_DAMPER_01', value: 50 }));
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.blockedReason).toMatch(/chưa cấu hình/);
  });
});

describe('createFieldIo — chọn adapter', () => {
  it("protocol 'none' → disconnected", () => {
    expect(createFieldIo({ protocol: 'none', points: [] }, undefined, deps).status().connected).toBe(false);
  });
  it('có config nhưng không driver → disconnected (không kết nối)', () => {
    const a = createFieldIo(cfg, undefined, deps);
    expect(a.status().connected).toBe(false);
    expect(a.status().lastError).toMatch(/chưa kết nối/);
  });
  it('driver ngắt kết nối → disconnected', () => {
    const d = new FakeDriver();
    d.connected = false;
    expect(createFieldIo(cfg, d, deps).status().connected).toBe(false);
  });
  it('driver kết nối → bridge', () => {
    expect(createFieldIo(cfg, new FakeDriver(), deps)).toBeInstanceOf(FieldIoBridge);
  });
});

describe('FieldIoBridge — inbound (poll)', () => {
  it('quy đổi scale/offset + quality Good', () => {
    const d = new FakeDriver();
    d.raw.set('40001', { value: 100, ok: true }); // 100×0,1 + 5 = 15
    const b = new FieldIoBridge(cfg, d, deps);
    const s = b.poll(1000);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ tagId: 'BLR_DRUM_LVL_01', value: 15, quality: 'Good' });
    expect(b.status().reads).toBe(1);
  });
  it('raw ok=false → quality Bad (không bỏ giá trị)', () => {
    const d = new FakeDriver();
    d.raw.set('40001', { value: 80, ok: false });
    const s = new FieldIoBridge(cfg, d, deps).poll(2000);
    expect(s[0].quality).toBe('Bad');
    expect(s[0].value).toBe(13); // 80×0,1 + 5
  });
  it('địa chỉ chưa có trong scan-buffer → KHÔNG bịa mẫu', () => {
    const b = new FieldIoBridge(cfg, new FakeDriver(), deps); // raw rỗng
    expect(b.poll(3000)).toEqual([]);
  });
  it('driver mất kết nối → poll rỗng', () => {
    const d = new FakeDriver();
    d.raw.set('40001', { value: 100, ok: true });
    d.connected = false;
    expect(new FieldIoBridge(cfg, d, deps).poll(4000)).toEqual([]);
  });
});

describe('FieldIoBridge — outbound (write, gated + audit)', () => {
  it('điểm out: quy đổi ngược + audit', () => {
    const d = new FakeDriver();
    const audits: string[] = [];
    const b = new FieldIoBridge(cfg, d, { ...deps, audit: (e) => audits.push(e.action) });
    b.poll(5000); // đặt lastNowMs cho audit ts
    const w = b.write(wc({ tagId: 'BLR_FD_DAMPER_01', value: 20 })); // (20−0)/0,1 = 200
    expect(w.ok).toBe(true);
    expect(d.written).toEqual([{ address: '40010', value: 200 }]);
    expect(audits).toEqual(['field-write']);
    expect(b.status().writes).toBe(1);
  });
  it('boolean → 0/1', () => {
    const d = new FakeDriver();
    const cfgBool: FieldIoConfig = { protocol: 'modbus-tcp', points: [{ tagId: 'PUMP_CMD', address: '00001', direction: 'out' }] };
    new FieldIoBridge(cfgBool, d, deps).write(wc({ tagId: 'PUMP_CMD', value: true }));
    expect(d.written).toEqual([{ address: '00001', value: 1 }]);
  });
  it('tag chỉ inbound → chặn', () => {
    const w = new FieldIoBridge(cfg, new FakeDriver(), deps).write(wc({ tagId: 'BLR_DRUM_LVL_01', value: 9 }));
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.blockedReason).toMatch(/chỉ đọc/);
  });
  it('tag không ánh xạ → chặn', () => {
    const w = new FieldIoBridge(cfg, new FakeDriver(), deps).write(wc({ tagId: 'UNKNOWN', value: 1 }));
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.blockedReason).toMatch(/không ánh xạ/);
  });
  it('driver từ chối ghi → truyền lý do, không tăng writes', () => {
    const d = new FakeDriver();
    d.setFailWrite(true);
    const b = new FieldIoBridge(cfg, d, deps);
    const w = b.write(wc({ tagId: 'BLR_FD_DAMPER_01', value: 20 }));
    expect(w.ok).toBe(false);
    expect(b.status().writes).toBe(0);
  });
});

describe('tất định', () => {
  it('cùng snapshot → cùng kết quả poll', () => {
    const mk = (): FieldIoBridge => {
      const d = new FakeDriver();
      d.raw.set('40001', { value: 123, ok: true });
      return new FieldIoBridge(cfg, d, deps);
    };
    expect(mk().poll(7000)).toEqual(mk().poll(7000));
  });
});
