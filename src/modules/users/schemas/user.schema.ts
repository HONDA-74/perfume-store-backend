import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../common/types/enums/role.enum';
import { BaseSchema } from '../../../database/base/base.schema';
import { Address, AddressSchema } from './address.schema';

export type UserDocument = User & Document;

/**
 * `users` collection (DATABASE_DESIGN.md §4.1). Represents both the single
 * seeded Admin and every Customer — `role` is the sole differentiator.
 *
 * @Schema() is required on the leaf class so that SchemaFactory.createForClass
 * picks up @Prop metadata declared on this class — the same requirement as
 * Product, Category, Brand, Cart, etc. (all of which have their own @Schema
 * decorator). BaseSchema's @Schema provides the shared timestamps/toJSON
 * options; this override adds the collection-specific versionKey/id settings
 * and ensures @Prop decorators on User's own fields are registered.
 *
 * `passwordHash` uses `select: false` so it is never returned by a default
 * query/response — it must be explicitly requested via `.select('+passwordHash')`
 * (DATABASE_DESIGN.md §4.1 "Never exposed").
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
export class User extends BaseSchema {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  fullName!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop()
  phone?: string;

  @Prop({ type: String, enum: Role, default: Role.CUSTOMER })
  role!: Role;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Address[];

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
