import { ApiProperty } from '@nestjs/swagger';
import { ProductRecommendationDto } from './product-recommendation.dto';

export class ChatResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0ff' })
  conversationId!: string;

  @ApiProperty({ example: 'Here are a few fresh, office-friendly picks for summer...' })
  message!: string;

  @ApiProperty({ type: [ProductRecommendationDto] })
  recommendations!: ProductRecommendationDto[];
}
