import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';

/**
 * Transport-only DTO for POST /payments/create-intent (AI_RULES.md §11).
 * No business logic — ownership of the order and amount calculation happen
 * in PaymentsService, never trusted from the request body.
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    example: '66f1a2b3c4d5e6f7a8b9c0d1',
    description: 'The Mongo ObjectId of the order to pay for.',
  })
  @IsMongoId()
  orderId!: string;

  @ApiProperty({
    example: 'usd',
    description: 'ISO 4217 currency code (lowercase). Defaults to "usd".',
    required: false,
    default: 'usd',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
