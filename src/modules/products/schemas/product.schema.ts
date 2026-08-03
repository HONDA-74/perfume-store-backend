import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { BaseSchema } from '../../../database/base/base.schema';
import { ProductConcentration } from '../enums/product-concentration.enum';
import { ProductNotes, ProductNotesSchema } from './product-notes.schema';

export type ProductDocument = Product & Document;

/**
 * `products` collection (DATABASE_DESIGN.md §4.4). The core sellable
 * entity — the highest-read-traffic collection in the system.
 *
 * Structurally follows Category/Brand (categories/schemas/category.schema.ts,
 * brands/schemas/brand.schema.ts): its own explicit `@Schema(...)` decorator
 * rather than BaseSchema's prototype-chain inheritance, plus the identical
 * `toJSON` transform (strip `__v`, rename `_id` → `id`).
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
export class Product extends BaseSchema {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 150 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ required: true, trim: true, uppercase: true })
  sku!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Brand', required: true })
  brandId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, min: 0.01 })
  price!: number;

  @Prop({ min: 0 })
  discountPrice?: number;

  @Prop({ required: true, min: 0, default: 0 })
  stockQuantity!: number;

  @Prop({ type: String, enum: PerfumeGender, required: true })
  gender!: PerfumeGender;

  @Prop({ type: String, enum: ProductConcentration })
  concentration?: ProductConcentration;

  @Prop()
  sizeMl?: number;

  @Prop({ type: ProductNotesSchema })
  notes?: ProductNotes;

  @Prop({ type: [String], default: [] })
  images!: string[];

  /**
   * Default `true`. Controls storefront visibility — inactive products are
   * hidden from public listing but the document persists for referential
   * integrity (historical Orders.items[].productId), per DATABASE_DESIGN.md §6.
   */
  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isFeatured!: boolean;

  /** Reserved for the future Reviews module — not populated until then. */
  @Prop({ default: 0 })
  ratingAverage!: number;

  @Prop({ default: 0 })
  ratingCount!: number;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Intentional, named indexes per DATABASE_DESIGN.md §4.4/§5 — each serves a
// real, documented query path (no speculative indexes, per §7 YAGNI).
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ sku: 1 }, { unique: true });
ProductSchema.index({ categoryId: 1, brandId: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
