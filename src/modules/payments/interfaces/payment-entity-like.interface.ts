import { PaymentEntityStatus, PaymentProvider } from '../constants/payments.constants';

/**
 * Structural shape accepted by PaymentResponseDto.fromEntity — mirrors the
 * pattern established by OrderEntityLike / CartEntityLike / WishlistEntityLike.
 *
 * Matches both a full Mongoose Document (virtual `id` getter) and a `.lean()`
 * plain object (only `_id`). No schema import — pure TypeScript structural
 * typing (SYSTEM_ARCHITECTURE.md §1.2 / §4.3).
 */
export interface PaymentEntityLike {
  id?: string;
  _id?: { toString(): string };
  orderId: { toString(): string };
  userId: { toString(): string };
  paymentIntentId: string;
  provider: PaymentProvider;
  status: PaymentEntityStatus;
  currency: string;
  amount: number;
  transactionId?: string | null;
  failureReason?: string | null;
  refundedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
