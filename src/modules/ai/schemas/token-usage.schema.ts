import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type TokenUsageDocument = TokenUsage & Document;

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
export class TokenUsage extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  requestId!: string;

  @Prop({ required: true })
  modelName!: string;

  @Prop({ required: true })
  promptTokens!: number;

  @Prop({ required: true })
  completionTokens!: number;

  @Prop({ required: true })
  totalTokens!: number;

  @Prop({ required: true })
  estimatedCost!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TokenUsageSchema = SchemaFactory.createForClass(TokenUsage);
TokenUsageSchema.index({ userId: 1 });
TokenUsageSchema.index({ requestId: 1 });
TokenUsageSchema.index({ createdAt: -1 });
