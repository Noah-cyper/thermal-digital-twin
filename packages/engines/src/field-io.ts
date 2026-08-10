// L1 — Field I/O Bridge (doc 16/17). Hiện thực SEAM southbound: MẶC ĐỊNH ngắt kết nối (an toàn, không
// bịa dữ liệu); khi được TIÊM driver thật (OPC-UA/Modbus) → quy đổi scale/offset + quality (inbound) và
// gate/audit (outbound). Thuần logic (không import thư viện protocol) → browser-safe + DI-test-được.
import type {
  FieldDriver,
  FieldIoConfig,
  FieldIoStatus,
  FieldProtocol,
  FieldSample,
  IFieldIoAdapter,
  IWriteCommand,
  Iso8601,
  WriteResult,
} from '@idtp/sdk';

export interface FieldIoDeps {
  formatTs(ms: number): Iso8601;
  audit?(entry: { ts: Iso8601; user: string; action: string; target: string; reason: string }): void;
}

const DISCONNECTED_NOTICE = {
  vi: 'Field I/O: NGẮT KẾT NỐI — twin chạy bằng mô phỏng, chưa cắm thiết bị hiện trường thật.',
  en: 'Field I/O: DISCONNECTED — twin runs on simulation; no real field devices attached.',
} as const;

const CONNECTED_NOTICE = {
  vi: 'Field I/O: ĐANG KẾT NỐI thiết bị hiện trường (giá trị inbound là số ĐO THẬT).',
  en: 'Field I/O: CONNECTED to field devices (inbound values are REAL measurements).',
} as const;

/** MẶC ĐỊNH an toàn: không driver → không đọc/ghi field, KHÔNG bịa dữ liệu. */
export class DisconnectedFieldIoAdapter implements IFieldIoAdapter {
  constructor(
    private readonly protocol: FieldProtocol = 'none',
    private readonly reason = 'Field I/O chưa cấu hình (thiếu driver/endpoint).',
  ) {}

  status(): FieldIoStatus {
    return {
      protocol: this.protocol,
      mode: 'disconnected',
      connected: false,
      pointsIn: 0,
      pointsOut: 0,
      reads: 0,
      writes: 0,
      lastError: this.reason,
      notice: DISCONNECTED_NOTICE,
    };
  }

  poll(): ReadonlyArray<FieldSample> {
    return [];
  }

  write(_cmd: IWriteCommand): WriteResult {
    return { ok: false, blockedReason: this.reason };
  }
}

interface OutPoint {
  readonly address: string;
  readonly scale: number;
  readonly offset: number;
}

/** Có driver kết nối → cầu nối field↔tag: quy đổi + quality (inbound), gate + audit (outbound). */
export class FieldIoBridge implements IFieldIoAdapter {
  private readonly inPoints: ReadonlyArray<{ tagId: string; address: string; scale: number; offset: number }>;
  private readonly outByTag: ReadonlyMap<string, OutPoint>;
  private readonly inTags: ReadonlySet<string>;
  private reads = 0;
  private writes = 0;
  private lastNowMs = 0; // đồng hồ SIM ghi ở lần poll gần nhất (dùng cho audit ts — không Date.now)
  private lastError?: string;

  constructor(
    private readonly config: FieldIoConfig,
    private readonly driver: FieldDriver,
    private readonly deps: FieldIoDeps,
  ) {
    this.inPoints = config.points
      .filter((p) => p.direction === 'in')
      .map((p) => ({ tagId: p.tagId, address: p.address, scale: p.scale ?? 1, offset: p.offset ?? 0 }));
    const out = new Map<string, OutPoint>();
    for (const p of config.points) {
      if (p.direction === 'out') out.set(p.tagId, { address: p.address, scale: p.scale ?? 1, offset: p.offset ?? 0 });
    }
    this.outByTag = out;
    this.inTags = new Set(this.inPoints.map((p) => p.tagId));
  }

  status(): FieldIoStatus {
    return {
      protocol: this.driver.protocol,
      mode: this.driver.connected ? 'connected' : 'disconnected',
      connected: this.driver.connected,
      endpoint: this.driver.endpoint,
      pointsIn: this.inPoints.length,
      pointsOut: this.outByTag.size,
      reads: this.reads,
      writes: this.writes,
      lastError: this.lastError,
      notice: this.driver.connected ? CONNECTED_NOTICE : DISCONNECTED_NOTICE,
    };
  }

  poll(nowMs: number): ReadonlyArray<FieldSample> {
    if (!this.driver.connected) return [];
    this.lastNowMs = nowMs;
    const snap = this.driver.snapshot();
    const ts = this.deps.formatTs(nowMs);
    const out: FieldSample[] = [];
    for (const p of this.inPoints) {
      const raw = snap.get(p.address);
      if (raw === undefined) continue; // KHÔNG bịa: địa chỉ chưa có trong scan-buffer thì bỏ qua
      out.push({ tagId: p.tagId, value: raw.value * p.scale + p.offset, quality: raw.ok ? 'Good' : 'Bad', ts });
    }
    this.reads += out.length;
    return out;
  }

  write(cmd: IWriteCommand): WriteResult {
    if (!this.driver.connected) return { ok: false, blockedReason: 'Field I/O chưa kết nối.' };
    const point = this.outByTag.get(cmd.tagId);
    if (!point) {
      return {
        ok: false,
        blockedReason: this.inTags.has(cmd.tagId)
          ? `Điểm ${cmd.tagId} chỉ đọc (inbound) — không ghi được xuống field.`
          : `Tag ${cmd.tagId} không ánh xạ điểm field outbound.`,
      };
    }
    const numeric = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : cmd.value;
    const scale = point.scale === 0 ? 1 : point.scale;
    const raw = (numeric - point.offset) / scale;
    const res = this.driver.writeRaw(point.address, raw);
    if (!res.ok) {
      this.lastError = res.blockedReason;
      return res;
    }
    this.writes += 1;
    this.deps.audit?.({
      ts: this.deps.formatTs(this.lastNowMs),
      user: cmd.user,
      action: 'field-write',
      target: point.address,
      reason: `${cmd.tagId}=${cmd.value} → raw ${raw} (${cmd.reason})`,
    });
    return { ok: true };
  }
}

/**
 * Tạo adapter field I/O. Không config/protocol 'none'/không driver kết nối → DisconnectedFieldIoAdapter
 * (an toàn, không bịa). Có driver kết nối → FieldIoBridge. Runtime nối opt-in qua env (như persistence):
 * IDTP_FIELD_PROTOCOL / IDTP_FIELD_ENDPOINT + driver thật nạp khi có credential.
 */
export function createFieldIo(
  config: FieldIoConfig | undefined,
  driver: FieldDriver | undefined,
  deps: FieldIoDeps,
): IFieldIoAdapter {
  if (!config || config.protocol === 'none') return new DisconnectedFieldIoAdapter('none');
  if (!driver || !driver.connected) {
    return new DisconnectedFieldIoAdapter(config.protocol, `Driver ${config.protocol} chưa kết nối (thiếu endpoint/credential).`);
  }
  return new FieldIoBridge(config, driver, deps);
}
