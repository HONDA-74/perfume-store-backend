import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';
import { CartItem, CartItemSchema } from './cart-item.schema';

export type CartDocument = Cart & Document;

/**
 * `carts` collection (DATABASE_DESIGN.md §4.5). Exactly one active cart per
 * customer, modeled as a single document with an embedded items array —
 * carts are always read/written as a whole, never queried item-by-item
 * independently, so embedding is the correct pattern here.
 *
 * Extends `BaseSchema` for structural consistency with every other
 * collection (DATABASE_DESIGN.md §7 Audit Fields), even though soft delete
 * does not apply operationally to carts (DATABASE_DESIGN.md §6 — "Not
 * applicable... a disposable, session-like working document"). No Cart
 * endpoint ever reads or sets `isDeleted`/`deletedAt`.
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
export class Cart extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items!: CartItem[];

  createdAt!: Date;

  updatedAt!: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

// Intentional, named index per DATABASE_DESIGN.md §5 — guarantees exactly
// one cart document per customer and serves the cart-retrieval lookup on
// every authenticated cart request.
CartSchema.index({ userId: 1 }, { unique: true });
