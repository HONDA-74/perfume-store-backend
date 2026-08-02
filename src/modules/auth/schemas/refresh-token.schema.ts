import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type RefreshTokenDocument = RefreshToken & Document;

/**
 * `refreshtokens` collection (DATABASE_DESIGN.md §4.8). Owned by the Auth
 * module — enables refresh-token rotation and server-side revocation.
 *
 * Extends `BaseSchema` without redeclaring `@Schema(...)`, inheriting
 * `timestamps`/`toJSON` via the prototype chain (same pattern as
 * `modules/users/schemas/user.schema.ts`). Mongoose auto-pluralizes the
 * model name `RefreshToken` to the collection name `refreshtokens`,
 * matching DATABASE_DESIGN.md without needing an explicit `collection`
 * option.
 *
 * `tokenHash` is a deterministic SHA-256 digest of the raw refresh token
 * (not bcrypt) — the schema's own index on `tokenHash` (below) exists
 * specifically to serve a direct, indexed lookup on refresh, which a
 * salted bcrypt hash cannot support.
 */
export class RefreshToken extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  isRevoked!: boolean;

  @Prop()
  userAgent?: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ tokenHash: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
