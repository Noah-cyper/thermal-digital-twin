import { describe, it, expect } from 'vitest';
import type { AuthResult } from '@idtp/sdk';
import { LocalPasswordAuthProvider, JwtSsoAuthProvider, createAuthProvider, type LocalUser, type TokenVerifier } from '../src/auth-provider';

const users: LocalUser[] = [
  { userId: 'op1', roles: ['Operator'], secret: 'pw', displayName: 'Vận hành 1' },
  { userId: 'eng', roles: ['Engineer', 'Maintenance'], secret: 's3cret' },
];

describe('LocalPasswordAuthProvider', () => {
  it('đúng mật khẩu → principal + vai', () => {
    const r = new LocalPasswordAuthProvider(users).authenticate({ kind: 'password', user: 'op1', password: 'pw' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.principal).toMatchObject({ userId: 'op1', roles: ['Operator'], method: 'local' });
  });
  it('sai mật khẩu / không có user → từ chối', () => {
    const p = new LocalPasswordAuthProvider(users);
    expect(p.authenticate({ kind: 'password', user: 'op1', password: 'x' }).ok).toBe(false);
    expect(p.authenticate({ kind: 'password', user: 'ghost', password: 'pw' }).ok).toBe(false);
  });
  it('token cho provider local → từ chối', () => {
    expect(new LocalPasswordAuthProvider(users).authenticate({ kind: 'token', token: 't' }).ok).toBe(false);
  });
  it('deps.verify tuỳ biến (mô phỏng băm)', () => {
    const p = new LocalPasswordAuthProvider([{ userId: 'a', roles: ['Admin'], secret: 'HASH' }], { verify: (pw, s) => `H:${pw}`.toUpperCase() === `H:${s}`.toUpperCase() });
    expect(p.authenticate({ kind: 'password', user: 'a', password: 'hash' }).ok).toBe(true);
  });
});

describe('JwtSsoAuthProvider — mặc định ngắt kết nối', () => {
  it('chưa tiêm verifier → available=false + từ chối (không bịa)', () => {
    const p = new JwtSsoAuthProvider('jwt');
    expect(p.info.available).toBe(false);
    expect(p.info.notice.vi).toMatch(/CHƯA cấu hình/);
    const r = p.authenticate({ kind: 'token', token: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/chưa cấu hình/);
  });
  it('có verifier → uỷ thác xác minh token', () => {
    const verifier: TokenVerifier = {
      verify: (t): AuthResult => (t === 'good' ? { ok: true, principal: { userId: 'sso-user', roles: ['ShiftSupervisor'], method: 'jwt' } } : { ok: false, reason: 'token sai' }),
    };
    const p = new JwtSsoAuthProvider('jwt', verifier);
    expect(p.info.available).toBe(true);
    expect(p.authenticate({ kind: 'token', token: 'good' }).ok).toBe(true);
    expect(p.authenticate({ kind: 'token', token: 'bad' }).ok).toBe(false);
  });
  it('mật khẩu cho provider token → từ chối', () => {
    const verifier: TokenVerifier = { verify: () => ({ ok: true, principal: { userId: 'x', roles: ['Viewer'], method: 'sso' } }) };
    expect(new JwtSsoAuthProvider('sso', verifier).authenticate({ kind: 'password', user: 'a', password: 'b' }).ok).toBe(false);
  });
});

describe('createAuthProvider', () => {
  it("'local' → LocalPasswordAuthProvider", () => {
    expect(createAuthProvider({ method: 'local', users })).toBeInstanceOf(LocalPasswordAuthProvider);
  });
  it("'jwt'/'sso'/'none' → JwtSsoAuthProvider (none = ngắt kết nối)", () => {
    expect(createAuthProvider({ method: 'jwt' })).toBeInstanceOf(JwtSsoAuthProvider);
    expect(createAuthProvider({ method: 'none' }).info.available).toBe(false);
  });
});
