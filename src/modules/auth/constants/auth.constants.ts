/**
 * Authentication constants (AI_RULES.md §35 — avoid magic strings/numbers).
 *
 * NOTE: metadata keys for @Public()/@Roles() intentionally remain in
 * common/decorators/public.decorator.ts and common/decorators/roles.decorator.ts
 * (IS_PUBLIC_KEY, ROLES_KEY) rather than being duplicated here — those
 * decorators are consumed by every module, not just Auth, so per
 * AI_RULES.md §5 (DRY) and SYSTEM_ARCHITECTURE.md §6, their single source
 * of truth stays in common/.
 */

/** Registered Passport strategy name, referenced by JwtStrategy and JwtAuthGuard. */
export const AUTH_STRATEGY = {
  JWT: 'jwt',
} as const;

/** Kinds of tokens issued by AuthService (used only for internal clarity). */
export enum TokenType {
  ACCESS = 'ACCESS',
  REFRESH = 'REFRESH',
}

export const AUTH_MESSAGES = {
  INVALID_TOKEN_PAYLOAD: 'The authentication token payload is invalid.',
  TOKEN_EXPIRED: 'The authentication token has expired.',
  TOKEN_INVALID: 'The authentication token is invalid.',
  UNAUTHORIZED: 'Authentication is required to access this resource.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  REFRESH_TOKEN_INVALID: 'The refresh token is invalid, expired, or has been revoked.',
} as const;
