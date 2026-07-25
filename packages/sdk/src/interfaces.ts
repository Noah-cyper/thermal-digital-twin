// @idtp/sdk — 8 extension point (doc 03 §6). Chữ ký đầy đủ; implementation ở plugin.
import type {
  TagId,
  Iso8601,
  Quality,
  LoopMode,
  EngineeringUnit,
  TagValue,
  IWriteCommand,
  WriteResult,
} from './types';

/* ── 6.1 ISimModel (L2 Simulation) ─────────────────────────────── */
export interface ISimModelContext {
  readonly dtMs: number; // solver step = 100 ms
  getTag(tagId: TagId): number;
  now(): Iso8601; // từ Time Service (không dùng Date.now)
}
export interface ISimStepResult {
  outputs: ReadonlyArray<{ tagId: TagId; value: number; quality: Quality }>;
}
export interface ISimSnapshot {
  readonly state: Readonly<Record<string, number>>;
}
export interface IMalfunction {
  readonly id: string;
  readonly params?: Readonly<Record<string, number>>;
}
export interface ISimModel {
  readonly id: string;
  readonly tagsProvided: ReadonlyArray<TagId>;
  init(ctx: ISimModelContext, config: unknown): void;
  step(ctx: ISimModelContext): ISimStepResult;
  snapshot(): ISimSnapshot;
  restore(snapshot: ISimSnapshot): void;
  injectMalfunction(m: IMalfunction): void;
  clearMalfunction(id: string): void;
  dispose(): void;
}

/* ── 6.2 IProtocolDriver (L0) ──────────────────────────────────── */
export interface IProtocolDriverContext {
  publish(values: ReadonlyArray<TagValue>): void;
  logAudit(entry: Readonly<Record<string, unknown>>): void;
}
export interface IProtocolDriver {
  readonly id: string;
  connect(ctx: IProtocolDriverContext, config: unknown): Promise<void>;
  subscribe(tagIds: ReadonlyArray<TagId>): Promise<void>;
  write(cmd: IWriteCommand): Promise<WriteResult>;
  disconnect(): Promise<void>;
  readonly isConnected: boolean;
}

/* ── 6.3 IKpiCalculator (L2 Report/KPI) ────────────────────────── */
export type Aggregate = 'avg' | 'min' | 'max' | 'last' | 'total';
export interface IKpiInput {
  readonly range: { from: Iso8601; to: Iso8601 };
  read(tagId: TagId, agg: Aggregate): Promise<number>;
}
export interface IKpiResult {
  readonly kpiId: string;
  readonly value: number;
  readonly unit: EngineeringUnit;
}
export interface IKpiCalculator {
  readonly kpiId: string;
  readonly unit: EngineeringUnit;
  compute(input: IKpiInput): Promise<IKpiResult>;
}

/* ── 6.4 IReportSection (L2 Report) ────────────────────────────── */
export interface IReportContext {
  read(tagId: TagId, agg: Aggregate, range: { from: Iso8601; to: Iso8601 }): Promise<number>;
}
export type ReportBlock =
  | { kind: 'table'; headers: ReadonlyArray<string>; rows: ReadonlyArray<ReadonlyArray<string>> }
  | { kind: 'text'; text: string; authoredByAi?: boolean }
  | { kind: 'trend'; tagIds: ReadonlyArray<TagId>; range: { from: Iso8601; to: Iso8601 } };
export interface IReportSection {
  readonly sectionId: string;
  readonly title: { vi: string; en: string };
  render(ctx: IReportContext): Promise<ReadonlyArray<ReportBlock>>;
}

/* ── 6.5 ICustomSymbol (L4 Graphics — ngoại lệ L-P2) ───────────── */
export interface ISymbolState {
  value: number | boolean;
  quality: Quality;
  mode?: LoopMode;
  alarmState?: string;
}
export type SvgPrimitive =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string }
  | { kind: 'text'; x: number; y: number; text: string; fill: string }
  | { kind: 'path'; d: string; fill?: string; stroke?: string };
export interface ICustomSymbol {
  readonly symbolId: string;
  readonly bbox: { w: number; h: number };
  render(state: ISymbolState): ReadonlyArray<SvgPrimitive>;
}

/* ── 6.6 IAlarmShelvingPolicy (L2 Alarm) ───────────────────────── */
export interface IShelveRequest {
  alarmId: string;
  user: string;
  durationMin: number;
  reason: string;
}
export type ShelveDecision =
  | { allow: true; expiresAt: Iso8601 }
  | { allow: false; reason: string };
export interface IAlarmShelvingPolicy {
  readonly policyId: string;
  readonly maxDurationMin: number; // ≤ 480 (8 h)
  evaluate(req: IShelveRequest, now: Iso8601): ShelveDecision;
}

/* ── 6.7 ISequenceStep (L2 Control — SFC) ──────────────────────── */
export type StepStatus = 'pending' | 'active' | 'done' | 'failed';
export interface ISequenceContext {
  getTag(tagId: TagId): number | boolean;
  command(cmd: IWriteCommand): Promise<WriteResult>;
  elapsedMs(): number;
}
export interface ISequenceStep {
  readonly stepId: string;
  readonly permissive: ReadonlyArray<string>;
  enter(ctx: ISequenceContext): void;
  evaluate(ctx: ISequenceContext): StepStatus;
  onFail(ctx: ISequenceContext): void;
}

/* ── 6.8 IAiKnowledgeSource (L2 AI Advisor — read-only) ────────── */
export interface IKnowledgeDoc {
  readonly docId: string;
  readonly title: { vi: string; en: string };
  readonly kind: 'sop' | 'cause-effect' | 'narrative';
  readonly text: string;
  readonly tagRefs: ReadonlyArray<TagId>;
}
export interface IAiKnowledgeSource {
  readonly sourceId: string;
  list(): Promise<ReadonlyArray<IKnowledgeDoc>>;
}
