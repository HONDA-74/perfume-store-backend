import { Role } from '../enums/role.enum';

/**
 * Shape of the decoded JWT access-token payload.
 * The concrete signing/verification logic is implemented by the Auth module (M2).
 */
export interface JwtPayload {
  sub: string;
  role: Role;
  email?: string;
  iat?: number;
  exp?: number;
}
