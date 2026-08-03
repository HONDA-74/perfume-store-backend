import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { StockOperation } from '../enums/stock-operation.enum';

/** API_BLUEPRINT.md §4 — PATCH /products/:id/stock. */
export class UpdateStockDto {
  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({ enum: StockOperation, example: StockOperation.INCREMENT })
  @IsEnum(StockOperation)
  operation!: StockOperation;
}
