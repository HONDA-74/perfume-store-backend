import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'A previously issued, unexpired, unrevoked refresh token.' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
