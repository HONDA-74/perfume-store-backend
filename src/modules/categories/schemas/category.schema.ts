import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type CategoryDocument = Category & Document;

/**
 * `categories` collection (DATABASE_DESIGN.md §4.2). Classifies products
 * into browsable groups (e.g. Eau de Parfum, Gift Sets).
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
export class Category extends BaseSchema {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop()
  imageUrl?: string;

  /**
   * Default `true`. Doubles as the storefront-visibility flag: inactive
   * categories are hidden from public listing but the document persists
   * for referential integrity (DATABASE_DESIGN.md §6).
   */
  @Prop({ default: true })
  isActive!: boolean;

  createdAt!: Date;

  updatedAt!: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Intentional, named indexes per DATABASE_DESIGN.md §5 — each serves a
// real query path (public slug lookup; duplicate-name prevention).
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ name: 1 }, { unique: true });
