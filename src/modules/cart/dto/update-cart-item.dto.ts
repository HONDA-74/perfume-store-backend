import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Field constraints per API_BLUEPRINT.md §7 ("quantity (integer, ≥ 1)").
 */
export class UpdateCartItemDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
