import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Algorithm } from 'jsonwebtoken';
import { UsersModule } from '../users/users.module';
import { AUTH_STRATEGY } from './constants/auth.constants';
import { AuthController } from './controllers/auth.controller';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule — full Authentication module (IMPLEMENTATION_PLAN.md M2).
 *
 * Phase 4A built the infrastructure slice (Passport + JwtModule + JwtStrategy).
 * Phase 4B (this revision) adds the business-logic slice: AuthController,
 * AuthService, and the Auth-owned RefreshToken schema, plus a dependency on
 * UsersModule for credential read/create — exactly the dependency direction
 * permitted by SYSTEM_ARCHITECTURE.md §4.2 ("Auth may depend on Users").
 *
 * No controllers/services/schemas/DTOs from any other module are imported
 * directly; UsersService is the only cross-module access point, per
 * SYSTEM_ARCHITECTURE.md §1.3 ("Cross-module composition happens at the
 * Service layer only").
 */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
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
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
