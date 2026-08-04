import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { APP_CONSTANTS } from '../../../common/constants/app.constant';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';

/**
 * Documented query params only (API_BLUEPRINT.md §9 — "filterable by
 * `status`/`userId`"). No `sort` field: §1.6 documents newest-first as the
 * API-wide default with no per-endpoint override for Orders. `userId` is
 * only meaningful for Admin callers — the service silently overrides it
 * for non-admin callers rather than erroring (AI_RULES.md §30).
 */
export class QueryOrderDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Admin only — filter orders by customer.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

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
