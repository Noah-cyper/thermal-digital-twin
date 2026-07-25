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
