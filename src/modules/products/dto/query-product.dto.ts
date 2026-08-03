import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { APP_CONSTANTS } from '../../../common/constants/app.constant';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';

/**
 * Whitelisted sort values only (AI_RULES.md §31 / API_BLUEPRINT.md §4).
 * Invalid values are ignored by the service (falls back to the documented
 * default — isFeatured first, then newest — API_BLUEPRINT.md §1.6), never
 * causing an error.
 */
export const PRODUCT_SORT_WHITELIST = [
  'price:asc',
  'price:desc',
  'createdAt:desc',
  'name:asc',
] as const;

export type ProductSortOption = (typeof PRODUCT_SORT_WHITELIST)[number];

/**
 * Documented query params per API_BLUEPRINT.md §4 (search, categoryId,
 * brandId, gender, minPrice/maxPrice, sort, page/limit), extended with
 * `isFeatured`/`inStock` to satisfy this module's filtering requirements
 * (featured curation, stock status). Any undocumented query param is
 * silently ignored by the global whitelist `ValidationPipe`
 * (AI_RULES.md §30).
 */
export class QueryProductDto {
  @ApiPropertyOptional({ description: 'Text search on name/description (Mongo text index).' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Category ObjectId.' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand ObjectId.' })
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @ApiPropertyOptional({ enum: PerfumeGender })
  @IsOptional()
  @IsEnum(PerfumeGender)
  gender?: PerfumeGender;

  @ApiPropertyOptional({ description: 'Minimum price (inclusive).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price (inclusive).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filter by featured/homepage-curation flag.' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'When true, only returns products with stockQuantity > 0.' })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    enum: PRODUCT_SORT_WHITELIST,
    description: 'Whitelisted sort field:direction pair.',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_WHITELIST)
  sort?: ProductSortOption;

  @ApiPropertyOptional({ default: APP_CONSTANTS.DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: APP_CONSTANTS.DEFAULT_LIMIT,
    minimum: 1,
    maximum: APP_CONSTANTS.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(APP_CONSTANTS.MAX_LIMIT)
  limit?: number;
}
