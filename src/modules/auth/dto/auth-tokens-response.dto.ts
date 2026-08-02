import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthTokensResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token.' })
  accessToken!: string;

  @ApiProperty({ description: 'Longer-lived JWT refresh token.' })
  refreshToken!: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
