import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Algorithm } from 'jsonwebtoken';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { JwtPayload } from '../../../common/types/interfaces/jwt-payload.interface';
import { AUTH_MESSAGES, AUTH_STRATEGY } from '../constants/auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Verifies the cryptographic validity of a Bearer access token — signature,
 * expiration, issuer, and audience — via the "jwt" Passport strategy.
 *
 * Per SYSTEM_ARCHITECTURE.md §8.2 and this phase's constraints, this class
 * performs NO database lookups and NO user existence/status checks. It only
 * validates the token itself and shapes the already-verified payload into
 * the request-scoped user context consumed by @CurrentUser(). Rejecting
 * revoked refresh tokens, suspended (`isActive: false`) or soft-deleted
 * users is a business-logic concern deferred to the Authentication Business
 * Logic phase (Phase 4B) — it will live in AuthService/UsersService, not here.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, AUTH_STRATEGY.JWT) {
  constructor(configService: ConfigService) {
    const algorithm = configService.get<string>('jwt.algorithm') as Algorithm;

    const secret = configService.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT accessSecret is not configured');
    }

    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: configService.get<string>('jwt.issuer'),
      audience: configService.get<string>('jwt.audience'),
      algorithms: [algorithm],
    };

    super(options);
  }

  /**
   * Invoked by Passport only after the token has already passed signature,
   * expiration, issuer, and audience verification against the options
   * above. Performs a minimal structural check on the decoded payload and
   * returns it unchanged — no enrichment, no side effects, no I/O.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN_PAYLOAD);
    }

    return payload;
  }
}
