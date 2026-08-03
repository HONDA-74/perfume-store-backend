import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { ProductConcentration } from '../enums/product-concentration.enum';
import { IsLessThanPrice } from '../validators/is-less-than-price.validator';
import { ProductNotesDto } from './product-notes.dto';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Field constraints per DATABASE_DESIGN.md §4.4 and API_BLUEPRINT.md §4
 * ("name, sku, categoryId, brandId, description, price (> 0), stockQuantity
 * (≥ 0), gender required; discountPrice must be < price when present").
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Bleu de Chanel EDP', minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'CHN-BLEU-EDP-100', description: 'Unique stock-keeping unit code.' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'sku must contain only letters, numbers, and hyphens' })
  @MinLength(3)
  @MaxLength(50)
  sku!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001', description: 'Category ObjectId.' })
  @IsMongoId()
  categoryId!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c002', description: 'Brand ObjectId.' })
  @IsMongoId()
  brandId!: string;

  @ApiProperty({ example: 'A woody aromatic fragrance with citrus top notes.' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 120, minimum: 0.01, description: 'Base price, must be > 0.' })
  @IsNumber()
  @Min(0.01)
  price!: number;

  @ApiPropertyOptional({ example: 99.99, description: 'Must be less than price when present.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsLessThanPrice('price', { message: 'discountPrice must be less than price' })
  discountPrice?: number;

  @ApiProperty({ example: 50, minimum: 0 })
  @IsNumber()
  @Min(0)
  stockQuantity!: number;

  @ApiProperty({ enum: PerfumeGender, example: PerfumeGender.UNISEX })
  @IsEnum(PerfumeGender)
  gender!: PerfumeGender;

  @ApiPropertyOptional({ enum: ProductConcentration, example: ProductConcentration.EDP })
  @IsOptional()
  @IsEnum(ProductConcentration)
  concentration?: ProductConcentration;

  @ApiPropertyOptional({ example: 100, description: 'Bottle size in milliliters.' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  sizeMl?: number;

  @ApiPropertyOptional({ type: ProductNotesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductNotesDto)
  notes?: ProductNotesDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Cloudinary URLs, first entry treated as primary.',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({ default: false, description: 'Used for homepage curation.' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
