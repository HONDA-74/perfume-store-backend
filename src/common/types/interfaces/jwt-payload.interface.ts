import { Role } from '../enums/role.enum';

/**
 * Shape of the decoded JWT access-token payload.
 *
 * Verified structurally and cryptographically by JwtStrategy
 * (modules/auth/strategies/jwt.strategy.ts) — `iss`/`aud` are enforced
 * against config/jwt.config.ts at verification time. The concrete signing
 * logic (populating `sub`/`role`/`email`) belongs to the Authentication
 * Business Logic phase (Phase 4B).
 */
export interface JwtPayload {
  sub: string;
  role: Role;
  email?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}
