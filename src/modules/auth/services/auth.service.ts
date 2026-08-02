import { createHash } from 'crypto';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Algorithm } from 'jsonwebtoken';
import { Model } from 'mongoose';
import { JwtPayload } from '../../../common/types/interfaces/jwt-payload.interface';
import { comparePassword, hashPassword } from '../../../common/utils/password.util';
import { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/services/users.service';
import { AUTH_MESSAGES } from '../constants/auth.constants';
import { AuthMeResponseDto } from '../dto/auth-me-response.dto';
import { AuthTokensResponseDto } from '../dto/auth-tokens-response.dto';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';

/**
 * Authentication business logic (IMPLEMENTATION_PLAN.md M2, business-logic
 * slice / Phase 4B). Depends on UsersService (read/create only — never
 * touches another module's schema directly, per SYSTEM_ARCHITECTURE.md §4.3)
 * and its own RefreshToken model.
 *
 * Security posture:
 * - Passwords hashed with bcrypt via common/utils/password.util.ts, never
 *   logged, never returned.
 * - Login/refresh failures return one generic message regardless of cause
 *   (unknown email vs. wrong password vs. inactive account) to avoid user
 *   enumeration (AI_RULES.md §21).
 * - Refresh tokens are signed with a distinct secret (jwt.refreshSecret)
 *   from access tokens, and persisted only as a SHA-256 hash — the raw
 *   token is never stored (DATABASE_DESIGN.md §4.8).
 * - GET /auth/me never touches the database — it derives identity purely
 *   from the already-verified JWT payload (API_BLUEPRINT.md §2).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
    });

    this.logger.log(`New user registered (id=${user.id})`);

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensResponseDto> {
    const user = await this.usersService.findByEmail(dto.email, true);

    if (!user || !user.isActive || user.isDeleted) {
      this.logger.warn('Failed login attempt (invalid credentials or inactive account).');
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const passwordMatches = await comparePassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.logger.warn('Failed login attempt (invalid credentials).');
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    await this.usersService.updateLastLogin(user.id);
    this.logger.log(`User logged in (id=${user.id})`);

    return this.issueTokenPair(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.refreshTokenModel
      .findOne({ userId: payload.sub, tokenHash, isRevoked: false })
      .exec();

    if (!storedToken || storedToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive || user.isDeleted) {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    // Rotation: the presented token is revoked before a new pair is issued,
    // so it can never be replayed (DATABASE_DESIGN.md §4.8 / AI_RULES.md §22).
    storedToken.isRevoked = true;
    await storedToken.save();

    this.logger.log(`Refresh token rotated (userId=${user.id})`);

    return this.issueTokenPair(user);
  }

  async logout(dto: LogoutDto): Promise<void> {
    const tokenHash = this.hashToken(dto.refreshToken);
    await this.refreshTokenModel
      .updateOne({ tokenHash, isRevoked: false }, { $set: { isRevoked: true } })
      .exec();
    this.logger.log('Refresh token revoked (logout).');
  }

  /**
   * No database round-trip — identity is derived entirely from the
   * already-verified access-token payload (API_BLUEPRINT.md §2).
   */
  getCurrentUser(user: JwtPayload): AuthMeResponseDto {
    return { id: user.sub, email: user.email ?? '', role: user.role };
  }

  private async issueTokenPair(user: UserDocument): Promise<AuthTokensResponseDto> {
    const payload: TokenPayload = { sub: user.id, role: user.role, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(payload),
      this.signRefreshToken(payload),
    ]);

    await this.persistRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  private signAccessToken(payload: TokenPayload): Promise<string> {
    // Uses AuthModule's default JwtModule configuration (access secret,
    // expiry, issuer, audience, algorithm) — unchanged from Phase 4A.
    return this.jwtService.signAsync(payload);
  }

  private signRefreshToken(payload: TokenPayload): Promise<string> {
    const algorithm = this.configService.get<string>('jwt.algorithm') as Algorithm;

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiry'),
      issuer: this.configService.get<string>('jwt.issuer'),
      audience: this.configService.get<string>('jwt.audience'),
      algorithm,
    });
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    const algorithm = this.configService.get<string>('jwt.algorithm') as Algorithm;

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        issuer: this.configService.get<string>('jwt.issuer'),
        audience: this.configService.get<string>('jwt.audience'),
        algorithms: [algorithm],
      });
    } catch {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiry', '7d');
    const expiresAt = new Date(Date.now() + this.parseExpiryToMs(refreshExpiry));

    await this.refreshTokenModel.create({
      userId,
      tokenHash,
      expiresAt,
      isRevoked: false,
    });
  }

  /** Deterministic digest — enables an indexed lookup on refresh (see schema). */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryToMs(expiry: string): number {
    const FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
    const match = /^(\d+)(ms|s|m|h|d)?$/.exec(expiry.trim());

    if (!match) {
      return FALLBACK_MS;
    }

    const value = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }
}
