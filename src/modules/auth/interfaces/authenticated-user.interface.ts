import { JwtPayload } from '../../../common/types/interfaces/jwt-payload.interface';

/**
 * The shape attached to `request.user` once JwtStrategy has verified a
 * token's signature, expiration, issuer, and audience.
 *
 * Intentionally an alias of JwtPayload (common/types/interfaces/jwt-payload.interface.ts)
 * rather than a new, differently-shaped type: common/types/request-with-user.type.ts
 * already types `request.user` as JwtPayload and is consumed by
 * common/decorators/current-user.decorator.ts and common/guards/roles.guard.ts.
 * Introducing a second, incompatible shape here would fracture that
 * existing contract. This alias exists purely so Auth-module code can refer
 * to the concept by its domain name.
 */
export type AuthenticatedUser = JwtPayload;
