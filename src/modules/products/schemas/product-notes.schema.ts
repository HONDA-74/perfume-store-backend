import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Embedded fragrance-notes object (DATABASE_DESIGN.md §4.4). No independent
 * existence outside its parent Product document — never a standalone
 * collection, same rationale as modules/users/schemas/address.schema.ts.
 */
@Schema({ _id: false })
export class ProductNotes {
  @Prop({ type: [String], default: [] })
  top!: string[];

  @Prop({ type: [String], default: [] })
  middle!: string[];

  @Prop({ type: [String], default: [] })
  base!: string[];
}

export const ProductNotesSchema = SchemaFactory.createForClass(ProductNotes);
