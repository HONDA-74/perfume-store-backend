import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type CategoryDocument = Category & Document;

/**
 * `categories` collection (DATABASE_DESIGN.md §4.2). Classifies products
 * into browsable groups (e.g. Eau de Parfum, Gift Sets).
 *
 * Extends `BaseSchema` without redeclaring `@Schema(...)`, inheriting
 * `timestamps`/`toJSON` via the prototype chain — the same pattern used by
 * `modules/users/schemas/user.schema.ts` and
 * `modules/auth/schemas/refresh-token.schema.ts`.
 *
 * Categories is a foundational leaf module (SYSTEM_ARCHITECTURE.md §4.2):
 * this schema is never imported by another module directly — cross-module
 * access, once Products exists, must go through `CategoriesService`
 * (exported by `CategoriesModule`).
 */
export class Category extends BaseSchema {
  @Prop({ required: true, unique: true, trim: true, minlength: 2, maxlength: 60 })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
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
