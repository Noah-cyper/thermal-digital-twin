// @idtp/sdk — shared kernel types (doc 04 §6.3, doc 03 §5).
// Khoá tham chiếu duy nhất = tag id (UUID/số); KKS/UNS/Sparkplug là attribute.

export type TagId = string;
/** UTC + offset, vd "2026-07-24T10:00:00+07:00" */
export type Iso8601 = string;
export type Quality = 'Good' | 'Uncertain' | 'Bad' | 'Substituted';
export type LoopMode = 'MAN' | 'AUTO' | 'CASCADE';

export interface EngineeringUnit {
  readonly symbol: string;
}

export interface TagValue {
  tagId: TagId;
  value: number | boolean | string;
  quality: Quality;
  ts: Iso8601;
}

export interface IWriteCommand {
  tagId: TagId;
  value: number | boolean;
  user: string;
  reason: string;
}

/** Lệnh ghi trả kết quả có lý do bị chặn (không throw im lặng) — doc 03 §5. */
export type WriteResult = { ok: true } | { ok: false; blockedReason: string };

/**
 * Khai báo một control loop (doc 09 §1) — plugin CUNG CẤP dưới dạng dữ liệu, Control Engine
 * (@idtp/engines) CHẠY bằng PidController. Nhờ khai báo, thêm plugin mới không phải sửa engine.
 *  - sp cố định HOẶC spTag (cascade: SP lấy từ tag khác × spScale)
 *  - ff: feedforward = ffTag × ffGain (đưa vào PidController để bù nhiễu tải)
 *  - out: OP ghi ra outTag
 */
export interface ControlLoopDef {
  readonly id: string;
  readonly desc?: string;
  readonly pvTag: TagId;
  readonly sp?: number;
  readonly spTag?: TagId;
  readonly spScale?: number; // mặc định 1
  readonly kp: number;
  readonly ki: number;
  readonly kd: number;
  readonly outLo: number;
  readonly outHi: number;
  readonly mode?: LoopMode; // mặc định AUTO
  readonly ffTag?: TagId;
  readonly ffGain?: number; // mặc định 1
  readonly outTag: TagId;
  /** reverse-acting: tăng OP làm GIẢM PV (vd furnace draft, SH temp spray). Mặc định false. */
  readonly reverse?: boolean;
}
