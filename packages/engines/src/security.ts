// L1/L2 — Security/RBAC + Audit (doc 05-07, IEC 62443 nguyên tắc). Ma trận 6 vai × 9 action là nguồn
// chân lý DUY NHẤT; lệnh ghi nguy hiểm cần xác nhận 2 bước; audit BẤT BIẾN, fail-closed (không ghi =
// hủy lệnh); JWT access 15' + refresh XOAY VÒNG; session lock 10' (không khóa hiển thị alarm — ở UI).
// Token đơn giản hoá cho lát cắt (thư viện JWT thật ở sau) — vẫn đủ mô hình TTL + xoay refresh.
import type { Role, PermissionAction, AuthContext, AuditRecord, Iso8601 } from '@idtp/sdk';

export type AuthzResult = { allow: true } | { allow: false; reason: string };

export interface SecurityDeps {
  nowMs(): number;
  formatTs(ms: number): Iso8601;
}
export interface SecurityConfig {
  accessTtlMin: number;
  sessionLockMin: number;
  rateWindowSec: number;
  maxWrites: number;
  confirmTtlSec: number;
}
const DEFAULT_CFG: SecurityConfig = { accessTtlMin: 15, sessionLockMin: 10, rateWindowSec: 60, maxWrites: 30, confirmTtlSec: 30 };

// Ma trận quyền × hành động (doc 05-07 §3).
const MATRIX: Record<PermissionAction, ReadonlyArray<Role>> = {
  view: ['Viewer', 'Operator', 'ShiftSupervisor', 'Engineer', 'Maintenance', 'Admin'],
  ack: ['Operator', 'ShiftSupervisor', 'Engineer', 'Admin'],
  shelve: ['Operator', 'ShiftSupervisor', 'Engineer', 'Admin'],
  setpoint: ['Operator', 'ShiftSupervisor', 'Engineer', 'Admin'],
  mode: ['Operator', 'ShiftSupervisor', 'Engineer', 'Admin'],
  override: ['ShiftSupervisor', 'Engineer', 'Admin'],
  oos: ['ShiftSupervisor', 'Engineer', 'Maintenance', 'Admin'],
  engineer: ['Engineer', 'Admin'],
  admin: ['Admin'],
};
const TWO_STEP = new Set<PermissionAction>(['setpoint', 'mode', 'override']);

interface Session {
  user: string;
  roles: Role[];
  ip: string;
  accessExpMs: number;
  lastActivityMs: number;
}

export class SecurityEngine {
  private readonly cfg: SecurityConfig;
  private readonly users = new Map<string, { pass: string; roles: Role[] }>();
  private readonly sessions = new Map<string, Session>(); // access token = session id
  private readonly refreshTokens = new Map<string, { user: string; roles: Role[]; ip: string }>();
  private readonly confirms = new Map<string, { user: string; action: PermissionAction; target: string; expMs: number }>();
  private readonly writeTimes = new Map<string, number[]>();
  private readonly auditLog: AuditRecord[] = [];
  private auditFail = false;
  private seq = 0;

  constructor(
    private readonly deps: SecurityDeps,
    cfg: Partial<SecurityConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_CFG, ...cfg };
  }

  addUser(user: string, pass: string, roles: ReadonlyArray<Role>): void {
    this.users.set(user, { pass, roles: [...roles] });
  }

  authenticate(user: string, pass: string, ip: string): { access: string; refresh: string } | { error: string } {
    const u = this.users.get(user);
    if (!u || u.pass !== pass) return { error: 'sai tài khoản hoặc mật khẩu' };
    return this.issue(user, u.roles, ip);
  }

  refresh(oldRefresh: string, ip: string): { access: string; refresh: string } | { error: string } {
    const r = this.refreshTokens.get(oldRefresh);
    if (!r) return { error: 'refresh token không hợp lệ hoặc đã dùng' };
    this.refreshTokens.delete(oldRefresh); // xoay vòng: token cũ vô hiệu ngay
    return this.issue(r.user, r.roles, ip);
  }

  private issue(user: string, roles: Role[], ip: string): { access: string; refresh: string } {
    const now = this.deps.nowMs();
    const access = `acc.${user}.${++this.seq}`;
    const refresh = `ref.${user}.${++this.seq}`;
    this.sessions.set(access, { user, roles: [...roles], ip, accessExpMs: now + this.cfg.accessTtlMin * 60_000, lastActivityMs: now });
    this.refreshTokens.set(refresh, { user, roles: [...roles], ip });
    return { access, refresh };
  }

  resolve(access: string): AuthContext | undefined {
    const s = this.sessions.get(access);
    if (!s || this.deps.nowMs() >= s.accessExpMs) return undefined;
    return { userId: s.user, roles: s.roles, ip: s.ip, sessionId: access };
  }

  authorize(ctx: AuthContext, action: PermissionAction): AuthzResult {
    if (ctx.roles.some((r) => MATRIX[action].includes(r))) return { allow: true };
    return { allow: false, reason: `vai [${ctx.roles.join(',')}] không có quyền '${action}'` };
  }

  requiresTwoStep(action: PermissionAction): boolean {
    return TWO_STEP.has(action);
  }

  requestConfirm(ctx: AuthContext, action: PermissionAction, target: string): string {
    const token = `cfm.${++this.seq}`;
    this.confirms.set(token, { user: ctx.userId, action, target, expMs: this.deps.nowMs() + this.cfg.confirmTtlSec * 1000 });
    return token;
  }

  confirmTwoStep(ctx: AuthContext, action: PermissionAction, target: string, token: string): boolean {
    const c = this.confirms.get(token);
    if (!c) return false;
    this.confirms.delete(token); // dùng một lần
    return c.user === ctx.userId && c.action === action && c.target === target && this.deps.nowMs() < c.expMs;
  }

  /** touch: đánh dấu thao tác (giữ session khỏi lock). UI gọi khi người dùng tương tác. */
  touch(access: string): void {
    const s = this.sessions.get(access);
    if (s) s.lastActivityMs = this.deps.nowMs();
  }

  auditList(): ReadonlyArray<AuditRecord> {
    return [...this.auditLog];
  }

  /** test hook: ép audit lỗi để kiểm fail-closed. */
  simulateAuditFailure(on: boolean): void {
    this.auditFail = on;
  }

  private audit(entry: AuditRecord): void {
    if (this.auditFail) throw new Error('audit sink down');
    this.auditLog.push(entry);
  }

  private rateLimited(user: string): boolean {
    const now = this.deps.nowMs();
    const arr = (this.writeTimes.get(user) ?? []).filter((t) => t >= now - this.cfg.rateWindowSec * 1000);
    this.writeTimes.set(user, arr);
    return arr.length >= this.cfg.maxWrites;
  }

  /** Đường ghi bắt buộc: authenticate → session lock → authorize → rate limit → 2-step → audit (fail-closed). */
  guardedWrite(
    access: string,
    action: PermissionAction,
    target: string,
    oldValue: unknown,
    newValue: unknown,
    reason: string,
    confirmToken?: string,
  ): AuthzResult {
    const s = this.sessions.get(access);
    if (!s || this.deps.nowMs() >= s.accessExpMs) return { allow: false, reason: 'chưa xác thực hoặc access token hết hạn' };
    if (this.deps.nowMs() - s.lastActivityMs > this.cfg.sessionLockMin * 60_000) {
      return { allow: false, reason: `session bị khóa sau ${this.cfg.sessionLockMin} phút không thao tác` };
    }
    const ctx: AuthContext = { userId: s.user, roles: s.roles, ip: s.ip, sessionId: access };
    const az = this.authorize(ctx, action);
    if (!az.allow) return az;
    if (this.rateLimited(s.user)) return { allow: false, reason: 'vượt rate limit ghi' };
    if (this.requiresTwoStep(action) && !(confirmToken !== undefined && this.confirmTwoStep(ctx, action, target, confirmToken))) {
      return { allow: false, reason: 'lệnh nguy hiểm cần xác nhận 2 bước' };
    }
    try {
      this.audit({ ts: this.deps.formatTs(this.deps.nowMs()), user: s.user, ip: s.ip, action, target, oldValue, newValue, reason });
    } catch {
      return { allow: false, reason: 'ghi audit thất bại → hủy lệnh (fail-closed)' };
    }
    const arr = this.writeTimes.get(s.user) ?? [];
    arr.push(this.deps.nowMs());
    this.writeTimes.set(s.user, arr);
    s.lastActivityMs = this.deps.nowMs();
    return { allow: true };
  }
}
