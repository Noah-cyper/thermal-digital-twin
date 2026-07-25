// Kernel L1 — Audit (doc 05-07). Append-only, bất biến (không có API sửa/xoá).
import type { Iso8601 } from '@idtp/sdk';

export type AuditAction =
  | 'view'
  | 'ack'
  | 'shelve'
  | 'setpoint'
  | 'mode'
  | 'override'
  | 'oos'
  | 'engineer'
  | 'admin'
  | 'plugin'
  | 'ai';

export interface AuditEntry {
  ts: Iso8601;
  user: string;
  ip: string;
  action: AuditAction;
  target: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason: string;
}

export interface AuditFilter {
  user?: string;
  action?: AuditAction;
}

export interface IAudit {
  record(entry: AuditEntry): void;
  list(filter?: AuditFilter): ReadonlyArray<AuditEntry>;
}

export class Audit implements IAudit {
  private readonly entries: AuditEntry[] = [];

  constructor(private readonly sink?: (e: AuditEntry) => void) {}

  record(entry: AuditEntry): void {
    this.entries.push(entry);
    this.sink?.(entry);
  }

  list(filter?: AuditFilter): ReadonlyArray<AuditEntry> {
    if (!filter) return [...this.entries];
    return this.entries.filter(
      (e) =>
        (filter.user === undefined || e.user === filter.user) &&
        (filter.action === undefined || e.action === filter.action),
    );
  }
}
