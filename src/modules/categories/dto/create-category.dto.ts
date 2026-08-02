import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Field constraints per DATABASE_DESIGN.md §4.2 ("name (2-60 chars, unique)
 * required; description, imageUrl optional").
 */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Eau de Parfum', minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'Long-lasting, concentrated fragrances (15-20% aromatic compounds).',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    example: 'https://res.cloudinary.com/perfume-store/categories/edp.jpg',
    description: 'Cloudinary URL.',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
