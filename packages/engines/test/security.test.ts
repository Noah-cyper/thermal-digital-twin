import { describe, it, expect } from 'vitest';
import type { Role, AuthContext } from '@idtp/sdk';
import { SecurityEngine } from '../src/security';

function mk(): { sec: SecurityEngine; setT: (ms: number) => void } {
  let t = 0;
  const sec = new SecurityEngine({ nowMs: () => t, formatTs: (ms) => `t${ms}` }, { maxWrites: 3 });
  sec.addUser('op', 'p', ['Operator']);
  sec.addUser('admin', 'p', ['Admin']);
  return { sec, setT: (ms: number) => { t = ms; } };
}
const ctxOf = (roles: Role[]): AuthContext => ({ userId: 'u', roles, ip: '10.0.0.1', sessionId: 's' });

describe('SecurityEngine (RBAC 6 vai + audit + 2-step)', () => {
  it('ma trận quyền × hành động', () => {
    const { sec } = mk();
    expect(sec.authorize(ctxOf(['Viewer']), 'view').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Viewer']), 'setpoint').allow).toBe(false);
    expect(sec.authorize(ctxOf(['Operator']), 'setpoint').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Operator']), 'override').allow).toBe(false);
    expect(sec.authorize(ctxOf(['ShiftSupervisor']), 'override').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Maintenance']), 'oos').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Maintenance']), 'setpoint').allow).toBe(false);
    expect(sec.authorize(ctxOf(['Engineer']), 'engineer').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Admin']), 'admin').allow).toBe(true);
    expect(sec.authorize(ctxOf(['Operator']), 'admin').allow).toBe(false);
  });

  it('authenticate + resolve; sai mật khẩu → error; access hết hạn 15’ → resolve undefined', () => {
    const { sec, setT } = mk();
    expect('error' in sec.authenticate('op', 'wrong', '1')).toBe(true);
    const t = sec.authenticate('op', 'p', '1');
    expect('access' in t).toBe(true);
    if (!('access' in t)) return;
    expect(sec.resolve(t.access)?.userId).toBe('op');
    setT(15 * 60_000 + 1);
    expect(sec.resolve(t.access)).toBeUndefined();
  });

  it('refresh XOAY VÒNG: dùng lại refresh cũ → error', () => {
    const { sec } = mk();
    const t = sec.authenticate('op', 'p', '1');
    if (!('access' in t)) throw new Error('auth');
    expect('access' in sec.refresh(t.refresh, '1')).toBe(true);
    expect('error' in sec.refresh(t.refresh, '1')).toBe(true);
  });

  it('xác nhận 2 bước cho setpoint: thiếu → chặn; đúng token → cho + audit', () => {
    const { sec } = mk();
    const t = sec.authenticate('op', 'p', '1');
    if (!('access' in t)) throw new Error('auth');
    expect(sec.guardedWrite(t.access, 'setpoint', 'BLR_MW_DEMAND', 448, 560, 'ramp').allow).toBe(false);
    const ctx = sec.resolve(t.access);
    if (!ctx) throw new Error('ctx');
    const token = sec.requestConfirm(ctx, 'setpoint', 'BLR_MW_DEMAND');
    expect(sec.guardedWrite(t.access, 'setpoint', 'BLR_MW_DEMAND', 448, 560, 'ramp', token).allow).toBe(true);
    expect(sec.auditList()).toHaveLength(1);
    expect(sec.auditList()[0]?.newValue).toBe(560);
  });

  it('audit fail-closed: audit lỗi → hủy lệnh, không có bản ghi', () => {
    const { sec } = mk();
    const t = sec.authenticate('op', 'p', '1');
    if (!('access' in t)) throw new Error('auth');
    sec.simulateAuditFailure(true);
    const w = sec.guardedWrite(t.access, 'ack', 'A', null, null, 'ack');
    expect(w.allow).toBe(false);
    expect(w).toMatchObject({ reason: expect.stringContaining('fail-closed') });
    expect(sec.auditList()).toHaveLength(0);
  });

  it('session lock 10’ không thao tác → chặn ghi (dù access chưa hết hạn)', () => {
    const { sec, setT } = mk();
    const t = sec.authenticate('op', 'p', '1');
    if (!('access' in t)) throw new Error('auth');
    setT(11 * 60_000);
    const w = sec.guardedWrite(t.access, 'ack', 'A', null, null, 'x');
    expect(w.allow).toBe(false);
    expect(w).toMatchObject({ reason: expect.stringContaining('khóa') });
  });

  it('rate limit: vượt maxWrites → chặn', () => {
    const { sec } = mk();
    const t = sec.authenticate('op', 'p', '1');
    if (!('access' in t)) throw new Error('auth');
    for (let i = 0; i < 3; i++) expect(sec.guardedWrite(t.access, 'ack', 'A', null, null, 'x').allow).toBe(true);
    expect(sec.guardedWrite(t.access, 'ack', 'A', null, null, 'x').allow).toBe(false);
  });
});
