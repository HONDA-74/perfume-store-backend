import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * API_BLUEPRINT.md §2 lists no request DTO for logout, but does specify
 * that logout "revokes the presented refresh token" — this field is the
 * only way to identify which token to revoke.
 */
export class LogoutDto {
  @ApiProperty({ description: 'The refresh token to revoke.' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
