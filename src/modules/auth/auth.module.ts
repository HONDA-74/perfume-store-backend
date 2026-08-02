import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Algorithm } from 'jsonwebtoken';
import { AUTH_STRATEGY } from './constants/auth.constants';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule — Authentication INFRASTRUCTURE only (IMPLEMENTATION_PLAN.md M2,
 * infrastructure slice / Phase 4A). Registers the Passport + JWT verification
 * machinery and the JwtStrategy so that JwtAuthGuard (common/guards/jwt-auth.guard.ts)
 * has a real "jwt" strategy to authenticate against.
 *
 * Deliberately contains NO controllers, services, DTOs, or schemas — token
 * issuance (login/register/refresh/logout) and user validation against
 * MongoDB belong to the Authentication Business Logic phase (Phase 4B),
 * per SYSTEM_ARCHITECTURE.md §8.3 and IMPLEMENTATION_PLAN.md M2.
 *
 * PassportModule/JwtModule are exported so the future AuthService (Phase 4B)
 * can inject JwtService to sign tokens without this module needing to change.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: AUTH_STRATEGY.JWT }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const algorithm = configService.get<string>('jwt.algorithm') as Algorithm;
        const issuer = configService.get<string>('jwt.issuer');
        const audience = configService.get<string>('jwt.audience');

        return {
          secret: configService.get<string>('jwt.accessSecret'),
          signOptions: {
            expiresIn: configService.get<string>('jwt.accessExpiry'),
            issuer,
            audience,
            algorithm,
          },
          verifyOptions: {
            issuer,
            audience,
            algorithms: [algorithm],
          },
        };
      },
    }),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
