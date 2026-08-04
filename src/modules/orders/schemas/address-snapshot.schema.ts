import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Embedded, permanent copy of the address at checkout time
 * (DATABASE_DESIGN.md §4.7 — "identical shape to the Address sub-schema in
 * Section 4.1, copied by value, not by reference"). Deliberately does NOT
 * import `modules/users/schemas/address.schema.ts` — cross-module schema
 * imports are forbidden (SYSTEM_ARCHITECTURE.md §4.3); this is a
 * structurally-identical, module-local schema instead, matching the
 * `*EntityLike` convention used everywhere else for structural typing.
 */
@Schema({ _id: false })
export class AddressSnapshot {
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

export const AddressSnapshotSchema = SchemaFactory.createForClass(AddressSnapshot);
