// @idtp/sdk — Lớp FIELD I/O SOUTHBOUND (doc 16/17 — kết nối thiết bị hiện trường). Kiến trúc SEAM giống
// cognitive/persistence: khai báo ÁNH XẠ địa chỉ field ↔ tag; adapter MẶC ĐỊNH NGẮT KẾT NỐI, TUYỆT ĐỐI
// không bịa dữ liệu. Chỉ khi có DRIVER thật (OPC-UA/Modbus) + endpoint/credential của người dùng mới nối.
//
// Hướng chính = INBOUND (field → tag, chỉ đọc). OUTBOUND (tag → field) là mức OPERATOR/SCADA: PHẢI gated
// (điểm khai báo direction 'out') + audit — KHÔNG phải AI (AI vẫn read-only tuyệt đối). Bridge KHÔNG tự
// nối mạng: driver duy trì scan-buffer (snapshot) theo lịch riêng → tách để DI-test-được, không ép phụ thuộc.
import type { TagId, Quality, IWriteCommand, WriteResult, Iso8601 } from './types';

export type FieldProtocol = 'opcua' | 'modbus-tcp' | 'modbus-rtu' | 'none';
export type FieldDirection = 'in' | 'out'; // in: field→tag (đọc) · out: tag→field (ghi, gated)
export type FieldIoMode = 'disconnected' | 'connected';

/** Ánh xạ MỘT điểm field ↔ tag IDTP. Quy đổi: tag_value = raw × scale + offset. */
export interface FieldPoint {
  readonly tagId: TagId;
  readonly address: string; // OPC node id / Modbus register (vd "ns=2;s=BLR.DRUM.LVL", "40001")
  readonly direction: FieldDirection;
  readonly scale?: number; // mặc định 1
  readonly offset?: number; // mặc định 0
  readonly label?: { vi: string; en: string };
}

export interface FieldIoConfig {
  readonly protocol: FieldProtocol;
  readonly endpoint?: string; // vd "opc.tcp://host:4840" / "modbus://host:502"
  readonly points: ReadonlyArray<FieldPoint>;
  readonly pollMs?: number; // chu kỳ quét driver (mặc định 1000) — [GIẢ ĐỊNH]
}

/** Mẫu đọc từ field (inbound) đã quy đổi về tag. */
export interface FieldSample {
  readonly tagId: TagId;
  readonly value: number;
  readonly quality: Quality;
  readonly ts: Iso8601;
}

export interface FieldIoStatus {
  readonly protocol: FieldProtocol;
  readonly mode: FieldIoMode;
  readonly connected: boolean;
  readonly endpoint?: string;
  readonly pointsIn: number;
  readonly pointsOut: number;
  readonly reads: number; // tổng mẫu đã đọc
  readonly writes: number; // tổng lệnh ghi đã chấp nhận
  readonly lastError?: string;
  /** Nhãn TRUNG THỰC cho HMI (vd "Field I/O: NGẮT KẾT NỐI — chạy bằng mô phỏng"). */
  readonly notice: { vi: string; en: string };
}

/**
 * DRIVER field cấp thấp — do thư viện protocol THẬT hiện thực (OPC-UA/Modbus). Bridge KHÔNG tự nối mạng;
 * driver duy trì scan-buffer (snapshot) cập nhật nền theo lịch riêng. Tách ra để DI-test-được và KHÔNG
 * ép @idtp phụ thuộc bất kỳ thư viện protocol nào (nạp khi có env/credential — như persistence 'pg'/'mqtt').
 */
export interface FieldDriver {
  readonly protocol: FieldProtocol;
  readonly connected: boolean;
  readonly endpoint?: string;
  /** Ảnh chụp giá trị RAW hiện tại theo address (driver cập nhật nền). */
  snapshot(): ReadonlyMap<string, { readonly value: number; readonly ok: boolean }>;
  /** Ghi RAW xuống field (đồng bộ chấp nhận; hiện thực thật có thể xếp hàng async nội bộ). */
  writeRaw(address: string, value: number): WriteResult;
}

/**
 * ADAPTER field I/O. MẶC ĐỊNH = DisconnectedFieldIoAdapter (poll rỗng, write bị chặn, KHÔNG bịa dữ liệu).
 * Khi có driver kết nối → FieldIoBridge quy đổi scale/quality (inbound) + gate/audit (outbound).
 */
export interface IFieldIoAdapter {
  status(): FieldIoStatus;
  /** Đọc mẫu inbound mới nhất (KHÔNG chặn). Rỗng khi ngắt kết nối. */
  poll(nowMs: number): ReadonlyArray<FieldSample>;
  /** Ghi outbound (gated: điểm phải direction 'out'); trả lý do nếu bị chặn — không throw im lặng. */
  write(cmd: IWriteCommand): WriteResult;
}
