// @idtp/sdk — kiểu Security/RBAC (doc 05-07, IEC 62443 nguyên tắc). 6 vai cố định (CLAUDE.md).
// Security Engine (@idtp/engines) ép ma trận quyền × hành động, xác nhận 2 bước, audit bất biến.
// AI read-only tuyệt đối (không có action ghi).
import type { Iso8601 } from './types';

export type Role = 'Viewer' | 'Operator' | 'ShiftSupervisor' | 'Engineer' | 'Maintenance' | 'Admin';

export type PermissionAction =
  | 'view'
  | 'ack'
  | 'shelve'
  | 'setpoint'
  | 'mode'
  | 'override'
  | 'oos'
  | 'engineer'
  | 'admin';

export interface AuthContext {
  readonly userId: string;
  readonly roles: ReadonlyArray<Role>;
  readonly ip: string;
  readonly sessionId: string;
}

export interface AuditRecord {
  readonly ts: Iso8601;
  readonly user: string;
  readonly ip: string;
  readonly action: PermissionAction;
  readonly target: string;
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
  readonly reason: string;
}
