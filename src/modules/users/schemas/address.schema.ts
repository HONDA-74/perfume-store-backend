import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Embedded sub-document for a user's saved shipping addresses
 * (DATABASE_DESIGN.md §4.1). No independent existence outside its parent
 * User document — never a standalone collection.
 *
 * @Schema({ _id: true }) is required so SchemaFactory.createForClass picks
 * up the @Prop decorators on this class (same fix applied to
 * product-notes.schema.ts, cart-item.schema.ts, and wishlist-item.schema.ts —
 * absence causes Mongoose to silently ignore nested @Prop metadata, making
 * fields unhydratable when documents are read back after a raw insert).
 * _id: true retains the auto-generated ObjectId that address CRUD endpoints
 * depend on for identifying individual addresses.
 */
@Schema({ _id: true })
export class Address {
  @Prop()
  label?: string;

  @Prop({ required: true })
  recipientName!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  country!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  street!: string;

  @Prop()
  postalCode?: string;

  @Prop({ default: false })
  isDefault!: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
