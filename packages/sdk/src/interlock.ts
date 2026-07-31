// @idtp/sdk — INTERLOCK / PERMISSIVE KHAI BÁO (doc 09 điều khiển, W6 DoD: "interlock/permissive là
// first-class object; lệnh bị chặn HIỆN LÝ DO"). Plugin CUNG CẤP luật interlock dưới dạng DỮ LIỆU
// (điều kiện tag ↔ mục tiêu lệnh); InterlockEngine (@idtp/engines) đánh giá trước khi cho phép lệnh ra
// thiết bị. Không hardcode logic khoá trong code — luật = dữ liệu, engine thông dịch, READ-ONLY.
import type { TagId } from './types';

export type InterlockOp = 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne';

/** Điều kiện trên một tag (vd BLR_MFT_TRIP > 0). */
export interface InterlockCondition {
  readonly tag: TagId;
  readonly op: InterlockOp;
  readonly value: number;
}

/**
 * Luật interlock/permissive: khi TẤT CẢ điều kiện `when` đúng → interlock ĐANG HOẠT ĐỘNG → chặn lệnh
 * có `target` tương ứng, kèm `message` là lý do hiện cho operator. `target` là định danh lệnh/loop/thiết
 * bị (vd 'load', 'turbine-roll', loopId 'drum-level', assetId faceplate). Ở điểm vận hành bình thường
 * mọi interlock BẤT HOẠT (không chặn nhầm).
 */
export interface InterlockRule {
  readonly id: string;
  readonly target: string;
  readonly when: ReadonlyArray<InterlockCondition>;
  readonly message: { vi: string; en: string };
}

/** Kết quả kiểm tra interlock cho một target. */
export interface InterlockCheck {
  readonly blocked: boolean;
  readonly reasons: ReadonlyArray<string>;
  readonly ids: ReadonlyArray<string>;
}
