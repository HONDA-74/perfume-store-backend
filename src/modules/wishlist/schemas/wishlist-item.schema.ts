import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Embedded sub-document for a wishlist's saved products (DATABASE_DESIGN.md
 * §4.6). No independent existence outside its parent Wishlist document —
 * never a standalone collection, same rationale as cart/schemas/cart-item.schema.ts.
 *
 * @Schema({ _id: false }) is required so SchemaFactory.createForClass picks
 * up the @Prop decorators on this class (same fix applied to
 * product-notes.schema.ts and cart-item.schema.ts — absence causes Mongoose
 * to silently ignore nested @Prop metadata, dropping the addedAt field).
 */
@Schema({ _id: false })
export class WishlistItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  /** Defaults to insertion time (DATABASE_DESIGN.md §4.6). */
  @Prop({ type: Date, required: true, default: Date.now })
  addedAt!: Date;
}

export const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);
