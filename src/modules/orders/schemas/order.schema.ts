import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import { BaseSchema } from '../../../database/base/base.schema';
import { AddressSnapshot, AddressSnapshotSchema } from './address-snapshot.schema';
import { OrderItem, OrderItemSchema } from './order-item.schema';

export type OrderDocument = Order & Document;

/**
 * `orders` collection (DATABASE_DESIGN.md §4.7). An immutable-by-design
 * record of a completed checkout — the one collection where embedding
 * with data duplication (OrderItem snapshots, AddressSnapshot) is
 * intentional and required, not just convenient.
 *
 * Extends `BaseSchema` for structural consistency with every other
 * collection (DATABASE_DESIGN.md §7), but `isDeleted`/`deletedAt` are
 * never set by any endpoint — Orders have no hard or soft delete
 * (DATABASE_DESIGN.md §6: "Orders are a financial/audit record... never
 * deleted, soft or otherwise").
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
export class Order extends BaseSchema {
  /** Human-readable, unique, generated server-side (e.g. ORD-2026-000123). */
  @Prop({ required: true, trim: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ type: AddressSnapshotSchema, required: true })
  shippingAddress!: AddressSnapshot;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  /** Reserved for the future Coupons module — currently always 0. */
  @Prop({ default: 0, min: 0 })
  discountTotal!: number;

  @Prop({ default: 0, min: 0 })
  shippingFee!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ type: String, enum: OrderStatus, required: true, default: OrderStatus.PENDING })
  status!: OrderStatus;

  /** Reserved for the future Payments module — currently always UNPAID. */
  @Prop({ type: String, enum: PaymentStatus, required: true, default: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @Prop({ type: Date, required: true, default: Date.now })
  placedAt!: Date;

  /** Populated only if `status = CANCELLED` (DATABASE_DESIGN.md §4.7). */
  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Intentional, named indexes per DATABASE_DESIGN.md §4.7/§5 — each serves
// a real, documented query path (no speculative indexes, per §7 YAGNI).
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

/*
 * Partial unique index on { userId, status: PENDING } — prevents the same
 * customer from creating two simultaneous PENDING orders via rapid double-
 * submit (e.g., the user clicks Checkout twice before the first response
 * arrives). Only one PENDING order per customer is permitted; the unique
 * constraint is lifted as soon as the order moves to any other status, so
 * a customer can place another order after the first is confirmed/shipped.
 *
 * partialFilterExpression scopes the uniqueness to PENDING only — other
 * statuses are intentionally excluded so a customer can have multiple
 * historical (CONFIRMED/SHIPPED/DELIVERED/CANCELLED) orders simultaneously.
 */
OrderSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
    name: 'unique_pending_order_per_user',
  },
);
