import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({ example: 'I want something fresh for the office in summer.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Existing conversation to continue. Omit to start a new one.',
  })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}
