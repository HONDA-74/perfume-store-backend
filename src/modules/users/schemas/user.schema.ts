import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../common/types/enums/role.enum';
import { BaseSchema } from '../../../database/base/base.schema';
import { Address, AddressSchema } from './address.schema';

export type UserDocument = User & Document;

/**
 * `users` collection (DATABASE_DESIGN.md §4.1). Represents both the single
 * seeded Admin and every Customer — `role` is the sole differentiator.
 *
 * Deliberately does NOT redeclare its own `@Schema(...)` decorator: it
 * extends `BaseSchema` and inherits that class's `timestamps`/`toJSON`
 * metadata via the prototype chain, exactly as instructed in
 * `database/base/base.schema.ts`'s own doc comment
 * ("Feature modules extend it ... e.g. `class Product extends BaseSchema`").
 *
 * `passwordHash` uses `select: false` so it is never returned by a default
 * query/response — it must be explicitly requested via `.select('+passwordHash')`
 * (DATABASE_DESIGN.md §4.1 "Never exposed").
 */
export class User extends BaseSchema {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
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
