import { Prop, SchemaFactory } from '@nestjs/mongoose';

/**
 * Embedded sub-document for a user's saved shipping addresses
 * (DATABASE_DESIGN.md §4.1). No independent existence outside its parent
 * User document — never a standalone collection.
 */
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
