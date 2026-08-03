import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type BrandDocument = Brand & Document;

/**
 * `brands` collection (DATABASE_DESIGN.md §4.3). Represents a perfume
 * house/manufacturer (e.g. Chanel, Dior, Creed).
 *
 * Structurally near-identical to `Category` (DATABASE_DESIGN.md §4.2) —
 * built alongside it per IMPLEMENTATION_PLAN.md M4, with its own explicit
 * `@Schema(...)` decorator (same pattern as `category.schema.ts`) rather
 * than relying on `BaseSchema`'s prototype-chain inheritance, keeping the
 * two foundational collections consistent with each other.
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
export class Brand extends BaseSchema {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop()
  logoUrl?: string;

  @Prop({ trim: true })
  countryOfOrigin?: string;

  /**
   * Default `true`. Doubles as the storefront-visibility flag — inactive
   * brands are hidden from public listing but the document persists for
   * referential integrity (DATABASE_DESIGN.md §6), identical rationale to
   * `Category.isActive`.
   */
  @Prop({ default: true })
  isActive!: boolean;

  createdAt!: Date;

  updatedAt!: Date;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);

// Intentional, named indexes per DATABASE_DESIGN.md §5 — each serves a
// real query path (public slug lookup; duplicate-name prevention).
BrandSchema.index({ slug: 1 }, { unique: true });
BrandSchema.index({ name: 1 }, { unique: true });
