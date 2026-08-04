import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentEntityStatus, PaymentProvider } from '../constants/payments.constants';
import { PaymentEntityLike } from '../interfaces/payment-entity-like.interface';

/**
 * No endpoint returns a raw Mongoose document (AI_RULES.md §11).
 * `fromEntity` accepts both a full Document (virtual `.id`) and a `.lean()`
 * plain object (`._id`), mirroring the pattern used in OrderResponseDto.
 */
export class PaymentResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0e1' })
  id!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  orderId!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c000' })
  userId!: string;

  @ApiProperty({ example: 'pi_3ABC123' })
  paymentIntentId!: string;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.STRIPE })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentEntityStatus, example: PaymentEntityStatus.SUCCEEDED })
  status!: PaymentEntityStatus;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiProperty({ example: 24000, description: 'Amount in smallest currency unit (cents).' })
  amount!: number;

  @ApiPropertyOptional({ example: 'ch_3ABC123', nullable: true })
  transactionId?: string | null;

  @ApiPropertyOptional({ example: 'Your card was declined.', nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  refundedAt?: Date | null;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:05:00.000Z' })
  updatedAt!: Date;

  static fromEntity(payment: PaymentEntityLike): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id ?? payment._id?.toString() ?? '';
    dto.orderId = payment.orderId?.toString() ?? '';
    dto.userId = payment.userId?.toString() ?? '';
    dto.paymentIntentId = payment.paymentIntentId;
    dto.provider = payment.provider;
    dto.status = payment.status;
    dto.currency = payment.currency;
    dto.amount = payment.amount;
    dto.transactionId = payment.transactionId ?? null;
    dto.failureReason = payment.failureReason ?? null;
    dto.refundedAt = payment.refundedAt ?? null;
    dto.createdAt = payment.createdAt;
    dto.updatedAt = payment.updatedAt;
    return dto;
  }
}
