// @idtp/sdk — Lớp XÁC THỰC (auth) theo kiến trúc SEAM (doc 18, IEC 62443). Trừu tượng IAuthProvider để
// gắn nhiều nguồn cùng chữ ký: LocalPasswordAuthProvider (dùng NGAY) và JwtSsoAuthProvider (JWT/SSO doanh
// nghiệp — CHƯA cấu hình IdP thì KHÔNG xác thực, không bịa). KHÔNG thay SecurityEngine (RBAC/2-step/audit
// giữ nguyên) — chỉ chuẩn hoá bước "danh tính → vai" để cắm IdP thật khi có credential.
import type { Role } from './security';

export type AuthMethod = 'local' | 'jwt' | 'sso' | 'none';

export interface AuthPrincipal {
  readonly userId: string;
  readonly roles: ReadonlyArray<Role>;
  readonly displayName?: string;
  readonly method: AuthMethod;
}

export type AuthResult = { ok: true; principal: AuthPrincipal } | { ok: false; reason: string };

/** Chứng danh đưa vào provider: mật khẩu (local) hoặc token (JWT/SSO). */
export type AuthCredential =
  | { readonly kind: 'password'; readonly user: string; readonly password: string }
  | { readonly kind: 'token'; readonly token: string };

export interface AuthProviderInfo {
  readonly id: string;
  readonly method: AuthMethod;
  /** true nếu provider xác thực được thật; false → chỉ khai báo, TỪ CHỐI sạch (không bịa danh tính). */
  readonly available: boolean;
  readonly notice: { vi: string; en: string };
}

/**
 * PROVIDER xác thực. Không khả dụng (chưa cấu hình IdP) phải TỪ CHỐI (ok:false) — TUYỆT ĐỐI không cấp
 * principal giả. Fail-closed (nhất quán SecurityEngine doc 18).
 */
export interface IAuthProvider {
  readonly info: AuthProviderInfo;
  authenticate(cred: AuthCredential): AuthResult;
}
