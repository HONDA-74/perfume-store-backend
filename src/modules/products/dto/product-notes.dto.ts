import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ProductNotesDto {
  @ApiPropertyOptional({ type: [String], example: ['Bergamot', 'Lemon'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  top?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Jasmine', 'Ginger'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  middle?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Sandalwood', 'Musk'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  base?: string[];
}
