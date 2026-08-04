import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Embedded sub-document for an order's line items (DATABASE_DESIGN.md
 * §4.7). Unlike Cart/Wishlist items, this is a permanent historical
 * snapshot: `nameSnapshot`/`priceSnapshot` must never change even if the
 * underlying Product is later renamed, repriced, or deleted.
 * `productId` is kept only for traceability — never dereferenced for
 * display (DATABASE_DESIGN.md §4.7).
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nameSnapshot!: string;

  @Prop({ required: true, min: 0 })
  priceSnapshot!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  lineTotal!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
