import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtPayload } from '../../../common/types/interfaces/jwt-payload.interface';
import { AuthMeResponseDto } from '../dto/auth-me-response.dto';
import { AuthTokensResponseDto } from '../dto/auth-tokens-response.dto';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../services/auth.service';

/**
 * Auth endpoints per API_BLUEPRINT.md §2.
 *
 * NOTE (conflict resolution): the identity-check endpoint is exposed at
 * GET /auth/me — API_BLUEPRINT.md §2 explicitly describes it as returning
 * "minimal identity ... from the JWT payload, not a DB round-trip", and
 * README.md lists API_BLUEPRINT.md ahead of any other instruction for
 * endpoint contracts.
 *
 * Register/login carry a stricter throttle than the global default
 * (API_BLUEPRINT.md §2 "Rate-limited more strictly than the global
 * default"), reusing the already-scaffolded 'default' Throttler
 * registered in AppModule (config/throttler.config.ts already reserves
 * THROTTLE_AUTH_TTL/THROTTLE_AUTH_LIMIT for this exact purpose) — no new
 * rate-limiting infrastructure is introduced.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiCreatedResponse({ description: 'Account created.', type: AuthTokensResponseDto })
  @ApiConflictResponse({ description: 'Email already registered.' })
  register(@Body() dto: RegisterDto): Promise<AuthTokensResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ description: 'Authenticated.', type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  login(@Body() dto: LoginDto): Promise<AuthTokensResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair' })
  @ApiOkResponse({ description: 'Token pair rotated.', type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or revoked refresh token.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the presented refresh token' })
  @ApiNoContentResponse({ description: 'Refresh token revoked.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Return the caller's identity from the JWT payload" })
  @ApiOkResponse({ description: 'Current identity.', type: AuthMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  getMe(@CurrentUser() user: JwtPayload): AuthMeResponseDto {
    return this.authService.getCurrentUser(user);
  }
}
