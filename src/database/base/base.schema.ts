import { Prop, Schema } from '@nestjs/mongoose';

/**
 * Shared persistence contract extended by every feature schema
 * (DATABASE_DESIGN.md §7 — Audit Fields; AI_RULES.md §12 Schema Rules).
 *
 * Provides:
 * - `timestamps: true` → createdAt / updatedAt
 * - `isDeleted` / `deletedAt` → soft-delete fields (DATABASE_DESIGN.md §6)
 * - `toJSON` transform → strips `__v`, renames `_id` to `id`
 *
 * This class is not a standalone collection. Feature modules extend it
 * when defining their own schema (e.g. `class Product extends BaseSchema`),
 * per SYSTEM_ARCHITECTURE.md §3 (`database/base/base.schema.ts`).
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
export class BaseSchema {
  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  deletedAt!: Date | null;
}
