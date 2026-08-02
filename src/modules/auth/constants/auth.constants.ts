/**
 * Authentication-infrastructure constants (AI_RULES.md §35 — avoid magic
 * strings/numbers).
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

/**
 * Reserved for the future Authentication Business Logic phase (token
 * rotation, revocation). Not consumed by any code in this infrastructure
 * phase — defined now so the contract is fixed ahead of implementation.
 */
export enum TokenType {
  ACCESS = 'ACCESS',
  REFRESH = 'REFRESH',
}

export const AUTH_MESSAGES = {
  INVALID_TOKEN_PAYLOAD: 'The authentication token payload is invalid.',
  TOKEN_EXPIRED: 'The authentication token has expired.',
  TOKEN_INVALID: 'The authentication token is invalid.',
  UNAUTHORIZED: 'Authentication is required to access this resource.',
} as const;
