import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Embedded sub-document for a cart's line items (DATABASE_DESIGN.md §4.5).
 * No independent existence outside its parent Cart document — never a
 * standalone collection, same rationale as users/schemas/address.schema.ts.
 */
@Schema({ _id: false })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  /**
   * Snapshot of the effective selling price at the moment the item was
   * added (or last updated) — protects the customer from a mid-session
   * price change, reconciled again at checkout (DATABASE_DESIGN.md §4.5).
   */
  @Prop({ required: true, min: 0 })
  priceAtAdd!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
