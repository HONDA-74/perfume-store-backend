import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Field constraints per DATABASE_DESIGN.md §4.3 ("name (2-80 chars, unique)
 * required; description, logoUrl, countryOfOrigin optional").
 */
export class CreateBrandDto {
  @ApiProperty({ example: 'Chanel', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'French luxury fashion house founded in 1910.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    example: 'https://res.cloudinary.com/perfume-store/brands/chanel-logo.jpg',
    description: 'Cloudinary URL.',
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({ required: false, example: 'France' })
  @IsOptional()
  @IsString()
  countryOfOrigin?: string;
}
