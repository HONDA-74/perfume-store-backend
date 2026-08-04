import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';
import { PaymentEntityStatus, PaymentProvider } from '../constants/payments.constants';

export type PaymentDocument = Payment & Document;

/**
 * `payments` collection (IMPLEMENTATION_PLAN.md M12 / DATABASE_DESIGN.md §7).
 *
 * Extends `BaseSchema` for structural consistency (timestamps, isDeleted,
 * toJSON transform). Payments are an audit record — they are never hard-deleted
 * and soft-delete (`isDeleted`) is reserved for future admin tooling.
 *
 * Key design decisions:
 * - `paymentIntentId` carries a unique index — this is the primary idempotency
 *   key. On duplicate webhook delivery, PaymentsService short-circuits if
 *   the status is already SUCCEEDED/REFUNDED (no re-processing).
 * - `orderId` + `userId` are ObjectId refs stored as Types.ObjectId — we
 *   never import Order/User schemas from other modules; these are just foreign
 *   keys (SYSTEM_ARCHITECTURE.md §4.3).
 * - `amount` is stored in the smallest currency unit (e.g. cents for USD)
 *   to match the Stripe convention and avoid floating-point rounding issues.
 */
@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Payment extends BaseSchema {
  /** ObjectId of the associated Order. Stored as a foreign key — no populate. */
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  /** ObjectId of the customer who initiated the payment. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /**
   * Stripe PaymentIntent ID (pi_*). Unique — used as the primary
   * idempotency key for webhook deduplication.
   */
  @Prop({ required: true, trim: true })
  paymentIntentId!: string;

  @Prop({ type: String, enum: PaymentProvider, required: true, default: PaymentProvider.STRIPE })
  provider!: PaymentProvider;

  @Prop({
    type: String,
    enum: PaymentEntityStatus,
    required: true,
    default: PaymentEntityStatus.PENDING,
  })
  status!: PaymentEntityStatus;

  /** ISO 4217 currency code, lowercase (e.g. 'usd'). */
  @Prop({ required: true, lowercase: true, trim: true })
  currency!: string;

  /**
   * Amount in the smallest currency unit (cents for USD, piastres for EGP).
   * Stored as an integer — Stripe's convention — to avoid floating-point issues.
   */
  @Prop({ required: true, min: 0 })
  amount!: number;

  /**
   * Stripe Charge ID (ch_*) or PaymentIntent ID once the charge is captured.
   * Populated after the `payment_intent.succeeded` webhook is processed.
   */
  @Prop({ type: String, default: null })
  transactionId?: string | null;

  /** Human-readable failure message from the Stripe event. */
  @Prop({ type: String, default: null })
  failureReason?: string | null;

  /** Timestamp when the refund was issued — populated by the refund flow. */
  @Prop({ type: Date, default: null })
  refundedAt?: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Unique index on paymentIntentId — primary idempotency guard.
PaymentSchema.index({ paymentIntentId: 1 }, { unique: true });

// Query indexes for admin tooling and per-user payment history.
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: -1 });
