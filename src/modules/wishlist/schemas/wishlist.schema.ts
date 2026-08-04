import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';
import { WishlistItem, WishlistItemSchema } from './wishlist-item.schema';

export type WishlistDocument = Wishlist & Document;

/**
 * `wishlists` collection (DATABASE_DESIGN.md §4.6). One wishlist per
 * customer, embedded items — same rationale as Cart (DATABASE_DESIGN.md
 * §4.5): only a product reference and timestamp are needed; wishlist items
 * carry no independent lifecycle.
 *
 * Extends `BaseSchema` for structural consistency with every other
 * collection (DATABASE_DESIGN.md §7 Audit Fields), even though soft delete
 * does not apply operationally to wishlists (DATABASE_DESIGN.md §6 — same
 * "Not applicable... ephemeral by nature" rationale as Carts). No Wishlist
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
export class Wishlist extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: [WishlistItemSchema], default: [] })
  items!: WishlistItem[];

  createdAt!: Date;

  updatedAt!: Date;
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);

// Intentional, named index per DATABASE_DESIGN.md §5 — guarantees exactly
// one wishlist document per customer.
WishlistSchema.index({ userId: 1 }, { unique: true });
