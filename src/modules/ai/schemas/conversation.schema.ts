import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type ConversationDocument = Conversation & Document;

@Schema({ _id: false })
export class ConversationMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;
}
export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessage);

@Schema({ _id: false })
export class ConversationPreferences {
  @Prop({ type: [String], default: [] })
  likedNotes!: string[];

  @Prop({ type: [String], default: [] })
  dislikedNotes!: string[];

  @Prop()
  preferredGender?: string;

  @Prop()
  preferredSeason?: string;

  @Prop()
  preferredOccasion?: string;
}
export const ConversationPreferencesSchema = SchemaFactory.createForClass(ConversationPreferences);

/**
 * `aiconversations` collection — multi-turn chat memory (IMPLEMENTATION_PLAN.md
 * M11 "Conversation Memory"). One document per conversation thread, owned
 * by a single customer.
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
export class Conversation extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: [ConversationMessageSchema], default: [] })
  messages!: ConversationMessage[];

  @Prop({ type: ConversationPreferencesSchema, default: () => ({}) })
  preferences!: ConversationPreferences;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ userId: 1, updatedAt: -1 });
