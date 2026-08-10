// (6b) Driver field THẬT (deploy-only) cho field-io. Base app KHÔNG phụ thuộc cứng modbus-serial: import
// ĐỘNG qua specifier biến (tsc/esbuild không phân giải → không cần cài khi chạy demo). Chưa cài lib / sai
// endpoint / thiết bị không tới → trả undefined → adapter NGẮT KẾT NỐI (không bịa). Seam DI (FieldDriver)
// đã phủ bằng driver GIẢ trong field-link.test.ts; driver THẬT c8-ignored (chỉ chạy với thiết bị Modbus).
import type { FieldDriver, FieldIoConfig, WriteResult } from '@idtp/sdk';

/** Modbus holding-register: địa chỉ 4xxxx → offset 0 (40001→0); số thuần → dùng nguyên. -1 nếu không hợp lệ. */
export function modbusRegister(address: string): number {
  const n = Number(address);
  if (!Number.isFinite(n)) return -1;
  return n >= 40001 ? n - 40001 : n;
}

/* c8 ignore start */ // deploy-only: cần modbus-serial + thiết bị Modbus THẬT — không chạy trong test/demo.
export async function makeModbusTcpDriver(config: FieldIoConfig): Promise<FieldDriver | undefined> {
  const spec = 'modbus-serial';
  let ModbusRTU: new () => ModbusClient;
  try {
    const mod = (await import(spec)) as { default?: new () => ModbusClient } & (new () => ModbusClient);
    ModbusRTU = (mod.default ?? mod) as new () => ModbusClient;
  } catch {
    return undefined; // chưa cài driver → giữ ngắt kết nối
  }
  const m = /modbus:\/\/([^:/]+)(?::(\d+))?/.exec(config.endpoint ?? '');
  const host = m?.[1];
  if (!host) return undefined;
  const port = m[2] ? Number(m[2]) : 502;

  const client = new ModbusRTU();
  try {
    await client.connectTCP(host, { port });
  } catch {
    return undefined; // thiết bị không tới → ngắt kết nối
  }

  const snap = new Map<string, { value: number; ok: boolean }>();
  const addrs = config.points
    .map((p) => ({ address: p.address, reg: modbusRegister(p.address) }))
    .filter((a) => a.reg >= 0);
  let connected = true;

  const scan = async (): Promise<void> => {
    for (const a of addrs) {
      try {
        const r = await client.readHoldingRegisters(a.reg, 1);
        snap.set(a.address, { value: r.data[0] ?? 0, ok: true });
      } catch {
        const prev = snap.get(a.address);
        snap.set(a.address, { value: prev?.value ?? 0, ok: false });
      }
    }
  };
  await scan();
  const timer = setInterval(() => void scan(), config.pollMs ?? 1000);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    protocol: 'modbus-tcp',
    get connected(): boolean {
      return connected;
    },
    endpoint: config.endpoint,
    snapshot: () => snap,
    writeRaw: (address: string, value: number): WriteResult => {
      const reg = modbusRegister(address);
      if (reg < 0) return { ok: false, blockedReason: `Địa chỉ Modbus không hợp lệ: ${address}` };
      void client.writeRegister(reg, Math.round(value));
      return { ok: true };
    },
  };
}

interface ModbusClient {
  connectTCP(host: string, opts: { port: number }): Promise<void>;
  readHoldingRegisters(addr: number, len: number): Promise<{ data: number[] }>;
  writeRegister(addr: number, value: number): Promise<unknown>;
}
/* c8 ignore stop */
