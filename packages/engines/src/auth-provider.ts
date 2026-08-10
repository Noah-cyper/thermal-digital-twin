// L1 — Auth Provider (doc 18). Hiện thực SEAM xác thực: LocalPasswordAuthProvider (mặc định, dùng ngay)
// và JwtSsoAuthProvider (JWT/SSO — MẶC ĐỊNH ngắt: chưa tiêm verifier/IdP thì TỪ CHỐI, không bịa danh tính).
// Thuần logic (không import thư viện JWT) → browser-safe + DI-test-được; verifier THẬT tiêm ở deploy.
import type { AuthCredential, AuthProviderInfo, AuthResult, IAuthProvider, Role } from '@idtp/sdk';

export interface LocalUser {
  readonly userId: string;
  readonly roles: ReadonlyArray<Role>;
  readonly secret: string; // mật khẩu/băm — deploy thật nên dùng băm + deps.verify
  readonly displayName?: string;
}

export interface LocalAuthDeps {
  /** So khớp mật khẩu ↔ secret (mặc định so bằng — deploy nên tiêm hàm băm bcrypt/argon2). */
  verify?(password: string, secret: string): boolean;
}

/** Xác thực bằng bảng người dùng khai báo. So khớp qua deps.verify (mặc định plaintext — chỉ demo). */
export class LocalPasswordAuthProvider implements IAuthProvider {
  readonly info: AuthProviderInfo = {
    id: 'local',
    method: 'local',
    available: true,
    notice: {
      vi: 'Xác thực nội bộ (bảng người dùng). Deploy thật nên tiêm hàm băm mật khẩu.',
      en: 'Local authentication (user table). Real deploy should inject a password hasher.',
    },
  };
  private readonly users: ReadonlyMap<string, LocalUser>;
  constructor(users: ReadonlyArray<LocalUser>, private readonly deps: LocalAuthDeps = {}) {
    this.users = new Map(users.map((u) => [u.userId, u] as const));
  }
  authenticate(cred: AuthCredential): AuthResult {
    if (cred.kind !== 'password') return { ok: false, reason: 'Provider local chỉ nhận chứng danh mật khẩu.' };
    const u = this.users.get(cred.user);
    const verify = this.deps.verify ?? ((p, s) => p === s);
    if (!u || !verify(cred.password, u.secret)) return { ok: false, reason: 'Sai tài khoản hoặc mật khẩu.' };
    return { ok: true, principal: { userId: u.userId, roles: u.roles, displayName: u.displayName, method: 'local' } };
  }
}

/** Xác minh token JWT/SSO — do lớp deploy tiêm (jsonwebtoken/JWKS/introspection). */
export interface TokenVerifier {
  verify(token: string): AuthResult;
}

/**
 * Adapter JWT/SSO — MẶC ĐỊNH NGẮT KẾT NỐI. Chưa tiêm verifier (thiếu secret/JWKS/IdP) → available=false và
 * TỪ CHỐI mọi lần xác thực (không bịa danh tính). Có verifier → uỷ thác xác minh token.
 */
export class JwtSsoAuthProvider implements IAuthProvider {
  readonly info: AuthProviderInfo;
  constructor(
    private readonly method: 'jwt' | 'sso',
    private readonly verifier?: TokenVerifier,
  ) {
    this.info = {
      id: method,
      method,
      available: verifier !== undefined,
      notice: verifier
        ? { vi: `Xác thực ${method.toUpperCase()} đã cấu hình (token xác minh qua IdP).`, en: `${method.toUpperCase()} auth configured (token verified via IdP).` }
        : { vi: `Auth ${method.toUpperCase()} CHƯA cấu hình — chế độ demo, KHÔNG xác thực (từ chối an toàn).`, en: `${method.toUpperCase()} auth NOT configured — demo mode, does not authenticate (fail-closed).` },
    };
  }
  authenticate(cred: AuthCredential): AuthResult {
    if (!this.verifier) return { ok: false, reason: `Auth ${this.method.toUpperCase()} chưa cấu hình (thiếu verifier/IdP).` };
    if (cred.kind !== 'token') return { ok: false, reason: `Provider ${this.method.toUpperCase()} cần chứng danh token.` };
    return this.verifier.verify(cred.token);
  }
}

export interface AuthProviderConfig {
  readonly method: 'local' | 'jwt' | 'sso' | 'none';
  readonly users?: ReadonlyArray<LocalUser>;
  readonly verifier?: TokenVerifier;
}

/** Tạo provider theo cấu hình. 'none'/thiếu cấu hình → provider từ chối an toàn (fail-closed). */
export function createAuthProvider(config: AuthProviderConfig, deps: LocalAuthDeps = {}): IAuthProvider {
  if (config.method === 'local') return new LocalPasswordAuthProvider(config.users ?? [], deps);
  if (config.method === 'jwt' || config.method === 'sso') return new JwtSsoAuthProvider(config.method, config.verifier);
  return new JwtSsoAuthProvider('jwt', undefined); // 'none' → adapter ngắt kết nối (từ chối)
}
