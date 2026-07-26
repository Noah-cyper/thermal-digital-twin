// @idtp/sdk — kiểu alarm KHAI BÁO (doc 05-03 / doc 08, ISA-18.2 / EEMUA 191). Plugin CUNG CẤP
// alarms dưới dạng dữ liệu; Alarm Engine (@idtp/engines) chạy state machine. IAlarmShelvingPolicy
// (interfaces.ts §6.6) là extension point tuỳ chọn.
import type { TagId, Iso8601 } from './types';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type AlarmCondition = 'HH' | 'H' | 'L' | 'LL' | 'DEV' | 'ROC' | 'DISCRETE';
export type AlarmStateName =
  | 'Normal'
  | 'UnackAlarm'
  | 'AckAlarm'
  | 'RtnUnack'
  | 'Shelved'
  | 'Suppressed'
  | 'OutOfService';

export interface AlarmDef {
  readonly alarmId: string;
  readonly tagId: TagId;
  readonly condition: AlarmCondition;
  readonly priority: Priority;
  readonly setpoint: number;
  readonly deadband: number;
  readonly onDelayMs: number; // chống chattering vào (2–5 s)
  readonly offDelayMs: number; // chống chattering ra (5–10 s)
  readonly suppressWhen?: string; // suppression theo trạng thái thiết bị (vd "unit_state == SHUTDOWN")
  readonly consequence: { vi: string; en: string }; // hậu quả nếu bỏ qua
  readonly corrective?: { vi: string; en: string }; // hành động khắc phục
}

export interface AlarmEvent {
  readonly alarmId: string;
  readonly state: AlarmStateName;
  readonly priority: Priority;
  readonly ts: Iso8601;
  readonly value?: number;
  readonly user?: string;
}
