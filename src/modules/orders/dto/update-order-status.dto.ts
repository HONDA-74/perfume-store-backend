import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';

/** API_BLUEPRINT.md §9 — PATCH /orders/:id/status (Admin only). */
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
