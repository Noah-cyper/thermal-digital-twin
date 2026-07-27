// @idtp/sdk — ma trận CAUSE & EFFECT KHAI BÁO (doc 09 §4, NFPA 85 MFT / turbine trip). Plugin CUNG
// CẤP ma trận dưới dạng DỮ LIỆU (nguyên nhân = điều kiện tag · hệ quả = lệnh trip · ô = liên kết);
// CauseEffectEngine (@idtp/engines) đánh giá + CHỐT (latch) trip + ghi hệ quả có audit. Không hardcode
// logic bảo vệ trong code — ma trận = dữ liệu, engine thông dịch.
import type { TagId } from './types';

export type CeOp = 'gt' | 'lt' | 'ge' | 'le';

/** Nguyên nhân: điều kiện trên tag (vd drum level < −250 mm). */
export interface CeCause {
  readonly id: string;
  readonly tag: TagId;
  readonly op: CeOp;
  readonly value: number;
  readonly title: { vi: string; en: string };
}

/** Hệ quả: lệnh trip ghi ra tag (vd BLR_MFT_TRIP = 1). */
export interface CeEffect {
  readonly id: string;
  readonly tag: TagId;
  readonly value: number;
  readonly title: { vi: string; en: string };
}

/** Ô ma trận thưa: nguyên nhân `cause` kích hoạt hệ quả `effect`. */
export interface CeCell {
  readonly cause: string;
  readonly effect: string;
}

export interface CauseEffectMatrix {
  readonly matrixId: string;
  readonly title: { vi: string; en: string };
  readonly causes: ReadonlyArray<CeCause>;
  readonly effects: ReadonlyArray<CeEffect>;
  readonly cells: ReadonlyArray<CeCell>;
}

export interface CeState {
  readonly activeCauses: ReadonlyArray<string>;
  readonly trippedEffects: ReadonlyArray<string>; // đã CHỐT (latched) tới khi reset
}
