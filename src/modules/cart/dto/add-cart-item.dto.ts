import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Field constraints per API_BLUEPRINT.md §7 ("productId (required, valid
 * ObjectId), quantity (integer, ≥ 1)").
 */
export class AddCartItemDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001', description: 'Product ObjectId.' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
