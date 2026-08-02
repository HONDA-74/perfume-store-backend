import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { APP_CONSTANTS } from '../../../common/constants/app.constant';

/**
 * Whitelisted sort values only (AI_RULES.md §31 / API_BLUEPRINT.md §1.6).
 * Invalid values are ignored by the service (falls back to the default),
 * never causing an error.
 */
export const CATEGORY_SORT_WHITELIST = [
  'name:asc',
  'name:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

export type CategorySortOption = (typeof CATEGORY_SORT_WHITELIST)[number];

/**
 * Documented query params only (API_BLUEPRINT.md §5 / AI_RULES.md §30).
 * Any undocumented query param is silently ignored by the global
 * `ValidationPipe` (`whitelist: true`), never causing an error.
 */
export class QueryCategoryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive search on category name.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: CATEGORY_SORT_WHITELIST,
    default: APP_CONSTANTS.DEFAULT_SORT,
    description: 'Whitelisted sort field:direction pair.',
  })
  @IsOptional()
  @IsIn(CATEGORY_SORT_WHITELIST)
  sort?: CategorySortOption;

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
