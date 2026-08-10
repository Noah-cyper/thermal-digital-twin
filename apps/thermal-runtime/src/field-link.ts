// (6) Lớp DEPLOY southbound — chạy field I/O adapter trong runtime, BẬT bằng env. Base app KHÔNG phụ
// thuộc cứng thư viện protocol (node-opcua/modbus-serial): DRIVER THẬT được TIÊM ở deploy qua deps.makeDriver
// (kèm endpoint/credential của người dùng). Không driver → NGẮT KẾT NỐI → base run 0 hồi quy. Seam DI đã
// phủ bằng driver GIẢ trong field-link.test.ts. Inbound (field→tag) thu về stream RIÊNG (không ghi đè sim).
import { createFieldIo } from '@idtp/engines';
import type { FieldDriver, FieldIoConfig, FieldIoStatus, FieldSample, IFieldIoAdapter, Iso8601 } from '@idtp/sdk';

export interface FieldLinkDeps {
  now?(): number; // đồng hồ (mặc định Date.now — đây là glue nền, không phải vòng sim tất định)
  formatTs?(ms: number): Iso8601;
  audit?(e: { ts: Iso8601; user: string; action: string; target: string; reason: string }): void;
  /** Nhà máy driver THẬT — tiêm ở deploy (nạp node-opcua/modbus-serial + endpoint/credential). */
  makeDriver?(config: FieldIoConfig): Promise<FieldDriver | undefined>;
}

export interface FieldLink {
  status(): FieldIoStatus;
  /** Mẫu inbound mới nhất (field→tag). Rỗng khi ngắt kết nối. Stream RIÊNG — không ghi đè tag sim. */
  samples(): ReadonlyArray<FieldSample>;
  stop(): Promise<void>;
}

/** Bật field link opt-in. Không makeDriver / protocol 'none' → adapter ngắt kết nối (poll rỗng). */
export async function startFieldLink(config: FieldIoConfig, deps: FieldLinkDeps = {}): Promise<FieldLink> {
  const now = deps.now ?? (() => Date.now());
  const formatTs = deps.formatTs ?? ((ms) => new Date(ms).toISOString());
  const driver = config.protocol === 'none' || !deps.makeDriver ? undefined : await deps.makeDriver(config);
  const adapter: IFieldIoAdapter = createFieldIo(config, driver, { formatTs, audit: deps.audit });

  let latest: ReadonlyArray<FieldSample> = adapter.poll(now());
  const timer = setInterval(() => {
    latest = adapter.poll(now());
  }, config.pollMs ?? 1000);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    status: () => adapter.status(),
    samples: () => latest,
    stop: async () => {
      clearInterval(timer);
    },
  };
}
