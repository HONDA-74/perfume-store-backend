import { Role } from '../../../common/types/enums/role.enum';

/**
 * Shape of the data required to sign a future access/refresh token pair.
 *
 * Not consumed anywhere in this infrastructure phase — no signing occurs
 * yet. Reserved for the Authentication Business Logic phase (Phase 4B),
 * so the payload contract is fixed once, here, ahead of AuthService's
 * token-issuance implementation.
 */
export interface TokenPayload {
  sub: string;
  role: Role;
  email?: string;
}
