import { describe, it, expect } from 'vitest';
import { Audit, type AuditEntry } from '../src/audit';

function mk(user: string, action: AuditEntry['action']): AuditEntry {
  return { ts: '2026-08-01T10:00:00+07:00', user, ip: '10.0.0.1', action, target: 'TAG_01', reason: 'test' };
}

describe('Audit (kernel L1) — append-only, bất biến', () => {
  it('record + list toàn bộ; sink callback được gọi', () => {
    const sunk: AuditEntry[] = [];
    const a = new Audit((e) => sunk.push(e));
    a.record(mk('operator', 'setpoint'));
    a.record(mk('engineer', 'override'));
    expect(a.list().length).toBe(2);
    expect(sunk.length).toBe(2);
  });

  it('lọc theo user và theo action', () => {
    const a = new Audit();
    a.record(mk('operator', 'ack'));
    a.record(mk('engineer', 'override'));
    a.record(mk('operator', 'setpoint'));
    expect(a.list({ user: 'operator' }).length).toBe(2);
    expect(a.list({ action: 'override' }).length).toBe(1);
    expect(a.list({ user: 'operator', action: 'ack' }).length).toBe(1);
  });

  it('list trả bản sao (không lộ mảng nội bộ)', () => {
    const a = new Audit();
    a.record(mk('admin', 'admin'));
    const copy = a.list() as AuditEntry[];
    copy.push(mk('x', 'view'));
    expect(a.list().length).toBe(1); // nội bộ không đổi
  });
});
