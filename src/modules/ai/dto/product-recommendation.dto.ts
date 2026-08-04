import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductRecommendationDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  productId!: string;

  @ApiProperty({ example: 'Bleu de Chanel EDP' })
  name!: string;

  @ApiProperty({ example: 'bleu-de-chanel-edp' })
  slug!: string;

  @ApiProperty({ example: 120 })
  price!: number;

  @ApiPropertyOptional({ example: 99.99 })
  discountPrice?: number;

  @ApiProperty({ example: 'A fresh, woody-aromatic scent well suited to summer office wear.' })
  reason!: string;

  @ApiProperty({ example: 0.87, minimum: 0, maximum: 1 })
  confidenceScore!: number;
}
