// @idtp/sdk — SFC (Sequential Function Chart) KHAI BÁO (doc 09 §3, ISA-88 / NFPA 85). Plugin CUNG
// CẤP chuỗi dưới dạng DỮ LIỆU; SequenceEngine (@idtp/engines) chạy: permissive-gate mỗi bước, hành
// động ghi có audit, chuyển bước theo điều kiện tag + thời gian giữ, timeout → failed. Không hardcode
// logic bước trong code — chuỗi = dữ liệu, engine thông dịch. (ISequenceStep §6.7 = escape hatch nâng cao.)
import type { TagId } from './types';

export type SeqOp = 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne';
export type SeqRunStatus = 'idle' | 'running' | 'done' | 'failed' | 'aborted';

/** Điều kiện trên tag: getTag(tag) <op> value (bool coi như 0/1). */
export interface SeqCondition {
  readonly tag: TagId;
  readonly op: SeqOp;
  readonly value: number;
}

/** Hành động ghi khi VÀO bước (có reason → audit trail bắt buộc, luật cứng). */
export interface SeqAction {
  readonly tag: TagId;
  readonly value: number;
  readonly reason: string;
}

export interface SeqStepDef {
  readonly stepId: string;
  readonly title: { vi: string; en: string };
  readonly permissive: ReadonlyArray<SeqCondition>; // phải đúng HẾT mới được VÀO bước
  readonly actions: ReadonlyArray<SeqAction>; // ghi khi vào bước
  readonly transition: ReadonlyArray<SeqCondition>; // đúng HẾT (kèm holdMs) → bước done
  readonly holdMs: number; // thời gian giữ tối thiểu trong bước trước khi được done
  readonly timeoutMs: number; // quá hạn mà chưa done → failed (0 = không timeout)
}

export interface SequenceDef {
  readonly sequenceId: string;
  readonly title: { vi: string; en: string };
  readonly steps: ReadonlyArray<SeqStepDef>;
  readonly abortOnFail?: boolean; // true → failed chuyển 'aborted' (dừng cứng)
}

/** Trạng thái runtime của một lần chạy chuỗi. */
export interface SeqRunState {
  readonly status: SeqRunStatus;
  readonly stepIndex: number;
  readonly stepId: string | null;
  readonly message: string | null;
}
