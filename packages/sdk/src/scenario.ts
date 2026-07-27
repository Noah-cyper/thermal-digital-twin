// @idtp/sdk — KỊCH BẢN vận hành KHAI BÁO (doc 22, nghiệm thu §10: cold-start→…→coast-down). Plugin
// CUNG CẤP kịch bản dưới dạng DỮ LIỆU (chuỗi pha: chạy SFC · đặt tải · tiêm malfunction · settle);
// ScenarioRunner (@idtp/engines) ráp SFC + malfunction + CCS đã có để diễn kịch bản end-to-end.
import type { TagId } from './types';

export type ScenarioActionKind =
  | 'sequence' // chạy một SFC tới done (ref = sequenceId)
  | 'load' // đặt lệnh tải MW (value)
  | 'malfunction' // tiêm malfunction (ref = id)
  | 'clear' // xoá malfunction (ref = id)
  | 'set' // ghi thẳng một tag (ref = tagId, value)
  | 'settle'; // chỉ chạy sim để ổn định

export interface ScenarioPhase {
  readonly phaseId: string;
  readonly title: { vi: string; en: string };
  readonly action: ScenarioActionKind;
  readonly ref?: string; // sequenceId | malfunctionId | tagId
  readonly value?: number; // MW / giá trị set
  readonly settleSteps: number; // số bước sim chạy sau hành động
}

export interface ScenarioDef {
  readonly scenarioId: string;
  readonly title: { vi: string; en: string };
  readonly sampleTags: ReadonlyArray<TagId>; // tag chụp cuối mỗi pha (để dựng quỹ đạo)
  readonly phases: ReadonlyArray<ScenarioPhase>;
}

export interface ScenarioPhaseResult {
  readonly phaseId: string;
  readonly status: 'ok' | 'fail';
  readonly note: string;
  readonly tags: Readonly<Record<string, number>>;
}
